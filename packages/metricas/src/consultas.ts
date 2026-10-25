/* Leitura do modelo canônico (somente SELECT) e montagem do relatório. Os números saem das funções puras. */
import type { Sql } from 'postgres';
import type { ContratoLinha, EventoCSLinha, InvestimentoLinha, NegocioLinha, Periodo, PrecoLinha } from './tipos.js';
import { eficienciaPorCanal, economiaDaVenda, type Politicas } from './canais.js';
import { politicaDe } from '@lab/economia';
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
           coalesce((select jsonb_agg(distinct e2.papel) from lab.negocio_transicao t join lab.etapa e2 on e2.id = t.para_etapa_id where t.negocio_id = n.id), '[]'::jsonb) as alcancados
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
  const linhas = await sql<any[]>`select p.negocio_id, p.momento, p.valor, p.linhas, c.chave as condicao, p.politica_versao, p.comissao_fixa from lab.preco_negocio p left join lab.condicao_pagamento c on c.id = p.condicao_id where p.negocio_id in ${sql(ids)} order by p.em, p.id`;
  for (const l of linhas) {
    const lista = mapa.get(l.negocio_id) ?? [];
    lista.push({ negocioId: l.negocio_id, momento: l.momento, valor: Number(l.valor), linhas: (l.linhas ?? []).map((x: any) => ({ chave: String(x.chave), valor: Number(x.valor), ...(x.categoria ? { categoria: x.categoria } : {}) })), condicao: l.condicao ?? null, politicaVersao: l.politica_versao == null ? null : Number(l.politica_versao), comissaoFixa: l.comissao_fixa == null ? null : Number(l.comissao_fixa) });
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
    sql<any[]>`select c.chave as canal, i.valor, i.leads_plataforma, i.mes::text as mes from lab.investimento_canal i join lab.canal c on c.id = i.canal_id
               where i.operacao_id = ${op.id} and i.mes >= date_trunc('month', ${p.de}::date) and i.mes < ${p.ate}::date`,
    sql<any[]>`select t.negocio_id, e.papel from lab.negocio_transicao t join lab.etapa e on e.id = t.para_etapa_id
               where t.operacao_id = ${op.id} and (t.em at time zone ${op.fuso})::date >= ${p.de}::date and (t.em at time zone ${op.fuso})::date < ${p.ate}::date`,
    contratos(sql, op.id),
    sql<any[]>`select conta_id, tipo, em, valor from lab.evento_cs where operacao_id = ${op.id}`,
  ]);
  const investimentos: InvestimentoLinha[] = invs.map(i => ({ canal: i.canal, valor: Number(i.valor), leadsPlataforma: i.leads_plataforma, mes: i.mes }));
  const politicas = await politicasDaOperacao(sql, op.id);
  const mesesDoPeriodo = mesesEntre(p.de, p.ate);
  const eventos: EventoCSLinha[] = evs.map(e => ({ contaId: e.conta_id, tipo: e.tipo, em: new Date(e.em).toISOString(), valor: e.valor == null ? null : Number(e.valor) }));
  const precosPorNegocio = await precos(sql, ganhos.map(n => n.id));
  const economia = ganhos.map(n => economiaDaVenda(n, precosPorNegocio.get(n.id) ?? [], politicas));
  const comMc = economia.filter(e => e.margemContribuicao != null);
  /* margem agregada = Σ MC ÷ Σ receita líquida (base única), não média das margens */
  const rlComMc = soma(comMc.map(e => e.receitaLiquida)), receitaComMc = soma(comMc.map(e => e.fechado));
  const margem = rlComMc ? soma(comMc.map(e => e.margemContribuicao)) / rlComMc : null;

  return {
    periodo: p,
    canais: eficienciaPorCanal({ negociosCriados: criados, negociosGanhos: ganhos, investimentos, precosPorNegocio, contratos: ctrs, politicas, mesesDoPeriodo }),
    coorte: conversaoPorCoorte(criados),
    fluxo: fluxoPorPapel(trans.map(t => ({ negocioId: t.negocio_id, papel: t.papel }))),
    taxaDeGanho: taxaDeGanho(fechados),
    vendas: { quantidade: ganhos.length, receita: soma(ganhos.map(n => n.valorFechado)), margemPercentual: arredondar(margem, 4), margemPercentualPreco: arredondar(receitaComMc ? soma(comMc.map(e => e.margemContribuicao)) / receitaComMc : null, 4), economia },
    retencao: retencao({ contratos: ctrs, eventos, periodo: p, margem }),
  };
}

/* meses AAAA-MM que cabem inteiros em [de, ate): o mês em curso (ainda sem fechar) não cobra lançamento (D21 vale para mês terminado) */
export function mesesEntre(de: string, ate: string): string[] {
  const out: string[] = []; let a = Number(de.slice(0, 4)), m = Number(de.slice(5, 7));
  for (let i = 0; i < 120; i++) {
    const k = a + '-' + String(m).padStart(2, '0'), fimMes = (m === 12 ? a + 1 + '-01' : a + '-' + String(m + 1).padStart(2, '0')) + '-01';
    if (fimMes > ate) break; out.push(k); m++; if (m > 12) { m = 1; a++; }
  }
  return out;
}
/* a política vigente e as versões anteriores (cada venda guarda a versão do dia) */
export async function politicasDaOperacao(sql: Sql, opId: string): Promise<Politicas> {
  const L = await sql<any[]>`select versao, margem_alvo, margem_minima, desconto_maximo, linhas, condicoes, comissao, custo_capital_mes, custos_fixos_mes, lucro_desejado_mes from lab.politica_preco where operacao_id = ${opId} order by versao`;
  const porVersao = new Map(L.map(r => [Number(r.versao), politicaDe({ margemAlvo: r.margem_alvo == null ? null : Number(r.margem_alvo), margemMinima: r.margem_minima == null ? null : Number(r.margem_minima), descontoMaximo: r.desconto_maximo == null ? null : Number(r.desconto_maximo),
    custoCapitalMes: Number(r.custo_capital_mes ?? 0), custosFixosMes: r.custos_fixos_mes == null ? null : Number(r.custos_fixos_mes), lucroDesejadoMes: r.lucro_desejado_mes == null ? null : Number(r.lucro_desejado_mes), comissao: r.comissao ?? { tipo: 'nenhuma' }, linhas: r.linhas ?? [], condicoes: r.condicoes ?? [] }, Number(r.versao))]));
  const ult = L.length ? porVersao.get(Number(L[L.length - 1].versao))! : politicaDe({});
  return { vigente: ult, porVersao };
}
