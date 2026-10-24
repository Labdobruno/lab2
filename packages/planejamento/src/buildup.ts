/* Build-up reverso único: receita → vendas → oportunidades → reuniões → agendamentos → contatos → tentativas.
   Por pessoa, por canal e por dia útil. Taxa ausente interrompe a cadeia: não se inventa conversão. */
import type { FuncaoPessoa } from '@lab/nucleo';

export const CADEIA = ['vendas', 'oportunidades', 'reuniao_realizada', 'agendamento', 'contato', 'tentativa'] as const;
export type Degrau = (typeof CADEIA)[number];

/* taxa de cada degrau para o anterior: taxas.oportunidades = vendas ÷ oportunidades, e assim por diante */
export type Taxas = Partial<Record<Degrau, number | null>>;

/* quem trabalha cada degrau */
const QUEM: Record<Degrau, FuncaoPessoa[]> = {
  vendas: ['closer', 'ambos'], oportunidades: ['closer', 'ambos'], reuniao_realizada: ['closer', 'ambos'],
  agendamento: ['sdr', 'ambos'], contato: ['sdr', 'ambos'], tentativa: ['sdr', 'ambos'],
};

export interface EntradaBuildup {
  receita: number; ticketMedio: number | null; taxas: Taxas; diasUteis: number;
  pessoas?: Array<{ id: string; nome: string; funcao: FuncaoPessoa | null }>;
  /* participação de cada canal nas vendas (somam 1); sem isto, tudo vai em "total" */
  canais?: Record<string, number>;
}
export interface SaidaBuildup {
  ok: boolean; avisos: string[];
  totais: Partial<Record<Degrau, number>>;
  porDia: Partial<Record<Degrau, number>>;
  porPessoa: Array<{ pessoaId: string; nome: string; metas: Partial<Record<Degrau, number>> }>;
  porCanal: Record<string, Partial<Record<Degrau, number>>>;
}

export function buildupReverso(e: EntradaBuildup): SaidaBuildup {
  const avisos: string[] = [];
  const totais: Partial<Record<Degrau, number>> = {};
  if (!(e.ticketMedio && e.ticketMedio > 0)) return { ok: false, avisos: ['sem ticket médio: não dá para converter receita em vendas'], totais, porDia: {}, porPessoa: [], porCanal: {} };
  let qtd = Math.ceil(e.receita / e.ticketMedio);
  totais.vendas = qtd;
  for (const degrau of CADEIA.slice(1)) {
    const taxa = e.taxas[degrau];
    if (!taxa || taxa <= 0 || taxa > 1) { avisos.push(`sem taxa válida para "${degrau}": a cadeia para em "${CADEIA[CADEIA.indexOf(degrau) - 1]}"`); break; }
    qtd = Math.ceil(qtd / taxa);
    totais[degrau] = qtd;
  }
  const degraus = Object.keys(totais) as Degrau[];
  const porDia = Object.fromEntries(degraus.map(d => [d, e.diasUteis > 0 ? Math.ceil(totais[d]! / e.diasUteis) : null])) as Partial<Record<Degrau, number>>;

  const porPessoa = (e.pessoas ?? []).map(p => ({ pessoaId: p.id, nome: p.nome, metas: {} as Partial<Record<Degrau, number>> }));
  for (const d of degraus) {
    const elegiveis = (e.pessoas ?? []).filter(p => p.funcao && QUEM[d].includes(p.funcao));
    if (!elegiveis.length) { if (e.pessoas?.length) avisos.push(`ninguém com função para "${d}"`); continue; }
    const cota = Math.ceil(totais[d]! / elegiveis.length);
    for (const p of elegiveis) porPessoa.find(x => x.pessoaId === p.id)!.metas[d] = cota;
  }

  const shares = e.canais ?? { total: 1 };
  const soma = Object.values(shares).reduce((s, x) => s + x, 0);
  if (Math.abs(soma - 1) > 0.001) avisos.push(`a participação dos canais soma ${soma.toFixed(3)}, não 1`);
  const porCanal = Object.fromEntries(Object.entries(shares).map(([c, s]) => [c, Object.fromEntries(degraus.map(d => [d, Math.ceil(totais[d]! * s)]))])) as SaidaBuildup['porCanal'];
  return { ok: degraus.length === CADEIA.length, avisos, totais, porDia, porPessoa, porCanal };
}
