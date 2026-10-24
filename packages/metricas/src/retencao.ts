/* Lado direito da borboleta: churn, receita retida, expansão e LTV. Base: MRR dos contratos recorrentes. */
import type { ContratoLinha, EventoCSLinha, Periodo } from './tipos.js';
import { arredondar, razao, soma } from './estatistica.js';

export const mrrDe = (c: Pick<ContratoLinha, 'valorPeriodo' | 'periodicidadeMeses'>) => c.valorPeriodo / (c.periodicidadeMeses ?? 1);

const mesesEntre = (de: string, ate: string) => Math.max((Date.parse(ate) - Date.parse(de)) / 86_400_000 / (365.25 / 12), 1e-9);

export interface Retencao {
  contasNoInicio: number; mrrInicial: number | null; mrrCancelado: number; mrrReduzido: number; mrrExpansao: number;
  churnLogos: number | null; churnReceita: number | null; retencaoBruta: number | null; retencaoLiquida: number | null;
  arpa: number | null; churnMensal: number | null; ltv: number | null;
}

/* margem: fração (0–1) da receita que sobra como margem de contribuição; sem ela, LTV fica nulo */
export function retencao(args: { contratos: ContratoLinha[]; eventos: EventoCSLinha[]; periodo: Periodo; margem?: number | null }): Retencao {
  const { de, ate } = args.periodo;
  const recorrentes = args.contratos.filter(c => c.recorrente);
  const ativosNoInicio = recorrentes.filter(c => c.inicio < de && (c.fim == null || c.fim >= de) && c.status !== 'suspenso');
  const ids = new Set(ativosNoInicio.map(c => c.id));
  const cancelados = ativosNoInicio.filter(c => c.status === 'cancelado' && c.fim != null && c.fim < ate);
  const contas = new Set(ativosNoInicio.map(c => c.contaId));
  const contasPerdidas = new Set(cancelados.map(c => c.contaId));
  const mrrInicial = ids.size ? soma(ativosNoInicio.map(mrrDe)) : null;
  const mrrCancelado = soma(cancelados.map(mrrDe));
  const doPeriodo = args.eventos.filter(e => e.em.slice(0, 10) >= de && e.em.slice(0, 10) < ate && contas.has(e.contaId));
  const mrrExpansao = soma(doPeriodo.filter(e => e.tipo === 'expandido').map(e => e.valor));
  const mrrReduzido = soma(doPeriodo.filter(e => e.tipo === 'reduzido').map(e => Math.abs(e.valor ?? 0)));

  const churnLogos = razao(contasPerdidas.size, contas.size);
  const churnReceita = mrrInicial ? razao(mrrCancelado, mrrInicial) : null;
  const churnMensal = churnReceita != null ? 1 - (1 - churnReceita) ** (1 / mesesEntre(de, ate)) : null;
  const arpa = mrrInicial != null && contas.size ? mrrInicial / contas.size : null;
  const ltv = arpa != null && args.margem != null && churnMensal ? (arpa * args.margem) / churnMensal : null;
  return {
    contasNoInicio: contas.size, mrrInicial, mrrCancelado, mrrReduzido, mrrExpansao,
    churnLogos: arredondar(churnLogos, 4), churnReceita: arredondar(churnReceita, 4),
    retencaoBruta: mrrInicial ? arredondar((mrrInicial - mrrCancelado - mrrReduzido) / mrrInicial, 4) : null,
    retencaoLiquida: mrrInicial ? arredondar((mrrInicial - mrrCancelado - mrrReduzido + mrrExpansao) / mrrInicial, 4) : null,
    arpa: arredondar(arpa), churnMensal: arredondar(churnMensal, 4), ltv: arredondar(ltv),
  };
}
