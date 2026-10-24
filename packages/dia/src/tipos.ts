/* O contrato entre a montagem (consultas) e quem consome: ações, fotos dos rituais e a tela. */
import type { Classe, Evidencia, Gargalo, Padrao, Quadrante, Viabilidade } from './motor.js';
import type { ObjetivoSemana, Ritual } from './producao.js';

export const INDICADORES_DIA = ['tentativa', 'contato', 'agendamento', 'reuniao_realizada', 'proposta_enviada', 'oportunidades', 'vendas'] as const;
export const NOMES: Record<string, [string, string, string]> = {   // [nome, singular, plural]
  tentativa: ['Tentativas de contato', 'tentativa', 'tentativas'], contato: ['Contatos efetivos', 'contato', 'contatos'], agendamento: ['Reuniões agendadas', 'reunião agendada', 'reuniões agendadas'],
  reuniao_realizada: ['Reuniões realizadas', 'reunião realizada', 'reuniões realizadas'], proposta_enviada: ['Propostas enviadas', 'proposta', 'propostas'],
  oportunidades: ['Oportunidades', 'oportunidade', 'oportunidades'], vendas: ['Vendas', 'venda', 'vendas'], receita: ['Receita', 'R$', 'R$'],
};

export interface ProducaoIndicador {
  k: string; nome: string; diario: boolean;
  alvo: number; feito: number; falta: number; recup: number; janela: number; metaHoje: number; adiantado: number;
  atraso: number; atrasoTotal: number; metaCiclo: number; feitoCiclo: number; metaAmanha: number; metaRestante: number; metaTotal: number;
  sem: ObjetivoSemana | null;
}
export interface NegocioAtencao {
  id: string; nome: string; etapa: string; valor: number; pv: number | null; diasSemAtiv: number; diasNaEtapa: number; refEtapa: number | null;
  classe: Classe; motivos: string[]; acao: string; prazo: string; ve: number; score: number; proposta: boolean; semProximo: boolean;
}
export interface LeadNovo { id: string; nome: string; horas: number; canal: string | null }
export interface Taxa { chave: string; de: string; para: string; nome: string; real: number | null; n: number; k: number; plano: number | null; hist: number | null; nh: number; equipe: number | null }
export interface Acao {
  chave: string; classe: Classe; tit: string; qtd: string; porque: string; ben: { t: string; e: Evidencia | null }; nao: string; medir: string; prazo: string;
  origem: Array<{ neg: string; txt: string }>; score?: number; habilita?: number; hora?: string | null; conf?: string;
  justificativa?: { motivo: string; terceiro: boolean; por: string | null; em: string } | null;
}
export interface Compromisso { k: string; ok: boolean; t: string; s: string; marcado?: { por: string | null; em: string } | null }

export interface DadosDia {
  pessoa: { id: string; nome: string; funcao: string | null; funcaoNome: string };
  data: string; ritual: Ritual; fracaoHoje: number; versaoRegras: string;
  ciclo: { inicio: string; fim: string; uteisOperacao: number; uteisPessoa: string[]; diasRest: number; amanha: string | null; ontem: string | null; trabalhaHoje: boolean };
  semana: { ini: string; fim: string; restantes: number };
  cap: { v: number | null; fonte: 'apontada' | 'observada' | null; obs: { v: number | null; n: number } };
  prod: ProducaoIndicador[];
  quad: Quadrante; quadAt: ProducaoIndicador | null; quadRs: ProducaoIndicador | null;
  viab: Viabilidade | null;
  tx: Taxa[]; txPlano: Record<string, number>;
  vol: Record<string, number>; volH: Record<string, number>;
  cards: NegocioAtencao[]; exposicao: number; leadsNovos: LeadNovo[];
  padrao: Padrao & { k: string }; serie: Array<{ iso: string; meta: number; feito: number }>;
  ontem: { prod: Array<{ k: string; meta: number; feito: number }> };
  garg: Gargalo[];
  ticket: { v: number | null; fonte: string };
  pct: number | null; pctSem: number | null; atrasoProd: number;
  sucesso: Compromisso[]; acoes: Acao[];
  cenario: { exec: { pendencias: number; etapas: Array<{ k: string; nome: string; planejado: number; adicional: number; amanha: number; atraso: number }>; esperado: Array<{ k: string; de: number; para: string; n: number; tx: number }>; sobrecarga?: boolean }; nao: { pendencias: number; etapas: Array<{ k: string; nome: string; planejado: number; adicional: number; amanha: number; atraso: number }>; sobrecarga?: boolean; semProximo?: number }; cap: number | null };
  esperadoAgora: Array<{ k: string; esperado: number; feito: number; status: 'em_dia' | 'atencao' | 'atras' | null }>;
  fontes: Record<string, boolean>;   // o que a V2 ainda não tem aparece como false ("sem fonte"), nunca como zero
  notas: { justificativas: Record<string, { motivo: string; terceiro: boolean; por: string | null; em: string }>; feitos: Record<string, { por: string | null; em: string }> };
  memoria: Array<{ data: string; ritual: Ritual; alvo: number; feito: number | null; pct: number | null; acoes: number; criticas: number; justificativas: number }>;
}
