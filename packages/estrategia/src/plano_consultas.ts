/* Plano do ciclo no banco: as metas continuam em lab.meta (só acréscimo); lab.plano_ciclo guarda o estado, a foto original aprovada
   e cada versão substituída por replanejamento (corte + motivo). A meta ORIGINAL nunca muda; a VIGENTE é a última meta de cada indicador. */
import type { Sql } from 'postgres';
import { acrescentarMetas, cicloDaOperacao, metasVigentes, realizados, somarDias, type MetaVigente, type Operacao } from '@lab/planejamento';
import { replanejar, type MetaDoPlano, type PlanoDoc, type VersaoPlano } from './plano_ciclo.js';

export class ErroDeEstrategia extends Error { constructor(m: string, readonly status = 400) { super(m); } }
const DATA = /^\d{4}-\d{2}-\d{2}$/;

export interface MetaGravada { indicador: string; pessoaId: string | null; valor: number }
export interface LinhaPlano {
  id: string; cicloInicio: string; status: 'rascunho' | 'ativo' | 'fechado'; versao: number;
  original: { em: string; por: string; metas: MetaGravada[] } | null; versoes: Record<string, VersaoPlano>; corte: string | null;
  ativadoEm: string | null; ativadoPor: string; fechadoEm: string | null; fechadoPor: string;
}
const linha = (p: any): LinhaPlano => ({
  id: p.id, cicloInicio: p.ciclo_inicio, status: p.status, versao: Number(p.versao) || 1, original: p.original ?? null, versoes: p.versoes ?? {}, corte: p.corte ?? null,
  ativadoEm: p.ativado_em ? new Date(p.ativado_em).toISOString() : null, ativadoPor: p.ativado_por ?? '', fechadoEm: p.fechado_em ? new Date(p.fechado_em).toISOString() : null, fechadoPor: p.fechado_por ?? '',
});
const COLS = (sql: Sql) => sql`id, ciclo_inicio::text, status, versao, original, versoes, corte::text, ativado_em, ativado_por, fechado_em, fechado_por`;

/* metas gravadas → metas do plano (formato dos motores): id = indicador:pessoa, escopo empresa/pessoa, ref = nome da pessoa */
export function metasParaDoc(metas: MetaGravada[], nomes: Map<string, string>): Record<string, MetaDoPlano> {
  const out: Record<string, MetaDoPlano> = {};
  for (const m of metas) out[`${m.indicador}:${m.pessoaId ?? 'op'}`] = { ind: m.indicador, escopo: m.pessoaId ? 'pessoa' : 'empresa', ref: m.pessoaId ? nomes.get(m.pessoaId) ?? m.pessoaId : null, alvo: m.valor };
  /* sem meta própria da operação, a soma das pessoas vale como meta da empresa (mesma regra do plano do dia) */
  for (const ind of new Set(metas.map(m => m.indicador))) if (!out[`${ind}:op`]) { const soma = metas.filter(m => m.indicador === ind && m.pessoaId).reduce((s, m) => s + m.valor, 0); if (soma > 0) out[`${ind}:op`] = { ind, escopo: 'empresa', ref: null, alvo: soma }; }
  return out;
}
export async function nomesDasPessoas(sql: Sql, opId: string): Promise<Map<string, string>> {
  return new Map((await sql<{ id: string; nome: string }[]>`select id, nome from lab.pessoa where operacao_id = ${opId}`).map(p => [p.id, p.nome]));
}

export interface PlanoDoCiclo { linha: LinhaPlano | null; doc: PlanoDoc; metas: MetaVigente[]; ciclo: { inicio: string; fim: string; uteis: string[] } }
export async function planoDoCiclo(sql: Sql, op: Operacao, cicloInicio: string): Promise<PlanoDoCiclo> {
  if (!DATA.test(cicloInicio)) throw new ErroDeEstrategia('ciclo deve ser AAAA-MM-DD');
  const ciclo = cicloDaOperacao(op, cicloInicio);
  const [rows, metas, nomes] = await Promise.all([
    sql<any[]>`select ${COLS(sql)} from lab.plano_ciclo where operacao_id = ${op.id} and ciclo_inicio = ${ciclo.inicio}::date`, metasVigentes(sql, op.id, ciclo.inicio), nomesDasPessoas(sql, op.id),
  ]);
  const l = rows[0] ? linha(rows[0]) : null;
  const doc: PlanoDoc = {
    status: l?.status ?? 'rascunho', versao: l?.versao ?? 1, metas: metasParaDoc(metas, nomes), ...(l?.corte ? { corte: l.corte } : {}),
    ...(l?.original ? { original: { em: l.original.em, por: l.original.por, metas: metasParaDoc(l.original.metas, nomes) } } : {}),
    versoes: Object.fromEntries(Object.entries(l?.versoes ?? {}).map(([k, v]) => [k, { ...v, metas: metasParaDoc((v.metas as unknown as MetaGravada[]) ?? [], nomes) }])),
    ...(l?.fechadoEm ? { fechamento: { em: l.fechadoEm, por: l.fechadoPor } } : {}),
  };
  return { linha: l, doc, metas, ciclo };
}

/* ativar: congela a foto original das metas vigentes (D16: a referência aprovada nunca muda) */
export async function ativarPlano(sql: Sql, op: Operacao, cicloInicio: string, por: string | null, agora = new Date()) {
  const P = await planoDoCiclo(sql, op, cicloInicio);
  if (!P.metas.length) throw new ErroDeEstrategia('cadastre as metas do ciclo antes de ativar o plano', 409);
  if (P.linha?.status === 'ativo') throw new ErroDeEstrategia('o plano deste ciclo já está ativo', 409);
  if (P.linha?.status === 'fechado') throw new ErroDeEstrategia('o plano deste ciclo está fechado', 409);
  const original = { em: agora.toISOString(), por: por ?? '', metas: P.metas.map(m => ({ indicador: m.indicador, pessoaId: m.pessoaId, valor: m.valor })) };
  await sql`insert into lab.plano_ciclo (operacao_id, ciclo_inicio, status, original, ativado_em, ativado_por) values (${op.id}, ${P.ciclo.inicio}::date, 'ativo', ${sql.json(original as never)}, ${agora}, ${por ?? ''})
    on conflict (operacao_id, ciclo_inicio) do update set status = 'ativo', original = coalesce(lab.plano_ciclo.original, excluded.original), ativado_em = excluded.ativado_em, ativado_por = excluded.ativado_por`;
  return planoDoCiclo(sql, op, cicloInicio);
}

/* replanejar a partir de uma data de corte: a versão anterior fica guardada inteira; as metas novas entram como acréscimo em lab.meta */
export async function replanejarCiclo(sql: Sql, op: Operacao, cicloInicio: string, b: { corte: string; motivo: string; metas: Array<{ indicador: string; pessoaId?: string | null; valor: number }>; por?: string | null }, agora = new Date()) {
  const P = await planoDoCiclo(sql, op, cicloInicio);
  if (!P.linha || P.linha.status !== 'ativo') throw new ErroDeEstrategia(P.linha?.status === 'fechado' ? 'plano fechado: crie o plano do próximo ciclo' : 'ative o plano do ciclo antes de replanejar', 409);
  if (!Array.isArray(b.metas) || !b.metas.length) throw new ErroDeEstrategia('informe as metas que passam a valer a partir do corte');
  if (!DATA.test(b.corte ?? '') || b.corte < P.ciclo.inicio || b.corte >= P.ciclo.fim) throw new ErroDeEstrategia('a data de corte precisa estar dentro do ciclo');
  const nomes = await nomesDasPessoas(sql, op.id);
  const reals = await realizados(sql, op, P.ciclo.inicio, somarDias(b.corte, 1)), realizado: Record<string, number> = {};
  for (const r of reals) realizado[r.indicador] = (realizado[r.indicador] ?? 0) + r.quantidade;
  const R = replanejar(P.doc, b.corte, realizado, { motivo: String(b.motivo ?? '').trim(), metas: metasParaDoc(b.metas.map(m => ({ indicador: m.indicador, pessoaId: m.pessoaId ?? null, valor: m.valor })), nomes) }, { agora: agora.toISOString(), autor: b.por ?? '' });
  if ('erro' in R) throw new ErroDeEstrategia(String(R.erro));
  /* a versão guardada leva as metas no formato gravado (indicador, pessoa, valor), para reler sem depender dos nomes */
  const ant = { ...R.anterior, metas: P.metas.map(m => ({ indicador: m.indicador, pessoaId: m.pessoaId, valor: m.valor })) as unknown as Record<string, MetaDoPlano> };
  await sql.begin(async tx => {
    const t = tx as unknown as Sql;
    await acrescentarMetas(t, op.id, P.ciclo.inicio, b.metas.map(m => ({ indicador: m.indicador, pessoaId: m.pessoaId ?? null, valor: m.valor, nota: `Replanejamento v${R.versao} a partir de ${b.corte}: ${R.hist.motivo}` })));
    await t`update lab.plano_ciclo set versao = ${R.versao}, corte = ${b.corte}::date, versoes = versoes || ${t.json({ ['v' + R.anterior.n]: ant } as never)} where id = ${P.linha!.id}`;
  });
  return { ...(await planoDoCiclo(sql, op, cicloInicio)), restanteNoCorte: R.patch.restanteNoCorte, hist: R.hist };
}
