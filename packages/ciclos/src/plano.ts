/* Cenários e programa de ciclos. Puro: recebe números, devolve números. */
import { buildupReverso, CADEIA, type SaidaBuildup, type Taxas } from '@lab/planejamento';
import type { FuncaoPessoa } from '@lab/nucleo';

export const CENARIOS = { conservador: 0.85, base: 1, otimista: 1.15 } as const;
export type NomeCenario = keyof typeof CENARIOS;
export const NOMES_CENARIO = Object.keys(CENARIOS) as NomeCenario[];

export interface Premissas { taxas: Taxas; ticketMedio: number | null; canais?: Record<string, number> }
export interface PessoaPlano { id: string; nome: string; funcao: FuncaoPessoa | null }

/* o cenário muda a conversão, não o ticket: conservador converte 15% menos, otimista 15% mais (teto de 100%) */
export function taxasDoCenario(taxas: Taxas, nome: NomeCenario): Taxas {
  const f = CENARIOS[nome];
  return Object.fromEntries(Object.entries(taxas).map(([k, v]) => [k, v == null ? v : Math.min(v * f, 1)])) as Taxas;
}

export type PlanoCenario = SaidaBuildup & { cenario: NomeCenario; fator: number };

export function cenariosDoQuarter(args: { receita: number; premissas: Premissas; diasUteis: number; pessoas?: PessoaPlano[] }): Record<NomeCenario, PlanoCenario> {
  return Object.fromEntries(NOMES_CENARIO.map(nome => [nome, {
    cenario: nome, fator: CENARIOS[nome],
    ...buildupReverso({
      receita: args.receita, ticketMedio: args.premissas.ticketMedio, taxas: taxasDoCenario(args.premissas.taxas, nome), diasUteis: args.diasUteis,
      ...(args.pessoas ? { pessoas: args.pessoas } : {}), ...(args.premissas.canais ? { canais: args.premissas.canais } : {}),
    }),
  }])) as Record<NomeCenario, PlanoCenario>;
}

/* pesos normalizados; sem pesos, cada ciclo recebe a fração dos dias úteis dele */
export function normalizarPesos(pesos: number[] | undefined, diasUteis: number[]): number[] | null {
  const base = pesos && pesos.length === diasUteis.length ? pesos : diasUteis;
  if (base.some(p => !Number.isFinite(p) || p < 0)) return null;
  const soma = base.reduce((s, p) => s + p, 0);
  return soma > 0 ? base.map(p => p / soma) : null;
}

export interface CicloDoPrograma { inicio: string; fim: string; diasUteis: number; peso: number; metaReceita: number; plano: PlanoCenario }

export function programaDeCiclos(args: {
  receita: number; premissas: Premissas; cenario: NomeCenario; pesos?: number[]; pessoas?: PessoaPlano[];
  ciclos: Array<{ inicio: string; fim: string; diasUteis: number }>;
}): { ok: boolean; avisos: string[]; ciclos: CicloDoPrograma[] } {
  const pesos = normalizarPesos(args.pesos, args.ciclos.map(c => c.diasUteis));
  if (!pesos) return { ok: false, avisos: ['pesos inválidos: use números não negativos que somem mais que zero'], ciclos: [] };
  let acumulado = 0;
  const ciclos = args.ciclos.map((c, i) => {
    /* o último ciclo absorve o arredondamento: a soma das metas é exatamente a meta do quarter */
    const metaReceita = i === args.ciclos.length - 1 ? Math.round((args.receita - acumulado) * 100) / 100 : Math.round(args.receita * pesos[i]! * 100) / 100;
    acumulado += metaReceita;
    const plano = cenariosDoQuarter({ receita: metaReceita, premissas: args.premissas, diasUteis: c.diasUteis, ...(args.pessoas ? { pessoas: args.pessoas } : {}) })[args.cenario];
    return { ...c, peso: pesos[i]!, metaReceita, plano };
  });
  return { ok: ciclos.every(c => c.plano.ok), avisos: [...new Set(ciclos.flatMap(c => c.plano.avisos))], ciclos };
}

/* metas que o compromisso grava: receita e cada degrau do funil, por operação e por pessoa */
export function metasDoCiclo(c: CicloDoPrograma): Array<{ indicador: string; pessoaId: string | null; valor: number }> {
  const metas: Array<{ indicador: string; pessoaId: string | null; valor: number }> = [{ indicador: 'receita', pessoaId: null, valor: c.metaReceita }];
  for (const d of CADEIA) if (c.plano.totais[d] != null) metas.push({ indicador: d, pessoaId: null, valor: c.plano.totais[d]! });
  for (const p of c.plano.porPessoa) for (const d of CADEIA) if (p.metas[d] != null) metas.push({ indicador: d, pessoaId: p.pessoaId, valor: p.metas[d]! });
  return metas;
}
