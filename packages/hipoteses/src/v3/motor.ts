/* Motor de achados v3 (porta 1:1 o lab_motor.js da V1; lab_motor.test.js é o contrato): avalia cada hipótese pelas condições estruturadas,
   calcula aderência, rivais, confiança, impacto em reais (na mesma moeda: receita vira contribuição pela margem), prioridade, compõe achados
   a partir de hipóteses que se ligam, aplica histerese e modo sombra, e respeita o orçamento de atenção com as marcas do gestor.
   Determinístico: a mesma entrada produz o mesmo resultado. Nada aqui lê banco nem tela. */
import { analisar, avaliar, variaveisUsadas, type Contexto } from '@lab/nucleo';
import { amostra, condicao, confianca, histerese, PESO_CONFIANCA, type Condicao, type Confianca, type EstadoHisterese, type FaixasAmostra, type Medida, type ResultadoCondicao } from './condicao.js';

const DIA = 86_400_000;
export type Dimensao = 'contribuicao' | 'receita' | 'caixa' | 'capacidade';
export type TipoAchado = 'problema' | 'risco' | 'oportunidade' | 'gargalo' | 'anomalia' | 'contradicao' | 'hipotese' | 'investigacao';
export const TIPOS_ACHADO_NOME: Record<TipoAchado, string> = { problema: 'Problema (o que está piorando?)', risco: 'Risco (o que pode piorar?)', oportunidade: 'Oportunidade (onde há ganho?)', gargalo: 'Gargalo (qual restrição limita?)', anomalia: 'Anomalia', contradicao: 'Contradição (indicadores contando histórias diferentes)', hipotese: 'Hipótese', investigacao: 'Investigação (o que descobrir antes de agir?)' };

/* a hipótese como dado (o pack) */
export interface HipoteseV3 {
  chave: string; titulo: string; acao: string;
  quando?: string | null;                 // forma simples: fórmula booleana sobre o contexto de hoje
  condicoes?: Condicao[] | null;          // forma estruturada
  essenciais?: string[] | null; impacto?: string | null; dimensao?: Dimensao | null; tipo?: TipoAchado | null;
  severidade?: 'alta' | 'media' | 'baixa' | null; mecanismo?: string | null; rivais?: string[] | null; distingue?: string | null; intervencoes?: string[] | null; requer?: string[] | null;
}
export interface Intervencao { chave: string; nome: string; variavel?: string | null; ataca?: string[] | null; impacto?: Record<string, string> | null; fonte?: string | null; riscos?: string | null; naoUsar?: string | null; esforco?: number | null; prazoDias?: number | null }
export interface Composto { chave: string; nome: string; de: string[]; relacao?: string | null; tipo?: TipoAchado | null; dimensao?: Dimensao | null; texto?: string | null }
export interface RegraEstado { estado?: 'rascunho' | 'sombra' | 'ativa' | 'aposentada'; params?: Record<string, unknown> }
export interface EventoContexto { ts: number; areas?: string[]; data?: string; desc: string }
export type Elegibilidade = 'elegivel' | 'inelegivel' | 'experimento';
export const ELEGIBILIDADE_NOME: Record<Elegibilidade, string> = { elegivel: 'elegível', inelegivel: 'inelegível', experimento: 'requer experimento' };

export interface Impacto { valor: number; dimensao: Dimensao; texto: string; premissas: string[]; receitaBruta?: number; margemUsada?: number }
export interface AchadoV3 {
  codigo: string; nome: string; tipo: TipoAchado; dimensao: Dimensao; estado: 'ativo' | 'parcial' | 'inativo' | 'nao_avaliavel' | 'sem_regra';
  ativo: boolean; aderencia: number; conds: ResultadoCondicao[]; faltando: string[]; impacto: Impacto | null; confianca: Confianca;
  rivais: Array<{ codigo: string; nome: string; estado: string }>; distingue?: string | null; mecanismo?: string | null; acao: string; contexto: EventoContexto[];
  intervencoes: Array<Intervencao & { elegibilidade: Elegibilidade }>; prioridade: number; sombra: boolean; ligada: boolean; hist: EstadoHisterese; novo: boolean;
  composto?: boolean; componentes?: string[]; relacao?: string | null; texto?: string | null; cobertoPor?: string; severidade?: string | null;
}
export interface OpcoesMotor {
  agora?: number; regras?: Record<string, RegraEstado>; hist?: Record<string, EstadoHisterese>; historico?: string[]; confirmadas?: string[]; inelegiveis?: string[]; breakEven?: Record<string, boolean>;
  contexto?: EventoContexto[]; margemRef?: number; faixas?: FaixasAmostra; intervencoes?: Record<string, Intervencao> | Intervencao[]; compostos?: Composto[];
  ctx?: Contexto;                          // contexto de hoje para as hipóteses simples ("quando") e para variáveis extras nas fórmulas
  nSimples?: number;                       // amostra usada pelas hipóteses simples (ex.: amostra da coorte)
  aditivas?: readonly string[]; coorte?: readonly string[]; maturacaoDias?: number;
}
export type MedirMetrica = (id: string, a: number, b: number) => Medida | null | undefined;
export type Unidade = (id: string) => string | null | undefined;

/* áreas do diário de contexto que podem explicar cada dimensão (evento sem áreas explica qualquer um) */
export const AREAS_CONTEXTO = ['Comercial', 'Marketing', 'Financeiro', 'Operação', 'Fornecedor', 'Equipe', 'Mercado/regulação'] as const;
export const CONTEXTO_POR_DIMENSAO: Record<Dimensao, string[]> = { contribuicao: ['Comercial', 'Marketing', 'Fornecedor', 'Equipe', 'Mercado/regulação'], caixa: ['Financeiro', 'Operação', 'Fornecedor', 'Mercado/regulação'], capacidade: ['Operação', 'Equipe', 'Fornecedor'], receita: ['Comercial', 'Marketing', 'Equipe', 'Mercado/regulação'] };

/* elegibilidade de uma intervenção (§151): restrições conhecidas, ponto de equilíbrio e histórico */
export function elegibilidade(I: Partial<Intervencao> & { chave: string } | null | undefined, opts: Pick<OpcoesMotor, 'inelegiveis' | 'breakEven' | 'confirmadas'> = {}): Elegibilidade {
  if (!I) return 'experimento';
  if (opts.inelegiveis?.includes(I.chave)) return 'inelegivel';
  if (opts.breakEven && opts.breakEven[I.chave] === false) return 'inelegivel';
  if (opts.confirmadas?.includes(I.chave)) return 'elegivel';
  const neg = Object.keys(I.impacto ?? {}).filter(k => k !== 'risco' && /−|^-/.test(I.impacto![k] ?? ''));
  return neg.length ? 'experimento' : 'elegivel';
}

interface Parcial { h: HipoteseV3; conds: ResultadoCondicao[]; estado: AchadoV3['estado']; ativa: boolean; aderencia: number; impacto: Impacto | null; faltando: string[]; essFalta: string[]; nMin: number; ctxEventos: EventoContexto[]; sombra: boolean }

/* avalia a biblioteca inteira. medir(id, a, b) → medida na janela; un(id) → unidade */
export function avaliarV3(bib: HipoteseV3[], medir: MedirMetrica, un: Unidade, opts: OpcoesMotor = {}): AchadoV3[] {
  const agora = opts.agora ?? Date.now(), regras = opts.regras ?? {}, hist = opts.hist ?? {};
  const INT: Record<string, Intervencao> = Array.isArray(opts.intervencoes) ? Object.fromEntries(opts.intervencoes.map(i => [i.chave, i])) : opts.intervencoes ?? {};
  const porCod: Record<string, Parcial> = {}, ctxHoje = opts.ctx ?? {};
  for (const h of bib) {
    const R = regras[h.chave] ?? {}, estadoRegra = R.estado ?? 'ativa'; if (estadoRegra === 'aposentada' || estadoRegra === 'rascunho') continue;
    let conds: ResultadoCondicao[];
    if (h.condicoes && h.condicoes.length) {
      /* calibração por regra: params[met] vale só para aquela métrica; params plano vale para as condições que não são ESTAVEL */
      conds = h.condicoes.map(c0 => {
        const pm = R.params && typeof R.params[c0.met] === 'object' && R.params[c0.met] ? (R.params[c0.met] as Partial<Condicao>) : R.params && c0.op !== 'ESTAVEL' ? (R.params as Partial<Condicao>) : {};
        const c: Condicao = { ...c0, ...pm, met: c0.met, op: c0.op };
        return condicao(c, (a, b) => medir(c.met, a, b), un(c.met), agora, { aditivas: opts.aditivas, coorte: opts.coorte, maturacaoDias: opts.maturacaoDias });
      });
    } else if (h.quando) {
      /* forma simples: a fórmula de hoje é uma condição só; sem dado = ausente */
      let r: ResultadoCondicao;
      try { const v = avaliar(analisar(h.quando), ctxHoje); const n = opts.nSimples ?? 0; r = v === null ? { estado: 'ausente', motivo: 'faltam: ' + [...variaveisUsadas(analisar(h.quando))].filter(x => ctxHoje[x] == null).join(', '), n, cond: { met: 'quando', op: 'ACIMA' }, met: 'quando' } : { estado: v === false || v === 0 ? 'falso' : 'verdadeiro', n, cond: { met: 'quando', op: 'ACIMA' }, met: 'quando', texto: h.quando }; }
      catch (e) { r = { estado: 'ausente', motivo: 'fórmula inválida: ' + (e as Error).message, n: 0, cond: { met: 'quando', op: 'ACIMA' }, met: 'quando' }; }
      conds = [r];
    } else conds = [];
    const ausentes = conds.filter(r => r.estado === 'ausente' || r.estado === 'insuficiente');
    const essenciais = h.condicoes && h.condicoes.length ? h.essenciais ?? [] : ['quando'];
    const essFalta = essenciais.filter(m => ausentes.some(r => r.met === m)), faltando = ausentes.map(r => r.met!);
    /* condição não essencial sem dado não derruba a hipótese (vira "faltando" e rebaixa a confiança); as essenciais sim */
    const relev = conds.filter(r => !(ausentes.includes(r) && !essFalta.includes(r.met!))), verdadeiros = relev.filter(r => r.estado === 'verdadeiro').length;
    const aderencia = relev.length ? verdadeiros / relev.length : 0, ativa = relev.length > 0 && verdadeiros === relev.length && !essFalta.length;
    const estado: AchadoV3['estado'] = !conds.length ? 'sem_regra' : essFalta.length ? 'nao_avaliavel' : ativa ? 'ativo' : aderencia >= 0.5 ? 'parcial' : 'inativo';
    const jan = Math.max(1, Number(conds[0]?.cond?.janela) || 30), a = agora - jan * DIA;
    const cache: Record<string, Medida> = {}, ler = (id: string, x: number, y: number) => { const k = id + '|' + x + '|' + y; if (!(k in cache)) cache[k] = medir(id, x, y) ?? { estado: 'ausente' }; return cache[k]!; };
    const aditivas = opts.aditivas ?? [];
    const v = (id: string) => { const c = conds.find(r => r.met === id); if (c && c.atual != null) return c.atual; const r = ler(id, a, agora); return r.estado === 'ok' ? r.v ?? null : null; };
    const base = (id: string) => { const c = conds.find(r => r.met === id); if (c && c.base != null) return c.base; const r = ler(id, a - 90 * DIA, a); if (r.estado !== 'ok' || r.v == null) return null; return aditivas.includes(id) ? (r.v * jan) / 90 : r.v; };
    const nDe = (id: string) => { const c = conds.find(r => r.met === id); return c ? c.n : 0; };
    let impacto: Impacto | null = null;
    if ((ativa || estado === 'parcial') && h.impacto) {
      try {
        const f = analisar(h.impacto), vars = [...variaveisUsadas(f)], ctxF: Contexto = { ...ctxHoje };
        for (const x of vars) { const m = /^(.+?)(_base|_n)$/.exec(x); if (m && !(x in ctxHoje)) ctxF[x] = m[2] === '_base' ? base(m[1]!) : nDe(m[1]!); else if (!(x in ctxHoje)) ctxF[x] = v(x); }
        const val = avaliar(f, ctxF);
        if (typeof val === 'number' && Number.isFinite(val) && val > 0) impacto = { valor: val, dimensao: h.dimensao ?? 'contribuicao', texto: 'impacto estimado pela fórmula da hipótese', premissas: [h.impacto] };
      } catch { impacto = null; }
      /* receita não é contribuição: a perda de receita vira contribuição pela margem (a da janela, ou a de referência) para disputar prioridade na mesma moeda */
      if (impacto && impacto.dimensao === 'receita') {
        const m = v('margem_contrib') ?? (typeof ctxHoje.margem_percentual === 'number' ? ctxHoje.margem_percentual : null), mr = m != null && m > 0 && m < 1 ? m : opts.margemRef ?? 0.25;
        impacto = { valor: impacto.valor * mr, dimensao: 'contribuicao', receitaBruta: impacto.valor, margemUsada: mr, texto: impacto.texto + ' (R$ ' + Math.round(impacto.valor).toLocaleString('pt-BR') + ' de receita, ' + Math.round(mr * 100) + '% de margem)', premissas: impacto.premissas.concat(['receita convertida em contribuição pela margem de ' + Math.round(mr * 100) + '%']) };
      }
    }
    /* amostra: só das condições avaliadas que declaram amostra mínima; contagens usam o próprio valor e não entram */
    const avaliadas = conds.filter(r => r.estado === 'verdadeiro' || r.estado === 'falso'), comAm = avaliadas.filter(r => r.cond && Number(r.cond.amostraMin) > 0);
    const nMin = h.condicoes && h.condicoes.length ? (comAm.length ? Math.min(...comAm.map(r => r.n || 0)) : avaliadas.length ? 1000 : 0) : opts.nSimples ?? 1000;
    const dim: Dimensao = h.dimensao ?? 'contribuicao', areasOk = CONTEXTO_POR_DIMENSAO[dim] ?? [];
    const ctxEventos = (opts.contexto ?? []).filter(ev => { const t = ev.ts || 0; if (!(t >= a - 15 * DIA && t <= agora)) return false; const ar = ev.areas ?? []; return !ar.length || ar.some(x => areasOk.includes(x)); });
    porCod[h.chave] = { h, conds, estado, ativa, aderencia, impacto, faltando, essFalta, nMin, ctxEventos, sombra: estadoRegra === 'sombra' };
  }
  /* pares que um composto reúne não são rivais entre si: coexistem e se somam ao mesmo padrão */
  const copartes: Record<string, string[]> = {}, compAtivos = (opts.compostos ?? []).filter(c => c.de.every(k => porCod[k] && porCod[k]!.estado === 'ativo' && !porCod[k]!.sombra));
  for (const c of compAtivos) for (const k of c.de) (copartes[k] ??= []).push(...c.de.filter(z => z !== k));
  const out: AchadoV3[] = [];
  for (const k of Object.keys(porCod)) {
    const x = porCod[k]!, h = x.h;
    const rivaisAtivas = (h.rivais ?? []).filter(c => porCod[c] && porCod[c]!.estado === 'ativo' && !porCod[c]!.sombra && !(copartes[k] ?? []).includes(c)).map(c => ({ codigo: c, nome: porCod[c]!.h.titulo, estado: porCod[c]!.estado }));
    const conf = x.estado === 'nao_avaliavel' ? confianca({ completo: false, n: x.nMin, essencialAusente: true, faixas: opts.faixas })
      : confianca({ completo: !x.faltando.length, faltando: x.faltando, n: x.nMin, aderencia: x.aderencia, rivais: rivaisAtivas.length + (x.ctxEventos.length ? 1 : 0), contra: false, historico: (opts.historico ?? []).includes(h.chave), faixas: opts.faixas });
    const ints = (h.intervencoes ?? []).map(c => { const I: Intervencao = { ...(INT[c] ?? { chave: c, nome: c }) }; return { ...I, elegibilidade: elegibilidade(I, opts) }; });
    const esforco = ints.length ? Math.min(...ints.map(i => Number(i.esforco) || 2)) : 2;
    const tipo: TipoAchado = h.tipo ?? 'problema';
    const prioridade = ((x.impacto ? x.impacto.valor : 0) * PESO_CONFIANCA[conf.nivel] * (x.estado === 'parcial' ? x.aderencia : 1)) / esforco + (tipo === 'risco' || tipo === 'gargalo' ? 1 : 0);
    /* histerese: liga quando a condição fecha; só desliga com folga sustentada por N dias; sem dado o estado é mantido */
    const hc = (h.condicoes ?? [])[0]?.histerese ?? {}, prev = hist[h.chave] ?? { ligada: false };
    const novoHist = histerese(prev, x.estado === 'nao_avaliavel' || x.estado === 'sem_regra' ? { estado: 'ausente' } : { estado: x.ativa ? 'verdadeiro' : 'falso', delta: x.ativa ? 1e9 : 0 }, { limiar: 1, histerese: { folga: 0.5, dias: hc.dias ?? 14, intervalo: hc.intervalo ?? 14 } }, agora);
    out.push({ codigo: h.chave, nome: h.titulo, tipo, dimensao: x.impacto ? x.impacto.dimensao : h.dimensao ?? 'contribuicao', estado: x.estado, ativo: x.ativa, aderencia: x.aderencia, conds: x.conds, faltando: x.faltando, impacto: x.impacto, confianca: conf, rivais: rivaisAtivas, distingue: h.distingue, mecanismo: h.mecanismo, acao: h.acao, contexto: x.ctxEventos, intervencoes: ints, prioridade, sombra: x.sombra, ligada: novoHist.ligada, hist: novoHist, novo: novoHist.ligada && !prev.ligada, severidade: h.severidade });
  }
  /* composição (§145): só com todos os componentes ativos; os componentes ficam cobertos; impacto = o maior, com a dimensão dele */
  for (const c of compAtivos) {
    const comps = c.de.map(k => out.find(x => x.codigo === k)!), imp = comps.map(x => x.impacto).filter((x): x is Impacto => !!x).sort((p, q) => q.valor - p.valor)[0] ?? null;
    const conf = comps.map(x => x.confianca).sort((p, q) => PESO_CONFIANCA[p.nivel] - PESO_CONFIANCA[q.nivel])[0]!;
    for (const x of comps) x.cobertoPor = c.chave;
    out.push({ codigo: c.chave, nome: c.nome, composto: true, componentes: c.de, relacao: c.relacao, texto: c.texto, tipo: c.tipo ?? 'problema', dimensao: imp ? imp.dimensao : c.dimensao ?? 'contribuicao', estado: 'ativo', ativo: true, aderencia: 1, conds: [], faltando: [], impacto: imp, confianca: conf, rivais: [], acao: comps.map(x => x.acao).join(' '), intervencoes: comps.flatMap(x => x.intervencoes).filter((v, i, L) => L.findIndex(w => w.chave === v.chave) === i), prioridade: Math.max(...comps.map(x => x.prioridade)) + 2, sombra: false, ligada: true, hist: { ligada: true }, contexto: [], novo: comps.some(x => x.novo) });
  }
  out.sort((p, q) => q.prioridade - p.prioridade || (p.codigo < q.codigo ? -1 : 1));
  return out;
}

/* ---------- orçamento de atenção (§133, 152): N na tela; o resto acessível. Visível = ligado pela histerese, não coberto, não marcado.
   "Aceito" e "não procede" escondem até o impacto crescer 50% acima do que era quando foi marcado. ---------- */
export interface Marca { estado: 'tratamento' | 'aceito' | 'naoprocede'; motivo?: string | null; em?: string | number | null; por?: string | null; ref?: number | null }
export function orcamentoDeAtencao(achados: AchadoV3[], marcas: Record<string, Marca> = {}, N = 5) {
  const vis: AchadoV3[] = [], resto: AchadoV3[] = [], tratados: AchadoV3[] = [];
  const exibivel = (a: AchadoV3) => !a.sombra && (a.composto ? a.ativo : (a.ligada && a.estado !== 'nao_avaliavel') || a.estado === 'parcial');
  for (const a of achados.filter(exibivel)) {
    const m = marcas[a.codigo];
    if (m && (m.estado === 'aceito' || m.estado === 'naoprocede') && !(m.ref != null && a.impacto && a.impacto.valor > m.ref * 1.5)) { tratados.push(a); continue; }
    if (a.cobertoPor) { resto.push(a); continue; }
    (vis.length < N ? vis : resto).push(a);
  }
  return { visiveis: vis, resto, tratados, naoAvaliaveis: achados.filter(a => a.estado === 'nao_avaliavel'), sombra: achados.filter(a => a.sombra && (a.estado === 'ativo' || a.estado === 'parcial')) };
}

/* ---------- custo da inação (§121, 150): impacto por mês se nada mudar ---------- */
export const custoDaInacao = (impacto: Impacto | null | undefined, jan = 30) => (!impacto || !(impacto.valor > 0) ? null : { porMes: (impacto.valor * 30) / Math.max(1, jan || 30), dimensao: impacto.dimensao, texto: 'se nada mudar, ' + impacto.texto });

/* ---------- curva de caixa (§119) e pontos de equilíbrio (§120) ---------- */
export interface EventoCaixa { dia: number; valor: number; desc?: string }
export function curvaDeCaixa(eventos: EventoCaixa[]) {
  const L = [...eventos].sort((a, b) => a.dia - b.dia); let s = 0, pior = 0, piorDia: number | null = null, negDe: number | null = null, diasNeg = 0; const pts: Array<{ dia: number; saldo: number; desc: string }> = [];
  for (const e of L) {
    s = Math.round((s + e.valor) * 100) / 100; pts.push({ dia: e.dia, saldo: s, desc: e.desc ?? '' }); if (s < pior) { pior = s; piorDia = e.dia; }
    if (s < -0.005 && negDe == null) negDe = e.dia; if (s >= -0.005 && negDe != null) { diasNeg += e.dia - negDe; negDe = null; }
  }
  if (negDe != null && L.length) diasNeg += L[L.length - 1]!.dia - negDe;
  return { pts, pior, piorDia, diasNeg, final: s };
}
/* condições de pagamento num projeto típico: recebimentos [[dia, fração]], saídas [[dia, valor, desc]] */
export const simularCondicaoDeCaixa = (R: number, receb: Array<[number, number]>, saidas: Array<[number, number, string?]>) => curvaDeCaixa(receb.map(x => ({ dia: x[0], valor: R * x[1], desc: 'recebimento ' + Math.round(x[1] * 100) + '%' })).concat(saidas.map(s => ({ dia: s[0], valor: -s[1], desc: s[2] ?? 'saída' }))));
export function breakEvenDescontoSimples(contribAtual: number, descontoNovoFrac: number, ticket: number, convAtual: number | null) {
  const contribNova = contribAtual - descontoNovoFrac * ticket; if (!(contribAtual > 0) || !(contribNova > 0)) return null;
  const volEq = contribAtual / contribNova; return { volEq, volPct: (volEq - 1) * 100, quedaMax: 1 - contribNova / contribAtual, convEq: convAtual != null ? convAtual * (contribNova / contribAtual) : null, contribNova };
}
export function breakEvenEntrada(R: number, deltaFrac: number, dias: number, custoCapMes: number, contribUnit: number, convAtual: number | null) {
  if (!(R > 0) || !(contribUnit > 0)) return null; const ganho = R * deltaFrac * (dias / 30) * custoCapMes, quedaMax = ganho / contribUnit;
  return { ganhoPorVenda: ganho, quedaMax, convEq: convAtual != null ? convAtual * (1 - quedaMax) : null };
}

/* ---------- desenho de experimento (§123): o que falta antes de começar ---------- */
export interface DesenhoExperimento { id?: string; ind?: string | null; secundarios?: string[]; esperado?: number | string | null; ini?: string | null; fim?: string | null; grupo?: string | null; pessoa?: string | null; titulo?: string }
export function desenhoDeExperimento(hp: DesenhoExperimento, ctx: { cicloDias?: number | null; nBase?: number | null; minN?: number; outras?: DesenhoExperimento[]; eventos?: Array<{ data: string; desc: string }> } = {}) {
  const av: string[] = [];
  if (!hp.ind) av.push('sem métrica principal');
  if (!(hp.secundarios ?? []).length) av.push('sem métrica de proteção (o que não pode piorar)');
  if (hp.esperado == null || hp.esperado === '') av.push('sem critério de sucesso com número');
  const dur = hp.ini && hp.fim ? (Date.parse(hp.fim) - Date.parse(hp.ini)) / DIA : null;
  if (dur != null && ctx.cicloDias && dur < ctx.cicloDias) av.push('duração (' + Math.round(dur) + ' d) menor que um ciclo de venda (' + Math.round(ctx.cicloDias) + ' d)');
  if (ctx.nBase != null && ctx.minN && ctx.nBase < ctx.minN) av.push('linha de base com amostra ' + ctx.nBase + ' < ' + ctx.minN);
  if (!hp.grupo && !hp.pessoa) av.push('sem grupo de comparação (aplicar a parte da operação e manter o resto como referência)');
  for (const o of ctx.outras ?? []) if (o.id !== hp.id && o.ind === hp.ind && o.ini && hp.ini && (o.fim ?? o.ini) >= hp.ini && o.ini <= (hp.fim ?? hp.ini) && (o.pessoa ?? '') === (hp.pessoa ?? '')) av.push('intervenção sobreposta na mesma variável e período: ' + (o.titulo ?? o.id));
  for (const ev of ctx.eventos ?? []) if (hp.ini && ev.data >= hp.ini && ev.data <= (hp.fim ?? hp.ini)) av.push('evento de contexto dentro do período: ' + ev.desc);
  return { ok: !av.length, avisos: av };
}
export { amostra };
