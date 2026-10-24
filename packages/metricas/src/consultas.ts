/* Leitura do modelo canônico (somente SELECT) e montagem do relatório. Os números saem das funções puras. */
import type { Sql } from 'postgres';
import type { ContratoLinha, EventoCSLinha, InvestimentoLinha, NegocioLinha, Periodo, PrecoLinha } from './tipos.js';
import { eficienciaPorCanal, economiaDaVenda } from './canais.js';
import { conversaoPorCoorte, fluxoPorPapel, taxaDeGanho } from './funil.js';
import { retencao } from './retencao.js';
import { arredondar, soma } from './estatistica.js';

const DATA = /^\d{4}-\d{2}-\d{2}$/;
export function validarPeriodo(p: Periodo): string | null {
  if (!DATA.test(p.de) || !DATA.test(p.ate) || Number.isNaN(Date.parse(p.de)) || Number.isNaN(Date.parse(p.ate))) return 'informe de e ate no formato AAAA-MM-DD';
  return p.de < p.ate ? null : '"de" deve ser anterior a "ate"';
}

export async function operacaoPorSlug(sql: Sql, slug: string) {
  const [op] = await sql<{ id: string; slug: string; nome: string; fuso: string }[]>`select id, slug, nome, fuso from lab.operacao where slug = ${slug}`;
  return op ?? null;
}

export async function negocios(sql: Sql, opId: string, fuso: string, filtro: 'criados' | 'fechados', p: Periodo): Promise<NegocioLinha[]> {
  const col = filtro === 'criados' ? sql`n.criado_em` : sql`n.fechado_em`;
  const linhas = await sql<any[]>`
    select n.id, n.tipo, c.chave as canal, n.status, e.papel as papel_atual, f.principal,
           n.valor_fechado, n.criado_em, n.fechado_em,
           coalesce((select array_agg(distinct e2.papel) from lab.negocio_transicao t join lab.etapa e2 on e2.id = t.para_etapa_id where t.negocio_id = n.id), '{}') as alcancados
    from lab.negocio n join lab.etapa e on e.id = n.etapa_id join lab.funil f on f.id = n.funil_id left join lab.canal c on c.id = n.canal_id
    where n.operacao_id = ${opId} and (${col} at time zone ${fuso})::date >= ${p.de}::date and (${col} at time zone ${fuso})::date < ${p.ate}::date
      ${filtro === 'fechados' ? sql`and n.status <> 'aberto'` : sql``}`;
  return linhas.map(l => ({
    id: l.id, tipo: l.tipo, canal: l.canal, status: l.status, papelAtual: l.papel_atual, papeisAlcancados: l.alcancados,
    valorFechado: l.valor_fechado == null ? null : Number(l.valor_fechado), criadoEm: new Date(l.criado_em).toISOString(),
    fechadoEm: l.fechado_em ? new Date(l.fechado_em).toISOString() : null, funilPrincipal: l.principal,
  }));
}

async function precos(sql: Sql, ids: string[]): Promise<Map<string, PrecoLinha[]>> {
  const mapa = new Map<string, PrecoLinha[]>();
  if (!ids.length) return mapa;
  const linhas = await sql<any[]>`select negocio_id, momento, valor, linhas from lab.preco_negocio where negocio_id in ${sql(ids)} order by em, id`;
  for (const l of linhas) {
    const lista = mapa.get(l.negocio_id) ?? [];
    lista.push({ negocioId: l.negocio_id, momento: l.momento, valor: Number(l.valor), linhas: (l.linhas ?? []).map((x: any) => ({ chave: String(x.chave), valor: Number(x.valor) })) });
    mapa.set(l.negocio_id, lista);
  }
  return mapa;
}

async function contratos(sql: Sql, opId: string): Promise<ContratoLinha[]> {
  const l = await sql<any[]>`select id, conta_id, negocio_origem_id, recorrente, valor_periodo, periodicidade_meses, inicio::text, fim::text, status from lab.contrato where operacao_id = ${opId}`;
  return l.map(c => ({ id: c.id, contaId: c.conta_id, negocioOrigemId: c.negocio_origem_id, recorrente: c.recorrente, valorPeriodo: Number(c.valor_periodo), periodicidadeMeses: c.periodicidade_meses, inicio: c.inicio, fim: c.fim, status: c.status }));
}

export async function relatorio(sql: Sql, op: { id: string; fuso: string }, p: Periodo) {
  const [criados, ganhos, fechados, invs, trans, ctrs, evs] = await Promise.all([
    negocios(sql, op.id, op.fuso, 'criados', p),
    negocios(sql, op.id, op.fuso, 'fechados', p).then(l => l.filter(n => n.status === 'ganho')),
    negocios(sql, op.id, op.fuso, 'fechados', p),
    sql<any[]>`select c.chave as canal, i.valor, i.leads_plataforma from lab.investimento_canal i join lab.canal c on c.id = i.canal_id
               where i.operacao_id = ${op.id} and i.mes >= date_trunc('month', ${p.de}::date) and i.mes < ${p.ate}::date`,
    sql<any[]>`select t.negocio_id, e.papel from lab.negocio_transicao t join lab.etapa e on e.id = t.para_etapa_id
               where t.operacao_id = ${op.id} and (t.em at time zone ${op.fuso})::date >= ${p.de}::date and (t.em at time zone ${op.fuso})::date < ${p.ate}::date`,
    contratos(sql, op.id),
    sql<any[]>`select conta_id, tipo, em, valor from lab.evento_cs where operacao_id = ${op.id}`,
  ]);
  const investimentos: InvestimentoLinha[] = invs.map(i => ({ canal: i.canal, valor: Number(i.valor), leadsPlataforma: i.leads_plataforma }));
  const eventos: EventoCSLinha[] = evs.map(e => ({ contaId: e.conta_id, tipo: e.tipo, em: new Date(e.em).toISOString(), valor: e.valor == null ? null : Number(e.valor) }));
  const precosPorNegocio = await precos(sql, ganhos.map(n => n.id));
  const economia = ganhos.map(n => economiaDaVenda(n, precosPorNegocio.get(n.id) ?? []));
  const comMc = economia.filter(e => e.margemContribuicao != null);
  const receitaComMc = soma(comMc.map(e => e.fechado));
  const margem = receitaComMc ? soma(comMc.map(e => e.margemContribuicao)) / receitaComMc : null;

  return {
    periodo: p,
    canais: eficienciaPorCanal({ negociosCriados: criados, negociosGanhos: ganhos, investimentos, precosPorNegocio, contratos: ctrs }),
    coorte: conversaoPorCoorte(criados),
    fluxo: fluxoPorPapel(trans.map(t => ({ negocioId: t.negocio_id, papel: t.papel }))),
    taxaDeGanho: taxaDeGanho(fechados),
    vendas: { quantidade: ganhos.length, receita: soma(ganhos.map(n => n.valorFechado)), margemPercentual: arredondar(margem, 4), economia },
    retencao: retencao({ contratos: ctrs, eventos, periodo: p, margem }),
  };
}
