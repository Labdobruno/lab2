/* Eficiência de aquisição por canal: CPL, CAC, ROI, payback e margem de contribuição. */
import type { InvestimentoLinha, NegocioLinha, PrecoLinha, ContratoLinha } from './tipos.js';
import { arredondar, razao, soma } from './estatistica.js';

export interface EconomiaVenda {
  negocioId: string; referencia: number | null; aprovado: number | null; fechado: number | null;
  descontoSobreReferencia: number | null; descontoSobreAprovado: number | null;
  custos: Array<{ chave: string; valor: number }>; margemContribuicao: number | null; margemPercentual: number | null;
}

const ultimo = (precos: PrecoLinha[], momento: PrecoLinha['momento']) => precos.filter(p => p.momento === momento).at(-1);

/* precos: em ordem cronológica (o último registro de cada momento vale) */
export function economiaDaVenda(negocio: Pick<NegocioLinha, 'id' | 'valorFechado'>, precos: PrecoLinha[]): EconomiaVenda {
  const ref = ultimo(precos, 'referencia'), apr = ultimo(precos, 'aprovado'), fec = ultimo(precos, 'fechado');
  const fechado = fec?.valor ?? negocio.valorFechado ?? null;
  const custos = fec?.linhas ?? [];
  const mc = fechado != null && fec ? fechado - soma(custos.map(l => l.valor)) : null;
  const desc = (base?: number) => (base && fechado != null ? 1 - fechado / base : null);
  return {
    negocioId: negocio.id, referencia: ref?.valor ?? null, aprovado: apr?.valor ?? null, fechado,
    descontoSobreReferencia: desc(ref?.valor), descontoSobreAprovado: desc(apr?.valor),
    custos, margemContribuicao: mc, margemPercentual: mc != null && fechado ? mc / fechado : null,
  };
}

export interface LinhaCanal {
  canal: string; investimento: number | null; leads: number; vendas: number; receita: number;
  cpl: number | null; cac: number | null; roi: number | null;
  margemContribuicao: number | null; mcMenosCac: number | null; paybackMeses: number | null;
}

/* Leads = negócios novos criados no período; vendas = novos ganhos no período. */
export function eficienciaPorCanal(args: {
  negociosCriados: NegocioLinha[]; negociosGanhos: NegocioLinha[]; investimentos: InvestimentoLinha[];
  precosPorNegocio: Map<string, PrecoLinha[]>; contratos: ContratoLinha[];
}): LinhaCanal[] {
  const SEM = '(sem canal)';
  const canais = new Set<string>([...args.investimentos.map(i => i.canal), ...args.negociosCriados.map(n => n.canal ?? SEM), ...args.negociosGanhos.map(n => n.canal ?? SEM)]);
  return [...canais].sort().map(canal => {
    const inv = args.investimentos.filter(i => i.canal === canal);
    const investimento = inv.length ? soma(inv.map(i => i.valor)) : null;
    const leads = args.negociosCriados.filter(n => n.tipo === 'novo' && (n.canal ?? SEM) === canal).length;
    const ganhos = args.negociosGanhos.filter(n => n.tipo === 'novo' && (n.canal ?? SEM) === canal);
    const receita = soma(ganhos.map(n => n.valorFechado));
    const econ = ganhos.map(n => economiaDaVenda(n, args.precosPorNegocio.get(n.id) ?? []));
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
      paybackMeses: arredondar(paybackMeses, 1),
    };
  });
}
