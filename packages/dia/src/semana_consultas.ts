/* Semana com os dados da V2: o relatório da semana passada e a projeção desta semana.
   Medidas por semana de segunda a domingo a partir da fonte única (realizados) e dos negócios (leads criados, perdidos, vendas por canal). */
import type { Sql } from 'postgres';
import { cicloDaOperacao, diaDaSemana, metasVigentes, realizados, somarDias, type Operacao } from '@lab/planejamento';
import { metasDaOperacao } from './ciclo.js';
import { brl } from './objetivos.js';
import { ELO, FLUXO, NOME_SITUACAO_SEMANA, ROTEIRO, VERSAO_SEMANA, cascataReceita, fracaoDoDia, julgarSemana, metaDaSemana, projetarSemana, variacaoTxt, type DefIndicador, type Julgamento } from './semana.js';
import { agoraLocal } from './fechamento.js';

export const INDICADORES_SEMANA: DefIndicador[] = [
  { k: 'leads', nome: 'Leads (negócios novos)', un: 'n', aditiva: true }, { k: 'tentativa', nome: 'Tentativas de contato', un: 'n', aditiva: true }, { k: 'contato', nome: 'Contatos efetivos', un: 'n', aditiva: true },
  { k: 'agendamento', nome: 'Reuniões agendadas', un: 'n', aditiva: true }, { k: 'f:agl', nome: FLUXO['f:agl']!.nome, un: '%', aditiva: false },
  { k: 'reuniao_realizada', nome: 'Reuniões realizadas', un: 'n', aditiva: true }, { k: 'f:opr', nome: FLUXO['f:opr']!.nome, un: '%', aditiva: false },
  { k: 'oportunidades', nome: 'Oportunidades', un: 'n', aditiva: true }, { k: 'proposta_enviada', nome: 'Propostas enviadas', un: 'n', aditiva: true }, { k: 'f:vop', nome: FLUXO['f:vop']!.nome, un: '%', aditiva: false },
  { k: 'vendas', nome: 'Vendas', un: 'n', aditiva: true }, { k: 'receita', nome: 'Receita', un: 'R$', aditiva: true }, { k: 'ticket', nome: 'Ticket médio', un: 'R$', aditiva: false }, { k: 'perdidos', nome: 'Negócios perdidos', un: 'n', aditiva: true, menorMelhor: true },
];
const GRUPO: Record<string, string> = { leads: 'Pré-vendas', tentativa: 'Pré-vendas', contato: 'Pré-vendas', agendamento: 'Pré-vendas', 'f:agl': 'Pré-vendas', reuniao_realizada: 'Vendas', 'f:opr': 'Vendas', oportunidades: 'Vendas', proposta_enviada: 'Vendas', 'f:vop': 'Vendas', vendas: 'Vendas', receita: 'Vendas', ticket: 'Vendas', perdidos: 'Vendas' };
export const fmtSemana = (un: DefIndicador['un'], v: number | null | undefined, curto = false) => (v == null || !isFinite(v) ? '—' : un === 'R$' ? (curto && Math.abs(v) >= 1000 ? 'R$ ' + (Math.round(v / 100) / 10).toLocaleString('pt-BR') + ' mil' : brl(v)) : un === '%' ? Math.round(v * 100) + '%' : Math.abs(v) < 10 && Math.abs(v - Math.round(v)) > 0.05 ? (Math.round(v * 10) / 10).toLocaleString('pt-BR') : String(Math.round(v)));

/* segunda-feira da semana que contém a data */
export const segundaDe = (iso: string) => somarDias(iso, -((diaDaSemana(iso) + 6) % 7));

/* os eventos brutos do período, por dia, pessoa e canal: a base de toda medida da semana */
interface Evento { dia: string; k: string; v: number; pessoa: string | null; canal: string | null }
async function eventos(sql: Sql, op: Operacao, de: string, ate: string): Promise<Evento[]> {
  const [reals, negs, lancs] = await Promise.all([
    realizados(sql, op, de, ate),
    sql<any[]>`select n.id, (n.criado_em at time zone ${op.fuso})::date::text as criado, (n.fechado_em at time zone ${op.fuso})::date::text as fechado, n.status, n.dono_id, c.chave as canal, coalesce(n.valor_fechado, 0) as valor
      from lab.negocio n join lab.funil f on f.id = n.funil_id left join lab.canal c on c.id = n.canal_id
      where n.operacao_id = ${op.id} and f.principal and n.tipo = 'novo' and (((n.criado_em at time zone ${op.fuso})::date >= ${de}::date and (n.criado_em at time zone ${op.fuso})::date < ${ate}::date) or (n.status <> 'aberto' and (n.fechado_em at time zone ${op.fuso})::date >= ${de}::date and (n.fechado_em at time zone ${op.fuso})::date < ${ate}::date))`,
    sql<any[]>`select pessoa_id, data::text, indicador, delta from lab.lancamento where operacao_id = ${op.id} and data >= ${de}::date and data < ${ate}::date`,
  ]);
  const out: Evento[] = reals.filter(r => r.indicador !== 'vendas' && r.indicador !== 'receita').map(r => ({ dia: r.dia, k: r.indicador, v: r.quantidade, pessoa: r.pessoaId, canal: null }));
  for (const l of lancs) out.push({ dia: l.data, k: l.indicador, v: Number(l.delta), pessoa: l.pessoa_id, canal: null });
  for (const n of negs) {
    if (n.criado >= de && n.criado < ate) out.push({ dia: n.criado, k: 'leads', v: 1, pessoa: n.dono_id, canal: n.canal });
    if (n.status === 'ganho' && n.fechado && n.fechado >= de && n.fechado < ate) { out.push({ dia: n.fechado, k: 'vendas', v: 1, pessoa: n.dono_id, canal: n.canal }); out.push({ dia: n.fechado, k: 'receita', v: Number(n.valor), pessoa: n.dono_id, canal: n.canal }); }
    if (n.status === 'perdido' && n.fechado && n.fechado >= de && n.fechado < ate) out.push({ dia: n.fechado, k: 'perdidos', v: 1, pessoa: n.dono_id, canal: n.canal });
  }
  return out;
}
type Filtro = { pessoa?: string | null; canal?: string | null };
function medir(E: Evento[], k: string, a: string, b: string, f: Filtro = {}): { v: number | null; n: number; estado: 'ok' | 'ausente' } {
  const sel = (kk: string) => E.filter(e => e.k === kk && e.dia >= a && e.dia < b && (f.pessoa === undefined || f.pessoa === null || e.pessoa === f.pessoa) && (f.canal === undefined || f.canal === null || e.canal === f.canal)).reduce((s, e) => s + e.v, 0);
  if (FLUXO[k]) { const A = sel(FLUXO[k]!.a), B = sel(FLUXO[k]!.b); return B > 0 ? { v: A / B, n: B, estado: 'ok' } : { v: null, n: 0, estado: 'ausente' }; }
  if (k === 'ticket') { const r = sel('receita'), v = sel('vendas'); return v > 0 ? { v: r / v, n: v, estado: 'ok' } : { v: null, n: 0, estado: 'ausente' }; }
  const v = sel(k); return { v, n: v, estado: 'ok' };
}

export interface LinhaSemana { k: string; D: DefIndicador; grupo: string; cur: number | null; n: number; prev: number | null; base: number | null; meta: number | null; J: Julgamento; porPessoa?: Array<{ nome: string; cur: number; base: number; d: number }>; porCanal?: Array<{ nome: string; cur: number; base: number; d: number }> }
/* ---------- relatório da semana (off = −1: semana passada; 0: esta, parcial) ---------- */
export async function relatorioDaSemana(sql: Sql, op: Operacao, data: string, agora: Date, off = -1) {
  const seg = somarDias(segundaDe(data), 7 * off), dom = somarDias(seg, 6), fim = somarDias(seg, 7), hojeL = agoraLocal(op.fuso, agora);
  const parcial = fim > hojeL.iso, fr = parcial ? Math.max(0.05, Math.min(1, ((Date.parse(hojeL.iso) - Date.parse(seg)) / 86_400_000 + fracaoDoDia(Number(hojeL.hm.slice(0, 2)), Number(hojeL.hm.slice(3)))) / 7)) : 1;
  const de = somarDias(seg, -28), E = await eventos(sql, op, de, fim);
  const ciclo = cicloDaOperacao(op, seg), metasC = metasDaOperacao(await metasVigentes(sql, op.id, ciclo.inicio));
  const duC = ciclo.uteis.length, duS = ciclo.uteis.filter(d => d >= seg && d <= dom).length;
  const pessoas = await sql<{ id: string; nome: string }[]>`select id, nome from lab.pessoa where operacao_id = ${op.id} and ativa order by nome`;
  const canais = [...new Set(E.filter(e => e.canal).map(e => e.canal!))].slice(0, 15);
  const linha = (D: DefIndicador, f: Filtro = {}) => { const cur = medir(E, D.k, seg, fim, f), prev = medir(E, D.k, somarDias(seg, -7), seg, f), b4 = medir(E, D.k, de, seg, f);
    let base = b4.estado === 'ok' ? b4.v : null; if (base != null && D.aditiva) base = (base / 4) * fr; return { cur, prev, base }; };
  const linhas: LinhaSemana[] = [];
  for (const D of INDICADORES_SEMANA) { const L = linha(D); if (L.cur.estado !== 'ok' && L.base == null) continue; if (D.aditiva && (L.cur.v ?? 0) === 0 && (L.base ?? 0) === 0) continue;
    const metaS = metaDaSemana(metasC[D.k] ?? null, duC, duS), metaP = metaS != null ? metaS * fr : null;
    const J = julgarSemana({ atual: L.cur.estado === 'ok' ? L.cur.v : null, base: L.base, meta: metaP, un: D.un, menorMelhor: D.menorMelhor, aditiva: D.aditiva, n: L.cur.n, minN: 5 }); J.meta = metaP;
    linhas.push({ k: D.k, D, grupo: GRUPO[D.k] ?? '', cur: L.cur.estado === 'ok' ? L.cur.v : null, n: L.cur.n, prev: L.prev.estado === 'ok' ? L.prev.v : null, base: L.base, meta: metaP, J }); }
  const mag = (L: LinhaSemana) => (L.J.at != null ? Math.abs(1 - L.J.at) * 100 : L.J.V ? Math.abs(L.J.V.d) : 0);
  const bons = linhas.filter(L => L.J.st === 'bom').sort((x, y) => mag(y) - mag(x)), ruins = linhas.filter(L => L.J.st === 'ruim').sort((x, y) => mag(y) - mag(x));
  const decompor = (L: LinhaSemana, dim: 'pessoa' | 'canal') => { const mem = dim === 'pessoa' ? pessoas.map(p => ({ nome: p.nome, f: { pessoa: p.id } })) : canais.map(c => ({ nome: c, f: { canal: c } }));
    return mem.map(m => { const x = linha(L.D, m.f); if (x.cur.estado !== 'ok' && x.base == null) return null; const cv = x.cur.estado === 'ok' ? x.cur.v! : 0, bv = x.base ?? 0; if (!L.D.aditiva && x.cur.n < 5) return null; return { nome: m.nome, cur: cv, base: bv, d: cv - bv }; }).filter((x): x is NonNullable<typeof x> => !!x && Math.abs(x.d) > 1e-9); };
  for (const L of [...bons, ...ruins]) { if (L.k === 'leads' || L.k === 'vendas' || L.k === 'receita' || L.k === 'perdidos') L.porCanal = decompor(L, 'canal'); L.porPessoa = decompor(L, 'pessoa'); }
  /* por quê: cascata volume × ticket, elo anterior, por pessoa e por origem */
  const causas = ruins.slice(0, 5).map(L => { const partes: string[] = [];
    if (L.k === 'receita') { const v = linhas.find(x => x.k === 'vendas'), t = linhas.find(x => x.k === 'ticket'); if (v && t && v.cur != null && t.cur != null && v.base != null && t.base != null) { const W = cascataReceita(v.base, t.base, v.cur, t.cur); partes.push('Volume × ticket: ' + (W.volume < 0 ? 'menos vendas tiraram ' + brl(-W.volume) : 'mais vendas somaram ' + brl(W.volume)) + ' e ' + (W.ticket < 0 ? 'o ticket menor tirou ' + brl(-W.ticket) : 'o ticket maior somou ' + brl(W.ticket)) + '.'); } }
    const elos = (ELO[L.k] ?? []).map(k => linhas.find(x => x.k === k)).filter((x): x is LinhaSemana => !!x);
    if (elos.length) partes.push('Antes no funil: ' + elos.map(e => e.D.nome.toLowerCase() + ' ' + (e.J.st === 'ruim' ? 'piorou' : e.J.st === 'bom' ? 'melhorou' : 'ficou no normal') + (e.J.V ? ' (' + variacaoTxt(e.J.V) + ')' : '')).join('; ') + '.');
    const pes = (L.porPessoa ?? []).slice().sort((x, y) => (L.D.menorMelhor ? y.d - x.d : x.d - y.d)).slice(0, 3).filter(x => (x.d < 0) !== !!L.D.menorMelhor);
    if (pes.length) partes.push('Por pessoa: ' + pes.map(x => x.nome + ' ' + fmtSemana(L.D.un, x.cur) + ' (média ' + fmtSemana(L.D.un, x.base) + ')').join(', ') + '.');
    const can = (L.porCanal ?? []).slice().sort((x, y) => (L.D.menorMelhor ? y.d - x.d : x.d - y.d)).slice(0, 3).filter(x => (x.d < 0) !== !!L.D.menorMelhor);
    if (can.length) partes.push('Por origem: ' + can.map(x => x.nome + ' ' + fmtSemana(L.D.un, x.cur) + ' (média ' + fmtSemana(L.D.un, x.base) + ')').join(', ') + '.');
    return { k: L.k, nome: L.D.nome, partes: partes.length ? partes : ['Sem recorte que explique sozinho: a queda está espalhada.'] }; });
  const roteiro = ruins.filter(L => ROTEIRO[L.k]).slice(0, 5).map(L => ({ k: L.k, nome: L.D.nome, acao: ROTEIRO[L.k]![0], porque: ROTEIRO[L.k]![1], testar: ROTEIRO[L.k]![2], funcionou: ROTEIRO[L.k]![3] }));
  const rec = linhas.find(L => L.k === 'receita'), ven = linhas.find(L => L.k === 'vendas');
  const resumo = (rec && rec.cur != null ? 'Receita de ' + brl(rec.cur) + (rec.J.V ? ' (' + variacaoTxt(rec.J.V) + ' contra a média das 4 semanas)' : '') + (ven && ven.cur != null ? ' em ' + Math.round(ven.cur) + ' venda' + (ven.cur === 1 ? '' : 's') : '') + '. ' : '') + bons.length + ' indicador' + (bons.length === 1 ? '' : 'es') + ' melhor' + (bons.length === 1 ? '' : 'es') + ' que o normal, ' + ruins.length + ' pior' + (ruins.length === 1 ? '' : 'es') + ' e ' + (linhas.length - bons.length - ruins.length) + ' dentro do normal ou sem amostra.';
  const texto = [(off === -1 ? 'Semana passada' : off === 0 ? 'Esta semana (parcial)' : 'Semana') + ' · ' + seg.slice(8) + '/' + seg.slice(5, 7) + ' a ' + dom.slice(8) + '/' + dom.slice(5, 7), '', 'Deu certo:', ...(bons.length ? bons.map(L => '• ' + L.D.nome + ': ' + fmtSemana(L.D.un, L.cur) + (L.J.V ? ' (' + variacaoTxt(L.J.V) + ')' : '')) : ['• nada claramente acima do normal']), '', 'Deu errado:', ...(ruins.length ? ruins.map(L => '• ' + L.D.nome + ': ' + fmtSemana(L.D.un, L.cur) + (L.J.V ? ' (' + variacaoTxt(L.J.V) + ')' : '')) : ['• nada claramente abaixo do normal']), ...(roteiro.length ? ['', 'Para testar:', ...roteiro.slice(0, 3).map(r => '• ' + r.nome + ': ' + r.acao)] : [])].join('\n');
  return { versao: VERSAO_SEMANA, semana: { ini: seg, fim: dom, parcial, fr, off }, ciclo: { inicio: ciclo.inicio, fim: ciclo.fim, duCiclo: duC, duSemana: duS }, resumo, linhas, bons: bons.map(L => L.k), ruins: ruins.map(L => L.k), causas, roteiro, texto };
}

/* ---------- projeção desta semana ---------- */
export async function projecaoDaSemana(sql: Sql, op: Operacao, data: string, agora: Date) {
  const hojeL = agoraLocal(op.fuso, agora), hoje = data, ciclo = cicloDaOperacao(op, hoje);
  const seg0 = segundaDe(hoje), ia = seg0 < ciclo.inicio ? ciclo.inicio : seg0, dom0 = somarDias(seg0, 6), ib = dom0 >= ciclo.fim ? somarDias(ciclo.fim, -1) : dom0, fimEx = somarDias(ib, 1);
  const du = ciclo.uteis.filter(d => d >= ia && d <= ib), frHoje = du.includes(hoje) && hoje === hojeL.iso ? fracaoDoDia(Number(hojeL.hm.slice(0, 2)), Number(hojeL.hm.slice(3))) : du.includes(hoje) && hoje < hojeL.iso ? 1 : 0;
  const decorridos = du.filter(d => d < hoje).length + frHoje, restantes = Math.max(0, du.length - decorridos);
  const E = await eventos(sql, op, somarDias(seg0, -28), fimEx);
  const metasC = metasDaOperacao(await metasVigentes(sql, op.id, ciclo.inicio)), duC = ciclo.uteis.length;
  const duJanela = (a: string, b: string) => { let n = 0; for (let d = a; d < b; d = somarDias(d, 1)) { const w = diaDaSemana(d); if (op.calendario.diasUteis.includes(w)) n++; } return n; };
  const ritmoJanela = (k: string, a: string, b: string) => { const n = duJanela(a, b); if (!n) return null; const r = medir(E, k, a, b); return r.estado === 'ok' && r.v != null ? r.v / n : null; };
  const IND = ['leads', 'tentativa', 'contato', 'agendamento', 'reuniao_realizada', 'oportunidades', 'proposta_enviada', 'vendas', 'receita'];
  const linhas = IND.map(k => { const D = INDICADORES_SEMANA.find(x => x.k === k)!, feitoR = medir(E, k, ia, somarDias(hoje, 1)), feito = feitoR.v ?? 0;
    const ritmos = [1, 2, 3, 4].map(i => ritmoJanela(k, somarDias(seg0, -7 * i), somarDias(seg0, -7 * (i - 1)))), ritmoHist = ritmoJanela(k, somarDias(seg0, -28), seg0);
    const meta = metaDaSemana(metasC[k] ?? null, duC, du.length), P = projetarSemana({ feito, decorridos, restantes, ritmoHist, ritmos, meta });
    const falta = meta != null ? Math.max(0, meta - feito) : null, mult = P.precisa != null && ritmoHist && ritmoHist > 0 ? P.precisa / ritmoHist : null;
    return { k, nome: D.nome, un: D.un, feito, meta, ritmoHist, ...P, stNome: NOME_SITUACAO_SEMANA[P.st][0], classe: NOME_SITUACAO_SEMANA[P.st][1], falta, mult, roteiro: ROTEIRO[k] ? { acao: ROTEIRO[k]![0], acompanhar: ROTEIRO[k]![2] } : null }; })
    .filter(x => x.feito > 0 || x.meta != null || x.ritmoHist);
  /* na mesa: negócios em proposta e negociação, com valor, dias na etapa e a chance histórica de fechar (coorte de 150 a 15 dias atrás) */
  const [mesaL, coorteL] = await Promise.all([
    sql<any[]>`select n.id, coalesce(c.nome, n.atributos->>'cliente', 'Negócio') as nome, e.papel, e.nome as etapa, p.nome as dono, coalesce(n.valor_estimado, 0) as valor, coalesce(n.etapa_desde, n.criado_em) as desde
      from lab.negocio n join lab.etapa e on e.id = n.etapa_id join lab.funil f on f.id = n.funil_id left join lab.conta c on c.id = n.conta_id left join lab.pessoa p on p.id = n.dono_id
      where n.operacao_id = ${op.id} and f.principal and n.status = 'aberto' and n.tipo = 'novo' and e.papel in ('proposta', 'negociacao')`,
    sql<any[]>`select e.papel, count(distinct t.negocio_id)::int as n, count(distinct t.negocio_id) filter (where n.status = 'ganho')::int as g
      from lab.negocio_transicao t join lab.etapa e on e.id = t.para_etapa_id join lab.negocio n on n.id = t.negocio_id
      where t.operacao_id = ${op.id} and e.papel in ('proposta', 'negociacao') and n.status <> 'aberto' and n.tipo = 'novo' and (t.em at time zone ${op.fuso})::date >= ${somarDias(hoje, -150)}::date and (t.em at time zone ${op.fuso})::date < ${somarDias(hoje, -15)}::date group by e.papel`,
  ]);
  const tx = Object.fromEntries(coorteL.map(c => [c.papel, { v: c.n ? c.g / c.n : null, n: c.n }])) as Record<string, { v: number | null; n: number }>;
  const mesa = mesaL.map(m => ({ id: m.id, nome: m.nome, etapa: m.etapa, papel: m.papel, dono: m.dono, valor: Number(m.valor), dias: Math.max(0, (agora.getTime() - new Date(m.desde).getTime()) / 86_400_000), chance: (tx[m.papel]?.n ?? 0) >= 5 ? tx[m.papel]!.v : null }))
    .sort((a, b) => Number(b.papel === 'negociacao') - Number(a.papel === 'negociacao') || b.valor - a.valor);
  const rec = linhas.find(x => x.k === 'receita');
  const mesaResumo = { n: mesa.length, total: mesa.reduce((s, m) => s + m.valor, 0), esperado: mesa.reduce((s, m) => s + m.valor * (m.chance ?? 0), 0), faltaReceita: rec && rec.meta != null ? Math.max(0, rec.meta - rec.feito) : null, taxas: tx };
  /* semanas do ciclo: feito / meta de cada semana para os indicadores com meta */
  const semanas: Array<{ n: number; ini: string; fim: string; du: number; atual: boolean; futura: boolean }> = [];
  for (let s = segundaDe(ciclo.inicio), n = 1; s < ciclo.fim; s = somarDias(s, 7), n++) { const a = s < ciclo.inicio ? ciclo.inicio : s, b = somarDias(s, 6) >= ciclo.fim ? somarDias(ciclo.fim, -1) : somarDias(s, 6); semanas.push({ n, ini: a, fim: b, du: ciclo.uteis.filter(d => d >= a && d <= b).length, atual: a <= hoje && b >= hoje, futura: a > hoje }); }
  const EC = await eventos(sql, op, ciclo.inicio, somarDias(hoje, 1));
  const semanasCiclo = Object.keys(metasC).filter(k => IND.includes(k)).map(k => ({ k, nome: INDICADORES_SEMANA.find(x => x.k === k)!.nome, un: INDICADORES_SEMANA.find(x => x.k === k)!.un, celulas: semanas.map(w => { const meta = metaDaSemana(metasC[k]!, duC, w.du), feito = w.futura ? null : medir(EC, k, w.ini, somarDias(w.fim, 1)).v ?? 0; return { n: w.n, meta, feito, ok: feito != null && meta != null && !w.atual && !w.futura ? feito >= meta - 1e-6 : null }; }) }));
  const com = linhas.filter(x => x.meta != null && x.meta > 0), atras = linhas.filter(x => x.st === 'risco' || x.st === 'nao').sort((p, q) => (p.at ?? 0) - (q.at ?? 0));
  const texto = ['Projeção da semana ' + ia.slice(8) + '/' + ia.slice(5, 7) + ' a ' + ib.slice(8) + '/' + ib.slice(5, 7), '', ...linhas.map(x => '• ' + x.nome + ': feito ' + fmtSemana(x.un, x.feito) + ', projeção ' + fmtSemana(x.un, x.proj) + (x.meta != null ? ', meta ' + fmtSemana(x.un, x.meta) + ' (' + x.stNome.toLowerCase() + ')' : '')), ...(atras.length ? ['', 'Para bater até domingo:', ...atras.map(x => '• ' + x.nome + ': faltam ' + fmtSemana(x.un, x.falta) + (x.precisa != null ? ' (' + fmtSemana(x.un, x.precisa) + '/dia útil)' : ''))] : [])].join('\n');
  return { versao: VERSAO_SEMANA, semana: { ini: ia, fim: ib, du: du.length, decorridos, restantes, hoje }, ciclo: { inicio: ciclo.inicio, fim: ciclo.fim, duCiclo: duC }, temMetas: com.length > 0, resumo: { bate: com.filter(x => x.st === 'bate' || x.st === 'batida').length, risco: com.filter(x => x.st === 'risco').length, nao: com.filter(x => x.st === 'nao').length, com: com.length }, linhas, atras: atras.map(x => x.k), mesa, mesaResumo, semanas, semanasCiclo, texto };
}
