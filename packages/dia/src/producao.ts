/* Núcleo de produção: contas puras, sem banco e sem relógio. Portado do LAB V1 (producao.js, lab_objetivos.js,
   plano_dia_motor.js §semana, esforco.js); os testes da V1 são o contrato (valores exatos).
   Regra oficial da recuperação distribuída (09/10/2026): alvo de hoje = meta de hoje + ⌈atraso até ontem ÷ janela⌉.
   O que faltar hoje vira atraso amanhã e entra aos poucos; o que foi feito a mais abate a meta dos próximos dias. */

export type Mapa = Record<string, number>;
const EPS = 1e-9;
export const VERSAO_REGRAS = '2026-10-29.1';

/* ---------- metas diárias inteiras: a soma dos dias é exatamente a meta do mês ---------- */

/* meta inteira do dia k (0-based) de uma meta T distribuída em du dias úteis (metas_dia.test: 22 em 5 = 4,4,5,4,5) */
import { metaDiaInteira } from '@lab/planejamento';
export { metaDiaInteira };

/* reparte um total em partes inteiras pelos pesos (lpoDistribuir): acumula, arredonda para baixo, o último absorve o resto.
   Sem pesos válidos, partes iguais. Sem pesos equivale a metaDiaInteira. */
export function distribuirInteiros(total: number, pesos?: Array<number | null | undefined>, n?: number): number[] {
  const qtd = pesos ? pesos.length : (n ?? 0);
  if (!(qtd > 0)) return [];
  const T = Math.round(Number(total) || 0);
  const w = (pesos ?? []).map(p => (Number(p) > 0 ? Number(p) : 0));
  const soma = w.reduce((a, b) => a + b, 0);
  const pesosOk = pesos && soma > 0 ? w : Array.from({ length: qtd }, () => 1);
  const S = pesosOk.reduce((a, b) => a + b, 0);
  const out: number[] = [];
  let acc = 0, dado = 0;
  for (let i = 0; i < qtd; i++) {
    acc += (pesosOk[i]! / S) * T;
    const v = i === qtd - 1 ? T - dado : Math.floor(acc + EPS) - dado;
    out.push(Math.max(0, v)); dado += Math.max(0, v);
  }
  return out;
}

/* reparte por maior resto (lpDividir): T = round(total); parte inteira + sobras aos maiores restos. cadeia.test: 7 em 60/40 = 4/3; 150k em 50/30/20 */
export function dividirMaiorResto(total: number, pesos: number[]): number[] {
  const T = Math.round(Number(total) || 0), n = pesos.length;
  if (!n) return [];
  const w = pesos.map(p => (Number(p) > 0 ? Number(p) : 0)), S = w.reduce((a, b) => a + b, 0);
  const W = S > 0 ? w : w.map(() => 1), SS = W.reduce((a, b) => a + b, 0);
  const exato = W.map(x => (x / SS) * T), base = exato.map(x => Math.floor(x + EPS));
  let sobra = T - base.reduce((a, b) => a + b, 0);
  const ordem = exato.map((x, i) => ({ i, r: x - base[i]! })).sort((a, b) => b.r - a.r || a.i - b.i);
  for (const o of ordem) { if (sobra <= 0) break; base[o.i]!++; sobra--; }
  return base;
}

/* metas diárias de uma meta do ciclo nos dias úteis da pessoa, com peso por dia (padrão 1): soma = meta */
export function metasDiarias(metaCiclo: number, dias: string[], pesos?: Record<string, number>): Record<string, number> {
  const v = distribuirInteiros(metaCiclo, dias.map(d => (pesos && pesos[d] != null ? pesos[d] : 1)));
  return Object.fromEntries(dias.map((d, i) => [d, v[i] ?? 0]));
}

/* mínimo de 1 por dia trabalhado na etapa principal (lpoMinimoDia, decisão de 10/10/2026): o mês sobe, nunca desce.
   lab_objetivos.test: 5 agendadas em 23 dias → 23 (+18) */
export function minimoDiario(porDia: Record<string, number>): { porDia: Record<string, number>; extra: number } {
  const out: Record<string, number> = {}; let extra = 0;
  for (const d of Object.keys(porDia)) { const v = porDia[d] ?? 0; if (v < 1) { out[d] = 1; extra += 1 - v; } else out[d] = v; }
  return { porDia: out, extra };
}

/* ---------- produção do ciclo até hoje, com a recuperação distribuída (prCalcular) ---------- */

export interface DiaProducao { iso: string; meta: Mapa; feito: Mapa; ajuste?: Mapa }
export interface EntradaProducao {
  dias: DiaProducao[];                 // do início da vigência até hoje, inclusive (só dias com meta ou feito; dia sem trabalho tem meta 0)
  futuros?: Array<{ iso: string; meta: Mapa }>;   // dias após hoje (para a meta da semana)
  hoje: string;
  semana: [string, string];            // [segunda, domingo] da semana de hoje
  janela?: number;                     // dias úteis para recuperar o atraso (padrão 1 = tudo hoje; o plano do dia usa 5)
  semRecup?: boolean;                  // hoje não é dia de trabalho da pessoa: nada do atraso entra hoje
}
export interface LinhaProducao {
  temMeta: boolean;
  metaHoje: number; feitoHoje: number;
  metaCiclo: number; feitoCiclo: number;        // acumulados até hoje, inclusive
  atrasoTotal: number;                          // meta − feito até ontem (só o que falta)
  adiantadoAcum: number;                        // feito − meta até ontem (só o que sobra)
  recupHoje: number;                            // parcela do atraso que entra hoje: ⌈atrasoTotal ÷ janela⌉
  alvoHoje: number;                             // meta de hoje + parcela do atraso
  aFazerHoje: number;                           // o que ainda falta do alvo (abatendo o adiantado)
  adiantado: number;                            // o que sobra depois de cobrir o alvo de hoje
  atraso: number;                               // atraso em aberto (o excedente de hoje abate)
  devendoCiclo: number;                         // meta até hoje − feito até hoje
  janela: number;
  metaSemana: number; feitoSemana: number;
}

export function producaoDoCiclo(x: EntradaProducao): Record<string, LinhaProducao> {
  const janela = Math.max(1, Math.floor(x.janela ?? 1));
  const chaves = new Set<string>();
  for (const d of x.dias) for (const k of [...Object.keys(d.meta), ...Object.keys(d.feito), ...Object.keys(d.ajuste ?? {})]) chaves.add(k);
  for (const f of x.futuros ?? []) for (const k of Object.keys(f.meta)) chaves.add(k);
  const out: Record<string, LinhaProducao> = {};
  const feitoDe = (d: DiaProducao, k: string) => (Number(d.feito[k]) || 0) + (Number(d.ajuste?.[k]) || 0);
  for (const k of chaves) {
    let metaAntes = 0, feitoAntes = 0, metaHoje = 0, feitoHoje = 0, metaSemana = 0, feitoSemana = 0, temMeta = false;
    for (const d of x.dias) {
      const m = Number(d.meta[k]) || 0, f = feitoDe(d, k);
      if (m > 0) temMeta = true;
      if (d.iso < x.hoje) { metaAntes += m; feitoAntes += f; }
      else if (d.iso === x.hoje) { metaHoje += m; feitoHoje += f; }
      if (d.iso >= x.semana[0] && d.iso <= x.semana[1] && d.iso <= x.hoje) { metaSemana += m; feitoSemana += f; }
    }
    for (const f of x.futuros ?? []) { const m = Number(f.meta[k]) || 0; if (m > 0) temMeta = true; if (f.iso > x.hoje && f.iso >= x.semana[0] && f.iso <= x.semana[1]) metaSemana += m; }
    const feitoHojeBruto = feitoHoje; feitoHoje = Math.max(0, feitoHoje);
    const saldo = metaAntes - feitoAntes;
    const atrasoTotal = Math.max(0, saldo), adiantadoAcum = Math.max(0, -saldo);
    const recupHoje = x.semRecup || atrasoTotal <= EPS ? 0 : Math.ceil(atrasoTotal / janela - EPS);
    const alvoHoje = metaHoje + recupHoje;
    const aFazerHoje = Math.max(0, alvoHoje - feitoHoje - adiantadoAcum);
    const adiantado = Math.max(0, adiantadoAcum + feitoHoje - alvoHoje);
    const atraso = Math.max(0, atrasoTotal - Math.max(0, feitoHoje - metaHoje));
    const feitoCiclo = Math.max(0, feitoAntes + feitoHojeBruto);   // a correção para baixo vale no total; hoje não fica negativo
    out[k] = {
      temMeta, metaHoje, feitoHoje, metaCiclo: metaAntes + metaHoje, feitoCiclo, atrasoTotal, adiantadoAcum, recupHoje, alvoHoje, aFazerHoje, adiantado, atraso,
      devendoCiclo: Math.max(0, metaAntes + metaHoje - feitoCiclo), janela, metaSemana, feitoSemana,
    };
  }
  return out;
}

/* ---------- objetivo da semana (pdmSemana): só atividade de alto volume é meta do dia; o resto vale pela semana ---------- */

export interface DiaSemana { iso: string; meta: Mapa; feito: Mapa; util: boolean }
export interface EntradaSemana { dias: DiaSemana[]; antes: Mapa; janela: number; hoje: string; indicadores: string[]; diarias: string[] }
export interface ObjetivoSemana { meta: number; feito: number; atraso: number; recup: number; alvo: number; falta: number; uteis: number; restantes: number; ritmo: number | null; diario: boolean }

export function objetivoSemana(x: EntradaSemana): Record<string, ObjetivoSemana> {
  const out: Record<string, ObjetivoSemana> = {};
  const uteis = x.dias.filter(d => d.util).length, rest = x.dias.filter(d => d.util && d.iso >= x.hoje).length, j = Math.max(1, x.janela || 1);
  for (const k of x.indicadores) {
    let meta = 0, feito = 0;
    for (const d of x.dias) { meta += Number(d.meta[k]) || 0; if (d.iso <= x.hoje) feito += Number(d.feito[k]) || 0; }
    const saldo = Number(x.antes[k]) || 0, atraso = Math.max(0, saldo), adiant = Math.max(0, -saldo);
    /* o atraso que chega na semana entra proporcional aos dias úteis dela (5 dias úteis com janela 5 = recupera tudo na semana) */
    const recup = atraso > EPS ? Math.min(Math.ceil(atraso - EPS), Math.ceil(atraso * Math.min(1, uteis / j) - EPS)) : 0;
    const alvo = Math.max(0, meta + recup - adiant), falta = Math.max(0, alvo - feito);
    out[k] = { meta, feito, atraso, recup, alvo, falta, uteis, restantes: rest, ritmo: rest ? falta / rest : null, diario: x.diarias.includes(k) };
  }
  return out;
}

/* ritmo legível: "≈ 3 por dia útil", "≈ 1 por dia útil", "≈ 1 a cada 3 dias úteis" */
export function ritmoLegivel(r: number | null): string {
  if (r == null) return '';
  if (r <= EPS) return 'feito';
  if (r >= 1.5) return `≈ ${Math.round(r)} por dia útil`;
  if (r >= 0.75) return '≈ 1 por dia útil';
  return `≈ 1 a cada ${Math.round(1 / r)} dias úteis`;
}

/* ---------- esforço planejado × realizado (esLinha) ---------- */
export interface LinhaEsforco { meta: number; esperado: number; feito: number; saldo: number; progresso: number | null; ritmo: number | null; tendencia: number | null; status: 'sem_meta' | 'adiantado' | 'em_dia' | 'atras' }
export function linhaEsforco(x: { metaTotal: number; metaAteHoje: number; feito: number }): LinhaEsforco {
  const meta = Math.max(0, Number(x.metaTotal) || 0), esperado = Math.max(0, Number(x.metaAteHoje) || 0), feito = Math.max(0, Number(x.feito) || 0);
  const tendencia = esperado > 0 && meta > 0 ? (feito * meta) / esperado : null;
  return { meta, esperado, feito, saldo: Math.max(0, meta - feito), progresso: meta > 0 ? feito / meta : null, ritmo: esperado > 0 ? feito / esperado : null, tendencia,
    status: !(esperado > 0) ? 'sem_meta' : feito >= esperado - EPS ? (feito > esperado + EPS ? 'adiantado' : 'em_dia') : 'atras' };
}

/* ---------- os três rituais do dia e quanto de "hoje" conta no esperado ---------- */
export const RITUAIS = ['manha', 'tarde', 'fim'] as const;
export type Ritual = (typeof RITUAIS)[number];
export const FRACAO_DO_DIA: Record<Ritual, number> = { manha: 0, tarde: 0.5, fim: 1 };

/* pela hora local: antes do meio-dia é manhã; até as 17h é tarde; depois, fim do dia */
export function ritualDaHora(hora: number): Ritual { return hora < 12 ? 'manha' : hora < 17 ? 'tarde' : 'fim'; }

/* esperado até agora: dias úteis passados contam inteiros; hoje conta a fração do ritual (manhã 0, tarde ½, fim 1) */
export function esperadoAteAgora(meta: number, uteis: string[], hoje: string, fracaoHoje: number): number {
  if (!uteis.length) return 0;
  const passados = uteis.filter(d => d < hoje).length, ehUtil = uteis.includes(hoje) ? 1 : 0;
  return meta * ((passados + ehUtil * Math.min(1, Math.max(0, fracaoHoje))) / uteis.length);
}
