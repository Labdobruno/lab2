/* Inteligência aplicada (porta o lab_inteligencia.js da V1; lab_inteligencia.test.js é o contrato): ponte (waterfall) de receita e margem com a
   categoria do desvio plano × realizado, acurácia do forecast (erro e viés por antecedência), build-up faseado, métricas de proteção e saúde da inteligência. */
import { MENOR_MELHOR_V3 } from '@lab/nucleo';
import type { AchadoV3 } from './motor.js';

const DIA = 86_400_000;
/* ponte de receita: receita = volume × ticket → efeito volume (a ticket antigo) + efeito ticket (no volume novo) */
export function waterfallReceita(V0: number, T0: number, V1: number, T1: number) {
  V0 = Number(V0) || 0; T0 = Number(T0) || 0; V1 = Number(V1) || 0; T1 = Number(T1) || 0;
  const volume = (V1 - V0) * T0, ticket = V1 * (T1 - T0); return { de: V0 * T0, para: V1 * T1, volume, ticket, total: V1 * T1 - V0 * T0 };
}
/* ponte de margem na ordem fixa: preço (receita), custo, comissão, imposto, taxa; sobra = sem explicação. O desconto já está dentro da receita. */
export interface AgregadoMargem { receita?: number; impostos?: number; taxa?: number; custo?: number; comissao?: number; desconto?: number }
export function waterfallMargem(A: AgregadoMargem, B: AgregadoMargem) {
  const g = (o: AgregadoMargem, k: keyof AgregadoMargem) => Number(o[k]) || 0, m = (o: AgregadoMargem) => g(o, 'receita') - g(o, 'impostos') - g(o, 'taxa') - g(o, 'custo') - g(o, 'comissao');
  const ef = { preco: g(B, 'receita') - g(A, 'receita'), desconto: -(g(B, 'desconto') - g(A, 'desconto')), custo: -(g(B, 'custo') - g(A, 'custo')), comissao: -(g(B, 'comissao') - g(A, 'comissao')), imposto: -(g(B, 'impostos') - g(A, 'impostos')), taxa: -(g(B, 'taxa') - g(A, 'taxa')) };
  const total = m(B) - m(A), soma = ef.preco + ef.custo + ef.comissao + ef.imposto + ef.taxa;
  return { de: m(A), para: m(B), efeitos: ef, total, semExplicacao: Math.round((total - soma) * 100) / 100 };
}
/* categoria do desvio plano × realizado (§155): premissa, execução, contexto ou sem explicação */
export type CategoriaDesvio = 'premissa' | 'execucao' | 'contexto' | 'sem_explicacao';
export const CATEGORIA_NOME: Record<CategoriaDesvio, string> = { premissa: 'desvio de premissa (o plano estava errado)', execucao: 'desvio de execução', contexto: 'desvio de contexto', sem_explicacao: 'sem explicação suficiente' };
export function categoriaDoDesvio(x: { ticketPlan?: number | null; ticketHist?: number | null; taxaPlan?: number | null; taxaHist?: number | null; descontoReal?: number | null; descontoPolitica?: number | null; atividadeReal?: number | null; atividadePlan?: number | null; eventos?: string[] } = {}) {
  const cats: Array<{ k: CategoriaDesvio; txt: string }> = [];
  if (x.ticketPlan != null && x.ticketHist != null && Math.abs(x.ticketPlan / x.ticketHist - 1) > 0.15) cats.push({ k: 'premissa', txt: 'ticket planejado ' + (x.ticketPlan > x.ticketHist ? 'acima' : 'abaixo') + ' do histórico em ' + Math.round(Math.abs(x.ticketPlan / x.ticketHist - 1) * 100) + '%' });
  if (x.taxaPlan != null && x.taxaHist != null && x.taxaPlan - x.taxaHist > 0.05) cats.push({ k: 'premissa', txt: 'conversão planejada ' + Math.round((x.taxaPlan - x.taxaHist) * 100) + ' p.p. acima do histórico' });
  if (x.descontoReal != null && x.descontoPolitica != null && x.descontoReal > x.descontoPolitica) cats.push({ k: 'execucao', txt: 'desconto médio ' + Math.round(x.descontoReal * 100) + '% acima da política (' + Math.round(x.descontoPolitica * 100) + '%)' });
  if (x.atividadeReal != null && x.atividadePlan != null && x.atividadeReal < x.atividadePlan * 0.8) cats.push({ k: 'execucao', txt: 'atividade ' + Math.round((1 - x.atividadeReal / x.atividadePlan) * 100) + '% abaixo do planejado' });
  for (const e of x.eventos ?? []) cats.push({ k: 'contexto', txt: e });
  if (!cats.length) cats.push({ k: 'sem_explicacao', txt: 'dados insuficientes ou conflito de fontes: nenhuma categoria se sustenta' });
  return cats;
}
/* acurácia do forecast (§122): fotos { iso: { receita: { ajust } } } × realizado final; erro por antecedência (dias antes do fim) e viés */
export interface Foto { receita?: { ajust?: number | null } | null }
export interface Acuracia { pontos: Array<{ iso: string; antecedencia: number; prev: number; erro: number; erroPct: number }>; erroAbs: number | null; vies: number | null; a30?: number | null; a15?: number | null; a7?: number | null; n: number }
export function acuracia(fotos: Record<string, Foto>, finalReal: number, fimIso: string): Acuracia {
  const out: Acuracia['pontos'] = []; if (!(finalReal > 0) || !fotos) return { pontos: out, erroAbs: null, vies: null, n: 0 };
  const fim = Date.parse(fimIso + 'T12:00:00Z');
  for (const iso of Object.keys(fotos).sort()) { const prev = fotos[iso]?.receita?.ajust; if (prev == null) continue; const d = Math.round((fim - Date.parse(iso + 'T12:00:00Z')) / DIA), erro = prev - finalReal; out.push({ iso, antecedencia: d, prev, erro, erroPct: erro / finalReal }); }
  const abs = out.length ? out.reduce((a, p) => a + Math.abs(p.erroPct), 0) / out.length : null, vies = out.length ? out.reduce((a, p) => a + p.erroPct, 0) / out.length : null;
  const em = (n: number) => { const c = out.filter(p => p.antecedencia >= n - 3 && p.antecedencia <= n + 3); return c.length ? c.reduce((a, p) => a + p.erroPct, 0) / c.length : null; };
  return { pontos: out, erroAbs: abs, vies, a30: em(30), a15: em(15), a7: em(7), n: out.length };
}
export function acuraciaGeral(ciclos: Array<Acuracia | null | undefined>) {
  const L = ciclos.filter((c): c is Acuracia => !!c && c.n > 0); if (!L.length) return null;
  const med = (k: 'vies' | 'erroAbs' | 'a30' | 'a15' | 'a7') => { const xs = L.map(c => c[k]).filter((x): x is number => x != null); return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null; };
  const vies = med('vies'), erroAbs = med('erroAbs');
  return { n: L.length, erroAbs, vies, a30: med('a30'), a15: med('a15'), a7: med('a7'), direcao: vies == null ? null : vies > 0.05 ? 'otimista' : vies < -0.05 ? 'pessimista' : 'sem viés relevante', confiavel: erroAbs != null && erroAbs < 0.15 };
}
/* erro simétrico por pessoa: quem previu venda e vendeu zero conta como erro grande, não some */
export function acuraciaPorPessoa(L: Array<{ pessoa: string; previsto: number; real: number }>) {
  const por: Record<string, number[]> = {};
  for (const x of L) { const den = (Math.abs(x.previsto) + Math.abs(x.real)) / 2; if (!(den > 0)) continue; (por[x.pessoa] ??= []).push((x.previsto - x.real) / den); }
  return Object.keys(por).map(v => { const xs = por[v]!, vies = xs.reduce((a, b) => a + b, 0) / xs.length; return { pessoa: v, n: xs.length, vies, erroAbs: xs.reduce((a, b) => a + Math.abs(b), 0) / xs.length, direcao: vies > 0.1 ? 'otimista' : vies < -0.1 ? 'pessimista' : 'sem viés' }; }).sort((a, b) => Math.abs(b.vies) - Math.abs(a.vies));
}
/* build-up faseado (§118): quando os leads precisam entrar e se cabe na capacidade */
export interface SemanaFaseado { n: number; ini: string; du: number }
export function faseado(vol: { leads?: number; realizadas?: number; agendadas?: number }, cicloDias: number | null, semanas: SemanaFaseado[], nVend: number, tetoReunioesDia: number | null, cancel: number, vendasMeta: number | null, ticket: number | null, hoje?: string) {
  const du = semanas.reduce((a, w) => a + w.du, 0) || 1;
  const vendasLiq = vendasMeta != null && cancel > 0 && cancel < 1 ? Math.ceil(vendasMeta / (1 - cancel)) : vendasMeta;
  const fator = vendasMeta != null && vendasMeta > 0 && vendasLiq != null ? vendasLiq / vendasMeta : 1, antecedencia = Math.round(Number(cicloDias) || 0), leads = Math.ceil((vol.leads ?? 0) * fator);
  const h0 = hoje ?? new Date().toISOString().slice(0, 10);
  const porSemana = semanas.map(w => { const ini = Date.parse(w.ini + 'T12:00:00Z'), ate = new Date(ini - antecedencia * DIA).toISOString().slice(0, 10); return { n: w.n, ini: w.ini, du: w.du, leadsEntrar: Math.ceil((leads * w.du) / du), devemEntrarAte: ate, atrasado: ate < h0 }; });
  const reunioesDia = Math.ceil((vol.realizadas ?? vol.agendadas ?? 0) * fator) / du, porPessoaDia = nVend > 0 ? reunioesDia / nVend : null;
  const cabe = porPessoaDia == null || !(tetoReunioesDia != null && tetoReunioesDia > 0) ? null : porPessoaDia <= tetoReunioesDia;
  return { vendasLiq, antecedencia, atrasoEntrada: porSemana.some(w => w.atrasado), porSemana, reunioesDia, porPessoaDia, teto: tetoReunioesDia ?? null, cabe, leadsSemana: Math.ceil(leads / Math.max(1, semanas.length)), inicioEntradas: porSemana[0]?.devemEntrarAte ?? null, receitaLiq: vendasLiq != null && ticket ? vendasLiq * ticket : null };
}
/* métricas de proteção (§153): toda métrica de volume tem proteção; alerta quando o volume sobe e a proteção piora */
export const PROTECAO: Record<string, string[]> = { leads: ['tx_agenda'], contatos: ['tx_agenda'], agendadas: ['tx_compar', 'tx_oport'], realizadas: ['tx_oport'], propostas: ['tx_fech', 'desconto_medio'], oport: ['tx_fech'], vendas: ['margem_contrib', 'cancelamentos'], receita: ['margem_contrib', 'caixa_oper'], backlog: ['prazo_receb'] };
export function protecao(volume: { met: string; delta: number | null } | null, protecoes: Array<{ met: string; delta: number | null; un?: string } | null>, limiarVol = 10, banda = 2, menorMelhor: readonly string[] = MENOR_MELHOR_V3) {
  if (!volume || volume.delta == null || volume.delta < limiarVol) return [];
  return protecoes.filter((p): p is { met: string; delta: number; un?: string } => !!p && p.delta != null).flatMap(p => { const piorou = menorMelhor.includes(p.met) ? p.delta > banda : p.delta < -banda; return piorou ? [{ met: p.met, delta: p.delta, un: p.un }] : []; });
}
/* saúde da inteligência (§164, 168): o LAB observa a si mesmo */
export interface ObsRegra { disparos?: number; uteis?: number; naoProcede?: number; intervencoes?: number; ultimo?: string | number | null }
export function saude(obs: Record<string, ObsRegra>, achados: Array<Pick<AchadoV3, 'codigo' | 'estado'> & { composto?: boolean }>, hips: Array<{ final?: string | null; aval?: unknown }>) {
  const regras = achados.filter(a => !a.composto), ativas = regras.filter(a => a.estado === 'ativo'), naoAv = regras.filter(a => a.estado === 'nao_avaliavel'), semRegra = regras.filter(a => a.estado === 'sem_regra');
  const O = Object.keys(obs).map(k => ({ codigo: k, ...obs[k]! })), disparos = O.reduce((a, o) => a + (o.disparos ?? 0), 0), uteis = O.reduce((a, o) => a + (o.uteis ?? 0), 0), np = O.reduce((a, o) => a + (o.naoProcede ?? 0), 0), interv = O.reduce((a, o) => a + (o.intervencoes ?? 0), 0);
  const comDesfecho = hips.filter(h => h.final), ciclos = hips.filter(h => h.aval && h.final), conf = hips.filter(h => h.final === 'sucesso');
  return { regras: regras.length, ativas: ativas.length, naoAvaliaveis: naoAv.length, semRegra: semRegra.length, cobertura: regras.length ? (regras.length - naoAv.length - semRegra.length) / regras.length : 0, disparos, uteis, naoProcede: np, utilidade: uteis + np ? uteis / (uteis + np) : null, intervencoes: interv, taxaIntervencao: disparos ? interv / disparos : null, hipotesesEncerradas: comDesfecho.length, ciclosCompletos: ciclos.length, confirmadas: conf.length, taxaConfirmacao: comDesfecho.length ? conf.length / comDesfecho.length : null, porRegra: O };
}
/* contribuição necessária no mês (venda → OPEX → lucro): com lucro desejado l e MC média m (ambos % da receita líquida), a MC precisa ser F ÷ (1 − l/m) */
export function contribuicaoNecessariaMes(o: { fixo: number | null; mcMes: number; mcPct?: number | null; lucroPct?: number | null; mcVenda?: number | null; fracMes?: number | null }) {
  const F = Number(o.fixo) || 0, feita = Number(o.mcMes) || 0, m = Number(o.mcPct), l = Math.max(0, Number(o.lucroPct) || 0), mv = Number(o.mcVenda), fr = Number(o.fracMes);
  if (!(F > 0)) return null;
  const meta = m > 0 && l < m ? F / (1 - l / m) : null, vendas = (x: number) => (mv > 0 ? Math.max(0, Math.ceil((x - feita) / mv - 1e-9)) : null);
  return { fixo: F, feita, empate: F, meta, faltaEmpate: Math.max(0, F - feita), faltaMeta: meta == null ? null : Math.max(0, meta - feita), vendasEmpate: vendas(F), vendasMeta: meta == null ? null : vendas(meta), ritmo: fr > 0 && fr <= 1 ? feita / fr : null };
}
