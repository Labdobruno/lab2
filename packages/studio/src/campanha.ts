/* Projeção de uma campanha de go-to-market: orçamento → leads (pelo CPL) → funil em grafo → vendas, receita, CAC e ROI. */
import { analisar, avaliar, ErroExpressao, type Contexto } from '@lab/nucleo';
import { alavancas, resolverTaxas, simular, type Alavanca, type Grafo, type Simulacao } from './grafo.js';

export interface PremissasCampanha { cpl: number | string | null; ticketMedio: number | string | null; margem?: number | string | null }
export interface Projecao {
  ok: boolean; avisos: string[];
  orcamento: number; cpl: number | null; ticketMedio: number | null; margem: number | null;
  leads: number | null; vendas: number | null; receita: number | null; cac: number | null; roi: number | null;
  margemContribuicao: number | null; mcMenosOrcamento: number | null;
  simulacao: Simulacao | null; alavancas: Alavanca[];
}

/* número vale como está; texto é fórmula da mesma linguagem das hipóteses (ex.: "cpl_medio * 1.1") */
export function valorDe(v: number | string | null | undefined, ctx: Contexto): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  try { const r = avaliar(analisar(v), ctx); return typeof r === 'number' && Number.isFinite(r) ? r : null; }
  catch (e) { if (e instanceof ErroExpressao) return null; throw e; }
}

export function projetar(args: { grafo: Grafo; ctx: Contexto; orcamento: number; premissas: PremissasCampanha; alteracoes?: Record<string, number | string> }): Projecao {
  const { grafo, ctx, orcamento, premissas } = args;
  const avisos: string[] = [];
  const cpl = valorDe(premissas.cpl, ctx), ticket = valorDe(premissas.ticketMedio, ctx), margem = valorDe(premissas.margem ?? 'margem_percentual', ctx);
  const vazio: Projecao = { ok: false, avisos, orcamento, cpl, ticketMedio: ticket, margem, leads: null, vendas: null, receita: null, cac: null, roi: null, margemContribuicao: null, mcMenosOrcamento: null, simulacao: null, alavancas: [] };
  if (!(orcamento > 0)) { avisos.push('informe um orçamento maior que zero'); return vazio; }
  if (!(cpl && cpl > 0)) { avisos.push('sem custo por lead (CPL): informe um valor ou tenha investimento e leads no histórico'); return vazio; }
  const r = resolverTaxas(grafo, ctx, args.alteracoes);
  if (r.faltam.length) { for (const f of r.faltam) avisos.push(`sem dado para a taxa ${f.aresta.replace('>', ' → ')}${f.variaveis.length ? ` (falta: ${f.variaveis.join(', ')})` : ''}`); return vazio; }
  if (r.excedem.length) { avisos.push(`as saídas de ${r.excedem.join(', ')} somam mais de 100%`); return vazio; }
  if (ticket == null) avisos.push('sem ticket médio: a receita não pôde ser calculada');
  const leads = orcamento / cpl;
  const sim = simular(grafo, r.taxas, leads, ticket);
  const mc = sim.receita != null && margem != null ? sim.receita * margem : null;
  return {
    ok: true, avisos, orcamento, cpl, ticketMedio: ticket, margem, leads, vendas: sim.vendas, receita: sim.receita,
    cac: sim.vendas > 0 ? orcamento / sim.vendas : null,
    roi: sim.receita != null ? (sim.receita - orcamento) / orcamento : null,
    margemContribuicao: mc, mcMenosOrcamento: mc != null ? mc - orcamento : null,
    simulacao: sim, alavancas: alavancas(grafo, r.taxas, leads, ticket).slice(0, 5),
  };
}

export interface Realizado { leads: number; vendas: number; receita: number; investimento: number | null; cpl: number | null; cac: number | null; roi: number | null }
export interface Desvio { campo: string; plano: number | null; realizado: number | null; diferenca: number | null; pct: number | null }

export function realizadoDe(x: { leads: number; vendas: number; receita: number; investimento: number | null }): Realizado {
  const inv = x.investimento;
  return { ...x, cpl: inv != null && x.leads > 0 ? inv / x.leads : null, cac: inv != null && x.vendas > 0 ? inv / x.vendas : null, roi: inv ? (x.receita - inv) / inv : null };
}

/* plano × realizado: só compara o que existe nos dois lados; ausência não vira zero */
export function desvios(plano: Pick<Projecao, 'leads' | 'vendas' | 'receita' | 'cac' | 'roi'>, real: Realizado): Desvio[] {
  const par = (campo: string, p: number | null, r: number | null): Desvio => ({ campo, plano: p, realizado: r, diferenca: p != null && r != null ? r - p : null, pct: p != null && r != null && p !== 0 ? (r - p) / Math.abs(p) : null });
  return [par('leads', plano.leads, real.leads), par('vendas', plano.vendas, real.vendas), par('receita', plano.receita, real.receita), par('cac', plano.cac, real.cac), par('roi', plano.roi, real.roi)];
}
