/* Monta o contexto de números das fórmulas a partir do modelo canônico, reaproveitando as funções donas (fases 2 e 3). */
import type { Sql } from 'postgres';
import { relatorio } from '@lab/metricas';
import { cicloDaOperacao, ritmo, somarDias, type Operacao } from '@lab/planejamento';
import { VARIAVEIS, type Contexto } from '@lab/nucleo';

const soma = (xs: Array<number | null | undefined>) => xs.reduce<number>((s, x) => s + (x ?? 0), 0);
const div = (a: number | null, b: number | null) => (a == null || b == null || b === 0 ? null : a / b);
const PIOR: Record<string, number> = { atras: 3, atencao: 2, no_ritmo: 1 };

export interface OpcoesContexto { amostraMinima?: number }

export async function montarContexto(sql: Sql, op: Operacao, hoje: string, opcoes: OpcoesContexto = {}): Promise<Contexto> {
  const de = somarDias(hoje, -op.janelaHistoricaDias), ate = somarDias(hoje, 1);
  const [r, pipeline, perdas, ritmoHoje] = await Promise.all([
    relatorio(sql, op, { de, ate }),
    sql<any[]>`
      select count(*)::int as abertos, coalesce(sum(n.valor_estimado), 0) as valor,
             count(*) filter (where e.prazo_dias is not null and coalesce(n.etapa_desde, n.criado_em) < now() - make_interval(days => e.prazo_dias))::int as parados,
             coalesce(sum(n.valor_estimado) filter (where e.prazo_dias is not null and coalesce(n.etapa_desde, n.criado_em) < now() - make_interval(days => e.prazo_dias)), 0) as valor_parado
      from lab.negocio n join lab.etapa e on e.id = n.etapa_id
      where n.operacao_id = ${op.id} and n.status = 'aberto' and n.tipo = 'novo'`,
    sql<any[]>`
      select count(*)::int as perdidos, coalesce(sum(n.valor_estimado), 0) as valor,
             coalesce(sum(n.valor_estimado) filter (where m.grupo = 'preco'), 0) as valor_preco
      from lab.negocio n left join lab.motivo_perda m on m.id = n.motivo_perda_id
      where n.operacao_id = ${op.id} and n.status = 'perdido' and n.tipo = 'novo'
        and (n.fechado_em at time zone ${op.fuso})::date >= ${de}::date and (n.fechado_em at time zone ${op.fuso})::date < ${ate}::date`,
    ritmo(sql, op, hoje),
  ]);

  const canais = r.canais;
  const leads = soma(canais.map(c => c.leads)), vendas = soma(canais.map(c => c.vendas)), receita = soma(canais.map(c => c.receita));
  const invs = canais.map(c => c.investimento).filter((x): x is number => x != null);
  const investimento = invs.length ? soma(invs) : null;
  const etapa = (papel: string) => r.coorte.etapas.find(e => e.papel === papel)?.taxa ?? null;
  const passo = (para: string) => r.coorte.passoAPasso.find(p => p.para === para)?.taxa ?? null;
  const descontos = r.vendas.economia.map(e => e.descontoSobreReferencia).filter((x): x is number => x != null);
  const p = pipeline[0] ?? {}, pd = perdas[0] ?? {};

  /* ritmo: pior indicador de cada pessoa; a receita da operação vem da linha sem pessoa */
  const porPessoa = new Map<string, string | null>();
  for (const l of ritmoHoje.linhas) if (l.pessoaId) {
    const atual = porPessoa.get(l.pessoaId) ?? null;
    if ((PIOR[l.status ?? ''] ?? 0) > (PIOR[atual ?? ''] ?? 0)) porPessoa.set(l.pessoaId, l.status); else if (!porPessoa.has(l.pessoaId)) porPessoa.set(l.pessoaId, l.status);
  }
  const comMeta = [...porPessoa.values()].filter(s => s);
  const atras = comMeta.filter(s => s === 'atras').length;
  const rec = ritmoHoje.linhas.find(l => !l.pessoaId && l.indicador === 'receita');
  const uteis = cicloDaOperacao(op, hoje).uteis;

  const ctx: Contexto = {
    leads, vendas, fechados: r.taxaDeGanho.total, receita, ticket_medio: div(receita, vendas), taxa_ganho: r.taxaDeGanho.taxa,
    conv_contato: etapa('contato'), conv_qualificado: etapa('qualificado'), conv_agendada: etapa('agendada'), conv_realizada: etapa('realizada'),
    conv_oportunidade: etapa('oportunidade'), conv_proposta: etapa('proposta'), conv_ganho: etapa('ganho'),
    passo_agendada: passo('agendada'), passo_realizada: passo('realizada'), passo_proposta: passo('proposta'), passo_ganho: passo('ganho'),
    amostra_coorte: r.coorte.coorte, amostra_minima: opcoes.amostraMinima ?? 10,
    desconto_medio: descontos.length ? soma(descontos) / descontos.length : null,
    margem_percentual: r.vendas.margemPercentual,
    investimento_total: investimento, cac_medio: div(investimento, vendas || null), cpl_medio: div(investimento, leads || null),
    roi_aquisicao: investimento ? (receita - investimento) / investimento : null,
    negocios_abertos: p.abertos ?? 0, valor_aberto: Number(p.valor ?? 0), negocios_parados: p.parados ?? 0, valor_parado: Number(p.valor_parado ?? 0),
    perdidos: pd.perdidos ?? 0, valor_perdido: Number(pd.valor ?? 0), valor_perdido_preco: Number(pd.valor_preco ?? 0),
    mrr_inicial: r.retencao.mrrInicial, churn_receita: r.retencao.churnReceita, churn_logos: r.retencao.churnLogos,
    retencao_liquida: r.retencao.retencaoLiquida, ltv: r.retencao.ltv,
    pessoas_com_meta: comMeta.length, pessoas_atras: atras, pct_atras: comMeta.length ? atras / comMeta.length : null,
    meta_receita_ciclo: rec?.metaDoCiclo ?? null, receita_ate_hoje: rec ? rec.realizadoNoCiclo : null, receita_esperada_ate_hoje: rec ? rec.esperadoAteHoje : null,
    dias_uteis_restantes: uteis.filter(d => d >= hoje).length,
  };
  for (const k of Object.keys(VARIAVEIS)) if (!(k in ctx)) throw new Error(`variável do catálogo sem valor no contexto: ${k}`);
  return ctx;
}
