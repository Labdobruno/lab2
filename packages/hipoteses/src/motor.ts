/* Motor de hipóteses: lê a biblioteca do pack (fórmulas em texto) e o contexto de números, e devolve achados.
   Tudo determinístico: o mesmo contexto dá sempre os mesmos achados, e cada achado mostra os números que o provam. */
import { analisar, avaliar, variaveisUsadas, VARIAVEIS, type Contexto, type PackResolvido } from '@lab/nucleo';

export type Hipotese = PackResolvido['hipoteses'][number];
export interface Evidencia { variavel: string; nome: string; unidade: string; valor: number | null }
export interface Achado { chave: string; titulo: string; acao: string; severidade: 'alta' | 'media' | 'baixa'; impacto: number | null; evidencias: Evidencia[] }
export interface SemDados { chave: string; titulo: string; faltam: string[] }
export interface ResultadoMotor { orcamento: number; achados: Achado[]; emEspera: Achado[]; semDados: SemDados[]; naoDisparam: number; errosDeFormula: Array<{ chave: string; erro: string }> }

const PESO = { alta: 3, media: 2, baixa: 1 } as const;

const evidencias = (vars: Set<string>, ctx: Contexto): Evidencia[] =>
  [...vars].sort().map(v => ({ variavel: v, nome: VARIAVEIS[v]?.nome ?? v, unidade: VARIAVEIS[v]?.unidade ?? 'n', valor: ctx[v] ?? null }));

export function avaliarHipoteses(hipoteses: Hipotese[], ctx: Contexto, orcamento = 3): ResultadoMotor {
  const disparos: Achado[] = [], semDados: SemDados[] = [], erros: ResultadoMotor['errosDeFormula'] = [];
  let nao = 0;
  for (const h of hipoteses) {
    try {
      const quando = analisar(h.quando);
      const usadas = variaveisUsadas(quando);
      const r = avaliar(quando, ctx);
      if (r === null) { semDados.push({ chave: h.chave, titulo: h.titulo, faltam: [...usadas].filter(v => ctx[v] == null).sort() }); continue; }
      if (r === false || r === 0) { nao++; continue; }
      let impacto: number | null = null;
      if (h.impacto) {
        const f = analisar(h.impacto);
        for (const v of variaveisUsadas(f)) usadas.add(v);
        const i = avaliar(f, ctx);
        impacto = typeof i === 'number' ? Math.round(i * 100) / 100 : null;
      }
      disparos.push({ chave: h.chave, titulo: h.titulo, acao: h.acao, severidade: h.severidade ?? 'media', impacto, evidencias: evidencias(usadas, ctx) });
    } catch (e) { erros.push({ chave: h.chave, erro: (e as Error).message }); }
  }
  /* maior impacto em R$ primeiro; sem impacto calculável vai para o fim; empate: severidade e chave */
  disparos.sort((a, b) => (b.impacto ?? -Infinity) - (a.impacto ?? -Infinity) || PESO[b.severidade] - PESO[a.severidade] || a.chave.localeCompare(b.chave));
  return { orcamento, achados: disparos.slice(0, orcamento), emEspera: disparos.slice(orcamento), semDados, naoDisparam: nao, errosDeFormula: erros };
}
