/* Conversão por coorte e fluxo do funil. Falam só de papéis de etapa. */
import type { NegocioLinha } from './tipos.js';
import { proporcao, type Proporcao } from './estatistica.js';

/* escada de conversão da aquisição; 'intermediaria' e 'perdido' não são degraus */
export const ESCADA = ['lead', 'contato', 'qualificado', 'agendada', 'realizada', 'oportunidade', 'proposta', 'negociacao', 'ganho'] as const;
const posto = (p: string) => ESCADA.indexOf(p as (typeof ESCADA)[number]);

/* maior degrau alcançado: pular etapas não quebra a conta (quem ganhou passou por todas) */
export function degrauAlcancado(n: Pick<NegocioLinha, 'papelAtual' | 'papeisAlcancados' | 'status'>): number {
  const todos = [...n.papeisAlcancados, n.papelAtual, ...(n.status === 'ganho' ? ['ganho'] : [])];
  return Math.max(-1, ...todos.map(posto));
}

export interface ConversaoCoorte { coorte: number; etapas: Array<{ papel: string } & Proporcao>; passoAPasso: Array<{ de: string; para: string } & Proporcao> }

/* coorte = negócios novos criados no período do funil principal */
export function conversaoPorCoorte(negocios: NegocioLinha[]): ConversaoCoorte {
  const coorte = negocios.filter(n => n.tipo === 'novo' && n.funilPrincipal);
  const alc = coorte.map(degrauAlcancado);
  const ate = (i: number) => alc.filter(a => a >= i).length;
  return {
    coorte: coorte.length,
    etapas: ESCADA.map((papel, i) => ({ papel, ...proporcao(ate(i), coorte.length) })),
    passoAPasso: ESCADA.slice(1).map((papel, i) => ({ de: ESCADA[i]!, para: papel, ...proporcao(ate(i + 1), ate(i)) })),
  };
}

/* fluxo: quantos negócios distintos entraram em cada papel no período (independe de quando nasceram) */
export function fluxoPorPapel(transicoes: Array<{ negocioId: string; papel: string }>): Record<string, number> {
  const vistos = new Map<string, Set<string>>();
  for (const t of transicoes) (vistos.get(t.papel) ?? vistos.set(t.papel, new Set()).get(t.papel)!).add(t.negocioId);
  return Object.fromEntries([...vistos].map(([p, s]) => [p, s.size]));
}

/* ganho ÷ (ganho + perdido) entre os negócios novos que fecharam no período */
export function taxaDeGanho(fechados: NegocioLinha[]): Proporcao {
  const novos = fechados.filter(n => n.tipo === 'novo');
  return proporcao(novos.filter(n => n.status === 'ganho').length, novos.filter(n => n.status !== 'aberto').length);
}
