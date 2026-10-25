/* Medição de um período com as fontes da V2: realizado por indicador, coorte do funil (taxas com k e n), ticket, ciclo de venda, canais e perdas.
   Fonte única: as mesmas consultas do planejamento e das métricas. Sem registro no período, cada medida sai "ausente" (nunca zero inventado). */
import type { Sql } from 'postgres';
import { degrauAlcancado, ESCADA, negocios, relatorio } from '@lab/metricas';
import { realizados, type Operacao } from '@lab/planejamento';
import { TX, type Medida } from './quarter.js';

const DIA = 86_400_000;
export interface Medicao {
  de: string; ate: string; vazio: boolean;
  med: Record<string, Medida>;                       // por indicador (volumes, taxas, ticket, margem)
  leads: number; ganhos: number; receita: number; ticket: number | null;
  taxas: Record<string, { v: number | null; n: number; k: number }>;
  ciclosVenda: number[]; cicloMediano: number | null;
  canais: Array<{ canal: string; receita: number; vendas: number }>; perdas: Record<string, number>;
  margem: { v: number | null; n: number } | null; temAtividades: boolean;
}
const mediana = (L: number[]) => (L.length ? [...L].sort((a, b) => a - b)[Math.floor((L.length - 1) / 2)]! : null);
export const VOLUMES = ['tentativa', 'contato', 'agendamento', 'reuniao_realizada', 'proposta_enviada', 'oportunidades', 'vendas', 'receita'] as const;

export async function medirPeriodo(sql: Sql, op: Operacao, de: string, ate: string, opts: { comMargem?: boolean } = {}): Promise<Medicao> {
  const [reals, criados, fechados, perdasL, rel] = await Promise.all([
    realizados(sql, op, de, ate),
    negocios(sql, op.id, op.fuso, 'criados', { de, ate }),
    negocios(sql, op.id, op.fuso, 'fechados', { de, ate }),
    sql<any[]>`select coalesce(m.nome, '(sem motivo)') as motivo, count(*)::int as n from lab.negocio n left join lab.motivo_perda m on m.id = n.motivo_perda_id
      where n.operacao_id = ${op.id} and n.status = 'perdido' and n.tipo = 'novo' and (n.fechado_em at time zone ${op.fuso})::date >= ${de}::date and (n.fechado_em at time zone ${op.fuso})::date < ${ate}::date group by 1`,
    opts.comMargem ? relatorio(sql, op, { de, ate }) : Promise.resolve(null),
  ]);
  const soma: Record<string, number> = {};
  for (const r of reals) soma[r.indicador] = (soma[r.indicador] ?? 0) + r.quantidade;
  const novos = criados.filter(n => n.tipo === 'novo' && n.funilPrincipal), co = novos.map(degrauAlcancado);
  const ganhos = fechados.filter(n => n.status === 'ganho' && n.tipo === 'novo');
  const vazio = !reals.length && !criados.length && !fechados.length;
  const pos = (p: (typeof ESCADA)[number]) => ESCADA.indexOf(p);
  const tx = (a: (typeof ESCADA)[number], b: (typeof ESCADA)[number]) => { const n = co.filter(g => g >= pos(a)).length, k = co.filter(g => g >= pos(b)).length; return { v: n ? k / n : null, n, k }; };
  const taxas = { [TX.leadAg]: tx('lead', 'agendada'), [TX.agReal]: tx('agendada', 'realizada'), [TX.realOport]: tx('realizada', 'oportunidade'), [TX.oportVenda]: tx('oportunidade', 'ganho'), [TX.leadVenda]: tx('lead', 'ganho') };
  const receita = ganhos.reduce((s, g) => s + (g.valorFechado ?? 0), 0), ticket = ganhos.length ? receita / ganhos.length : null;
  const ciclosVenda = ganhos.filter(g => g.fechadoEm).map(g => Math.max(0, (Date.parse(g.fechadoEm!) - Date.parse(g.criadoEm)) / DIA));
  const porCanal = new Map<string, { receita: number; vendas: number }>();
  for (const g of ganhos) { const k = g.canal ?? '(sem canal)', x = porCanal.get(k) ?? { receita: 0, vendas: 0 }; x.receita += g.valorFechado ?? 0; x.vendas++; porCanal.set(k, x); }
  const med: Record<string, Medida> = {};
  const ok = (v: number | null, n?: number): Medida => (vazio ? { estado: 'ausente', nota: 'sem registros no período' } : v == null ? { estado: 'ausente', nota: 'sem base para medir' } : { v, n: n ?? null, estado: 'ok' });
  for (const k of VOLUMES) med[k] = ok(k === 'vendas' ? ganhos.length : k === 'receita' ? receita : (soma[k] ?? 0), k === 'receita' ? ganhos.length : undefined);
  if (!vazio && !reals.some(r => !['vendas', 'receita', 'oportunidades'].includes(r.indicador))) for (const k of ['tentativa', 'contato', 'agendamento', 'reuniao_realizada', 'proposta_enviada']) med[k] = { estado: 'ausente', nota: 'atividades não lançadas no período' };
  med.leads = ok(novos.length);
  for (const [k, t] of Object.entries(taxas)) med[k] = t.v == null ? { estado: 'ausente', nota: 'sem negócios na etapa de origem' } : { v: t.v, n: t.n, k: t.k, estado: 'ok' };
  med.ticket = ticket == null ? { estado: 'ausente', nota: 'sem vendas no período' } : { v: ticket, n: ganhos.length, estado: 'ok' };
  const margem = rel ? { v: rel.vendas.margemPercentual, n: rel.vendas.economia.filter(e => e.margemContribuicao != null).length } : null;
  med.margem = margem && margem.v != null ? { v: margem.v, n: margem.n, estado: 'ok' } : { estado: 'ausente', nota: rel ? 'vendas sem custos lançados' : 'margem não medida' };
  med.t_contato = { estado: 'ausente', nota: 'tempo até o primeiro contato não medido' };
  return {
    de, ate, vazio, med, leads: novos.length, ganhos: ganhos.length, receita, ticket, taxas, ciclosVenda, cicloMediano: mediana(ciclosVenda),
    canais: [...porCanal].map(([canal, x]) => ({ canal, ...x })), perdas: Object.fromEntries(perdasL.map(p => [p.motivo, p.n])), margem, temAtividades: reals.some(r => !['vendas', 'receita', 'oportunidades'].includes(r.indicador)),
  };
}

/* soma de medições de períodos vizinhos (as taxas somam k e n; o ticket é receita ÷ vendas) */
export function somarMedicoes(L: Medicao[]): Medicao {
  if (!L.length) throw new Error('nada para somar');
  if (L.length === 1) return L[0]!;
  const de = L[0]!.de, ate = L[L.length - 1]!.ate, vazio = L.every(m => m.vazio);
  const med: Record<string, Medida> = {};
  for (const k of [...VOLUMES, 'leads']) { const Ls = L.filter(m => m.med[k]?.estado === 'ok'); med[k] = !Ls.length ? { estado: 'ausente', nota: L[0]!.med[k]?.nota ?? 'sem registros no período' } : { v: Ls.reduce((s, m) => s + (m.med[k]!.v ?? 0), 0), n: k === 'receita' ? Ls.reduce((s, m) => s + (m.med[k]!.n ?? 0), 0) : null, estado: 'ok' }; }
  const taxas: Medicao['taxas'] = {};
  for (const k of Object.keys(L[0]!.taxas)) { const n = L.reduce((s, m) => s + (m.taxas[k]?.n ?? 0), 0), kk = L.reduce((s, m) => s + (m.taxas[k]?.k ?? 0), 0); taxas[k] = { v: n ? kk / n : null, n, k: kk }; med[k] = taxas[k]!.v == null ? { estado: 'ausente', nota: 'sem negócios na etapa de origem' } : { v: taxas[k]!.v, n, k: kk, estado: 'ok' }; }
  const ganhos = L.reduce((s, m) => s + m.ganhos, 0), receita = L.reduce((s, m) => s + m.receita, 0), ticket = ganhos ? receita / ganhos : null;
  med.ticket = ticket == null ? { estado: 'ausente', nota: 'sem vendas no período' } : { v: ticket, n: ganhos, estado: 'ok' };
  const mg = L.filter(m => m.margem && m.margem.v != null && m.margem.n > 0), mn = mg.reduce((s, m) => s + m.margem!.n, 0);
  const margem = mg.length ? { v: mg.reduce((s, m) => s + m.margem!.v! * m.margem!.n, 0) / mn, n: mn } : null;
  med.margem = margem ? { v: margem.v, n: margem.n, estado: 'ok' } : { estado: 'ausente', nota: 'vendas sem custos lançados' };
  med.t_contato = { estado: 'ausente', nota: 'tempo até o primeiro contato não medido' };
  const ciclosVenda = L.flatMap(m => m.ciclosVenda), porCanal = new Map<string, { receita: number; vendas: number }>(), perdas: Record<string, number> = {};
  for (const m of L) { for (const c of m.canais) { const x = porCanal.get(c.canal) ?? { receita: 0, vendas: 0 }; x.receita += c.receita; x.vendas += c.vendas; porCanal.set(c.canal, x); } for (const [k, n] of Object.entries(m.perdas)) perdas[k] = (perdas[k] ?? 0) + n; }
  return { de, ate, vazio, med, leads: L.reduce((s, m) => s + m.leads, 0), ganhos, receita, ticket, taxas, ciclosVenda, cicloMediano: mediana(ciclosVenda), canais: [...porCanal].map(([canal, x]) => ({ canal, ...x })), perdas, margem, temAtividades: L.some(m => m.temAtividades) };
}
