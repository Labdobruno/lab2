/* Pessoas no banco: carrega a coorte do funil principal (negócios novos criados no período) com alcance, datas de entrada por etapa,
   dono, canal e segmento, e roda o motor puro de pessoas. Só SELECT. */
import type { Sql } from 'postgres';
import { somarDias, type Operacao } from '@lab/planejamento';
import { alertas, calcularPessoas, drillCompleto, fonteDe, gargalos, leadsDaEtapa, matriz, metaReversa, pontosFortes, potencial, sensibilidade, transferencia, type Encerrado, type Funil, type NegocioPessoa, type Pessoas } from './pessoas.js';

export class ErroDePessoas extends Error { constructor(m: string, readonly status = 400) { super(m); } }
export interface EtapaPessoas { id: string; chave: string; nome: string; papel: string }

export async function etapasPrincipais(sql: Sql, op: Operacao): Promise<EtapaPessoas[]> {
  const [funil] = await sql<{ id: string }[]>`select id from lab.funil where operacao_id = ${op.id} and principal limit 1`;
  if (!funil) throw new ErroDePessoas('a operação não tem funil principal', 409);
  return sql<EtapaPessoas[]>`select id, chave, nome, papel from lab.etapa where funil_id = ${funil.id} and ativa and papel <> 'perdido' order by ordem`;
}
/* a coorte: negócios novos do funil principal criados em [de, ate]; entrouEm[i] = primeira transição para a etapa i (etapa 0 = criação) */
export async function coortePessoas(sql: Sql, op: Operacao, E: EtapaPessoas[], de: string, ate: string): Promise<NegocioPessoa[]> {
  const pos = new Map(E.map((e, i) => [e.id, i])), n = E.length - 1;
  const L = await sql<any[]>`
    select n.id, n.dono_id, p.nome as dono, c.chave as canal, k.nome as conta, k.segmento, n.status, n.etapa_id, n.valor_fechado, n.valor_estimado, n.criado_em, n.fechado_em, e.nome as etapa_nome,
           coalesce((select jsonb_agg(jsonb_build_object('e', t.para_etapa_id, 'em', t.em)) from lab.negocio_transicao t where t.negocio_id = n.id), '[]'::jsonb) as trans
    from lab.negocio n join lab.etapa e on e.id = n.etapa_id join lab.funil f on f.id = n.funil_id
      left join lab.canal c on c.id = n.canal_id left join lab.pessoa p on p.id = n.dono_id left join lab.conta k on k.id = n.conta_id
    where n.operacao_id = ${op.id} and n.tipo = 'novo' and f.principal
      and (n.criado_em at time zone ${op.fuso})::date >= ${de}::date and (n.criado_em at time zone ${op.fuso})::date <= ${ate}::date`;
  return L.map(l => {
    const criado = Date.parse(l.criado_em), entrou: Array<number | null> = E.map(() => null); entrou[0] = criado; let al = 0;
    for (const t of l.trans as Array<{ e: string; em: string }>) { const i = pos.get(t.e); if (i == null) continue; const em = Date.parse(t.em); if (entrou[i] == null || em < entrou[i]!) entrou[i] = em; if (i > al) al = i; }
    const atual = pos.get(l.etapa_id); if (atual != null && atual > al) al = atual;
    if (l.status === 'ganho') { al = n; if (entrou[n] == null) entrou[n] = l.fechado_em ? Date.parse(l.fechado_em) : criado; }
    for (let i = 1; i <= al; i++) if (entrou[i] == null) entrou[i] = entrou[i - 1] ?? null;   // salto conta como passagem pelas anteriores
    return { id: l.id, nome: l.conta ?? null, pessoa: l.dono ?? null, pessoaId: l.dono_id ?? null, canal: l.canal ?? null, segmento: l.segmento ?? null, criadoEm: criado, fechadoEm: l.fechado_em ? Date.parse(l.fechado_em) : null, status: l.status, alcance: al, entrouEm: entrou, valor: l.valor_fechado != null ? Number(l.valor_fechado) : l.valor_estimado != null ? Number(l.valor_estimado) : null, etapaAtual: l.etapa_nome } as NegocioPessoa & { pessoaId: string | null };
  });
}
/* encerrados do último ano (para anomalia e tendência do ticket): não dependem do período da coorte */
export async function encerradosPessoas(sql: Sql, op: Operacao, ate: string): Promise<Encerrado[]> {
  const L = await sql<any[]>`select p.nome as dono, n.status, n.fechado_em, n.valor_fechado from lab.negocio n join lab.funil f on f.id = n.funil_id left join lab.pessoa p on p.id = n.dono_id
    where n.operacao_id = ${op.id} and n.tipo = 'novo' and f.principal and n.status <> 'aberto' and n.fechado_em is not null and n.fechado_em >= ${somarDias(ate, -365)}::date and n.fechado_em < ${somarDias(ate, 1)}::date`;
  return L.map(l => ({ pessoa: l.dono ?? null, status: l.status, fechadoEm: Date.parse(l.fechado_em), valor: l.valor_fechado == null ? null : Number(l.valor_fechado) }));
}
const DATA = /^\d{4}-\d{2}-\d{2}$/;
export function periodoPessoas(op: Operacao, de: unknown, ate: unknown, hoje: string) {
  const a = typeof de === 'string' && DATA.test(de) ? de : somarDias(hoje, -op.janelaHistoricaDias), b = typeof ate === 'string' && DATA.test(ate) ? ate : hoje;
  if (a > b) throw new ErroDePessoas('"de" deve ser anterior a "ate"');
  return { de: a, ate: b };
}
export async function carregarPessoas(sql: Sql, op: Operacao, de: string, ate: string, minN = 5): Promise<{ X: Pessoas; E: EtapaPessoas[] }> {
  const E = await etapasPrincipais(sql, op);
  if (E.length < 2) throw new ErroDePessoas('o funil principal precisa de ao menos duas etapas', 409);
  const coorte = await coortePessoas(sql, op, E, de, ate);
  return { X: calcularPessoas(coorte, E.map(e => e.nome), minN), E };
}
const resumoFunil = (F: Funil) => ({ N: F.N, conv: F.conv, perdas: F.perdas, tempo: F.tempo, tempoN: F.tempoN, valorEt: F.valorEt, vendas: F.vendas, receita: F.receita, ticket: F.ticket, nTicket: F.nTicket, ciclo: F.ciclo, total: F.total, n: F.pop.length });
/* o painel inteiro: equipe, pessoas, benchmark, gargalos, alertas, matriz, potencial por pessoa */
export async function painelPessoas(sql: Sql, op: Operacao, de: string, ate: string, agora = Date.now(), minN = 5) {
  const { X, E } = await carregarPessoas(sql, op, de, ate, minN);
  const enc = await encerradosPessoas(sql, op, ate);
  const pessoas = X.vends.map(v => { const F = X.porV[v]!, P = potencial(F, X.bench, X.ticketMediano); return { nome: v, funil: resumoFunil(F), potencial: P, potencialTotal: P.reduce((s, p) => s + p.ganho, 0), fortes: pontosFortes(X, v), gargalos: P.filter(p => p.ganho > 0).sort((a, b) => b.ganho - a.ganho) }; });
  const G = gargalos(X);
  return {
    periodo: { de, ate }, etapas: E.map(e => ({ chave: e.chave, nome: e.nome, papel: e.papel })), minN: X.minN, ticketMediano: X.ticketMediano, coorte: X.coorte.length, semDono: X.coorte.filter(d => !d.pessoa).length,
    equipe: resumoFunil(X.equipe), bench: X.bench, pessoas, gargalos: G, principal: G[0] && G[0].total > 0 ? G[0] : null, potencialTotal: G.reduce((s, g) => s + g.total, 0),
    alertas: alertas(X, enc, agora), matriz: matriz(X), sensibilidade: sensibilidade(X, X.equipe),
    comparacoes: ['equipe', 'mediana', 'p75', ...X.vends],
  };
}
export async function compararPessoa(sql: Sql, op: Operacao, de: string, ate: string, v: string, cmp: string, minN = 5) {
  const { X } = await carregarPessoas(sql, op, de, ate, minN); const F = X.porV[v]; if (!F) throw new ErroDePessoas('pessoa sem negócios na coorte', 404);
  const fonte = fonteDe(X, cmp); if (!fonte) throw new ErroDePessoas('comparação desconhecida', 404);
  return { pessoa: v, funil: resumoFunil(F), fonte, fortes: pontosFortes(X, v), potencial: potencial(F, X.bench, X.ticketMediano), sensibilidade: sensibilidade(X, F), bench: X.bench, E: X.E };
}
export async function transferirPerformance(sql: Sql, op: Operacao, de: string, ate: string, a: string, b: string, marcadas: unknown, minN = 5) {
  const { X } = await carregarPessoas(sql, op, de, ate, minN);
  const T = transferencia(X, a, b, Array.isArray(marcadas) ? marcadas.filter((m): m is string => typeof m === 'string') : []); if (!T) throw new ErroDePessoas('pessoa ou fonte desconhecida', 404);
  return T;
}
export async function drillPessoas(sql: Sql, op: Operacao, de: string, ate: string, i: number, foco: string | null, minN = 5) {
  const { X } = await carregarPessoas(sql, op, de, ate, minN); if (!Number.isInteger(i) || i < 0 || i >= X.E.length - 1) throw new ErroDePessoas('etapa inválida');
  return drillCompleto(X, i, foco);
}
export async function leadsPessoas(sql: Sql, op: Operacao, de: string, ate: string, i: number, foco: string | null, minN = 5) {
  const { X } = await carregarPessoas(sql, op, de, ate, minN); if (!Number.isInteger(i) || i < 0 || i >= X.E.length) throw new ErroDePessoas('etapa inválida');
  const F = foco ? X.porV[foco] : X.equipe; if (!F) throw new ErroDePessoas('pessoa sem negócios na coorte', 404);
  const L = leadsDaEtapa(F, i); return { ...L, leads: L.leads.slice(0, 500) };
}
export async function metaReversaPessoas(sql: Sql, op: Operacao, de: string, ate: string, meta: number, foco: string | null, minN = 5) {
  const { X } = await carregarPessoas(sql, op, de, ate, minN); const F = foco ? X.porV[foco] : X.equipe; if (!F) throw new ErroDePessoas('pessoa sem negócios na coorte', 404);
  return metaReversa(F, meta, X.ticketMediano);
}
