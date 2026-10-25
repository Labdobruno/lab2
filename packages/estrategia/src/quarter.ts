/* Planejamento do quarter: motor puro portado do LAB V1 (lab_quarter.js; testes/lab_quarter.test.js é o contrato), com as chaves de indicador da V2.
   Um quarter = três ciclos seguidos. Seis fases: revisão do anterior, diagnóstico e prioridades, objetivo e metas, iniciativas, os três meses, publicação e acompanhamento.
   Nada aqui lê banco nem DOM: tudo entra por parâmetro e sai como objeto. "Sem dado" nunca vira zero. */
import { wilson } from '@lab/metricas';

export const num = (v: unknown): number | null => (v == null || v === '' || !isFinite(Number(v)) ? null : Number(v));
export const brl = (v: number | null | undefined) => (v == null || !isFinite(v) ? '—' : 'R$ ' + Math.round(v).toLocaleString('pt-BR'));
export const pct = (v: number | null | undefined) => (v == null || !isFinite(v) ? '—' : (Math.round(v * 1000) / 10).toLocaleString('pt-BR') + '%');
/* objetos indexados por id viram listas com o id dentro (o documento do quarter guarda mapas) */
export const lista = <T extends object>(o: Record<string, T | null | undefined> | null | undefined): Array<T & { id: string }> =>
  Object.keys(o ?? {}).map(k => (o![k] && typeof o![k] === 'object' ? { id: k, ...(o![k] as T) } : null)).filter((x): x is T & { id: string } => !!x);

export const FASES_QUARTER = [
  ['visao', 'Visão do quarter'], ['revisao', '1 · Revisão do quarter anterior'], ['diagnostico', '2 · Diagnóstico e prioridades'], ['objetivo', '3 · Objetivo e metas'],
  ['iniciativas', '4 · Iniciativas'], ['meses', '5 · Os três meses'], ['publicar', '6 · Publicação e acompanhamento'],
] as const;
export type FaseQuarter = (typeof FASES_QUARTER)[number][0];

/* taxas da cadeia (chaves da V2) */
export const TX = {
  leadAg: 'leads>agendamento', agReal: 'agendamento>reuniao_realizada', realOport: 'reuniao_realizada>oportunidades', oportVenda: 'oportunidades>vendas', leadVenda: 'leads>vendas', contatoAg: 'contato>agendamento',
} as const;
/* indicadores revistos no quarter anterior e os que têm meta somável entre meses */
export const IND_REVISAO = ['receita', 'vendas', 'ticket', 'leads', 'agendamento', 'reuniao_realizada', 'oportunidades', 'proposta_enviada', TX.leadAg, TX.realOport, TX.oportVenda, TX.leadVenda, TX.agReal, 'margem', 't_contato'];
export const ehTaxa = (ind: string) => ind === 'ticket' || ind === 'margem' || ind === 't_contato' || ind.includes('>');
const MENOR_MELHOR = new Set(['t_contato']);
export const menorMelhor = (ind: string) => MENOR_MELHOR.has(ind);

export const NATUREZA = { fato: 'Fato observado', desvio: 'Desvio medido', hipotese: 'Hipótese', oportunidade: 'Oportunidade potencial', recomendacao: 'Recomendação', decisao: 'Decisão aprovada', esperado: 'Resultado esperado', observado: 'Resultado observado' } as const;
export const ESTADO_DIAG = { comprovado: 'Problema comprovado nos dados (a causa continua hipótese)', hipotese: 'Hipótese (sinal nos dados, sem base para afirmar)', sem_dado: 'Não dá para avaliar com os dados disponíveis', ok: 'Sem problema nos dados' } as const;
export type EstadoDiag = keyof typeof ESTADO_DIAG;
/* critérios de prioridade: 1 baixo · 2 médio · 3 alto. Sinal +1 = quanto mais, melhor; −1 = quanto mais, pior */
export const CRITERIOS_PRIORIDADE: Array<[string, string, 1 | -1]> = [
  ['impacto', 'Impacto esperado', 1], ['evidencia', 'Evidência disponível', 1], ['urgencia', 'Urgência', 1], ['controle', 'Controle sobre a variável', 1],
  ['esforco', 'Esforço necessário', -1], ['custo', 'Custo', -1], ['risco', 'Risco', -1], ['tempo', 'Tempo até o resultado', -1], ['dependencias', 'Dependências operacionais', -1],
];
export const NIVEL: Record<number, string> = { 1: 'baixo', 2: 'médio', 3: 'alto' };
export const PRIORIDADE_ST = { sugerida: 'Sugerida pelo LAB', aceita: 'Aceita', modificada: 'Aceita com escopo modificado', rejeitada: 'Rejeitada', propria: 'Prioridade do gestor' } as const;
export type StPrioridade = keyof typeof PRIORIDADE_ST;
export const FECHAMENTO_MES = { concluido: 'Concluído', parcial: 'Concluído parcialmente', pendente: 'Pendente e válido', replanejado: 'Replanejado', bloqueado: 'Bloqueado', cancelado: 'Cancelado' } as const;
export type ClasseFechMes = keyof typeof FECHAMENTO_MES;
export const MARCO_ST = { previsto: 'Previsto', andamento: 'Em andamento', concluido: 'Concluído', atrasado: 'Atrasado', cancelado: 'Cancelado' } as const;
export type StMarco = keyof typeof MARCO_ST;
export const CONFIANCA = { baixa: 'Baixa', media: 'Média', alta: 'Alta' } as const;
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const aceita = (st: string | undefined) => st === 'aceita' || st === 'modificada' || st === 'propria';

/* ---------- calendário por chave 'AAAA-MM': quarter-calendário (mesIni = 1) ou ano fiscal começando em qualquer mês ---------- */
const chaveDe = (y: number, m0: number) => { const t = y * 12 + m0; return Math.floor(t / 12) + '-' + String(((t % 12) + 12) % 12 + 1).padStart(2, '0'); };
export interface Trimestre { key: string; ciclos: string[]; q: number; ano: number; mesIni: number; nome: string; curto: string }
export function trimestre(key: string, mesIni = 1): Trimestre | null {
  const p = String(key ?? '').split('-').map(Number); const ano = p[0], mes = p[1];
  if (p.length < 2 || ano == null || mes == null || !(mes >= 1 && mes <= 12)) return null;
  const ini = Math.min(12, Math.max(1, Number(mesIni) || 1)) - 1, off = (mes - 1 - ini + 12) % 12, q = Math.floor(off / 3) + 1, primeiro = ano * 12 + mes - 1 - (off % 3);
  const ciclos = [0, 1, 2].map(i => chaveDe(0, primeiro + i)), anoIni = Math.floor((primeiro - (q - 1) * 3) / 12);
  const nome = ini === 0 ? `${q}º quarter de ${anoIni}` : `${q}º quarter do ano fiscal ${anoIni}/${String(anoIni + 1).slice(2)} (começa em ${MESES[ini]})`;
  return { key: ciclos[0]!, ciclos, q, ano: anoIni, mesIni: ini + 1, nome, curto: 'Q' + q + ' ' + (ini === 0 ? anoIni : anoIni + '/' + String(anoIni + 1).slice(2)) };
}
export function deslocarQuarter(key: string, n: number, mesIni = 1): Trimestre | null {
  const T = trimestre(key, mesIni); if (!T) return null;
  const p = T.key.split('-').map(Number); return trimestre(chaveDe(p[0]!, p[1]! - 1 + 3 * n), mesIni);
}

/* ---------- planejado × realizado ---------- */
export interface Desvio { estado: 'sem_dado' | 'sem_meta' | 'ok'; abs: number | null; pct: number | null; atingido: boolean | null }
export function desvio(meta: unknown, real: unknown, menor = false): Desvio {
  const m = num(meta), r = num(real);
  if (r == null) return { estado: 'sem_dado', abs: null, pct: null, atingido: null };
  if (m == null) return { estado: 'sem_meta', abs: null, pct: null, atingido: null };
  const abs = r - m; return { estado: 'ok', abs, pct: m > 0 ? abs / m : null, atingido: menor ? r <= m : r >= m };
}
export interface Medida { v?: number | null; n?: number | null; k?: number | null; estado: string; nota?: string }
export interface Tendencia { dir: 'sem_dado' | 'amostra' | 'estavel' | 'melhorou' | 'piorou'; delta: number | null; rel?: number | null; nota?: string }
/* tendência em relação ao quarter anterior. Taxa: ±2 p.p. é estável e as duas amostras precisam do mínimo; volume: ±5% é estável */
export function tendencia(atual: Medida | null | undefined, anterior: Medida | null | undefined, ind: string, minN = 5): Tendencia {
  const a = atual ?? { estado: 'ausente' }, b = anterior ?? { estado: 'ausente' }, va = a.estado === 'ok' ? num(a.v) : null, vb = b.estado === 'ok' ? num(b.v) : null, taxa = ehTaxa(ind), mn = Number(minN) || 5;
  if (va == null || vb == null) return { dir: 'sem_dado', delta: null };
  const delta = va - vb, rel = vb !== 0 ? delta / Math.abs(vb) : null, menor = menorMelhor(ind);
  if (taxa && ((a.n != null && a.n < mn) || (b.n != null && b.n < mn))) return { dir: 'amostra', delta, rel, nota: `amostra abaixo do mínimo (n=${mn}): a variação não é conclusiva` };
  const estavel = ind === 'margem' || ind.includes('>') ? Math.abs(delta) < 0.02 : rel == null ? delta === 0 : Math.abs(rel) < 0.05;
  if (estavel) return { dir: 'estavel', delta, rel };
  return { dir: delta > 0 !== menor ? 'melhorou' : 'piorou', delta, rel };
}

/* ---------- revisão do quarter anterior ---------- */
export interface MetaDoMes { original?: number | null; final?: number | null; estado?: string; fonte?: string }
export interface CicloRevisao { key: string; nome?: string; encerrado?: boolean; meta?: Record<string, MetaDoMes>; metas?: Record<string, number | null>; real?: Record<string, Medida> }
export interface EntradaRevisao { ciclos?: CicloRevisao[]; total?: Record<string, Medida>; anterior?: Record<string, Medida> | null; minN?: number }
export interface LinhaRevisao {
  ind: string; meta: { original: number | null; final: number | null; revisada: boolean; nota: string }; real: Medida; v: number | null; desvio: Desvio; desvioOriginal: Desvio | null;
  evolucao: Array<number | null>; completude: { meses: number; de: number }; amostraBaixa: boolean; tendencia: Tendencia;
}
export function revisao(d: EntradaRevisao) {
  const cs = d.ciclos ?? [], T = d.total ?? {}, A = d.anterior ?? null, mn = Number(d.minN) || 5, lacunas: Array<{ ind: string; texto: string }> = [];
  const linhas: LinhaRevisao[] = IND_REVISAO.map(ind => {
    const real: Medida = T[ind] ?? { estado: 'ausente' }, evol = cs.map(c => { const r = c.real?.[ind]; return r && r.estado === 'ok' ? num(r.v) : null; });
    let meta = { original: null as number | null, final: null as number | null, revisada: false, nota: '' };
    if (ind === 'receita' || ind === 'vendas') {
      const ms = cs.map(c => c.meta?.[ind] ?? {}), conh = ms.filter(m => num(m.final) != null);
      if (conh.length === cs.length && cs.length) {
        const fin = conh.reduce((s, m) => s + Number(m.final), 0), orig = ms.every(m => num(m.original) != null) ? ms.reduce((s, m) => s + Number(m.original), 0) : null;
        meta = { original: orig, final: fin, revisada: orig != null && Math.abs(orig - fin) > 0.5, nota: orig == null ? 'meta original não registrada em algum mês: vale a final' : '' };
      } else meta.nota = conh.length ? `meta conhecida em ${conh.length} de ${cs.length} meses: sem meta do quarter` : 'nenhum mês com meta conhecida';
    } else if (!ehTaxa(ind)) {
      const ms = cs.map(c => num(c.metas?.[ind])); if (ms.length && ms.every(x => x != null)) meta = { original: null, final: ms.reduce((s, x) => s + x!, 0), revisada: false, nota: 'soma das metas da empresa nos planos dos três meses' };
    } else { const ms = cs.map(c => num(c.metas?.[ind])).filter(x => x != null); meta.nota = ms.length ? 'meta de taxa não se soma entre meses: veja mês a mês' : ''; }
    const v = real.estado === 'ok' ? num(real.v) : null, des = desvio(meta.final, v, menorMelhor(ind)), desO = meta.revisada ? desvio(meta.original, v, menorMelhor(ind)) : null;
    const comp = evol.filter(x => x != null).length, amostraBaixa = ehTaxa(ind) && real.n != null && real.n < mn;
    if (real.estado === 'semacesso') lacunas.push({ ind, texto: 'sem acesso: o indicador não entra na revisão (pede a permissão da fonte)' });
    else if (real.estado !== 'ok') lacunas.push({ ind, texto: (real.nota ?? 'sem dado no período') + ': a revisão não diz nada sobre este indicador' });
    else if (amostraBaixa) lacunas.push({ ind, texto: `amostra pequena (n=${real.n}): a taxa existe, mas não sustenta conclusão` });
    return { ind, meta, real, v, desvio: des, desvioOriginal: desO, evolucao: evol, completude: { meses: comp, de: cs.length }, amostraBaixa: !!amostraBaixa, tendencia: tendencia(real, A ? A[ind] : null, ind, mn) };
  });
  const rec = linhas.find(l => l.ind === 'receita')!;
  return {
    linhas, lacunas, melhoraram: linhas.filter(l => l.tendencia.dir === 'melhorou').map(l => l.ind), pioraram: linhas.filter(l => l.tendencia.dir === 'piorou').map(l => l.ind),
    resumo: { metaOriginal: rec.meta.original, metaFinal: rec.meta.final, resultado: rec.v, diferenca: rec.desvio.abs, pct: rec.desvio.pct, revisada: rec.meta.revisada, temAnterior: !!A },
  };
}

/* ---------- iniciativas do quarter anterior: separa má execução de estratégia executada sem resultado ---------- */
export interface Marco { id?: string; txt?: string; prazo?: string | null; st?: StMarco | string; resp?: string; mes?: number }
export interface Iniciativa {
  id?: string; nome?: string; prio?: string; resp?: string; problema?: string; hipotese?: string; variavel?: string; ind?: string; inicial?: number | null; alvo?: number | null; minimo?: number | null;
  continuar?: string; corrigir?: string; interromper?: string; marcos?: Record<string, Marco>; st?: string; menorMelhor?: boolean; horas?: number | null; orcamento?: number | null; meses?: number[];
  prioOrdem?: number | null; deps?: string[]; implantacaoDias?: number | null; etapa?: string; ampliar?: string;
}
export type ChaveAvaliacao = 'sem_dado' | 'mal_executada' | 'sem_resultado' | 'resultado_sem_execucao' | 'resultado_sem_marcos' | 'funcionou';
export interface AvaliacaoIniciativa { k: ChaveAvaliacao; texto: string; execucao: number | null; marcos: { feitos: number; total: number }; resultado: boolean | null; v: number | null; alvo: number | null; minimo: number | null }
export function avaliarIniciativa(ini: Iniciativa | null | undefined, obs: Medida | null | undefined, minN = 5): AvaliacaoIniciativa {
  const i = ini ?? {}, M = lista(i.marcos).filter(m => m.st !== 'cancelado'), feitos = M.filter(m => m.st === 'concluido').length, exec = M.length ? feitos / M.length : null;
  const o = obs ?? { estado: 'ausente' }, v = o.estado === 'ok' ? num(o.v) : null, alvo = num(i.alvo), minimo = num(i.minimo) != null ? num(i.minimo) : alvo, menor = !!(i.menorMelhor || menorMelhor(i.ind ?? ''));
  const amostra = ehTaxa(i.ind ?? '') && o.n != null && o.n < (Number(minN) || 5);
  const res = v == null || minimo == null ? null : menor ? v <= minimo : v >= minimo, executada = exec == null ? null : exec >= 0.8;
  let k: ChaveAvaliacao, texto: string;
  if (res == null || amostra) { k = 'sem_dado'; texto = v == null ? 'Sem medida do indicador da iniciativa no período: não dá para dizer se funcionou.' : `Amostra pequena (n=${o.n}): o resultado não é conclusivo.`; }
  else if (executada === false && !res) { k = 'mal_executada'; texto = `Execução incompleta (${feitos} de ${M.length} marcos) e resultado abaixo do mínimo: a hipótese não foi testada de verdade. Não é motivo para abandonar a estratégia.`; }
  else if (executada && !res) { k = 'sem_resultado'; texto = 'Executada conforme o plano, resultado abaixo do mínimo: a evidência a favor da hipótese enfraqueceu.'; }
  else if (executada === false && res) { k = 'resultado_sem_execucao'; texto = 'O indicador atingiu o mínimo, mas a iniciativa não foi executada por inteiro: a melhora não pode ser atribuída a ela.'; }
  else if (res && executada == null) { k = 'resultado_sem_marcos'; texto = 'O indicador atingiu o mínimo; sem marcos registrados, não dá para dizer quanto da melhora veio da iniciativa.'; }
  else if (!res) { k = 'sem_resultado'; texto = 'Resultado abaixo do mínimo; sem marcos registrados, não dá para separar execução de hipótese.'; }
  else { k = 'funcionou'; texto = 'Executada e com o indicador no mínimo esperado: resultado compatível com a hipótese (associação, não prova de causa).'; }
  return { k, texto, execucao: exec, marcos: { feitos, total: M.length }, resultado: res, v, alvo, minimo };
}
/* perguntas da retrospectiva: só onde há lacuna de interpretação; id estável para guardar a resposta */
export interface AvalRef { id: string; nome: string; ind?: string; aval: { k: ChaveAvaliacao } }
export function perguntas(rev: { linhas?: Array<{ ind: string; tendencia: { dir: string } }> } | null | undefined, avals: AvalRef[] | null | undefined, ctx?: { nome?: (k: string) => string; deficitCapacidade?: boolean; ofertaMudou?: boolean }) {
  const out: Array<{ id: string; ref: string; q: string }> = [], nome = ctx?.nome ?? ((k: string) => k), L = rev?.linhas ?? [], A = avals ?? [];
  for (const a of A) {
    if (a.aval.k === 'mal_executada') out.push({ id: 'exec:' + a.id, ref: a.nome, q: `A iniciativa "${a.nome}" foi executada conforme o planejado? O que impediu?` });
    if (a.aval.k === 'sem_resultado') out.push({ id: 'hip:' + a.id, ref: a.nome, q: `A hipótese de "${a.nome}" merece ser mantida, modificada ou abandonada?` });
    if (a.aval.k === 'resultado_sem_execucao' || a.aval.k === 'resultado_sem_marcos') out.push({ id: 'rep:' + a.id, ref: a.nome, q: `O resultado de "${a.nome}" é repetível? O que mais mudou no período?` });
  }
  const comIni = new Set(A.map(a => a.ind).filter(Boolean));
  L.filter(l => l.tendencia.dir === 'piorou' && !comIni.has(l.ind)).slice(0, 3).forEach(l => out.push({ id: 'ext:' + l.ind, ref: nome(l.ind), q: `"${nome(l.ind)}" piorou sem iniciativa ligada a ele. Houve algum fator externo (sazonalidade, mercado, mudança de público ou de oferta)?` }));
  L.filter(l => l.tendencia.dir === 'melhorou' && !comIni.has(l.ind)).slice(0, 2).forEach(l => out.push({ id: 'pos:' + l.ind, ref: nome(l.ind), q: `"${nome(l.ind)}" melhorou. O resultado positivo é repetível? O que causou a melhora?` }));
  if (ctx?.deficitCapacidade) out.push({ id: 'cap', ref: 'capacidade', q: 'A equipe tinha capacidade suficiente para o volume que o plano pedia?' });
  if (ctx?.ofertaMudou) out.push({ id: 'oferta', ref: 'oferta', q: 'O público ou a oferta mudou durante o período?' });
  return out;
}

/* ---------- diagnóstico: restrição, estado da evidência e impacto com as premissas. Escopo: só o que move a RECEITA ---------- */
export interface Impacto { valor: number; tipo: 'receita_potencial' | 'margem_afetada' | 'atraso_financeiro' | 'receita_em_risco'; texto: string; premissas: string[] }
export interface ItemDiagnostico { k: string; dim: string; estado: EstadoDiag; evidencia: string; impacto: Impacto | null; etapa?: string }
export interface EntradaDiagnostico {
  minN?: number; ticket?: number | null;
  leads?: { real?: number | null; necessario?: number | null; leadVenda?: number | null };
  conv?: Array<{ k: string; nome: string; atual?: { v?: number | null; n?: number; k?: number }; ref?: { v?: number | null; n?: number; k?: number }; entradas?: number | null; jusante?: number | null }>;
  ticketQ?: { atual?: number | null; ref?: number | null; n?: number; nRef?: number; vendas?: number | null };
  margem?: { atual?: number | null; ref?: number | null; n?: number; receita?: number | null; semAcesso?: boolean };
  ciclo?: { atual?: number | null; ref?: number | null; n?: number; receitaMes?: number | null };
  capacidade?: { deficit?: number | null; etapa?: string; receitaPerdida?: number | null } | null;
  canais?: Array<{ canal: string; receita: number; vendas?: number }>; perdas?: Record<string, number>; faltam?: Array<{ falta: string; efeito: string }>;
}
const wil = (k: number, n: number): [number, number] | null => { const w = wilson(k, n); return w ? [w.baixo, w.alto] : null; };
export function diagnostico(c: EntradaDiagnostico): ItemDiagnostico[] {
  const mn = Number(c.minN) || 5, tk = num(c.ticket), out: ItemDiagnostico[] = [];
  const add = (k: string, dim: string, estado: EstadoDiag, evidencia: string, impacto?: Impacto | null, extra?: Partial<ItemDiagnostico>) => out.push({ k, dim, estado, evidencia, impacto: impacto ?? null, ...(extra ?? {}) });
  /* demanda */
  const L = c.leads ?? {}, lr = num(L.real), ln = num(L.necessario), lv = num(L.leadVenda);
  if (lr == null || ln == null) add('demanda', 'Volume insuficiente de demanda', 'sem_dado', `Sem ${lr == null ? 'leads medidos' : 'volume necessário (meta ou taxas do plano)'} para comparar.`);
  else if (lr < ln * 0.95) { const falta = ln - lr; add('demanda', 'Volume insuficiente de demanda', 'comprovado', `Entraram ${Math.round(lr)} leads; a meta pedia ${Math.round(ln)} (faltaram ${Math.round(falta)}).`,
    lv != null && tk ? { valor: falta * lv * tk, tipo: 'receita_potencial', texto: 'receita potencial dos leads que faltaram', premissas: [`leads que faltaram: ${Math.round(falta)}`, `lead → venda: ${pct(lv)}`, `ticket: ${brl(tk)}`, 'potencial, não receita perdida: depende de os leads extras converterem como os atuais'] } : null); }
  else add('demanda', 'Volume insuficiente de demanda', 'ok', `Entraram ${Math.round(lr)} leads para ${Math.round(ln)} necessários.`);
  /* conversão por etapa: comprovado só com amostra mínima nos dois períodos e intervalos de 95% sem sobreposição */
  for (const e of c.conv ?? []) {
    const a = e.atual ?? {}, r = e.ref ?? {}, va = num(a.v), vr = num(r.v), dim = 'Conversão ' + e.nome;
    if (va == null || vr == null) { add('conv:' + e.k, dim, 'sem_dado', `Sem ${va == null ? 'taxa no período' : 'referência'} para comparar.`); continue; }
    const queda = vr - va;
    if (!(queda >= Math.max(0.02, vr * 0.1))) { add('conv:' + e.k, dim, 'ok', `${pct(va)} no período contra ${pct(vr)} de referência.`); continue; }
    const an = a.n ?? 0, rn = r.n ?? 0, amostra = an >= mn && rn >= mn, wa = wil(a.k ?? va * an, an), wr = wil(r.k ?? vr * rn, rn), separados = !!(wa && wr && wa[1] < wr[0]);
    const est: EstadoDiag = amostra && separados ? 'comprovado' : 'hipotese', ent = num(e.entradas), ju = num(e.jusante);
    add('conv:' + e.k, dim, est, `${pct(va)} (n=${an}) contra ${pct(vr)} de referência (n=${rn}).` + (est === 'hipotese' ? (amostra ? ' Os intervalos de 95% se sobrepõem: pode ser variação normal.' : ` Amostra abaixo de n=${mn}.`) : ''),
      ent != null && ju != null && tk ? { valor: ent * queda * ju * tk, tipo: 'receita_potencial', texto: 'receita potencial se a etapa voltasse à referência', premissas: [`entradas na etapa: ${Math.round(ent)}`, `queda: ${pct(queda)} (pontos)`, `conversão até a venda depois da etapa: ${pct(ju)}`, `ticket: ${brl(tk)}`] } : null, { etapa: e.k });
  }
  /* ticket */
  const T = c.ticketQ ?? {}, ta = num(T.atual), tr = num(T.ref);
  if (ta == null || tr == null) add('ticket', 'Ticket médio abaixo do potencial', 'sem_dado', `Sem ticket ${ta == null ? 'no período' : 'de referência'}.`);
  else if (ta < tr * 0.9) { const ok = (T.n ?? 0) >= mn && (T.nRef ?? 0) >= mn; add('ticket', 'Ticket médio abaixo do potencial', ok ? 'comprovado' : 'hipotese', `Ticket de ${brl(ta)} (n=${T.n ?? 0}) contra ${brl(tr)} de referência (n=${T.nRef ?? 0}).` + (ok ? '' : ' Amostra pequena.'),
    num(T.vendas) ? { valor: Number(T.vendas) * (tr - ta), tipo: 'receita_potencial', texto: 'receita potencial com o ticket de referência', premissas: [`vendas: ${T.vendas}`, `diferença de ticket: ${brl(tr - ta)}`, 'supõe o mesmo volume de vendas com o ticket maior'] } : null); }
  else add('ticket', 'Ticket médio abaixo do potencial', 'ok', `Ticket de ${brl(ta)} contra ${brl(tr)} de referência.`);
  /* margem */
  const Mg = c.margem ?? {}, ma = num(Mg.atual), mr = num(Mg.ref);
  if (Mg.semAcesso) add('margem', 'Margem inadequada', 'sem_dado', 'Sem acesso ao Financeiro: a margem não entra no diagnóstico.');
  else if (ma == null || mr == null) add('margem', 'Margem inadequada', 'sem_dado', `Sem margem ${ma == null ? 'nas vendas do período (custos não lançados)' : 'de referência'}.`);
  else if (ma < mr - 0.02) { const ok = (Mg.n ?? 0) >= mn; add('margem', 'Margem inadequada', ok ? 'comprovado' : 'hipotese', `Margem de contribuição de ${pct(ma)} (n=${Mg.n ?? 0}) contra ${pct(mr)} de referência.`,
    num(Mg.receita) ? { valor: Number(Mg.receita) * (mr - ma), tipo: 'margem_afetada', texto: 'margem de contribuição que ficou abaixo da referência', premissas: [`receita do período: ${brl(Mg.receita)}`, `diferença: ${pct(mr - ma)} (pontos)`] } : null); }
  else add('margem', 'Margem inadequada', 'ok', `Margem de ${pct(ma)} contra ${pct(mr)} de referência.`);
  /* ciclo comercial */
  const Ci = c.ciclo ?? {}, ca = num(Ci.atual), cr = num(Ci.ref);
  if (ca == null || cr == null) add('ciclo', 'Ciclo comercial prolongado', 'sem_dado', 'Sem vendas suficientes para medir o ciclo.');
  else if (ca > cr * 1.2 && ca - cr >= 5) { const ok = (Ci.n ?? 0) >= mn; add('ciclo', 'Ciclo comercial prolongado', ok ? 'comprovado' : 'hipotese', `Mediana de ${Math.round(ca)} dias da entrada à venda (n=${Ci.n ?? 0}) contra ${Math.round(cr)} de referência.`,
    num(Ci.receitaMes) ? { valor: Number(Ci.receitaMes) * Math.min(1, (ca - cr) / 30), tipo: 'atraso_financeiro', texto: 'receita de um mês que passa a entrar mais tarde', premissas: [`atraso: ${Math.round(ca - cr)} dias`, `receita média por mês: ${brl(Ci.receitaMes)}`, 'não é receita perdida: é receita deslocada no tempo'] } : null); }
  else add('ciclo', 'Ciclo comercial prolongado', 'ok', `Mediana de ${Math.round(ca)} dias contra ${Math.round(cr)} de referência.`);
  /* capacidade comercial (declarada no plano) */
  const Cp = c.capacidade;
  if (!Cp) add('capacidade', 'Capacidade comercial insuficiente', 'sem_dado', 'Capacidade das pessoas não informada nos planos dos meses.');
  else if ((num(Cp.deficit) ?? 0) > 0) add('capacidade', 'Capacidade comercial insuficiente', 'comprovado', `O volume necessário de ${Cp.etapa ?? 'reuniões'} passa a capacidade declarada em ${Math.round(Number(Cp.deficit))}.`,
    num(Cp.receitaPerdida) ? { valor: Number(Cp.receitaPerdida), tipo: 'receita_potencial', texto: 'receita que a capacidade não alcança', premissas: [`déficit: ${Math.round(Number(Cp.deficit))} ${Cp.etapa ?? ''}`, 'taxas e ticket do plano'] } : null);
  else add('capacidade', 'Capacidade comercial insuficiente', 'ok', 'O volume necessário cabe na capacidade declarada.');
  /* perdas por preço, prazo ou condição: o motivo é declarado por quem perdeu, então é sempre hipótese */
  const P = c.perdas ?? {}, totP = Object.values(P).reduce((s, x) => s + (Number(x) || 0), 0), cond = ['Preço', 'Inviabilidade econômica', 'Financiamento negado'].reduce((s, k) => s + (Number(P[k]) || 0), 0);
  if (totP < mn) add('perdas', 'Perdas por preço, prazo ou condições', 'sem_dado', `Poucas perdas com motivo registrado (${totP}).`);
  else if (cond / totP >= 0.3) add('perdas', 'Perdas por preço, prazo ou condições', 'hipotese', `${cond} de ${totP} perdas (${pct(cond / totP)}) registradas como preço, inviabilidade econômica ou financiamento. O motivo é declarado por quem perdeu.`);
  else add('perdas', 'Perdas por preço, prazo ou condições', 'ok', `${cond} de ${totP} perdas por preço ou condição.`);
  /* dependência de um canal (receita) */
  const Cn = (c.canais ?? []).filter(x => (num(x.receita) ?? 0) > 0), totR = Cn.reduce((s, x) => s + x.receita, 0), top = [...Cn].sort((a, b) => b.receita - a.receita)[0], totV = Cn.reduce((s, x) => s + (Number(x.vendas) || 0), 0);
  if (!top || totV < mn) add('canal', 'Dependência de poucos canais', 'sem_dado', 'Poucas vendas para medir a concentração por origem.');
  else if (top.receita / totR >= 0.6) add('canal', 'Dependência de poucos canais', 'comprovado', `${top.canal} trouxe ${pct(top.receita / totR)} da receita (${brl(top.receita)} de ${brl(totR)}).`, { valor: top.receita, tipo: 'receita_em_risco', texto: 'receita que depende de uma só origem', premissas: ['risco, não perda: é o que estaria exposto se a origem falhasse'] });
  else add('canal', 'Dependência de poucos canais', 'ok', `A maior origem (${top.canal}) trouxe ${pct(top.receita / totR)} da receita.`);
  (c.faltam ?? []).forEach((f, i) => add('dados:' + i, 'Confiabilidade dos dados: ' + f.falta, 'sem_dado', f.efeito));
  const ordem: Record<EstadoDiag, number> = { comprovado: 0, hipotese: 1, sem_dado: 2, ok: 3 };
  return out.sort((a, b) => ordem[a.estado] - ordem[b.estado] || (b.impacto?.valor ?? 0) - (a.impacto?.valor ?? 0));
}

/* ---------- priorização explicável: a soma é dos critérios mostrados, e a frase diz o que pesou ---------- */
export interface Pontuacao { pontos: number; avaliados: number; favor: string[]; contra: string[]; falta: string[]; porque: string }
export function pontuar(crit: Record<string, unknown> | null | undefined): Pontuacao {
  const c = crit ?? {}; let s = 0, n = 0; const favor: string[] = [], contra: string[] = [], falta: string[] = [];
  for (const [k, nome, sg] of CRITERIOS_PRIORIDADE) {
    const v = num(c[k]); if (v == null || v < 1 || v > 3) { falta.push(nome); continue; }
    n++; const p = sg * (v - 2); s += p; if (p > 0) favor.push(nome.toLowerCase() + ' ' + NIVEL[v]); if (p < 0) contra.push(nome.toLowerCase() + ' ' + NIVEL[v]);
  }
  return { pontos: s, avaliados: n, favor, contra, falta, porque: (favor.length ? 'a favor: ' + favor.join(', ') : 'nada a favor') + (contra.length ? '; contra: ' + contra.join(', ') : '') + (falta.length ? '; sem avaliação: ' + falta.join(', ') : '') };
}
export interface Prioridade { id: string; titulo?: string; st?: StPrioridade | string; crit?: Record<string, unknown>; ordem?: number | null; impacto?: { valor?: number | null } | null; diag?: string; justificativa?: string; escopo?: string }
export function priorizar<T extends Prioridade>(itens: T[] | null | undefined): Array<T & { pt: Pontuacao }> {
  const L = (itens ?? []).map(x => ({ ...x, pt: pontuar(x.crit) }));
  L.sort((a, b) => {
    const oa = num(a.ordem), ob = num(b.ordem);
    if (oa != null && ob != null && oa !== ob) return oa - ob; if (oa != null && ob == null) return -1; if (ob != null && oa == null) return 1;
    return b.pt.pontos - a.pt.pontos || (b.impacto?.valor ?? 0) - (a.impacto?.valor ?? 0);
  });
  return L;
}
export function foco(prios: Array<{ st?: string }> | null | undefined) {
  const n = (prios ?? []).filter(p => aceita(p.st)).length;
  return n === 0 ? { n, aviso: 'Nenhuma prioridade aceita ainda.' }
    : n > 5 ? { n, aviso: `${n} prioridades aceitas: acima de 5 o quarter tende a virar uma lista de melhorias sem hierarquia. Registre a justificativa ou corte.` }
    : n < 3 ? { n, aviso: `${n} prioridade${n > 1 ? 's' : ''} aceita${n > 1 ? 's' : ''}: tudo bem se o diagnóstico concentra o problema; o padrão é de 3 a 5.` } : { n, aviso: '' };
}

/* ---------- meta ambiciosa × meta viável: mostra o que a meta exige, não reduz a meta ---------- */
export type Cenarios = { continuidade?: number | null; conservador?: number | null; base?: number | null; otimista?: number | null };
export function metaVsCenarios(meta: unknown, cen: Cenarios | null | undefined, parte?: { fixo?: number | null; novo?: number | null } | null, depend?: Array<string | null | undefined>) {
  const m = num(meta), C = cen ?? {}; if (m == null) return { erro: 'sem meta definida' };
  const linhas = ([['continuidade', 'Continuidade do ritmo atual (receita do quarter anterior)'], ['conservador', 'Cenário conservador'], ['base', 'Cenário-base'], ['otimista', 'Cenário otimista']] as Array<[keyof Cenarios, string]>)
    .map(([k, nome]) => { const v = num(C[k]); return { k, nome, v, distancia: v == null ? null : m - v, alcanca: v == null ? null : v >= m - 0.5 }; });
  const base = num(C.base), fixo = num(parte?.fixo) ?? 0, novo = num(parte?.novo);
  let exige: { fator: number; texto: string } | null = null;
  if (base != null && base < m && novo != null && novo > 0) { const f = (m - fixo) / novo - 1; exige = { fator: f, texto: `Para chegar à meta pela parte que depende de negócios novos (${brl(novo)} no cenário-base), volume × conversão × ticket precisam render ${pct(f)} a mais. Ex.: +${pct(f)} de leads com a mesma conversão e ticket, ou +${pct(Math.sqrt(1 + f) - 1)} em dois deles.` }; }
  const deps = (depend ?? []).filter((x): x is string => !!x), alc = linhas.filter(l => l.alcanca);
  return {
    meta: m, linhas, exige, dependencias: deps,
    leitura: alc.some(l => l.k === 'continuidade' || l.k === 'conservador') ? 'A meta cabe até no cenário conservador ou na continuidade: pode ser pouco ambiciosa.'
      : alc.some(l => l.k === 'base') ? 'A meta cabe no cenário-base.' : alc.some(l => l.k === 'otimista') ? 'A meta só cabe no cenário otimista: depende das hipóteses dele se confirmarem.'
      : 'A meta fica acima de todos os cenários: ela depende de mudanças que nenhum cenário assume ainda.',
  };
}
/* repartição sugerida da meta pelos três meses: proporcional aos dias úteis de cada ciclo */
export function repartir(total: unknown, du: number[]): Array<number | null> {
  const t = num(total), d = du.map(x => Math.max(0, Number(x) || 0)), s = d.reduce((a, x) => a + x, 0);
  if (t == null) return d.map(() => null); if (!(s > 0)) return d.map(() => t / (d.length || 1)); return d.map(x => (t * x) / s);
}
/* pesos do programa que reproduzem as metas mensais escolhidas: peso_k = meta_k ÷ dias úteis_k */
export function pesosDoPrograma(metasMes: Array<unknown>, du: number[]): number[] {
  const out = metasMes.map((m, i) => { const v = num(m), d = Number(du[i]) || 0; return v != null && d > 0 ? v / d : null; });
  const mx = Math.max(...out.filter((x): x is number => x != null), 0); return out.map(x => (x == null || !(mx > 0) ? 1 : x / mx));
}

/* ---------- campos obrigatórios: resultado-chave e iniciativa ---------- */
export interface KR { id?: string; nome?: string; ind?: string; partida?: unknown; alvo?: unknown; resp?: string; criterio?: string; freq?: string; tipo?: 'resultado' | 'antecedente' | string }
const KR_REQ: Array<[keyof KR, string]> = [['ind', 'indicador'], ['partida', 'valor de partida'], ['alvo', 'meta final'], ['resp', 'responsável'], ['criterio', 'critério de sucesso'], ['freq', 'frequência de acompanhamento']];
const vazio = (v: unknown) => v == null || String(v).trim() === '';
export const lacunasKR = (kr: KR | null | undefined) => KR_REQ.filter(([k]) => vazio((kr ?? {})[k])).map(x => x[1]);
const VAGO = /^(melhorar|aumentar|otimizar|crescer|vender|alavancar|focar)\b.{0,25}$/i;
export function vago(nome: unknown) { const t = String(nome ?? '').trim(); return !t || (VAGO.test(t) && t.split(/\s+/).length <= 4); }
const INI_REQ: Array<[keyof Iniciativa, string]> = [['nome', 'nome'], ['prio', 'prioridade ligada'], ['resp', 'responsável principal'], ['problema', 'problema observado'], ['hipotese', 'hipótese'], ['variavel', 'variável alterada'], ['ind', 'indicador de sucesso'], ['inicial', 'valor inicial'], ['alvo', 'alvo esperado'], ['minimo', 'critério mínimo de sucesso'], ['continuar', 'critério para continuar'], ['corrigir', 'critério para corrigir'], ['interromper', 'critério para interromper']];
export function lacunasIniciativa(ini: Iniciativa | null | undefined) {
  const i = ini ?? {}, f = INI_REQ.filter(([k]) => vazio(i[k])).map(x => x[1]);
  if (i.nome && vago(i.nome)) f.unshift(`o nome descreve uma intenção ("${i.nome}"), não uma intervenção no mecanismo`);
  if (!lista(i.marcos).length) f.push('ao menos um entregável ou marco');
  return f;
}
/* os quatro níveis, acompanhados separadamente: entregável, execução, hipótese, resultado */
export function niveis(ini: Iniciativa | null | undefined, obs: Medida | null | undefined, hoje?: string, minN = 5) {
  const i = ini ?? {}, M = lista(i.marcos).filter(m => m.st !== 'cancelado'), feitos = M.filter(m => m.st === 'concluido').length, venc = M.filter(m => m.st !== 'concluido' && m.prazo && m.prazo < (hoje ?? '9999')).length;
  const o = obs ?? { estado: 'ausente' }, v = o.estado === 'ok' ? num(o.v) : null, mn = num(i.minimo), alvo = num(i.alvo), menor = menorMelhor(i.ind ?? '');
  const ok = (x: number | null) => (x == null || v == null ? null : menor ? v <= x : v >= x), pouco = !!(ehTaxa(i.ind ?? '') && o.n != null && o.n < (Number(minN) || 5));
  return {
    entregavel: { feitos, total: M.length, atrasados: venc, estado: !M.length ? 'sem_marcos' : feitos === M.length ? 'concluido' : venc ? 'atrasado' : 'andamento' },
    execucao: { estado: i.st === 'cancelada' ? 'cancelada' : !M.length ? 'sem_marcos' : feitos / M.length >= 0.8 ? 'executada' : 'em_execucao' },
    hipotese: { estado: v == null ? 'sem_dado' : pouco ? 'amostra' : ok(mn) === true ? 'validada' : 'nao_validada', v, n: o.n },
    resultado: { estado: v == null ? 'sem_dado' : pouco ? 'amostra' : ok(alvo) === true ? 'atingido' : 'nao_atingido', v, alvo },
  };
}

/* ---------- bottom-up de cada mês, com a origem de cada taxa e a defasagem ---------- */
export const NOME_TX: Record<string, string> = { [TX.oportVenda]: 'oportunidade → venda', [TX.realOport]: 'reunião realizada → oportunidade', [TX.agReal]: 'reunião agendada → realizada', [TX.leadAg]: 'lead → reunião agendada', [TX.contatoAg]: 'contato → reunião (registro diário)' };
export interface TaxaComFonte { v?: number | null; fonte?: string; n?: number }
export interface PassoBottomUp { k: string; nome: string; v: number | null; taxa: number | null; fonte: string | null; n?: number; como: string }
export function bottomUp(meta: unknown, tx: Record<string, TaxaComFonte> | null | undefined, ticket: TaxaComFonte | null | undefined, opts?: { cicloDias?: number | null; diasMes?: number | null; capacidade?: Record<string, number | null> }) {
  const m = num(meta), tk = ticket ? num(ticket.v) : null, T = tx ?? {};
  if (m == null) return { erro: 'sem meta de receita no mês' };
  if (!(tk != null && tk > 0)) return { erro: 'sem ticket (meta nem histórico) para converter receita em vendas' };
  const passos: PassoBottomUp[] = [{ k: 'vendas', nome: 'Vendas necessárias', v: m / tk, taxa: tk, fonte: ticket?.fonte ?? null, como: 'receita ÷ ticket' }], falta: string[] = [];
  const cadeia: Array<[string, string, string]> = [['oportunidades', 'Oportunidades qualificadas necessárias', TX.oportVenda], ['reuniao_realizada', 'Reuniões realizadas necessárias', TX.realOport], ['agendamento', 'Reuniões agendadas necessárias', TX.agReal], ['leads', 'Leads necessários', TX.leadAg], ['contato', 'Contatos (atividades) estimados', TX.contatoAg]];
  for (const [k, nome, t] of cadeia) {
    const ant = k === 'contato' ? passos.find(p => p.k === 'agendamento')! : passos[passos.length - 1]!, x = T[t] ?? {}, r = num(x.v);
    if (ant.v == null || !(r != null && r > 0)) { passos.push({ k, nome, v: null, taxa: null, fonte: x.fonte ?? null, como: 'falta a taxa ' + (NOME_TX[t] ?? t) }); if (!(r != null && r > 0)) falta.push(t); continue; }
    passos.push({ k, nome, v: ant.v / r, taxa: r, fonte: x.fonte ?? 'hist', ...(x.n != null ? { n: x.n } : {}), como: ant.nome.replace(' necessárias', '').replace(' necessários', '') + ' ÷ ' + pct(r) });
  }
  const cic = num(opts?.cicloDias), dias = num(opts?.diasMes) ?? 30;
  const defasagem = cic == null ? null : { dias: cic, fracaoAnterior: Math.min(1, cic / dias), texto: `Da entrada do lead à venda leva ${Math.round(cic)} dias (mediana). ` + (cic >= dias * 0.5 ? 'Boa parte das vendas de um mês vem de leads e reuniões do mês anterior: o volume de entrada precisa acontecer antes, e a reunião marcada no fim do mês tende a virar venda no mês seguinte.' : 'A maior parte das vendas sai de leads do próprio mês.') };
  const cap = opts?.capacidade ?? {}, sobrecarga: Array<{ k: string; necessario: number; capacidade: number; deficit: number }> = [];
  for (const k of ['reuniao_realizada', 'agendamento', 'contato']) { const p = passos.find(x => x.k === k), c = num(cap[k]); if (p && p.v != null && c != null && p.v > c) sobrecarga.push({ k, necessario: p.v, capacidade: c, deficit: p.v - c }); }
  return { passos, falta, defasagem, sobrecarga };
}

/* ---------- capacidade e carga das iniciativas ---------- */
export interface CapacidadeEquipe { pessoas?: Record<string, number | null>; operacao?: number | null; orcamento?: number | null }
export function capacidade(inis: Array<Iniciativa & { id: string }> | null | undefined, cap: CapacidadeEquipe | null | undefined) {
  const C = cap ?? {}, pes = C.pessoas ?? {}, op = Math.min(0.95, Math.max(0, num(C.operacao) ?? 0));
  type Mes = { m: number; carga: number; cap: number; porPessoa: Record<string, { carga: number; cap: number | null }>; sobra: number; excesso: Array<{ p: string; carga: number; cap: number | null; falta: number }> };
  const meses: Mes[] = [0, 1, 2].map(m => ({ m, carga: 0, cap: 0, porPessoa: {}, sobra: 0, excesso: [] }));
  for (const p of Object.keys(pes)) { const h = num(pes[p]); if (h == null) continue; for (const M of meses) { M.cap += h * (1 - op); M.porPessoa[p] = { carga: 0, cap: h * (1 - op) }; } }
  const ativas = (inis ?? []).filter(i => i.st !== 'cancelada');
  for (const i of ativas) {
    const h = num(i.horas) ?? 0, ms = Array.isArray(i.meses) && i.meses.length ? i.meses : [0, 1, 2];
    for (const m of ms) { const M = meses[m]; if (!M) continue; M.carga += h; const p = i.resp || 'sem responsável'; (M.porPessoa[p] = M.porPessoa[p] ?? { carga: 0, cap: null }).carga += h; }
  }
  for (const M of meses) {
    M.sobra = M.cap - M.carga;
    M.excesso = Object.keys(M.porPessoa).map(p => ({ p, ...M.porPessoa[p]! })).filter(x => (x.cap == null ? x.carga > 0 : x.carga > x.cap + 1e-9)).map(x => ({ ...x, falta: x.cap == null ? x.carga : x.carga - x.cap }));
  }
  const orc = ativas.reduce((s, i) => s + (num(i.orcamento) ?? 0), 0), orcDisp = num(C.orcamento);
  const sobrecarga = meses.some(M => M.excesso.length) || (orcDisp != null && orc > orcDisp), alternativas: Array<{ k: string; texto: string }> = [];
  if (sobrecarga) {
    const folga = meses.filter(M => !M.excesso.length && M.sobra > 0).map(M => M.m), menor = [...ativas].sort((a, b) => (num(b.prioOrdem) ?? 99) - (num(a.prioOrdem) ?? 99))[0];
    if (menor) alternativas.push({ k: 'priorizar', texto: `Priorizar: tirar ou reduzir "${menor.nome}" (a iniciativa de menor prioridade) libera ${num(menor.horas) ?? 0} h por mês.` });
    if (folga.length) alternativas.push({ k: 'redistribuir', texto: `Redistribuir: o mês ${folga.map(m => m + 1).join(' e ')} tem folga; mova marcos para lá.` });
    alternativas.push({ k: 'adiar', texto: 'Adiar: deixar uma iniciativa para o próximo quarter e registrar a decisão.' });
    alternativas.push({ k: 'reforcar', texto: 'Reforçar recursos: mais horas de alguém, contratação ou terceiro (entra como custo da iniciativa).' });
  }
  return { meses, orcamento: { total: orc, disponivel: orcDisp, excesso: orcDisp != null && orc > orcDisp ? orc - orcDisp : 0 }, sobrecarga, alternativas, semCapacidade: !Object.keys(pes).length };
}

/* ---------- sequenciamento: em que mês cada iniciativa começa, com o motivo ---------- */
export function sequencia(inis: Array<Iniciativa & { id: string }> | null | undefined, ctx?: { cicloDias?: number | null }) {
  const L = inis ?? [], by: Record<string, Iniciativa & { id: string }> = {}; for (const i of L) by[i.id] = i;
  const ini: Record<string, number> = {}, cic = num(ctx?.cicloDias) ?? 0;
  const calc = (id: string, pilha: Record<string, 1>): number | { erro: string } => {
    if (ini[id] != null) return ini[id]!; if (pilha[id]) return { erro: id }; pilha[id] = 1; const i = by[id]; if (!i) return 0;
    let m = 0;
    for (const d of i.deps ?? []) { if (!by[d]) continue; const r = calc(d, pilha); if (typeof r === 'object') return r; const fimDep = r + Math.ceil((num(by[d]!.implantacaoDias) ?? 0) / 30); m = Math.max(m, Math.min(2, fimDep)); }
    delete pilha[id]; ini[id] = m; return m;
  };
  const out: Array<{ id: string; nome: string; mesInicio: number; mesEfeito: number; foraDoQuarter: boolean; texto: string }> = [];
  for (const i of L) {
    const r = calc(i.id, {}); if (typeof r === 'object') return { erro: `dependência circular envolvendo "${by[r.erro]?.nome ?? r.erro}"` };
    const imp = num(i.implantacaoDias) ?? 0, efeito = r + (imp + cic) / 30, motivo: string[] = [];
    const deps = (i.deps ?? []).filter(d => by[d]); if (deps.length) motivo.push('depende de ' + deps.map(d => `"${by[d]!.nome}"`).join(', '));
    if (imp) motivo.push(`${imp} dias para implantar`); if (cic) motivo.push(`mais ${Math.round(cic)} dias até a venda`);
    out.push({ id: i.id, nome: i.nome ?? '', mesInicio: r, mesEfeito: efeito, foraDoQuarter: efeito > 3, texto: `Começar no mês ${r + 1}` + (motivo.length ? ` (${motivo.join('; ')})` : '') + '. ' + (efeito > 3 ? 'O efeito em vendas aparece só depois do quarter: meça um indicador antecedente dentro dele.' : `Efeito em vendas esperado a partir do mês ${Math.max(1, Math.ceil(efeito))}.`) });
  }
  return { itens: out };
}

/* ---------- gatilhos de decisão: não reage a amostra pequena ---------- */
export interface Gatilho { id?: string; ind: string; op?: 'acima' | 'abaixo'; limite?: unknown; acao?: string; amostraMin?: unknown; nome?: string }
export function gatilhos(gs: Gatilho[] | null | undefined, valores: Record<string, Medida> | null | undefined, minN = 5) {
  return (gs ?? []).map(g => {
    const r = valores?.[g.ind] ?? { estado: 'ausente' }, v = r.estado === 'ok' ? num(r.v) : null, lim = num(g.limite), am = num(g.amostraMin) ?? (Number(minN) || 5);
    if (lim == null) return { ...g, estado: 'incompleto' as const, v: null, texto: 'sem limite definido' };
    if (v == null) return { ...g, estado: 'sem_dado' as const, v: null, texto: r.nota ?? 'sem medida no período' };
    if (r.n != null && ehTaxa(g.ind) && r.n < am) return { ...g, estado: 'amostra' as const, v, texto: `amostra de ${r.n} abaixo de ${am}: o gatilho espera mais dados` };
    const disp = g.op === 'acima' ? v > lim : v < lim;
    return { ...g, estado: disp ? ('disparado' as const) : ('ok' as const), v, texto: disp ? 'disparado: revisar — ' + (g.acao ?? 'revisar o plano') : 'dentro do limite' };
  });
}

/* ---------- documento do quarter e aprovação: o que impede uma aprovação responsável ---------- */
export interface MesDoQuarter { meta?: unknown; resultado?: string; criterio?: string }
export interface Risco { id?: string; txt?: string; resposta?: string }
export interface Decisao { id?: string; tipo?: string; texto?: string }
export interface Versao { n: number; em: number | string; por: string; motivo: string; premissas?: unknown; revisao?: unknown; [campo: string]: unknown }
export interface DocQuarter {
  status?: 'rascunho' | 'publicado' | 'encerrado' | string; versao?: number; publicadoEm?: number | string | null; publicadoPor?: string;
  premissas?: unknown; programa?: unknown; respostas?: Record<string, unknown>; encerramento?: unknown;
  objetivo?: { texto?: string; ind?: string; alvo?: unknown }; krs?: Record<string, KR>; prioridades?: Record<string, Omit<Prioridade, 'id'>>; iniciativas?: Record<string, Iniciativa>;
  meses?: Record<string | number, MesDoQuarter>; cenarios?: unknown; riscos?: Record<string, Risco>; gatilhos?: Record<string, Gatilho>; capacidade?: unknown; decisoes?: Record<string, Decisao>;
  versoes?: Record<string, Versao>; fechMes?: Record<string | number, { em?: unknown }>;
}
const mes = (q: DocQuarter, m: number): MesDoQuarter => q.meses?.[m] ?? q.meses?.[String(m)] ?? {};
export function aprovacao(q: DocQuarter | null | undefined, ctx?: { capacidade?: { sobrecarga?: boolean } | null; conflitoPrograma?: string | null; metaVs?: { linhas?: Array<{ alcanca: boolean | null }> } | null }) {
  const Q = q ?? {}, C = ctx ?? {}, bloq: string[] = [], avisos: string[] = [], O = Q.objetivo ?? {};
  if (!O.texto) bloq.push('Objetivo do quarter não escrito (fase 3).');
  if (num(O.alvo) == null) bloq.push('Meta do quarter sem valor (fase 3).');
  const prios = lista(Q.prioridades), aceitas = prios.filter(p => aceita(p.st)), inis = lista(Q.iniciativas).filter(i => i.st !== 'cancelada');
  if (!aceitas.length) bloq.push('Nenhuma prioridade aceita (fase 2).');
  for (const p of aceitas) if (!inis.some(i => i.prio === p.id)) bloq.push(`A prioridade "${p.titulo}" não tem iniciativa (fase 4).`);
  for (const i of inis) { const f = lacunasIniciativa(i); if (f.length) bloq.push(`Iniciativa "${i.nome ?? 'sem nome'}": falta ${f.join(', ')}.`); }
  const krs = lista(Q.krs); if (!krs.length) bloq.push('Nenhum resultado-chave (fase 3).');
  for (const k of krs) { const f = lacunasKR(k); if (f.length) bloq.push(`Resultado-chave "${k.nome ?? k.ind ?? 'sem nome'}": falta ${f.join(', ')}.`); }
  if (!krs.some(k => k.tipo === 'antecedente')) avisos.push('Sem indicador antecedente: o resultado só será visto no fim de cada mês.');
  for (const m of [0, 1, 2]) { const x = mes(Q, m); if (!x.resultado || !x.criterio) bloq.push(`Mês ${m + 1}: falta ${[!x.resultado ? 'o resultado esperado' : '', !x.criterio ? 'o critério de sucesso' : ''].filter(Boolean).join(' e ')} (fase 5).`); }
  const mm = [0, 1, 2].map(m => num(mes(Q, m).meta));
  if (mm.every(x => x != null) && num(O.alvo) != null && (O.ind ?? 'receita') === 'receita' && Math.abs(mm.reduce((a, x) => a + x!, 0) - Number(O.alvo)) > 1) bloq.push(`As metas de receita dos três meses somam ${brl(mm.reduce((a, x) => a + x!, 0))}, diferente da meta do quarter (${brl(Number(O.alvo))}).`);
  if (C.capacidade?.sobrecarga && !lista(Q.decisoes).some(d => d.tipo === 'capacidade')) bloq.push('A carga das iniciativas passa a capacidade declarada e não há decisão registrada sobre isso (fase 5).');
  if (C.conflitoPrograma) bloq.push(C.conflitoPrograma);
  if (C.metaVs?.linhas && !C.metaVs.linhas.some(l => l.alcanca) && !lista(Q.riscos).length) avisos.push('A meta está acima de todos os cenários e nenhum risco foi registrado.');
  const riscos = lista(Q.riscos); if (!riscos.length) avisos.push('Nenhum risco registrado.'); riscos.filter(r => !r.resposta).forEach(r => avisos.push(`Risco "${r.txt}" sem plano de resposta.`));
  if (!lista(Q.gatilhos).length) avisos.push('Nenhum gatilho de decisão: o plano não avisa quando revisar.');
  const f = foco(prios); if (f.aviso && f.n > 0) avisos.push(f.aviso);
  return { ok: !bloq.length, bloqueios: bloq, avisos };
}
/* ---------- versões: cada publicação é uma foto; revisar exige motivo e nunca reescreve a anterior ---------- */
export const CAMPOS_VERSAO = ['objetivo', 'krs', 'prioridades', 'iniciativas', 'meses', 'cenarios', 'riscos', 'gatilhos', 'capacidade'] as const;
export function publicar(q: DocQuarter | null | undefined, motivo: string | null | undefined, ctx?: { agora?: number | string; autor?: string; premissas?: unknown; revisao?: unknown }) {
  const Q = q ?? {}, C = ctx ?? {};
  if (Q.status === 'encerrado') return { erro: 'quarter encerrado: não recebe nova versão' };
  const n = Q.status === 'publicado' ? (Number(Q.versao) || 1) + 1 : (Number(Q.versao) || 0) + 1;
  if (Q.status === 'publicado' && !String(motivo ?? '').trim()) return { erro: 'informe o motivo da revisão: a versão anterior continua guardada' };
  if (Q.versoes?.['v' + n]) return { erro: `a versão v${n} já existe` };
  const snap: Versao = { n, em: C.agora ?? Date.now(), por: C.autor ?? '', motivo: String(motivo ?? '').trim() || 'primeira publicação', premissas: C.premissas ?? null, revisao: C.revisao ?? null };
  for (const k of CAMPOS_VERSAO) snap[k] = Q[k] == null ? null : JSON.parse(JSON.stringify(Q[k]));
  return { versao: n, patch: { status: 'publicado' as const, versao: n, publicadoEm: snap.em, publicadoPor: snap.por, versoes: { ['v' + n]: snap } }, hist: { acao: n === 1 ? 'publicou o plano do quarter' : `publicou a revisão v${n}`, para: snap.motivo } };
}
export function diferencas(a: Record<string, unknown> | null | undefined, b: Record<string, unknown> | null | undefined) {
  return CAMPOS_VERSAO.filter(k => JSON.stringify(a?.[k] ?? null) !== JSON.stringify(b?.[k] ?? null)) as string[];
}

/* ---------- reprevisão: coexiste com a meta original; nunca a altera ---------- */
export function reprevisao(meta: { original?: unknown; vigente?: unknown } | null | undefined, real: unknown, proj: unknown, atrasos?: Array<{ impacto?: unknown }>) {
  const mo = num(meta?.original), mv = num(meta?.vigente), r = num(real), p = num(proj), imp = (atrasos ?? []).reduce((s, a) => s + (num(a.impacto) ?? 0), 0);
  return {
    metaOriginal: mo, metaVigente: mv ?? mo, realizado: r, projecao: p, projecaoComAtrasos: p != null ? p - imp : null, impactoAtrasos: imp, falta: mo != null && r != null ? Math.max(0, mo - r) : null,
    gapProjetado: mo != null && p != null ? p - mo : null,
    leitura: p == null || mo == null ? 'Sem projeção ou sem meta para comparar.' : p >= mo ? 'A projeção vigente alcança a meta aprovada.' : `A projeção vigente fica ${brl(mo - p)} abaixo da meta aprovada. A meta não muda sozinha: replanejar é uma decisão com motivo.`,
  };
}
/* ---------- fechamento do mês: classifica cada compromisso; só "pendente e válido" e "replanejado" seguem ---------- */
export function fechamentoMes<T extends { id: string }>(itens: T[] | null | undefined, classif: Record<string, string> | null | undefined) {
  const c = classif ?? {}, por = Object.fromEntries(Object.keys(FECHAMENTO_MES).map(k => [k, 0])) as Record<ClasseFechMes, number>, seguem: T[] = [], semClassificar: T[] = []; let total = 0;
  for (const i of itens ?? []) { total++; const k = c[i.id] as ClasseFechMes | undefined; if (!k || !(k in FECHAMENTO_MES)) { semClassificar.push(i); continue; } por[k]++; if (k === 'pendente' || k === 'replanejado') seguem.push(i); }
  return { total, por, seguem, semClassificar, completo: !semClassificar.length };
}
/* ---------- encerramento do quarter: comparável com o plano original (v1) ---------- */
export function encerramento(q: DocQuarter | null | undefined, obs?: { real?: unknown; inis?: Record<string, Medida>; minN?: number }) {
  const Q = q ?? {}, O_ = obs ?? {}, v1 = (Q.versoes?.v1 as DocQuarter | undefined) ?? Q, O = v1.objetivo ?? {}, ini = lista(Q.iniciativas);
  const metaO = num(O.alvo), real = num(O_.real);
  const avs = ini.map(i => ({ id: i.id, nome: i.nome ?? '', st: i.st ?? 'ativa', aval: avaliarIniciativa(i, O_.inis?.[i.id], O_.minN), custo: num(i.orcamento), horas: num(i.horas) }));
  return {
    metaOriginal: metaO, metaFinal: num(Q.objetivo?.alvo), real, desvio: desvio(metaO, real),
    concluidas: avs.filter(a => a.st !== 'cancelada' && a.aval.marcos.total && a.aval.marcos.feitos === a.aval.marcos.total),
    abandonadas: avs.filter(a => a.st === 'cancelada'), confirmadas: avs.filter(a => a.aval.k === 'funcionou'), rejeitadas: avs.filter(a => a.aval.k === 'sem_resultado'),
    falhasExecucao: avs.filter(a => a.aval.k === 'mal_executada'), semDado: avs.filter(a => a.aval.k === 'sem_dado'), avs, custo: avs.reduce((s, a) => s + (a.custo ?? 0), 0) || null,
  };
}

/* ---------- avisos (só receita): o que pede ação do gestor no quarter. O id é estável enquanto a situação é a mesma ---------- */
export interface EntradaAvisos {
  hoje?: string; T?: { key: string; curto: string }; q?: DocQuarter | null; prox?: { key: string; curto: string; ini: string }; proxDoc?: { status?: string } | null; ant?: { key: string; curto: string; fimISO: string }; antDoc?: { status?: string } | null;
  gatilhos?: Array<{ id?: string; ind?: string; nome?: string; estado: string; v?: number | null; limiteTxt?: string; vTxt?: string; acao?: string }>; proj?: { metaVigente: number; projecao: number | null; realizado: number; diasDecorridos?: number } | null;
  meses?: Array<{ m: number; nome: string; fim: string; iniciou: boolean }>; inis?: Array<{ id: string; nome: string; marcos?: Array<{ id: string; txt: string; prazo?: string | null; st?: string }> }>; mesKey?: string; semana?: string;
}
export interface Aviso { id: string; fase: FaseQuarter; key: string; titulo: string; texto: string }
const difDias = (a: string, b: string) => Math.round((Date.parse(a + 'T12:00:00Z') - Date.parse(b + 'T12:00:00Z')) / 86400000);
export function avisos(c: EntradaAvisos | null | undefined): Aviso[] {
  const C = c ?? {}, out: Aviso[] = [], hoje = C.hoje ?? '', q = C.q, T = C.T ?? { key: '', curto: '' };
  if (C.prox?.ini) {
    const d = difDias(C.prox.ini, hoje), st = C.proxDoc ? C.proxDoc.status ?? 'rascunho' : null;
    if (d >= 0 && d <= 15 && st !== 'publicado' && st !== 'encerrado') out.push({ id: 'lq:prox:' + C.prox.key, fase: C.proxDoc ? 'publicar' : 'visao', key: C.prox.key, titulo: `O ${C.prox.curto} começa em ${d} dia${d === 1 ? '' : 's'} e ${st ? 'o plano ainda está em rascunho' : 'ainda não tem plano'}`, texto: 'Quarter: a revisão do quarter atual e o diagnóstico já estão prontos.' });
  }
  if (C.antDoc?.status === 'publicado' && C.ant?.fimISO && hoje > C.ant.fimISO) out.push({ id: 'lq:enc:' + C.ant.key, fase: 'publicar', key: C.ant.key, titulo: `O ${C.ant.curto} terminou e ainda não foi encerrado`, texto: 'Registre a retrospectiva: ela alimenta a revisão automática do quarter atual.' });
  if (!q || q.status !== 'publicado') return out;
  for (const g of (C.gatilhos ?? []).filter(g => g.estado === 'disparado')) out.push({ id: `lq:gat:${T.key}:${g.id}:${C.mesKey ?? ''}`, fase: 'publicar', key: T.key, titulo: `Gatilho disparado: ${g.nome} ${g.vTxt ?? ''}`, texto: `Limite ${g.limiteTxt ?? ''} · ${g.acao ?? 'revisar o plano'}. Registre a decisão no acompanhamento do quarter.` });
  for (const i of C.inis ?? []) for (const m of (i.marcos ?? []).filter(m => m.prazo && m.prazo < hoje && m.st !== 'concluido' && m.st !== 'cancelado'))
    out.push({ id: `lq:marco:${T.key}:${i.id}:${m.id}`, fase: 'iniciativas', key: T.key, titulo: 'Marco atrasado: ' + m.txt, texto: `"${i.nome}" · prazo ${m.prazo!.split('-').reverse().join('/')}. Atualize a situação do marco ou replaneje.` });
  const P = C.proj;
  if (P && P.metaVigente > 0 && P.projecao != null && (P.diasDecorridos ?? 0) >= 10 && P.projecao < P.metaVigente * 0.95)
    out.push({ id: `lq:proj:${T.key}:${C.semana ?? ''}`, fase: 'publicar', key: T.key, titulo: `Projeção do ${T.curto} abaixo da meta: ${brl(P.projecao)} de ${brl(P.metaVigente)}`, texto: `Receita do quarter até hoje ${brl(P.realizado)}. A meta não muda sozinha: veja o acompanhamento e decida se replaneja.` });
  for (const M of C.meses ?? []) {
    const f = q.fechMes?.[M.m] ?? q.fechMes?.[String(M.m)]; if (!M.iniciou || f?.em) continue; const d = difDias(M.fim, hoje);
    if (d <= 2) out.push({ id: `lq:fech:${T.key}:${M.m}`, fase: 'publicar', key: T.key, titulo: d >= 0 ? `O mês ${M.m + 1} do ${T.curto} (${M.nome}) fecha em ${d + 1} dia${d ? 's' : ''}` : `Fechamento do mês ${M.m + 1} do ${T.curto} (${M.nome}) pendente`, texto: 'Classifique cada compromisso e registre o que muda no mês seguinte.' });
  }
  return out;
}
/* ---------- o Fechamento do dia dentro do quarter: contagem por status, desvios recorrentes e dias com o quarter em risco ---------- */
export function resumoDiario(lista_: unknown, de: string, ate: string, curto?: string) {
  const ehQ = (t: unknown) => /quarter/i.test(String(t ?? '')) || (!!curto && String(t ?? '').includes(curto));
  type Item = { data?: string; resumo?: { status?: string; desvio?: string; risco?: string } };
  const L = (Array.isArray(lista_) ? (lista_ as Item[]) : []).filter(x => x && x.data && x.data >= de && x.data <= ate && x.resumo) as Array<Required<Item>>;
  const por: Record<string, number> = { bom: 0, atencao: 0, critico: 0, sem_dado: 0 }, rec: Record<string, { txt: string; n: number; ultima: string; quarter: boolean }> = {};
  for (const x of L) {
    const r = x.resumo; if (r.status && por[r.status] != null) por[r.status]!++;
    for (const t of [r.desvio, r.risco].filter(Boolean)) { const k = String(t); const e = (rec[k] = rec[k] ?? { txt: k, n: 0, ultima: '', quarter: ehQ(k) }); e.n++; if (x.data > e.ultima) e.ultima = x.data; }
  }
  const recorrentes = Object.values(rec).filter(r => r.n >= 2).sort((a, b) => b.n - a.n || b.ultima.localeCompare(a.ultima));
  return { dias: L.length, por, recorrentes, diasQuarterRisco: L.filter(x => ehQ(x.resumo.risco)).length };
}
/* aprendizado sugerido a partir da avaliação de uma iniciativa no encerramento (o gestor confere e grava) */
export function aprendizadoDe(ini: Iniciativa | null | undefined, aval: Partial<AvaliacaoIniciativa> | null | undefined, nomeInd?: (k: string) => string, fmt?: (v: number | null | undefined) => string) {
  const i = ini ?? {}, a = aval ?? {}, f = fmt ?? ((v: number | null | undefined) => (v == null ? '—' : String(v))), nome = i.nome ?? 'iniciativa', ind = nomeInd ? nomeInd(i.ind ?? '') : i.ind ?? '';
  const conf = a.k === 'funcionou' || a.k === 'sem_resultado' ? (a.execucao != null && a.execucao >= 0.8 ? 'media' : 'baixa') : 'baixa';
  const conclusao: Record<string, string> = {
    funcionou: `"${nome}" produziu o resultado mínimo esperado em ${ind}.`, sem_resultado: `"${nome}" foi executada e não moveu ${ind} até o mínimo: a hipótese perdeu força.`,
    mal_executada: `"${nome}" não foi executada por inteiro: a hipótese continua sem teste.`, resultado_sem_execucao: `${ind} melhorou sem que "${nome}" fosse executada: a causa foi outra.`,
    resultado_sem_marcos: `${ind} atingiu o mínimo; sem marcos, não dá para atribuir à iniciativa.`, sem_dado: `Sem medida suficiente para concluir sobre "${nome}".`,
  };
  return {
    contexto: nome + (i.hipotese ? ' · hipótese: ' + i.hipotese : ''),
    evidencia: `${ind}: inicial ${f(num(i.inicial))}, mínimo ${f(a.minimo)}, observado ${f(a.v)}` + (a.marcos?.total ? ` · ${a.marcos.feitos} de ${a.marcos.total} marcos concluídos` : ''),
    conclusao: conclusao[a.k ?? ''] ?? '', confianca: conf, condicoes: i.etapa ? 'etapa: ' + i.etapa : '',
    implicacao: a.k === 'funcionou' ? (i.ampliar ? 'ampliar se ' + i.ampliar : 'manter e ampliar com cuidado') : a.k === 'sem_resultado' ? 'rever ou abandonar a hipótese' : a.k === 'mal_executada' ? 'testar de novo com execução completa' : '', decisao: '',
  };
}
/* ---------- encadeamento: objetivo → resultado-chave → problema → iniciativa → entregável → indicador → meta mensal → resultado observado ---------- */
export function encadeamento(q: DocQuarter | null | undefined, diag?: ItemDiagnostico[] | null, obs?: { objetivo?: number | null; krs?: Record<string, number | null>; inis?: Record<string, Medida>; meses?: Array<number | null> }) {
  const Q = q ?? {}, O_ = obs ?? {}, O = Q.objetivo ?? {}, D = diag ?? [], aceitas = priorizar(lista(Q.prioridades).filter(p => aceita(p.st))), inis = lista(Q.iniciativas).filter(i => i.st !== 'cancelada');
  const ramoIni = (i: Iniciativa & { id: string }) => ({
    id: i.id, nome: i.nome ?? '', resp: i.resp, ind: i.ind, inicial: num(i.inicial), minimo: num(i.minimo), alvo: num(i.alvo), obs: O_.inis?.[i.id] ?? null,
    meses: [0, 1, 2].filter(m => (i.meses ?? [0, 1, 2]).includes(m)).map(m => ({ m, marcos: lista(i.marcos).filter(x => (x.mes ?? 0) === m).map(x => ({ id: x.id, txt: x.txt ?? '', prazo: x.prazo ?? null, st: x.st ?? 'previsto' })) })),
  });
  const ramos = aceitas.map(p => {
    const d = p.diag ? D.find(x => x.k === p.diag) : null;
    return { prio: { id: p.id, titulo: p.titulo ?? '', st: p.st ?? '' }, problema: d ? { dim: d.dim, estado: d.estado as string, evidencia: d.evidencia } : { dim: p.justificativa ?? p.escopo ?? '', estado: 'gestor', evidencia: '' }, iniciativas: inis.filter(i => i.prio === p.id).map(ramoIni) };
  });
  const ligadas = new Set(ramos.flatMap(r => r.iniciativas.map(i => i.id)));
  return {
    objetivo: { texto: O.texto ?? '', ind: O.ind ?? 'receita', alvo: num(O.alvo), obs: O_.objetivo ?? null },
    krs: lista(Q.krs).map(k => ({ id: k.id, ind: k.ind, tipo: k.tipo ?? 'resultado', alvo: num(k.alvo), obs: O_.krs?.[k.id] ?? null })),
    ramos, soltas: inis.filter(i => !ligadas.has(i.id)).map(ramoIni),
    meses: [0, 1, 2].map(m => ({ m, meta: num(mes(Q, m).meta), resultado: mes(Q, m).resultado ?? '', obs: O_.meses?.[m] ?? null })),
  };
}
/* ---------- entregáveis do quarter no Plano do dia: atrasados e os que vencem nos próximos dias, por responsável ---------- */
const normNome = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
export function mesmaPessoa(resp: unknown, nome: unknown) { const a = normNome(resp), b = normNome(nome); if (!a || !b) return false; return a === b || (!a.includes(' ') && b.split(' ')[0] === a); }
export interface MarcoDaSemana { iniId: string; ini: string; id: string; txt: string; prazo: string; resp: string; st: string; situacao: 'atrasado' | 'semana'; dias: number }
export function marcosDaSemana(q: DocQuarter | null | undefined, hoje: string, pessoa?: string | null, dias = 7): { ate: string | null; itens: MarcoDaSemana[] } {
  const n = Number(dias) || 7, d0 = Date.parse(hoje + 'T12:00:00Z'), out: MarcoDaSemana[] = [];
  if (!hoje || !isFinite(d0)) return { ate: null, itens: out };
  const ate = new Date(d0 + (n - 1) * 86400000).toISOString().slice(0, 10);
  for (const i of lista(q?.iniciativas).filter(i => i.st !== 'cancelada')) for (const m of lista(i.marcos)) {
    if (!m.prazo || m.st === 'concluido' || m.st === 'cancelado' || m.prazo > ate) continue; const resp = m.resp ?? i.resp ?? '';
    if (pessoa && !mesmaPessoa(resp, pessoa)) continue;
    const atr = m.prazo < hoje;
    out.push({ iniId: i.id, ini: i.nome ?? '', id: m.id, txt: m.txt ?? '', prazo: m.prazo, resp, st: m.st ?? 'previsto', situacao: atr ? 'atrasado' : 'semana', dias: Math.round(Math.abs(Date.parse(m.prazo + 'T12:00:00Z') - d0) / 86400000) });
  }
  return { ate, itens: out.sort((a, b) => (a.situacao === 'atrasado' ? 0 : 1) - (b.situacao === 'atrasado' ? 0 : 1) || a.prazo.localeCompare(b.prazo) || a.resp.localeCompare(b.resp)) };
}
