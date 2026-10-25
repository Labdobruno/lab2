/* Fundamentos do motor v3 (porta 1:1 o lab_modelo.js da V1, com lab_modelo.test.js como contrato): qualidade da amostra, taxa ajustada,
   variação em p.p. ou %, a CONDIÇÃO DE REGRA com seis parâmetros, a HISTERESE, a rubrica de CONFIANÇA, os níveis de inferência que travam o verbo,
   a maturidade de dados e o grafo de relações (caminhos e natureza do elo mais fraco). Puro: nada lê banco nem tela. */
import { ADITIVAS_V3, COORTE_V3, FOTO_V3 } from '@lab/nucleo';

const DIA = 86_400_000;
export const MATURACAO_COORTE_DIAS = 30;

/* ---------- amostra (§20) ---------- */
export interface FaixasAmostra { insuf?: number; lim?: number; rel?: number }
export const AMOSTRA_PADRAO = { insuf: 10, lim: 30, rel: 100 };
export type QualidadeAmostra = 'insuficiente' | 'limitada' | 'relevante' | 'robusta';
export function amostra(n: number | null | undefined, faixas?: FaixasAmostra) {
  const F = { ...AMOSTRA_PADRAO, ...(faixas ?? {}) }, x = Number(n) || 0;
  const k: QualidadeAmostra = x < F.insuf ? 'insuficiente' : x < F.lim ? 'limitada' : x < F.rel ? 'relevante' : 'robusta';
  return { k, n: x, ok: k === 'relevante' || k === 'robusta', avalia: k !== 'insuficiente', nome: ({ insuficiente: 'amostra insuficiente', limitada: 'amostra limitada', relevante: 'amostra relevante', robusta: 'amostra robusta' } as const)[k] };
}
/* taxa ajustada pela taxa do time: (k + K·taxaTime) ÷ (n + K); converge para a própria conforme n cresce */
export function taxaAjustada(k: number, n: number, taxaTime: number | null | undefined, K = 10): number | null {
  n = Number(n) || 0; k = Number(k) || 0;
  if (taxaTime == null || !Number.isFinite(taxaTime)) return n > 0 ? k / n : null;
  return (k + K * taxaTime) / (n + K);
}
/* ---------- variação (§113): percentuais em p.p., o resto em % relativo; base negativa segue a direção real ---------- */
export interface Variacao { delta: number; un: 'pp' | '%' }
export function variacao(atual: number | null | undefined, base: number | null | undefined, un: string | null | undefined): Variacao | null {
  if (atual == null || base == null || !Number.isFinite(atual) || !Number.isFinite(base)) return null;
  if (un === '%') return { delta: (atual - base) * 100, un: 'pp' };
  return { delta: base !== 0 ? ((atual - base) / Math.abs(base)) * 100 : atual === 0 ? 0 : atual > 0 ? Infinity : -Infinity, un: '%' };
}
export function fmtVar(v: Variacao | null | undefined): string {
  if (!v || v.delta == null || !Number.isFinite(v.delta)) return '—';
  const s = v.delta > 0 ? '+' : v.delta < 0 ? '−' : '';
  return s + (Math.round(Math.abs(v.delta) * 10) / 10).toLocaleString('pt-BR') + (v.un === 'pp' ? ' p.p.' : '%');
}

/* ---------- a condição de regra (§114) ---------- */
export type Operador = 'AUMENTOU' | 'DIMINUIU' | 'ESTAVEL' | 'ACIMA' | 'ABAIXO';
export type BaseComparacao = 'anterior' | 'media90' | 'ano';
export interface Histerese { folga?: number; dias?: number; intervalo?: number }
export interface Condicao { met: string; op: Operador; janela?: number; base?: BaseComparacao; limiar?: number; banda?: number; amostraMin?: number; ref?: number; histerese?: Histerese }
export interface Medida { v?: number | null; n?: number | null; estado: 'ok' | 'ausente'; nota?: string }
export type Medir = (a: number, b: number) => Medida | null | undefined;
export type EstadoCondicao = 'verdadeiro' | 'falso' | 'ausente' | 'insuficiente';
export interface ResultadoCondicao {
  estado: EstadoCondicao; motivo?: string; mov?: 'estavel' | 'aumentou' | 'diminuiu' | 'indefinido';
  atual?: number; base?: number; n: number; baseN?: number; delta?: number | null; un?: 'pp' | '%' | null; texto?: string; cond: Condicao; met?: string;
}
const NOME_BASE: Record<string, string> = { anterior: 'janela anterior', media90: 'média dos 90 dias anteriores', ano: 'mesmo período do ano anterior' };

/* medir(a, b) devolve { v, n, estado } da métrica na janela [a, b). Para métricas de coorte a janela atual termina 30 dias antes de agora.
   Métricas aditivas têm a linha de base reduzida à duração da janela. ESTAVEL é testado pela banda antes de tudo. */
export function condicao(cond: Condicao, medir: Medir, un: string | null | undefined, agora = Date.now(), opts: { aditivas?: readonly string[]; coorte?: readonly string[]; maturacaoDias?: number } = {}): ResultadoCondicao {
  const jan = Math.max(1, Number(cond.janela) || 30), aditivas = opts.aditivas ?? ADITIVAS_V3, coortes = opts.coorte ?? COORTE_V3;
  const ehCoorte = coortes.includes(cond.met), adit = aditivas.includes(cond.met);
  const b = ehCoorte ? agora - (opts.maturacaoDias ?? MATURACAO_COORTE_DIAS) * DIA : agora, a = b - jan * DIA;
  const atual = medir(a, b) ?? { estado: 'ausente' as const };
  if (atual.estado !== 'ok' || atual.v == null || !Number.isFinite(atual.v)) return { estado: 'ausente', motivo: atual.nota ?? 'sem dado na janela', n: atual.n ?? 0, cond, met: cond.met };
  const amin = Number(cond.amostraMin) || 0;
  if (amin && (atual.n ?? 0) < amin) return { estado: 'insuficiente', motivo: 'amostra ' + (atual.n ?? 0) + ' < mínimo ' + amin, n: atual.n ?? 0, atual: atual.v, cond, met: cond.met };
  let baseV: number, baseN = 0, baseTxt = '';
  if (cond.op === 'ACIMA' || cond.op === 'ABAIXO') { baseV = Number(cond.ref); baseTxt = 'referência ' + cond.ref; }
  else {
    const bk = cond.base ?? 'anterior';
    const per: [number, number] = bk === 'anterior' ? [a - jan * DIA, a] : bk === 'media90' ? [a - 90 * DIA, a] : bk === 'ano' ? [a - 365 * DIA, b - 365 * DIA] : [a - jan * DIA, a];
    const bv = medir(per[0], per[1]) ?? { estado: 'ausente' as const };
    if (bv.estado !== 'ok' || bv.v == null || !Number.isFinite(bv.v)) return { estado: 'ausente', motivo: 'sem linha de base (' + bk + ')', n: atual.n ?? 0, atual: atual.v, cond, met: cond.met };
    if (amin && (bv.n ?? 0) < amin) return { estado: 'insuficiente', motivo: 'linha de base com amostra ' + (bv.n ?? 0) + ' < mínimo ' + amin, n: bv.n ?? 0, atual: atual.v, base: bv.v, cond, met: cond.met };
    baseV = bv.v; baseN = bv.n ?? 0; baseTxt = NOME_BASE[bk] ?? bk;
    if (adit) { const dias = (per[1] - per[0]) / DIA; if (dias > 0 && Math.abs(dias - jan) > 0.5) { baseV = (baseV * jan) / dias; baseTxt += ' (reduzida a ' + jan + ' dias)'; } }
  }
  const V = variacao(atual.v, baseV, un);
  if (cond.op !== 'ACIMA' && cond.op !== 'ABAIXO' && !V) return { estado: 'ausente', motivo: 'variação indefinida', n: atual.n ?? 0, cond, met: cond.met };
  const d = V ? V.delta : 0, lim = Number(cond.limiar) || 0, banda = Number(cond.banda) || 0;
  if (cond.op === 'ACIMA' || cond.op === 'ABAIXO') {
    const estado: EstadoCondicao = (cond.op === 'ACIMA' ? atual.v > baseV : atual.v < baseV) ? 'verdadeiro' : 'falso';
    return { estado, atual: atual.v, base: baseV, n: atual.n ?? 0, baseN, delta: V ? V.delta : null, un: V ? V.un : null, texto: (V ? fmtVar(V) + ' contra ' : '') + baseTxt, cond, met: cond.met };
  }
  const EPS = 1e-9, aum = d > 0 && d >= lim - EPS, dim = d < 0 && d <= -lim + EPS, est = Math.abs(d) <= banda + EPS;
  const mov = est ? 'estavel' : aum ? 'aumentou' : dim ? 'diminuiu' : 'indefinido';
  const estado: EstadoCondicao = cond.op === 'ESTAVEL' ? (est ? 'verdadeiro' : 'falso') : cond.op === 'AUMENTOU' ? (aum ? 'verdadeiro' : 'falso') : dim ? 'verdadeiro' : 'falso';
  return { estado, mov, atual: atual.v, base: baseV, n: atual.n ?? 0, baseN, delta: d, un: V!.un, texto: fmtVar(V) + ' contra ' + baseTxt, cond, met: cond.met };
}

/* ---------- histerese (§114): liga quando fecha; só desliga com folga sustentada por N dias; não religa antes do intervalo ---------- */
export interface EstadoHisterese { ligada: boolean; desde?: number | null; abaixoDesde?: number | null; desligouEm?: number | null }
export function histerese(prev: EstadoHisterese | null | undefined, res: { estado: string; delta?: number | null } | null | undefined, cond: { limiar?: number; histerese?: Histerese } | null | undefined, agora = Date.now()): EstadoHisterese {
  const p: EstadoHisterese = prev ?? { ligada: false }, H = { folga: 1, dias: 14, intervalo: 14, ...(cond?.histerese ?? {}) };
  const verdade = !!res && res.estado === 'verdadeiro', lim = Number(cond?.limiar) || 0;
  if (!p.ligada) {
    if (verdade && (!p.desligouEm || agora - p.desligouEm >= H.intervalo * DIA)) return { ligada: true, desde: agora, abaixoDesde: null, desligouEm: p.desligouEm ?? null };
    return { ...p, ligada: false };
  }
  const comFolga = !!res && res.estado !== 'ausente' && res.estado !== 'insuficiente' && (res.delta == null || Math.abs(res.delta) < Math.max(0, lim - H.folga));
  if (!comFolga) return { ...p, abaixoDesde: null };
  const desde = p.abaixoDesde ?? agora;
  if (agora - desde >= H.dias * DIA) return { ligada: false, desde: null, abaixoDesde: null, desligouEm: agora };
  return { ...p, abaixoDesde: desde };
}

/* ---------- confiança (§117): critérios objetivos → alta / média / baixa / não avaliável, com o que faltaria para subir ---------- */
export type NivelConfianca = 'alta' | 'media' | 'baixa' | 'nao';
export const PESO_CONFIANCA: Record<NivelConfianca, number> = { alta: 1, media: 0.6, baixa: 0.3, nao: 0.1 };
export interface Confianca { nivel: NivelConfianca; nome: string; criterios: string[]; subir: string[] }
export function confianca(c: { completo?: boolean; faltando?: string[]; n?: number; amostra?: QualidadeAmostra; aderencia?: number | null; rivais?: number; contra?: boolean; historico?: boolean; essencialAusente?: boolean; faixas?: FaixasAmostra }): Confianca {
  const crit: string[] = [], falta: string[] = [];
  const am = c.amostra ?? amostra(c.n, c.faixas).k;
  if (am === 'insuficiente' || c.essencialAusente) return { nivel: 'nao', nome: 'não avaliável', criterios: [am === 'insuficiente' ? 'amostra insuficiente' : 'dado essencial ausente'], subir: ['O LAB responde "não sei": ' + (am === 'insuficiente' ? 'faltam eventos para avaliar' : 'falta um dado necessário')] };
  crit.push(c.completo ? 'dados completos' : 'falta dado necessário'); if (!c.completo) falta.push('coletar: ' + ((c.faltando ?? []).join(', ') || 'dados necessários da hipótese'));
  crit.push('amostra ' + am); if (am === 'limitada') falta.push('ampliar a amostra (hoje ' + (c.n ?? 0) + ' eventos)');
  const ader = c.aderencia == null ? 1 : Number(c.aderencia); crit.push(ader >= 1 ? 'todas as condições atendidas' : Math.round(ader * 100) + '% das condições atendidas'); if (ader < 1) falta.push('as condições restantes precisariam se confirmar');
  crit.push(c.rivais ? c.rivais + ' hipótese(s) rival(is) ativa(s)' : 'nenhuma rival ativa'); if (c.rivais) falta.push('descartar as rivais com o dado discriminante');
  crit.push(c.contra ? 'há evidência contrária registrada' : 'sem evidência contrária'); if (c.contra) falta.push('explicar a evidência contrária');
  crit.push(c.historico ? 'já confirmada nesta operação em contexto semelhante' : 'sem histórico próprio'); if (!c.historico) falta.push('um experimento registrado e confirmado na própria operação');
  let nivel: NivelConfianca;
  if (!c.completo || am === 'limitada' || c.contra) nivel = 'baixa';
  else if (ader >= 1 && !c.rivais && c.historico) nivel = 'alta';
  else if (ader >= 1 && (c.rivais ?? 0) <= 1) nivel = 'media';
  else nivel = 'baixa';
  return { nivel, nome: ({ alta: 'alta', media: 'média', baixa: 'baixa' } as const)[nivel], criterios: crit, subir: falta };
}

/* ---------- níveis de inferência (§10): o motor trava o verbo ---------- */
export const INFERENCIA = {
  observado: { nome: 'Observado', verbo: 'ocorreu junto com', permite: ['ocorreu junto com'] },
  relacao: { nome: 'Relação conhecida', verbo: 'tem relação conhecida com', permite: ['tem relação conhecida com'] },
  hipotese: { nome: 'Hipótese', verbo: 'é compatível com', permite: ['é compatível com'] },
  evidencia: { nome: 'Evidência forte', verbo: 'produziu', permite: ['produziu', 'provocou'] },
  confirmado: { nome: 'Confirmado pela operação', verbo: 'produziu consistentemente', permite: ['produziu', 'provocou', 'produziu consistentemente'] },
} as const;
export type NivelInferencia = keyof typeof INFERENCIA;
export const frase = (nivel: NivelInferencia | string, x: string, y: string) => x + ' ' + (INFERENCIA[nivel as NivelInferencia] ?? INFERENCIA.observado).verbo + ' ' + y;

/* ---------- maturidade de dados (§129) ---------- */
export function maturidade(tem: { funil?: boolean; financeiro?: boolean; operacao?: boolean; intervencoes?: boolean } = {}) {
  const n = !tem.funil ? 0 : !tem.financeiro ? 1 : !tem.operacao ? 2 : !tem.intervencoes ? 3 : 4;
  const N = [['Nenhuma integração', 'Build-up com premissas informadas pelo gestor'], ['Funil comercial', 'Realizado, forecast, gap e gargalo de funil'], ['Funil + economia da venda', 'Qualidade da receita, margem, hipóteses comercial ↔ financeiro'], ['Funil + economia + operação', 'Restrições, capacidade, cadeia causal completa'], ['Histórico de intervenções', 'Memória, conhecimento empírico e recomendações com histórico próprio']] as const;
  const falta = n === 0 ? 'negócios no funil' : n === 1 ? 'preço e custo registrados nas vendas (Economia)' : n === 2 ? 'fonte de operação e entrega ligada' : n === 3 ? 'ao menos um experimento encerrado com desfecho' : null;
  return { nivel: n, dados: N[n]![0], entrega: N[n]![1], falta };
}

/* ---------- grafo de relações (§141): caminhos e natureza do elo mais fraco ---------- */
export type Natureza = 'matematica' | 'operacional' | 'observada' | 'hipotese';
export interface Relacao { id: string; tipo: 'causal' | 'dependencia' | 'restricao' | 'mediacao' | 'atraso' | 'compensacao' | 'contextual'; de: string; para: string; mecanismo: string; natureza: Natureza; atraso: number; origem: string; sinal?: 1 | -1 }
export const NATUREZA_ORDEM: Natureza[] = ['matematica', 'operacional', 'observada', 'hipotese'];
export const NATUREZA_NOME: Record<Natureza, string> = { matematica: 'matemática direta', operacional: 'relação operacional conhecida', observada: 'associação observada', hipotese: 'hipótese' };
export function caminhos(rel: Relacao[], de: string, para: string, max = 5): Relacao[][] {
  const out: Relacao[][] = [], fila: Array<[string, Relacao[]]> = [[de, []]], seen = new Set<string>();
  while (fila.length) {
    const [no, path] = fila.shift()!; if (path.length > max) continue;
    for (const r of rel.filter(r => r.de === no)) { const p2 = path.concat([r]); if (r.para === para) { out.push(p2); continue; } const key = r.para + '|' + p2.length; if (seen.has(key)) continue; seen.add(key); fila.push([r.para, p2]); }
  }
  return out;
}
export const naturezaDoCaminho = (path: Array<{ natureza?: Natureza }>): Natureza => { let pior = 0; for (const r of path) { const i = NATUREZA_ORDEM.indexOf(r.natureza ?? 'hipotese'); if (i > pior) pior = i; } return NATUREZA_ORDEM[pior]!; };
/* as relações universais entre as métricas do catálogo v3 */
export const RELACOES: Relacao[] = [
  { id: 'r01', tipo: 'dependencia', de: 'vendas', para: 'receita', mecanismo: 'receita = vendas × ticket', natureza: 'matematica', atraso: 0, origem: 'universal' },
  { id: 'r02', tipo: 'dependencia', de: 'ticket', para: 'receita', mecanismo: 'receita = vendas × ticket', natureza: 'matematica', atraso: 0, origem: 'universal' },
  { id: 'r03', tipo: 'dependencia', de: 'leads', para: 'agendadas', mecanismo: 'lead → reunião agendada pela taxa de agendamento', natureza: 'matematica', atraso: 3, origem: 'universal' },
  { id: 'r04', tipo: 'dependencia', de: 'agendadas', para: 'realizadas', mecanismo: 'comparecimento', natureza: 'matematica', atraso: 5, origem: 'universal' },
  { id: 'r05', tipo: 'dependencia', de: 'realizadas', para: 'oport', mecanismo: 'qualificação', natureza: 'matematica', atraso: 3, origem: 'universal' },
  { id: 'r06', tipo: 'dependencia', de: 'oport', para: 'vendas', mecanismo: 'fechamento', natureza: 'matematica', atraso: 15, origem: 'universal' },
  { id: 'r11', tipo: 'causal', de: 'desconto_medio', para: 'margem_contrib', mecanismo: 'desconto reduz contribuição por venda', natureza: 'matematica', atraso: 0, origem: 'universal', sinal: -1 },
  { id: 'r12', tipo: 'compensacao', de: 'desconto_medio', para: 'tx_fech', mecanismo: 'desconto pode comprar conversão', natureza: 'observada', atraso: 0, origem: 'universal', sinal: 1 },
  { id: 'r13', tipo: 'compensacao', de: 'ticket', para: 'tx_fech', mecanismo: 'ticket maior tende a reduzir conversão', natureza: 'observada', atraso: 0, origem: 'universal', sinal: -1 },
  { id: 'r14', tipo: 'causal', de: 'custo_var_venda', para: 'margem_contrib', mecanismo: 'custo acima do considerado na proposta corrói a margem', natureza: 'matematica', atraso: 0, origem: 'universal', sinal: -1 },
  { id: 'r19', tipo: 'causal', de: 'cancelamentos', para: 'receita', mecanismo: 'venda cancelada não vira receita', natureza: 'matematica', atraso: 0, origem: 'universal', sinal: -1 },
  { id: 'r23', tipo: 'contextual', de: 'tx_agenda', para: 'tx_fech', mecanismo: 'lead pior agenda mais e fecha menos (depende do canal)', natureza: 'hipotese', atraso: 20, origem: 'universal' },
  { id: 'r25', tipo: 'causal', de: 'contatos', para: 'agendadas', mecanismo: 'agendadas = contatos × taxa de agendamento por contato', natureza: 'matematica', atraso: 1, origem: 'universal' },
  { id: 'r30', tipo: 'causal', de: 'investimento', para: 'leads', mecanismo: 'leads pagos = investimento ÷ CPL', natureza: 'operacional', atraso: 3, origem: 'universal', sinal: 1 },
  { id: 'r31', tipo: 'dependencia', de: 'investimento', para: 'cac', mecanismo: 'CAC = investimento ÷ vendas', natureza: 'matematica', atraso: 0, origem: 'universal', sinal: 1 },
  { id: 'r32', tipo: 'causal', de: 'cac', para: 'margem_contrib', mecanismo: 'CAC acima da margem por venda come o resultado do canal', natureza: 'operacional', atraso: 0, origem: 'universal', sinal: -1 },
  { id: 'r33', tipo: 'causal', de: 'negocios_parados', para: 'ciclo_venda', mecanismo: 'negócio parado alonga o ciclo', natureza: 'operacional', atraso: 0, origem: 'universal', sinal: 1 },
  { id: 'r34', tipo: 'causal', de: 'ciclo_venda', para: 'tx_fech', mecanismo: 'ciclo mais longo perde fechamento', natureza: 'observada', atraso: 0, origem: 'universal', sinal: -1 },
  { id: 'r35', tipo: 'causal', de: 'churn_receita', para: 'mrr', mecanismo: 'churn reduz a receita recorrente', natureza: 'matematica', atraso: 0, origem: 'universal', sinal: -1 },
  { id: 'r07', tipo: 'causal', de: 'vendas', para: 'recebiveis', mecanismo: 'toda venda gera contas a receber pela condição de pagamento', natureza: 'operacional', atraso: 0, origem: 'universal' },
  { id: 'r10', tipo: 'causal', de: 'prazo_receb', para: 'caixa_oper', mecanismo: 'prazo maior = caixa entra depois', natureza: 'operacional', atraso: 0, origem: 'universal', sinal: -1 },
  { id: 'r21', tipo: 'causal', de: 'exposicao', para: 'caixa_oper', mecanismo: 'projetos deficitários consomem o caixa', natureza: 'matematica', atraso: 0, origem: 'universal', sinal: -1 },
  { id: 'r26', tipo: 'causal', de: 'vendas', para: 'backlog', mecanismo: 'cada venda entra na fila de entrega', natureza: 'operacional', atraso: 2, origem: 'universal', sinal: 1 },
];
export const relacoesDe = (id: string, rel: Relacao[] = RELACOES) => rel.filter(r => r.de === id);
export const relacoesPara = (id: string, rel: Relacao[] = RELACOES) => rel.filter(r => r.para === id);
export { FOTO_V3 };
