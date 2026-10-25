export interface Periodo { de: string; ate: string }   // AAAA-MM-DD; [de, ate) — "ate" não entra
export interface Contexto { operacaoId: string; fuso: string }

export interface NegocioLinha {
  id: string; tipo: string; canal: string | null; status: 'aberto' | 'ganho' | 'perdido';
  papelAtual: string; papeisAlcancados: string[];
  valorFechado: number | null; criadoEm: string; fechadoEm: string | null; funilPrincipal: boolean;
}
export interface PrecoLinha { negocioId: string; momento: 'referencia' | 'aprovado' | 'fechado'; valor: number; linhas: Array<{ chave: string; valor: number }>; condicao?: string | null; politicaVersao?: number | null; comissaoFixa?: number | null }
export interface InvestimentoLinha { canal: string; valor: number; leadsPlataforma: number | null; mes?: string | null }
export interface ContratoLinha { id: string; contaId: string; negocioOrigemId: string | null; recorrente: boolean; valorPeriodo: number; periodicidadeMeses: number | null; inicio: string; fim: string | null; status: string }
export interface EventoCSLinha { contaId: string; tipo: string; em: string; valor: number | null }
