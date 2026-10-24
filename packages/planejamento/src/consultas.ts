/* Leitura do modelo e montagem das visões de planejamento. Gravar só em lab.meta, e só acrescentando. */
import type { Sql } from 'postgres';
import { negocios, soma, degrauAlcancado, ESCADA } from '@lab/metricas';
import { cicloDe, diasUteis, somarDias, type CalendarioOperacao } from './calendario.js';
import { buildupReverso, type Degrau, type Taxas } from './buildup.js';
import { contingencia, esperadoAteHoje, fechamentoDoDia, statusDoRitmo, type MetaVigente, type Realizado } from './ritmo.js';

export const INDICADORES = ['receita', 'vendas', 'oportunidades', 'reuniao_realizada', 'agendamento', 'contato', 'tentativa', 'proposta_enviada'] as const;
const DATA = /^\d{4}-\d{2}-\d{2}$/;
export const dataValida = (d: string) => DATA.test(d) && !Number.isNaN(Date.parse(d));

export interface Operacao { id: string; slug: string; nome: string; fuso: string; calendario: CalendarioOperacao; janelaHistoricaDias: number }

export async function operacao(sql: Sql, slug: string): Promise<Operacao | null> {
  const [o] = await sql<any[]>`select id, slug, nome, fuso, pack from lab.operacao where slug = ${slug}`;
  if (!o) return null;
  const c = o.pack?.calendario ?? {};
  return {
    id: o.id, slug: o.slug, nome: o.nome, fuso: o.fuso, janelaHistoricaDias: o.pack?.parametros?.janelaHistoricaDias ?? 180,
    calendario: { feriados: c.feriados ?? 'BR', diasUteis: c.diasUteis ?? [1, 2, 3, 4, 5], inicioCicloDia: c.inicioCicloDia ?? 1 },
  };
}

export function hojeNoFuso(fuso: string, agora = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
}

export function cicloDaOperacao(op: Operacao, data: string) {
  const ciclo = cicloDe(data, op.calendario.inicioCicloDia);
  return { ...ciclo, uteis: diasUteis(ciclo.inicio, ciclo.fim, op.calendario) };
}

/* meta mais recente de cada (indicador, pessoa) no ciclo */
export async function metasVigentes(sql: Sql, opId: string, cicloInicio: string): Promise<MetaVigente[]> {
  const l = await sql<any[]>`select distinct on (indicador, pessoa_id) indicador, pessoa_id, valor from lab.meta
    where operacao_id = ${opId} and ciclo_inicio = ${cicloInicio}::date order by indicador, pessoa_id, id desc`;
  return l.map(m => ({ indicador: m.indicador, pessoaId: m.pessoa_id, valor: Number(m.valor) }));
}

export async function acrescentarMetas(sql: Sql, opId: string, cicloInicio: string, metas: Array<{ indicador: string; pessoaId?: string | null; valor: number; nota?: string }>) {
  for (const m of metas) {
    if (!(INDICADORES as readonly string[]).includes(m.indicador)) throw new Error(`indicador desconhecido: ${m.indicador}`);
    if (!(m.valor >= 0) || !Number.isFinite(m.valor)) throw new Error(`valor inválido para ${m.indicador}`);
    if (m.pessoaId) {
      const [p] = await sql`select 1 from lab.pessoa where id = ${m.pessoaId} and operacao_id = ${opId}`;
      if (!p) throw new Error(`pessoa não encontrada nesta operação: ${m.pessoaId}`);
    }
  }
  if (!metas.length) return 0;
  await sql`insert into lab.meta ${sql(metas.map(m => ({ operacao_id: opId, ciclo_inicio: cicloInicio, indicador: m.indicador, pessoa_id: m.pessoaId ?? null, valor: m.valor, nota: m.nota ?? null })))}`;
  return metas.length;
}

/* realizado por pessoa, indicador e dia. Atividades pelo papel; vendas e receita pelos negócios ganhos; oportunidades pelas transições. */
export async function realizados(sql: Sql, op: Operacao, de: string, ate: string): Promise<Realizado[]> {
  const [ativ, vendas, oport] = await Promise.all([
    sql<any[]>`select a.pessoa_id, t.papel as indicador, (a.em at time zone ${op.fuso})::date::text as dia, sum(a.quantidade)::int as q
      from lab.atividade a join lab.tipo_atividade t on t.id = a.tipo_id
      where a.operacao_id = ${op.id} and (a.em at time zone ${op.fuso})::date >= ${de}::date and (a.em at time zone ${op.fuso})::date < ${ate}::date
      group by 1, 2, 3`,
    sql<any[]>`select dono_id as pessoa_id, (fechado_em at time zone ${op.fuso})::date::text as dia, count(*)::int as q, coalesce(sum(valor_fechado), 0) as r
      from lab.negocio where operacao_id = ${op.id} and status = 'ganho' and tipo = 'novo'
        and (fechado_em at time zone ${op.fuso})::date >= ${de}::date and (fechado_em at time zone ${op.fuso})::date < ${ate}::date group by 1, 2`,
    sql<any[]>`select t.dono_id as pessoa_id, (t.em at time zone ${op.fuso})::date::text as dia, count(distinct t.negocio_id)::int as q
      from lab.negocio_transicao t join lab.etapa e on e.id = t.para_etapa_id
      where t.operacao_id = ${op.id} and e.papel = 'oportunidade'
        and (t.em at time zone ${op.fuso})::date >= ${de}::date and (t.em at time zone ${op.fuso})::date < ${ate}::date group by 1, 2`,
  ]);
  return [
    ...ativ.map(a => ({ pessoaId: a.pessoa_id, indicador: a.indicador, dia: a.dia, quantidade: a.q })),
    ...vendas.flatMap(v => [{ pessoaId: v.pessoa_id, indicador: 'vendas', dia: v.dia, quantidade: v.q }, { pessoaId: v.pessoa_id, indicador: 'receita', dia: v.dia, quantidade: Number(v.r) }]),
    ...oport.map(o => ({ pessoaId: o.pessoa_id, indicador: 'oportunidades', dia: o.dia, quantidade: o.q })),
  ];
}

/* a meta da operação inteira é a soma das pessoas, a menos que exista uma linha própria (pessoaId nulo) */
function comTotais(rs: Realizado[]): Realizado[] {
  return [...rs, ...rs.filter(r => r.pessoaId).map(r => ({ ...r, pessoaId: null }))];
}

export async function ritmo(sql: Sql, op: Operacao, hoje: string) {
  const ciclo = cicloDaOperacao(op, hoje);
  const [metas, rs] = await Promise.all([metasVigentes(sql, op.id, ciclo.inicio), realizados(sql, op, ciclo.inicio, somarDias(hoje, 1))]);
  const todos = comTotais(rs);
  const linhas = fechamentoDoDia({ dia: hoje, ciclo, uteis: ciclo.uteis, metas, realizados: todos });
  const nomes = new Map((await sql<any[]>`select id, nome from lab.pessoa where operacao_id = ${op.id}`).map(p => [p.id as string, p.nome as string]));
  return { ciclo: { inicio: ciclo.inicio, fim: ciclo.fim, diasUteis: ciclo.uteis.length, diasUteisPassados: ciclo.uteis.filter(d => d <= hoje).length }, hoje, linhas: linhas.map(l => ({ ...l, pessoa: l.pessoaId ? nomes.get(l.pessoaId) ?? null : 'operação' })) };
}

export async function fechamento(sql: Sql, op: Operacao, dia: string) {
  const r = await ritmo(sql, op, dia);
  const uteis = cicloDaOperacao(op, dia).uteis;
  const ehUtil = uteis.includes(dia);
  const atrasadas = r.linhas.filter(l => l.status === 'atras');
  const resumo = [
    ehUtil ? `Fechamento de ${dia}: dia ${r.ciclo.diasUteisPassados} de ${r.ciclo.diasUteis} úteis do ciclo.` : `${dia} não é dia útil neste calendário.`,
    ...r.linhas.filter(l => l.status).map(l => `${l.pessoa} · ${l.indicador}: ${l.realizadoNoCiclo} de ${l.esperadoAteHoje} esperados (${(l.status ?? '').replace('_', ' ')})${l.planoAmanha != null ? `; amanhã: ${l.planoAmanha}` : ''}`),
    atrasadas.length ? `${atrasadas.length} linha(s) atrás do ritmo.` : 'Ninguém atrás do ritmo.',
  ];
  return { ...r, ehDiaUtil: ehUtil, resumo };
}

/* taxas históricas dos degraus, na janela anterior à data. Sem base suficiente, a taxa é nula. */
export async function taxasHistoricas(sql: Sql, op: Operacao, ate: string): Promise<{ taxas: Taxas; ticketMedio: number | null; canais: Record<string, number>; base: Record<string, number> }> {
  const de = somarDias(ate, -op.janelaHistoricaDias);
  const [ativ, criados, fechados] = await Promise.all([
    sql<any[]>`select t.papel, coalesce(sum(a.quantidade), 0)::int as q from lab.atividade a join lab.tipo_atividade t on t.id = a.tipo_id
      where a.operacao_id = ${op.id} and (a.em at time zone ${op.fuso})::date >= ${de}::date and (a.em at time zone ${op.fuso})::date < ${ate}::date group by 1`,
    negocios(sql, op.id, op.fuso, 'criados', { de, ate }),
    negocios(sql, op.id, op.fuso, 'fechados', { de, ate }),
  ]);
  const q = (p: string) => Number(ativ.find(a => a.papel === p)?.q ?? 0);
  const coorte = criados.filter(n => n.tipo === 'novo' && n.funilPrincipal).map(degrauAlcancado);
  const ate_ = (papel: (typeof ESCADA)[number]) => coorte.filter(g => g >= ESCADA.indexOf(papel)).length;
  const razao = (a: number, b: number) => (b > 0 && a > 0 ? Math.min(a / b, 1) : null);
  const ganhos = fechados.filter(n => n.status === 'ganho' && n.tipo === 'novo');
  const porCanal = new Map<string, number>();
  for (const g of ganhos) porCanal.set(g.canal ?? '(sem canal)', (porCanal.get(g.canal ?? '(sem canal)') ?? 0) + 1);
  return {
    taxas: {
      oportunidades: razao(ate_('ganho'), ate_('oportunidade')),   // vendas ÷ oportunidades
      reuniao_realizada: razao(ate_('oportunidade'), ate_('realizada')),
      agendamento: razao(q('reuniao_realizada'), q('agendamento')),
      contato: razao(q('agendamento'), q('contato')),
      tentativa: razao(q('contato'), q('tentativa')),
    },
    ticketMedio: ganhos.length ? soma(ganhos.map(g => g.valorFechado)) / ganhos.length : null,
    canais: ganhos.length ? Object.fromEntries([...porCanal].map(([c, n]) => [c, n / ganhos.length])) : {},
    base: { vendas: ganhos.length, tentativas: q('tentativa'), contatos: q('contato'), agendamentos: q('agendamento'), reunioes: q('reuniao_realizada') },
  };
}

export async function sugestaoBuildup(sql: Sql, op: Operacao, hoje: string, receita: number, sobrescrever: { ticketMedio?: number; taxas?: Taxas } = {}) {
  const ciclo = cicloDaOperacao(op, hoje);
  const hist = await taxasHistoricas(sql, op, ciclo.inicio);
  const pessoas = (await sql<any[]>`select id, nome, funcao from lab.pessoa where operacao_id = ${op.id} and ativa order by nome`).map(p => ({ id: p.id as string, nome: p.nome as string, funcao: p.funcao }));
  const taxas = { ...hist.taxas, ...sobrescrever.taxas };
  const r = buildupReverso({
    receita, ticketMedio: sobrescrever.ticketMedio ?? hist.ticketMedio, taxas, diasUteis: ciclo.uteis.length, pessoas,
    ...(Object.keys(hist.canais).length ? { canais: hist.canais } : {}),
  });
  return { ciclo: { inicio: ciclo.inicio, fim: ciclo.fim, diasUteis: ciclo.uteis.length }, receita, ticketMedio: sobrescrever.ticketMedio ?? hist.ticketMedio, taxas, baseHistorica: hist.base, ...r };
}

export { contingencia, esperadoAteHoje, statusDoRitmo };
export type { Degrau };
