/* Eficiência de aquisição por canal: CPL, CAC, ROI, payback e margem de contribuição. A economia de cada venda vem do motor único (@lab/economia). */
import { economiaDaVenda as economia, POLITICA_VAZIA, type Economia, type Politica } from '@lab/economia';
import type { InvestimentoLinha, NegocioLinha, PrecoLinha, ContratoLinha } from './tipos.js';
import { arredondar, razao, soma } from './estatistica.js';

export interface EconomiaVenda {
  negocioId: string; referencia: number | null; aprovado: number | null; fechado: number | null;
  descontoSobreReferencia: number | null; descontoSobreAprovado: number | null;
  custos: Array<{ chave: string; valor: number }>; margemContribuicao: number | null; margemPercentual: number | null;
  receitaLiquida: number | null; economia: Economia | null; politicaVersao: number | null;
}
/* políticas: a vigente e, por versão, as congeladas nas vendas (a venda guarda a versão do dia) */
export interface Politicas { vigente: Politica; porVersao?: Map<number, Politica> }
const ultimo = (precos: PrecoLinha[], momento: PrecoLinha['momento']) => precos.filter(p => p.momento === momento).at(-1);

/* precos: em ordem cronológica (o último registro de cada momento vale). MC e MC % saem do motor: receita líquida − custos − custo do prazo; MC % sobre a RL. */
export function economiaDaVenda(negocio: Pick<NegocioLinha, 'id' | 'valorFechado'>, precos: PrecoLinha[], politicas?: Politicas | null): EconomiaVenda {
  const ref = ultimo(precos, 'referencia'), apr = ultimo(precos, 'aprovado'), fec = ultimo(precos, 'fechado');
  const fechado = fec?.valor ?? negocio.valorFechado ?? null;
  const custos = fec?.linhas ?? [];
  const pol = fec?.politicaVersao != null && politicas?.porVersao?.get(fec.politicaVersao) ? politicas.porVersao.get(fec.politicaVersao)! : politicas?.vigente ?? POLITICA_VAZIA;
  const econ = fechado != null && fec ? economia({ preco: fechado, custos, condicao: fec.condicao ?? null, comissaoFixa: fec.comissaoFixa ?? null }, pol) : null;
  const desc = (base?: number) => (base && fechado != null ? 1 - fechado / base : null);
  return {
    negocioId: negocio.id, referencia: ref?.valor ?? null, aprovado: apr?.valor ?? null, fechado,
    descontoSobreReferencia: desc(ref?.valor), descontoSobreAprovado: desc(apr?.valor),
    custos, margemContribuicao: econ ? econ.mc : null, margemPercentual: econ ? econ.mcPct : null, receitaLiquida: econ ? econ.receitaLiquida : null, economia: econ, politicaVersao: econ ? econ.politicaVersao : null,
  };
}

export interface LinhaCanal {
  canal: string; investimento: number | null; leads: number; vendas: number; receita: number;
  cpl: number | null; cac: number | null; roi: number | null;
  margemContribuicao: number | null; mcMenosCac: number | null; paybackMeses: number | null;
  investimentoIncompleto: boolean; mesesSemLancamento: string[];   // D21: mês do período sem investimento lançado → CPL, CAC e ROI ficam nulos, não errados
  retorno: number | null; roiSobreMargem: number | null;           // "receita não é lucro": retorno = MC − investimento; ROI sobre margem = MC ÷ investimento − 1
}

/* Leads = negócios novos criados no período; vendas = novos ganhos no período. */
export function eficienciaPorCanal(args: {
  negociosCriados: NegocioLinha[]; negociosGanhos: NegocioLinha[]; investimentos: InvestimentoLinha[];
  precosPorNegocio: Map<string, PrecoLinha[]>; contratos: ContratoLinha[]; politicas?: Politicas | null; mesesDoPeriodo?: string[];
}): LinhaCanal[] {
  const SEM = '(sem canal)';
  const canais = new Set<string>([...args.investimentos.map(i => i.canal), ...args.negociosCriados.map(n => n.canal ?? SEM), ...args.negociosGanhos.map(n => n.canal ?? SEM)]);
  return [...canais].sort().map(canal => {
    const inv = args.investimentos.filter(i => i.canal === canal);
    /* D21: a partir do primeiro mês lançado do canal, todo mês do período precisa de lançamento; faltando um, CPL/CAC/ROI ficam nulos (não errados) */
    const primeiro = inv.map(i => (i.mes ?? '').slice(0, 7)).filter(Boolean).sort()[0];
    const mesesSemLancamento = inv.length && primeiro && args.mesesDoPeriodo?.length ? args.mesesDoPeriodo.filter(m => m >= primeiro && !inv.some(i => (i.mes ?? '').slice(0, 7) === m)) : [];
    const incompleto = mesesSemLancamento.length > 0;
    const investimento = inv.length && !incompleto ? soma(inv.map(i => i.valor)) : null;
    const leads = args.negociosCriados.filter(n => n.tipo === 'novo' && (n.canal ?? SEM) === canal).length;
    const ganhos = args.negociosGanhos.filter(n => n.tipo === 'novo' && (n.canal ?? SEM) === canal);
    const receita = soma(ganhos.map(n => n.valorFechado));
    const econ = ganhos.map(n => economiaDaVenda(n, args.precosPorNegocio.get(n.id) ?? [], args.politicas));
    const comMc = econ.filter(e => e.margemContribuicao != null);
    const mcTotal = comMc.length ? soma(comMc.map(e => e.margemContribuicao)) : null;
    const cac = investimento != null ? razao(investimento, ganhos.length) : null;

    /* payback: CAC ÷ margem mensal por venda, só para vendas com contrato recorrente */
    let paybackMeses: number | null = null;
    if (cac != null) {
      const mensais = ganhos.flatMap(n => {
        const c = args.contratos.find(k => k.negocioOrigemId === n.id && k.recorrente && k.periodicidadeMeses);
        const e = econ.find(x => x.negocioId === n.id);
        return c && e?.margemPercentual != null ? [(c.valorPeriodo / c.periodicidadeMeses!) * e.margemPercentual] : [];
      });
      if (mensais.length) paybackMeses = razao(cac, soma(mensais) / mensais.length);
    }
    return {
      canal, investimento, leads, vendas: ganhos.length, receita,
      cpl: investimento != null ? arredondar(razao(investimento, leads)) : null,
      cac: arredondar(cac),
      roi: investimento ? arredondar((receita - investimento) / investimento, 4) : null,
      margemContribuicao: mcTotal,
      mcMenosCac: mcTotal != null && investimento != null ? mcTotal - investimento : null,
      paybackMeses: arredondar(paybackMeses, 1), investimentoIncompleto: incompleto, mesesSemLancamento,
      retorno: mcTotal != null && investimento != null ? mcTotal - investimento : null, roiSobreMargem: mcTotal != null && investimento ? arredondar(mcTotal / investimento - 1, 4) : null,
    };
  });
}
