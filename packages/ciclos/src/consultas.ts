/* Quarter, fechamento de ciclo e aprendizados no banco. Cada gravação respeita a ordem dos 6 passos. */
import type { Sql } from 'postgres';
import { relatorio } from '@lab/metricas';
import {
  acrescentarMetas, cicloDaOperacao, diasUteis, metasVigentes, ritmo, taxasHistoricas, type Operacao,
} from '@lab/planejamento';
import { quarterAnterior, quarterDe, ROTULO_QUARTER, PASSOS } from './quarter.js';
import { cenariosDoQuarter, metasDoCiclo, NOMES_CENARIO, programaDeCiclos, type NomeCenario, type PessoaPlano, type Premissas } from './plano.js';
import { assinar, podeFechar } from './retrato.js';

export class ErroDeRegra extends Error { constructor(m: string, readonly status = 400) { super(m); } }

export interface LinhaQuarter {
  id: string; inicio: string; fim: string; fase: number; receitaMeta: number | null; premissas: Partial<Premissas>;
  cenario: NomeCenario | null; pesos: number[]; status: 'rascunho' | 'travado'; travadoEm: string | null;
}

const linhaQuarter = (q: any): LinhaQuarter => ({
  id: q.id, inicio: q.inicio, fim: q.fim, fase: q.fase, receitaMeta: q.receita_meta == null ? null : Number(q.receita_meta),
  premissas: q.premissas ?? {}, cenario: q.cenario, pesos: (q.pesos ?? []).map(Number), status: q.status, travadoEm: q.travado_em ? new Date(q.travado_em).toISOString() : null,
});
const COLUNAS = (sql: Sql) => sql`id, inicio::text, fim::text, fase, receita_meta, premissas, cenario, pesos, status, travado_em`;

export function limitesDoQuarter(op: Operacao, data: string) {
  const q = quarterDe(data, op.mesInicioAno, op.calendario.inicioCicloDia);
  return { ...q, rotulo: ROTULO_QUARTER(q.inicio, op.mesInicioAno), ciclos: q.ciclos.map(c => ({ ...c, diasUteis: diasUteis(c.inicio, c.fim, op.calendario).length })) };
}

async function pessoasAtivas(sql: Sql, opId: string): Promise<PessoaPlano[]> {
  return (await sql<any[]>`select id, nome, funcao from lab.pessoa where operacao_id = ${opId} and ativa order by nome`).map(p => ({ id: p.id, nome: p.nome, funcao: p.funcao }));
}

export async function quarterDaOperacao(sql: Sql, op: Operacao, data: string) {
  const lim = limitesDoQuarter(op, data);
  const [q] = await sql<any[]>`select ${COLUNAS(sql)} from lab.quarter where operacao_id = ${op.id} and inicio = ${lim.inicio}::date`;
  const quarter = q ? linhaQuarter(q) : null;
  const diasTotal = lim.ciclos.reduce((s, c) => s + c.diasUteis, 0);
  const pessoas = await pessoasAtivas(sql, op.id);
  const completo = !!(quarter && quarter.receitaMeta != null && quarter.premissas.taxas);
  const cenarios = completo ? cenariosDoQuarter({ receita: quarter!.receitaMeta!, premissas: quarter!.premissas as Premissas, diasUteis: diasTotal, pessoas }) : null;
  const programa = quarter && quarter.cenario && quarter.fase >= 4 && completo
    ? programaDeCiclos({ receita: quarter.receitaMeta!, premissas: quarter.premissas as Premissas, cenario: quarter.cenario, pesos: quarter.pesos, pessoas, ciclos: lim.ciclos }) : null;
  return { rotulo: lim.rotulo, inicio: lim.inicio, fim: lim.fim, ciclos: lim.ciclos, diasUteis: diasTotal, passos: PASSOS, quarter, cenarios, programa };
}

export async function criarQuarter(sql: Sql, op: Operacao, data: string) {
  const lim = limitesDoQuarter(op, data);
  await sql`insert into lab.quarter (operacao_id, inicio, fim) values (${op.id}, ${lim.inicio}::date, ${lim.fim}::date) on conflict (operacao_id, inicio) do nothing`;
  return quarterDaOperacao(sql, op, data);
}

/* passo 1: retrato do quarter anterior, com as mesmas métricas da fase 2 */
export async function diagnostico(sql: Sql, op: Operacao, data: string) {
  const lim = limitesDoQuarter(op, data);
  const ant = quarterAnterior(lim.inicio, op.mesInicioAno, op.calendario.inicioCicloDia);
  return { quarterAnterior: { rotulo: ROTULO_QUARTER(ant.inicio, op.mesInicioAno), inicio: ant.inicio, fim: ant.fim }, ...(await relatorio(sql, op, { de: ant.inicio, ate: ant.fim })) };
}

async function rascunho(sql: Sql, op: Operacao, data: string, minimo: number): Promise<{ q: LinhaQuarter; lim: ReturnType<typeof limitesDoQuarter> }> {
  const lim = limitesDoQuarter(op, data);
  const [q] = await sql<any[]>`select ${COLUNAS(sql)} from lab.quarter where operacao_id = ${op.id} and inicio = ${lim.inicio}::date`;
  if (!q) throw new ErroDeRegra('este quarter ainda não foi iniciado', 404);
  const quarter = linhaQuarter(q);
  if (quarter.status === 'travado') throw new ErroDeRegra('este quarter está travado: o plano não pode mais mudar', 409);
  if (quarter.fase < minimo) throw new ErroDeRegra(`conclua o passo ${minimo} (${PASSOS[minimo - 1]!.nome}) antes`, 409);
  return { q: quarter, lim };
}

/* passo 2: meta. Taxas e ticket vêm do histórico da operação, e o que você informar vale no lugar. */
export async function definirMeta(sql: Sql, op: Operacao, data: string, b: { receita: number; ticketMedio?: number; taxas?: Premissas['taxas'] }) {
  if (!(b.receita > 0)) throw new ErroDeRegra('informe a receita do quarter (maior que zero)');
  const { q } = await rascunho(sql, op, data, 1);
  const hist = await taxasHistoricas(sql, op, q.inicio);
  /* ordem de prioridade, taxa a taxa: o que você informou agora, o que já estava no plano, o histórico */
  const anterior = q.premissas.taxas ?? {};
  const taxas = Object.fromEntries(Object.keys({ ...hist.taxas, ...anterior, ...(b.taxas ?? {}) }).map(k => [k, (b.taxas as Record<string, number | null> | undefined)?.[k] ?? (anterior as Record<string, number | null>)[k] ?? (hist.taxas as Record<string, number | null>)[k] ?? null])) as Premissas['taxas'];
  const premissas: Premissas = { taxas, ticketMedio: b.ticketMedio ?? q.premissas.ticketMedio ?? hist.ticketMedio, ...(Object.keys(hist.canais).length ? { canais: hist.canais } : {}) };
  await sql`update lab.quarter set receita_meta = ${b.receita}, premissas = ${sql.json(premissas as never)}, fase = 2, cenario = null, pesos = '[]' where id = ${q.id}`;
  return quarterDaOperacao(sql, op, data);
}

export async function escolherCenario(sql: Sql, op: Operacao, data: string, cenario: string) {
  if (!(NOMES_CENARIO as string[]).includes(cenario)) throw new ErroDeRegra(`cenário deve ser: ${NOMES_CENARIO.join(', ')}`);
  const { q } = await rascunho(sql, op, data, 2);
  await sql`update lab.quarter set cenario = ${cenario}, fase = 3, pesos = '[]' where id = ${q.id}`;
  return quarterDaOperacao(sql, op, data);
}

/* passo 4: só confirma se a cadeia do funil fecha (todas as taxas existem) */
export async function confirmarEsforco(sql: Sql, op: Operacao, data: string) {
  const { q, lim } = await rascunho(sql, op, data, 3);
  const plano = cenariosDoQuarter({ receita: q.receitaMeta!, premissas: q.premissas as Premissas, diasUteis: lim.ciclos.reduce((s, c) => s + c.diasUteis, 0), pessoas: await pessoasAtivas(sql, op.id) })[q.cenario!];
  if (!plano.ok) throw new ErroDeRegra(`o esforço não pode ser calculado: ${plano.avisos.join('; ') || 'faltam dados'}. Informe as taxas que faltam no passo 2.`, 409);
  await sql`update lab.quarter set fase = 4 where id = ${q.id}`;
  return quarterDaOperacao(sql, op, data);
}

export async function definirPrograma(sql: Sql, op: Operacao, data: string, pesos?: number[]) {
  const { q, lim } = await rascunho(sql, op, data, 4);
  const prog = programaDeCiclos({ receita: q.receitaMeta!, premissas: q.premissas as Premissas, cenario: q.cenario!, ...(pesos ? { pesos } : {}), ciclos: lim.ciclos });
  if (!prog.ok && !prog.ciclos.length) throw new ErroDeRegra(prog.avisos.join('; '));
  const usados = prog.ciclos.map(c => c.peso);
  await sql`update lab.quarter set pesos = ${sql.json(usados as never)}, fase = 5 where id = ${q.id}`;
  return quarterDaOperacao(sql, op, data);
}

/* passo 6: grava as metas de cada ciclo (as mesmas que o ritmo e o Fechamento do dia usam) e trava o quarter */
export async function travarQuarter(sql: Sql, op: Operacao, data: string) {
  const { q, lim } = await rascunho(sql, op, data, 5);
  const pessoas = await pessoasAtivas(sql, op.id);
  const prog = programaDeCiclos({ receita: q.receitaMeta!, premissas: q.premissas as Premissas, cenario: q.cenario!, pesos: q.pesos, pessoas, ciclos: lim.ciclos });
  if (!prog.ok) throw new ErroDeRegra(`o plano não fecha: ${prog.avisos.join('; ')}`, 409);
  await sql.begin(async tx => {
    const t = tx as unknown as Sql;
    for (const c of prog.ciclos) await acrescentarMetas(t, op.id, c.inicio, metasDoCiclo(c).map(m => ({ ...m, nota: `Quarter ${ROTULO_QUARTER(q.inicio, op.mesInicioAno)} · cenário ${q.cenario}` })));
    await t`update lab.quarter set fase = 6, status = 'travado', travado_em = now() where id = ${q.id}`;
  });
  return quarterDaOperacao(sql, op, data);
}

/* fechamento: fotografia do ciclo, assinada e imutável */
export async function fecharCiclo(sql: Sql, op: Operacao, data: string, hoje: string) {
  const ciclo = cicloDaOperacao(op, data);
  const ok = podeFechar(ciclo.uteis, hoje);
  if (!ok.pode) throw new ErroDeRegra(ok.motivo!, 409);
  const [ja] = await sql`select 1 from lab.retrato_ciclo where operacao_id = ${op.id} and ciclo_inicio = ${ciclo.inicio}::date`;
  if (ja) throw new ErroDeRegra('este ciclo já foi fechado; o retrato dele não muda', 409);
  const ultimoUtil = ciclo.uteis.at(-1)!;
  const [metas, ritmoFinal, metricas, quarter] = await Promise.all([
    metasVigentes(sql, op.id, ciclo.inicio), ritmo(sql, op, ultimoUtil), relatorio(sql, op, { de: ciclo.inicio, ate: ciclo.fim }),
    quarterDaOperacao(sql, op, ciclo.inicio),
  ]);
  const dados = JSON.parse(JSON.stringify({
    operacao: { slug: op.slug, nome: op.nome }, ciclo: { inicio: ciclo.inicio, fim: ciclo.fim, diasUteis: ciclo.uteis.length },
    metas, ritmoFinal: ritmoFinal.linhas, metricas,
    quarter: quarter.quarter ? { rotulo: quarter.rotulo, cenario: quarter.quarter.cenario, receitaMeta: quarter.quarter.receitaMeta, status: quarter.quarter.status } : null,
  }));
  const assinatura = await assinar(dados);
  try {
    await sql`insert into lab.retrato_ciclo (operacao_id, ciclo_inicio, ciclo_fim, dados, assinatura) values (${op.id}, ${ciclo.inicio}::date, ${ciclo.fim}::date, ${sql.json(dados)}, ${assinatura})`;
  } catch (e) {
    if (/unique|duplicate/i.test((e as Error).message)) throw new ErroDeRegra('este ciclo já foi fechado; o retrato dele não muda', 409);
    throw e;
  }
  return { cicloInicio: ciclo.inicio, assinatura, dados };
}

export async function retratos(sql: Sql, op: Operacao) {
  const l = await sql<any[]>`select ciclo_inicio::text, ciclo_fim::text, gerado_em, assinatura, dados from lab.retrato_ciclo where operacao_id = ${op.id} order by ciclo_inicio desc limit 24`;
  const confere = await Promise.all(l.map(async r => (await assinar(r.dados)) === r.assinatura));
  return l.map((r, i) => ({ cicloInicio: r.ciclo_inicio, cicloFim: r.ciclo_fim, geradoEm: new Date(r.gerado_em).toISOString(), assinatura: r.assinatura, integro: confere[i], dados: r.dados }));
}

export const TIPOS_APRENDIZADO = ['funcionou', 'nao_funcionou', 'hipotese', 'decisao'] as const;
export async function registrarAprendizado(sql: Sql, op: Operacao, b: { tipo: string; texto: string; cicloInicio?: string | null }) {
  const texto = (b.texto ?? '').trim();
  if (!(TIPOS_APRENDIZADO as readonly string[]).includes(b.tipo)) throw new ErroDeRegra(`tipo deve ser: ${TIPOS_APRENDIZADO.join(', ')}`);
  if (!texto || texto.length > 2000) throw new ErroDeRegra('escreva o aprendizado (até 2000 caracteres)');
  const [a] = await sql`insert into lab.aprendizado (operacao_id, ciclo_inicio, tipo, texto) values (${op.id}, ${b.cicloInicio ?? null}, ${b.tipo}, ${texto}) returning id, tipo, texto, ciclo_inicio::text as "cicloInicio", criado_em as "criadoEm"`;
  return a;
}
export async function aprendizados(sql: Sql, op: Operacao) {
  return sql`select id, tipo, texto, ciclo_inicio::text as "cicloInicio", criado_em as "criadoEm" from lab.aprendizado where operacao_id = ${op.id} order by id desc limit 200`;
}
