/* Metas históricas no banco (D16–D20): a meta oficial de cada ciclo pelas fontes da V2 (plano do ciclo, metas cadastradas na época,
   observações diárias, Fechamento do dia), o registro imutável no encerramento, revisões e estimativas, meta de intervalo e do ano. */
import type { Sql } from 'postgres';
import { cicloDaOperacao, diasUteis, hojeNoFuso, metasVigentes, realizados, somarDias, type Operacao } from '@lab/planejamento';
import { anual, atingimento, intervalo, oficial, registroInicial, revisaoDaMeta, snapshot, type CicloIntervalo, type DocMetaCiclo, type EntradaSnapshot, type Oficial, type Registro, type Snapshot } from './metas_historicas.js';
import { ErroDeEstrategia, planoDoCiclo, type LinhaPlano } from './plano_consultas.js';

export const chaveCiclo = (inicio: string) => inicio.slice(0, 7);
const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const nomeCiclo = (inicio: string) => `${MES[Number(inicio.slice(5, 7)) - 1]}/${inicio.slice(0, 4)}`;
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const clamp = (d: string, a: string, b: string) => (d < a ? a : d > b ? b : d);

/* D20: o ciclo que contém "analisar a partir de" (pack.parametros.analisarDesde) abre a operação; os anteriores ficam fora */
async function inicioDaOperacao(sql: Sql, op: Operacao): Promise<string | null> {
  const [o] = await sql<{ d: string | null }[]>`select pack -> 'parametros' ->> 'analisarDesde' as d from lab.operacao where id = ${op.id}`;
  const d = o?.d ?? null; return d && DATA.test(d) ? cicloDaOperacao(op, d).inicio : null;
}

export interface MetaDoCiclo { chave: string; nome: string; ciclo: { inicio: string; fim: string; uteis: string[] }; encerrado: boolean; fora: boolean; snap: Snapshot; oficial: Oficial; plano: LinhaPlano | null; obs: DocMetaCiclo['obs'] }
/* tudo o que define a meta oficial de um ciclo */
export async function metaOficialDoCiclo(sql: Sql, op: Operacao, cicloInicio: string, hoje: string): Promise<MetaDoCiclo> {
  const P = await planoDoCiclo(sql, op, cicloInicio), c = P.ciclo, chave = chaveCiclo(c.inicio), fimIncl = somarDias(c.fim, -1);
  const [obsL, regL, metasL, fotosL, inicioOp] = await Promise.all([
    sql<any[]>`select dia::text, receita, fonte, pessoas from lab.meta_ciclo_obs where operacao_id = ${op.id} and ciclo_inicio = ${c.inicio}::date order by dia`,
    sql<any[]>`select n, registro from lab.meta_ciclo_registro where operacao_id = ${op.id} and ciclo_inicio = ${c.inicio}::date order by n`,
    sql<any[]>`select m.indicador, m.pessoa_id, m.valor, (m.criado_em at time zone ${op.fuso})::date::text as dia, p.nome from lab.meta m left join lab.pessoa p on p.id = m.pessoa_id
      where m.operacao_id = ${op.id} and m.ciclo_inicio = ${c.inicio}::date and m.indicador = 'receita' and (m.criado_em at time zone ${op.fuso})::date < ${c.fim}::date order by m.id`,
    sql<any[]>`select data::text, (ref ->> 'meta')::numeric as receita from lab.dia_fechamento where operacao_id = ${op.id} and data >= ${c.inicio}::date and data < ${c.fim}::date and ref ? 'meta' and (ref ->> 'meta') is not null order by data`,
    inicioDaOperacao(sql, op),
  ]);
  /* observações: as gravadas pela rotina e as que as próprias metas cadastradas provam (cada dia em que a meta de receita do ciclo mudou, dentro do ciclo) */
  const obs: NonNullable<DocMetaCiclo['obs']> = {};
  const dias = [...new Set(metasL.map(m => clamp(m.dia, c.inicio, fimIncl)))].sort();
  for (const d of dias) {
    const ate = metasL.filter(m => clamp(m.dia, c.inicio, fimIncl) <= d), propria = [...ate].reverse().find(m => !m.pessoa_id), porPessoa = new Map<string, { nome: string; valor: number }>();
    for (const m of ate) if (m.pessoa_id) porPessoa.set(m.pessoa_id, { nome: m.nome ?? m.pessoa_id, valor: Number(m.valor) });
    const soma = [...porPessoa.values()].reduce((s, x) => s + x.valor, 0), v = propria ? Number(propria.valor) : soma > 0 ? soma : null;
    obs[d] = { v, fonte: v == null ? 'nenhuma' : 'meta cadastrada', pessoas: Object.fromEntries([...porPessoa.values()].map(x => [x.nome, x.valor])) };
  }
  for (const o of obsL) obs[o.dia] = { v: o.receita == null ? null : Number(o.receita), fonte: o.fonte, pessoas: o.pessoas ?? {} };
  const fotos: EntradaSnapshot['fotos'] = Object.fromEntries(fotosL.map(f => [f.data, { meta: { receita: Number(f.receita) } }]));
  const encerrado = hoje >= c.fim || P.linha?.status === 'fechado';
  /* ciclo em andamento: a meta cadastrada hoje é a meta vigente; metas individuais de hoje por nome */
  const nomes = new Map((await sql<{ id: string; nome: string }[]>`select id, nome from lab.pessoa where operacao_id = ${op.id}`).map(p => [p.id, p.nome]));
  const propria = P.metas.find(m => m.indicador === 'receita' && !m.pessoaId), somaP = P.metas.filter(m => m.indicador === 'receita' && m.pessoaId).reduce((s, m) => s + m.valor, 0);
  const metaMensal = propria ? propria.valor : somaP > 0 ? somaP : null;
  const metasVend = Object.fromEntries(P.metas.filter(m => m.indicador === 'receita' && m.pessoaId).map(m => [nomes.get(m.pessoaId!) ?? m.pessoaId!, m.valor]));
  const snap = snapshot({ chave, ini: c.inicio, fim: c.fim, encerrado, plano: P.linha ? P.doc : null, obs, fotos, metaMensal, metasVend });
  const doc: DocMetaCiclo = { registros: Object.fromEntries(regL.map(r => ['r' + r.n, r.registro as Registro])), obs };
  const fora = inicioOp != null && c.fim <= inicioOp;
  const of = fora
    ? ({ ...snap, estado: 'fora', receita: null, fonte: 'fora', motivo: `ciclo anterior ao início da operação (analisar a partir de ${inicioOp}): fora da meta, do realizado e da projeção (D20)`, registrado: false, historico: [], estimativas: [], divergencia: null } as Oficial)
    : oficial(doc, snap);
  return { chave, nome: nomeCiclo(c.inicio), ciclo: c, encerrado, fora, snap, oficial: of, plano: P.linha, obs };
}

/* registro do encerramento (D19): automático (data e autor do fechamento do plano, ou o fim do ciclo) ou recuperação manual; idempotente */
export async function registrarEncerramento(sql: Sql, op: Operacao, cicloInicio: string, opts: { manual?: boolean; por?: string | null; agora?: Date; hoje?: string } = {}) {
  const agora = opts.agora ?? new Date(), hoje = opts.hoje ?? hojeNoFuso(op.fuso, agora);
  const X = await metaOficialDoCiclo(sql, op, cicloInicio, hoje);
  if (X.fora) return { acao: 'nada' as const, motivo: 'ciclo anterior ao início da operação (D20)' };
  const F = X.plano?.fechadoEm ? { em: X.plano.fechadoEm, por: X.plano.fechadoPor } : null;
  const ctx: Parameters<typeof registroInicial>[2] = { agora: F?.em ?? X.ciclo.fim, autor: F?.por || 'registro automático no encerramento do ciclo' };
  if (opts.manual) { ctx.tipo = 'recuperacao'; ctx.registradoPor = opts.por ?? ''; ctx.registradoEm = agora.toISOString(); }
  const R = registroInicial({ registros: Object.fromEntries(X.oficial.historico.map(r => [r.id, r])) }, X.snap, ctx);
  if (R.acao === 'gravar') await sql`insert into lab.meta_ciclo_registro (operacao_id, ciclo_inicio, n, tipo, registro) values (${op.id}, ${X.ciclo.inicio}::date, ${R.registro.n}, ${R.registro.tipo}, ${sql.json(R.registro as never)}) on conflict do nothing`;
  return R;
}
/* revisão auditável ou estimativa identificada: novo registro; o anterior fica intacto */
export async function revisarMeta(sql: Sql, op: Operacao, cicloInicio: string, dados: { tipo?: string; receita?: unknown; justificativa?: string; origem?: string; limitacoes?: string }, por: string | null, agora = new Date()) {
  const X = await metaOficialDoCiclo(sql, op, cicloInicio, hojeNoFuso(op.fuso, agora));
  const R = revisaoDaMeta({ registros: Object.fromEntries(X.oficial.historico.map(r => [r.id, r])) }, dados, { agora: agora.toISOString(), autor: por ?? '' });
  if ('erro' in R) throw new ErroDeEstrategia(String(R.erro));
  await sql`insert into lab.meta_ciclo_registro (operacao_id, ciclo_inicio, n, tipo, registro) values (${op.id}, ${X.ciclo.inicio}::date, ${R.registro.n}, ${R.registro.tipo}, ${sql.json(R.registro as never)})`;
  return R;
}
/* fechar o plano do ciclo: o plano para de mudar e a meta do ciclo é registrada */
export async function fecharPlano(sql: Sql, op: Operacao, cicloInicio: string, por: string | null, agora = new Date()) {
  const P = await planoDoCiclo(sql, op, cicloInicio);
  if (!P.linha || P.linha.status !== 'ativo') throw new ErroDeEstrategia(P.linha?.status === 'fechado' ? 'o plano deste ciclo já está fechado' : 'só um plano ativo pode ser fechado', 409);
  await sql`update lab.plano_ciclo set status = 'fechado', fechado_em = ${agora}, fechado_por = ${por ?? ''} where id = ${P.linha.id}`;
  const registro = await registrarEncerramento(sql, op, cicloInicio, { agora });
  return { ...(await planoDoCiclo(sql, op, cicloInicio)), registro };
}

/* os últimos n ciclos (do atual para trás), com a meta oficial de cada um */
export async function metasHistoricas(sql: Sql, op: Operacao, hoje: string, n = 13) {
  const atual = cicloDaOperacao(op, hoje), out: MetaDoCiclo[] = [];
  let ini = atual.inicio;
  for (let i = 0; i < n; i++) { out.push(await metaOficialDoCiclo(sql, op, ini, hoje)); ini = cicloDaOperacao(op, somarDias(ini, -1)).inicio; }
  return out.map(x => ({ chave: x.chave, nome: x.nome, inicio: x.ciclo.inicio, fim: x.ciclo.fim, encerrado: x.encerrado, fora: x.fora, plano: x.plano ? { status: x.plano.status, versao: x.plano.versao } : null, snap: x.snap, oficial: x.oficial }));
}
/* meta atribuída ao intervalo [a, b] (inclusive), rateada pelos dias úteis de cada ciclo */
export async function metaIntervalo(sql: Sql, op: Operacao, a: string, b: string, hoje: string) {
  if (!DATA.test(a) || !DATA.test(b) || a > b) return intervalo([], '', '');
  const ciclos: CicloIntervalo[] = [];
  for (let c = cicloDaOperacao(op, a); c.inicio <= b; c = cicloDaOperacao(op, c.fim)) {
    const X = await metaOficialDoCiclo(sql, op, c.inicio, hoje), o = X.oficial;
    ciclos.push({ chave: X.chave, nome: X.nome, ini: c.inicio, fim: c.fim, oficial: { estado: o.estado, receita: o.receita, fonte: o.fonte, motivo: o.motivo }, dias: diasUteis(c.inicio, c.fim, op.calendario), pesos: null });
  }
  return intervalo(ciclos, a, b);
}
/* o ano (D18): do ciclo que abre o ano (mês de início do ano da operação) ao que fecha, com o realizado acumulado até hoje */
export async function metaDoAno(sql: Sql, op: Operacao, hoje: string) {
  const dia = String(Math.min(Math.max(op.calendario.inicioCicloDia, 1), 28)).padStart(2, '0'), m0 = op.mesInicioAno;
  let ano = Number(hoje.slice(0, 4)); if (cicloDaOperacao(op, hoje).inicio < `${ano}-${String(m0).padStart(2, '0')}-${dia}`) ano -= 1;
  const ini = cicloDaOperacao(op, `${ano}-${String(m0).padStart(2, '0')}-${dia}`).inicio, fim = cicloDaOperacao(op, somarDias(ini, 364)).fim, fimIncl = somarDias(fim, -1);
  const [tot, acum, reals] = await Promise.all([metaIntervalo(sql, op, ini, fimIncl, hoje), metaIntervalo(sql, op, ini, hoje < fimIncl ? hoje : fimIncl, hoje), realizados(sql, op, ini, somarDias(hoje < fimIncl ? hoje : fimIncl, 1))]);
  const realizado = reals.filter(r => r.indicador === 'receita').reduce((s, r) => s + r.quantidade, 0);
  return { ano, inicio: ini, fim, hoje, ...anual(tot, acum, realizado), tot, acum, atingimentoAcum: atingimento(realizado, acum) };
}

/* rotina (cron): observa a meta em vigor do ciclo atual uma vez por dia e registra os ciclos encerrados ainda sem registro */
export async function tiqueMetas(sql: Sql, op: Operacao, agora = new Date()) {
  const hoje = hojeNoFuso(op.fuso, agora), atual = cicloDaOperacao(op, hoje), out: Record<string, string> = {};
  const X = await metaOficialDoCiclo(sql, op, atual.inicio, hoje);
  if (!X.fora && !X.encerrado && !X.obs?.[hoje]) {
    await sql`insert into lab.meta_ciclo_obs (operacao_id, ciclo_inicio, dia, receita, fonte, pessoas) values (${op.id}, ${atual.inicio}::date, ${hoje}::date, ${X.snap.receita}, ${X.snap.fonte}, ${sql.json(X.snap.pessoas as never)}) on conflict do nothing`;
    out[X.chave] = 'observada';
  }
  let ini = atual.inicio;
  for (let i = 0; i < 4; i++) {
    const Y = i === 0 ? X : await metaOficialDoCiclo(sql, op, ini, hoje);
    if (!Y.fora && Y.encerrado && !Y.oficial.registrado) { const R = await registrarEncerramento(sql, op, ini, { agora, hoje }); out[Y.chave] = R.acao === 'gravar' ? 'registrada' : R.motivo; }
    ini = cicloDaOperacao(op, somarDias(ini, -1)).inicio;
  }
  return out;
}
export { metasVigentes };
