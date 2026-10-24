/* Fechamento do dia: o motor puro portado do LAB V1 (daily_motor.js, DXM_VERSAO 2026-10-24.1; testes/daily_motor.test.js é o contrato).
   Entrada: a FOTOGRAFIA do dia, montada só com o que o plano do dia e a projeção do ciclo já calculam. Nada aqui recalcula meta, feito ou taxa.
   Saída: o relatório gerencial (resumo, previsto × realizado, deu certo, deu errado, pessoas, avanços, pendências, alertas, intervenções, metas do ciclo e do quarter, limitações).
   Cada afirmação leva o tipo: fato · desvio · diagnóstico · risco · recomendação · decisão (a decisão é sempre do gestor, nunca do motor).
   "Sem dado" nunca vira zero; um único dia é sinal a investigar, não problema comprovado. */
import { NOMES } from './tipos.js';

export const VERSAO_FECHAMENTO = '2026-10-29.1';
export const TIPOS_AFIRMACAO = { fato: 'Fato', desvio: 'Desvio', diagnostico: 'Diagnóstico', risco: 'Risco', recomendacao: 'Recomendação', decisao: 'Decisão' } as const;
export type TipoAfirmacao = keyof typeof TIPOS_AFIRMACAO;
export const ETAPAS_FECHAMENTO = ['tentativa', 'contato', 'agendamento', 'reuniao_realizada', 'proposta_enviada', 'oportunidades', 'vendas'] as const;
export const CLASSES_PENDENCIA = { prioridade: 'Executar com prioridade', reagendar: 'Reagendar', terceiro: 'Depende de terceiro', bloqueada: 'Bloqueada', decisao: 'Exige decisão do gestor', sem_validade: 'Perdeu a validade (cancelar mediante confirmação)' } as const;
export type ClassePendencia = keyof typeof CLASSES_PENDENCIA;
export const SITUACOES = { em_dia: 'Em dia', falta_execucao: 'Falta de execução', resultado: 'Resultado abaixo do esperado', bloqueio: 'Bloqueio ou dependência externa', sem_registro: 'Sem registro até o corte', nao_trabalha: 'Fora do expediente hoje', sem_meta: 'Sem meta para comparar' } as const;
export type Situacao = keyof typeof SITUACOES;
export interface CritFechamento { pctOk: number; minN: number; recorrente: number; histDias: number }
export const CRIT_FECHAMENTO: CritFechamento = { pctOk: 0.9, minN: 10, recorrente: 3, histDias: 10 };
const crit = (c?: Partial<CritFechamento> | null): CritFechamento => ({ ...CRIT_FECHAMENTO, ...(c ?? {}) });
const et = (k: string): [string, string, string] => NOMES[k] ?? [k, k, k];
const N = (v: number | null | undefined) => { if (v == null || !isFinite(v)) return '—'; const r = Math.round(v * 10) / 10, s = Math.abs(r - Math.round(r)) < 1e-9 ? String(Math.round(r)) : String(r).replace('.', ','); return s.replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };
const Q = (n: number, k: string) => { const e = et(k), v = Math.round(n); return N(v) + ' ' + (v === 1 ? e[1] : e[2]); };
const P = (v: number | null | undefined) => (v == null || !isFinite(v) ? '—' : Math.round(v * 100) + '%');
const BRL = (v: number | null | undefined) => (v == null || !isFinite(v) ? '—' : 'R$ ' + N(Math.round(v)));
const prim = (n: string | undefined) => String(n ?? '').split(' ')[0]!;
const DM = (iso: string | null | undefined) => { const p = String(iso ?? '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : String(iso ?? ''); };

/* ---------- a fotografia (entrada) ---------- */
export interface ProdFoto { k: string; nome?: string; metaHoje?: number; alvo: number; feito: number; falta: number; atraso?: number; recup?: number; janela?: number; diario: boolean; metaCiclo?: number; feitoCiclo?: number; metaAmanha?: number }
export interface TarefaFoto { id: string; titulo: string; prazo?: string; prioridade?: string; neg?: string | null; negNome?: string; negFechado?: boolean; adiamentos?: number; terceiro?: boolean; ultimoMotivo?: string; cardCritico?: boolean; prazoOriginal?: string; diasAtraso?: number; bloqueada?: boolean }
export interface ReuniaoFoto { id: string; conduz: boolean; passou: boolean; status: 'agendado' | 'realizado' | 'noshow' | 'reagendado' | 'cancelado' | string; cliente?: string; neg?: string | null }
export interface AvancoFoto { k: string; neg: string; nome: string; valor?: number; txt?: string }
export interface PessoaFoto {
  n: string; funcaoNome?: string; trabalha?: boolean; prod: ProdFoto[]; semana?: Array<{ k: string; alvo: number; feito: number }>;
  tarefas?: { hoje?: TarefaFoto[]; atrasadas?: TarefaFoto[]; feitasHoje?: number; feitasHojePrazoHoje?: number }; reunioes?: ReuniaoFoto[]; avancos?: AvancoFoto[]; registrosHoje?: number;
  plano?: { registrado?: boolean; justificadas?: number; justTerceiro?: number; feitos?: number } | null; quad?: { tipo: string; tit?: string; txt?: string } | null; viab?: { st: string; txt: string } | null; capFonte?: string;
  padrao?: { recorrente: boolean; abaixo: number; n: number; k?: string } | null; garg?: Array<{ chave: string; nome: string; real: number; ref: number; refTxt: string; conf?: string; evid?: string; causas?: string[]; falta?: string; teste?: string }>;
  amanha?: { iso: string | null; cap: number | null; metaContatos: number; atrasoContatos: number; tarefas?: number; reunioes?: number } | null;
  cards?: Array<{ id: string; nome: string; etapa: string; classe: string; motivos: string[]; valor: number; ve: number }>; exposicao?: number;
}
export interface Fotografia {
  data: string; corte: number; corteHora?: string; fuso?: string; geradoEm?: number; versaoPlano?: string;
  plano: { status: 'ativo' | 'sem_plano' | string } | null; crit?: Partial<CritFechamento>;
  fontes?: { avisos?: string[]; indisponiveis?: string[] };
  pessoas: PessoaFoto[];
  equipe?: {
    sistemicos?: Array<{ chave: string; nome: string; pessoas: string[] }>;
    mes?: { nome?: string; meta: number | null; realizado: number; esperado: number | null; projecao: number | null; vendas?: { meta: number | null; real: number; proj: number | null }; sinais?: Array<{ origem: string; ind?: string; grav: number; tit: string; oque?: string; esperado?: string; desvio?: string }> } | null;
    conting?: unknown; quarter?: { nome?: string; meta: number; metaOriginal?: number | null; realizado: number; projecao: number | null; projecaoComAtrasos?: number | null; impactoAtrasos?: number | null; risco: boolean; leitura?: string; premissas?: string; avisos?: Array<{ id: string; titulo: string; texto?: string }> } | null;
  };
  historico?: Array<{ data: string; chaves?: string[]; acoes?: Record<string, { estado: string; texto?: string }>; pessoas?: Record<string, { pct: number | null }> }>;
}

/* ---------- previsto × realizado de um indicador: só a atividade de volume é meta do DIA; o resto vale pela SEMANA ---------- */
export interface Comparacao { k: string; escopo?: string; nome: string; periodo: 'dia' | 'semana'; previsto: number | null; realizado: number | null; origem?: string; dif: number | null; pct: number | null; status: 'atingido' | 'perto' | 'abaixo' | 'sem_dado' | 'sem_meta' }
export function comparar(x: Omit<Comparacao, 'dif' | 'pct' | 'status'>, c?: Partial<CritFechamento> | null): Comparacao {
  const C = crit(c), prev = Number(x.previsto), real = Number(x.realizado);
  const temPrev = x.previsto != null && isFinite(prev) && prev > 0, temReal = x.realizado != null && isFinite(real);
  const o = { ...x, dif: temPrev && temReal ? real - prev : null, pct: temPrev && temReal ? real / prev : null } as Comparacao;
  o.status = !temReal ? 'sem_dado' : !temPrev ? 'sem_meta' : o.pct! >= 1 ? 'atingido' : o.pct! >= C.pctOk ? 'perto' : 'abaixo';
  return o;
}

/* ---------- situação de uma pessoa: falta de execução × processo/dependência × ausência de registro × resultado ---------- */
export function situacao(p: PessoaFoto, c?: Partial<CritFechamento> | null): { k: Situacao; pct?: number | null; txt: string } {
  const C = crit(c);
  if (p.trabalha === false) return { k: 'nao_trabalha', txt: 'Fora do expediente hoje pelo calendário.' };
  const diar = (p.prod ?? []).filter(x => x.diario && x.alvo > 0), alvo = diar.reduce((a, x) => a + x.alvo, 0), feito = diar.reduce((a, x) => a + Math.min(x.feito, x.alvo), 0);
  const algum = (p.prod ?? []).some(x => x.feito > 0) || (p.tarefas?.feitasHoje ?? 0) > 0 || (p.reunioes ?? []).some(r => r.status === 'realizado') || (p.registrosHoje ?? 0) > 0;
  const terceiro = (p.tarefas?.atrasadas ?? []).concat(p.tarefas?.hoje ?? []).filter(t => t.terceiro).length + (p.plano?.justTerceiro ?? 0);
  const pct = alvo > 0 ? feito / alvo : null, q = p.quad?.tipo;
  if (!algum && (alvo > 0 || (p.tarefas?.hoje ?? []).length)) return { k: 'sem_registro', pct, txt: 'Nenhum registro até o corte (atividade, tarefa concluída ou reunião). Pode ser falta de execução ou registro ainda não feito: confirmar antes de concluir.' };
  if (terceiro > 0 && (pct == null || pct < C.pctOk)) return { k: 'bloqueio', pct, txt: terceiro + (terceiro === 1 ? ' compromisso depende' : ' compromissos dependem') + ' de terceiro (registrado na justificativa ou no adiamento).' };
  if (pct != null && pct < C.pctOk) return { k: 'falta_execucao', pct, txt: 'Atividade do dia em ' + P(pct) + ' do alvo de hoje.' };
  if (q === 'resultado') return { k: 'resultado', pct, txt: (p.quad?.tit ?? 'Insuficiência de resultado') + ': a atividade acompanha o plano, o resultado do ciclo não.' };
  if (pct == null && !(p.prod ?? []).length) return { k: 'sem_meta', pct, txt: 'Sem meta no plano para comparar.' };
  return { k: 'em_dia', pct, txt: pct != null ? 'Atividade do dia em ' + P(pct) + ' do alvo.' : 'Sem meta diária; acompanhar pela semana.' };
}

/* ---------- pendências: classifica sem copiar a tarefa; reagendar não apaga o desvio ---------- */
export function classePendencia(t: Partial<TarefaFoto>): ClassePendencia {
  if (t.negFechado) return 'sem_validade';
  if (t.bloqueada) return 'bloqueada';
  if (t.terceiro) return 'terceiro';
  if ((t.adiamentos ?? 0) >= 2) return 'decisao';
  if (t.prioridade === 'alta' || t.cardCritico || (t.diasAtraso ?? 0) >= 3) return 'prioridade';
  return 'reagendar';
}

/* ---------- recorrência: quantos relatórios seguidos (do mais recente para trás) trazem a mesma chave ---------- */
export function recorrencia(chave: string, hist: Fotografia['historico']) {
  const H = [...(hist ?? [])].sort((a, b) => String(b.data).localeCompare(String(a.data)));
  let n = 0; for (const r of H) { if ((r.chaves ?? []).includes(chave)) n++; else break; }
  let interv: { data: string; estado: string; texto: string } | null = null;
  for (const r of H) { const a = r.acoes?.[chave]; if (a && (a.estado === 'decidida' || a.estado === 'encaminhada') && (!interv || r.data > interv.data)) interv = { data: r.data, estado: a.estado, texto: a.texto ?? '' }; }
  return { seguidos: n, desde: n ? H[n - 1]!.data : null, interv };
}

/* ---------- capacidade de amanhã: a carga cabe? ---------- */
export function amanha(p: Pick<PessoaFoto, 'amanha'>) {
  const a = p.amanha; if (!a?.iso) return null;
  const cap = a.cap != null && a.cap > 0 ? a.cap : null, carga = (a.metaContatos || 0) + (a.atrasoContatos || 0);
  const st = cap == null ? 'sem_cap' : carga <= cap ? 'cabe' : 'sobrecarga';
  return { iso: a.iso, cap, carga, tarefas: a.tarefas ?? 0, reunioes: a.reunioes ?? 0, st,
    txt: st === 'sem_cap' ? 'Capacidade de toques não informada nem observada: o LAB não afirma se a carga de amanhã cabe.' : st === 'cabe' ? 'Carga de amanhã (' + N(carga) + ') cabe na capacidade (' + N(cap) + '/dia).' : 'Sobrecarga amanhã: ' + N(carga) + ' toques (meta + parcela do atraso) para capacidade de ' + N(cap) + '/dia. Priorizar ou redistribuir em vez de agendar tudo.' };
}

/* ---------- o relatório ---------- */
export interface Alerta { chave: string; p?: string; pessoas?: string[]; tipo: TipoAfirmacao; nivel: number; tit: string; esperado: string; aconteceu: string; desvio: string; evidencia: string; periodo: string; referencia: string; confianca: string; causa: string; impacto: string; padrao?: string; falta?: string; teste?: string; acaoPadrao?: string; recorrencia?: ReturnType<typeof recorrencia>; contexto?: string }
export interface Recomendacao { chave: string; problema: string; evidencia: string; consequencia: string; acao: string; resp: string; prazo: string; indicador: string; grav: number; tipo: 'recomendacao' }
export interface Relatorio {
  v: string; data: string; corte: number; fuso: string; geradoEm: number;
  comparacoes: Comparacao[]; certo: Array<{ tipo: TipoAfirmacao; chave: string; tit: string; porque: string }>; errado: Array<{ tipo: TipoAfirmacao; chave: string; tit: string; esperado: string; aconteceu: string; desvio: string; evidencia: string; causa: string; impacto: string; acao: string }>;
  pessoas: Array<{ n: string; funcao: string; sit: Situacao; sitNome: string; txt: string; pct: number | null | undefined; entregas: string[]; desvios: Array<{ k: string; txt: string }>; pendencias: number; bloqueios: string[]; evolucao: number | null; evolDias: number; planoAberto: boolean | null; quad: { tipo: string; tit?: string } | null; amanha: ReturnType<typeof amanha>; necessidade: string; tipo: TipoAfirmacao }>;
  avancos: Array<AvancoFoto & { tipo: TipoAfirmacao; pessoas: string[]; p?: string }>; pendencias: Array<{ id: string; titulo: string; resp: string; prazo?: string; neg: string | null; negNome: string; classe: ClassePendencia; classeNome: string; adiamentos: number; prazoOriginal?: string; tipo: TipoAfirmacao; motivo: string }>;
  alertas: Alerta[]; recomendacoes: Recomendacao[]; metas: Array<{ tipo: TipoAfirmacao; obj: string; situacao: string; esperado: string; desvio: string; projecao: string; premissas: string; impacto: string; acao: string }>;
  limitacoes: Array<{ tipo: TipoAfirmacao; txt: string }>; chaves: string[]; conting: unknown;
  resumo: { status: 'bom' | 'atencao' | 'critico' | 'sem_dado'; statusNome: string; objetivos: { atingidos: number; total: number }; desvio: string; avanco: string; risco: string; decisao: string; metaMes: string; pessoas: { total: number; atencao: number } };
}
export function relatorioDoDia(F: Fotografia, c?: Partial<CritFechamento> | null): Relatorio {
  const C = crit({ ...(c ?? {}), ...(F.crit ?? {}) });
  const R: Relatorio = { v: VERSAO_FECHAMENTO, data: F.data, corte: F.corte, fuso: F.fuso ?? 'America/Sao_Paulo', geradoEm: F.geradoEm ?? F.corte, comparacoes: [], certo: [], errado: [], pessoas: [], avancos: [], pendencias: [], alertas: [], recomendacoes: [], metas: [], limitacoes: [], chaves: [], conting: F.equipe?.conting ?? null,
    resumo: { status: 'sem_dado', statusNome: '', objetivos: { atingidos: 0, total: 0 }, desvio: '', avanco: '', risco: '', decisao: '', metaMes: '', pessoas: { total: 0, atencao: 0 } } };
  const pes = (F.pessoas ?? []).filter(p => p && p.n), hist = (F.historico ?? []).filter(h => h && h.data && h.data < F.data).slice(-C.histDias);
  /* limitações primeiro: o que falta para concluir */
  if (!F.plano || F.plano.status !== 'ativo') R.limitacoes.push({ tipo: 'fato', txt: F.plano?.status && F.plano.status !== 'sem_plano' ? 'O plano do ciclo está ' + F.plano.status + ': as metas do dia podem não existir.' : 'Sem metas no ciclo: nenhuma meta individual foi inventada.' });
  for (const f of F.fontes?.indisponiveis ?? []) R.limitacoes.push({ tipo: 'fato', txt: f + ' não está disponível: não entra no realizado.' });
  for (const a of F.fontes?.avisos ?? []) R.limitacoes.push({ tipo: 'fato', txt: a });
  if (!pes.length) R.limitacoes.push({ tipo: 'fato', txt: 'Nenhuma pessoa no plano do dia: não há o que comparar.' });

  /* previsto × realizado da equipe */
  const soma = (k: string, f: (x: ProdFoto) => number) => pes.reduce((a, p) => { const x = (p.prod ?? []).find(y => y.k === k); return a + (x ? f(x) : 0); }, 0);
  const tem = (k: string) => pes.some(p => (p.prod ?? []).some(y => y.k === k) || (p.semana ?? []).some(y => y.k === k && y.alvo > 0));
  for (const k of ETAPAS_FECHAMENTO) { if (!tem(k)) continue; const nome = et(k)[0];
    const diario = pes.some(p => (p.prod ?? []).find(y => y.k === k)?.diario);
    if (diario) R.comparacoes.push(comparar({ k, escopo: 'equipe', nome: nome + ' da equipe hoje', periodo: 'dia', previsto: soma(k, x => (x.diario ? x.alvo : 0)), realizado: soma(k, x => x.feito), origem: 'Alvo de hoje do plano do dia (meta do ciclo + parcela do atraso) × registros (fonte única)' }, C));
    const sp = pes.map(p => (p.semana ?? []).find(y => y.k === k)).filter((w): w is { k: string; alvo: number; feito: number } => !!w);
    if (sp.length && sp.some(w => w.alvo > 0)) R.comparacoes.push(comparar({ k, escopo: 'equipe', nome: nome + ' da equipe na semana', periodo: 'semana', previsto: sp.reduce((a, w) => a + (w.alvo || 0), 0), realizado: sp.reduce((a, w) => a + (w.feito || 0), 0), origem: 'Objetivo da semana do plano do dia (meta da semana + parcela do atraso) × registros' }, C)); }
  const tfPrev = pes.reduce((a, p) => a + (p.tarefas?.hoje ?? []).length + (p.tarefas?.feitasHojePrazoHoje ?? 0), 0), tfFeitas = pes.reduce((a, p) => a + (p.tarefas?.feitasHojePrazoHoje ?? 0), 0);
  if (tfPrev) R.comparacoes.push(comparar({ k: 'tarefas', escopo: 'equipe', nome: 'Tarefas da equipe com prazo hoje', periodo: 'dia', previsto: tfPrev, realizado: tfFeitas, origem: 'Tarefas (prazo hoje × concluídas hoje)' }, C));
  const reun: Array<ReuniaoFoto & { p: string }> = []; for (const p of pes) for (const r of p.reunioes ?? []) if (r.conduz) reun.push({ p: p.n, ...r });
  const reunPassou = reun.filter(r => r.passou), reunOk = reunPassou.filter(r => r.status === 'realizado'), reunNo = reunPassou.filter(r => r.status === 'noshow'), reunSemReg = reunPassou.filter(r => r.status !== 'realizado' && r.status !== 'noshow' && r.status !== 'reagendado');
  if (reun.length) R.comparacoes.push(comparar({ k: 'agenda', escopo: 'equipe', nome: 'Reuniões da agenda conduzidas pela equipe hoje (já no horário)', periodo: 'dia', previsto: reunPassou.length, realizado: reunOk.length, origem: 'Agenda (status de cada reunião)' }, C));

  /* pessoas: avaliadas pelos indicadores da própria função */
  for (const p of pes) {
    const S = situacao(p, C), funcao = p.funcaoNome ?? '', diar = (p.prod ?? []).filter(x => x.diario && x.alvo > 0);
    const desv = (p.prod ?? []).filter(x => x.diario && x.alvo > 0 && x.feito < x.alvo * C.pctOk).map(x => ({ k: x.k, txt: et(x.k)[0] + ' de ' + prim(p.n) + ' hoje: ' + N(x.feito) + ' de ' + N(x.alvo) + ' (alvo de hoje' + ((x.recup ?? 0) > 0 ? ', com ' + N(x.recup) + ' de recuperação do atraso' : '') + ')' }));
    const pend = (p.tarefas?.atrasadas ?? []).length + (p.tarefas?.hoje ?? []).length;
    const hp = hist.map(h => h.pessoas?.[p.n]).filter((x): x is { pct: number } => !!x && x.pct != null), evol = hp.length ? hp.reduce((a, x) => a + Math.min(1.5, x.pct), 0) / hp.length : null;
    const ent: string[] = []; for (const x of diar) if (x.feito >= x.alvo) ent.push(et(x.k)[0] + ': ' + N(x.feito) + ' de ' + N(x.alvo));
    if (p.tarefas?.feitasHoje) ent.push(p.tarefas.feitasHoje + (p.tarefas.feitasHoje === 1 ? ' tarefa concluída' : ' tarefas concluídas'));
    for (const r of (p.reunioes ?? []).filter(r => r.conduz && r.status === 'realizado')) ent.push('Reunião realizada: ' + (r.cliente ?? 'cliente'));
    const bloq: string[] = []; for (const t of (p.tarefas?.atrasadas ?? []).concat(p.tarefas?.hoje ?? []).filter(t => t.terceiro)) bloq.push(t.titulo + (t.ultimoMotivo ? ' (' + t.ultimoMotivo + ')' : ''));
    const nec = S.k === 'falta_execucao' || S.k === 'sem_registro' ? 'Conversar hoje ou na primeira hora de amanhã: ' + (S.k === 'sem_registro' ? 'confirmar se houve execução sem registro.' : 'entender o que tomou o tempo e combinar o alvo de amanhã.')
      : S.k === 'resultado' ? 'Orientação na conversão (acompanhar uma reunião ou ligação), não cobrança de volume.' : S.k === 'bloqueio' ? 'Destravar a dependência registrada ou decidir o que fazer com ela.' : '';
    R.pessoas.push({ n: p.n, funcao, sit: S.k, sitNome: SITUACOES[S.k], txt: S.txt, pct: S.pct, entregas: ent, desvios: desv, pendencias: pend, bloqueios: bloq, evolucao: evol, evolDias: hp.length,
      planoAberto: p.plano ? !!p.plano.registrado : null, quad: p.quad ? { tipo: p.quad.tipo, tit: p.quad.tit } : null, amanha: amanha(p), necessidade: nec, tipo: S.k === 'em_dia' || S.k === 'nao_trabalha' ? 'fato' : 'diagnostico' });
  }
  const ativos = R.pessoas.filter(x => x.sit !== 'nao_trabalha'), semPlano = pes.filter(p => p.plano && p.plano.registrado === false && p.trabalha !== false).map(p => prim(p.n));
  if (semPlano.length) R.limitacoes.push({ tipo: 'fato', txt: 'Plano do dia não registrado hoje por ' + semPlano.join(', ') + ': as ações priorizadas não foram registradas; o previsto usado é a meta do ciclo.' });
  if (reunSemReg.length) R.limitacoes.push({ tipo: 'fato', txt: reunSemReg.length + (reunSemReg.length === 1 ? ' reunião já passou do horário sem resultado registrado' : ' reuniões já passaram do horário sem resultado registrado') + ' na agenda: não foram contadas como não realizadas.' });

  /* o que deu certo */
  for (const cp of R.comparacoes.filter(x => x.status === 'atingido')) R.certo.push({ tipo: 'fato', chave: 'ok:' + cp.k + ':' + cp.periodo, tit: cp.nome + ': ' + N(cp.realizado) + ' de ' + N(cp.previsto) + ' previstos', porque: cp.periodo === 'semana' ? 'Mantém o objetivo da semana no ritmo.' : 'Alvo do dia cumprido, sem gerar atraso para amanhã.' });
  for (const x of ativos.filter(x => x.sit === 'em_dia' && x.pct != null && x.pct >= 1)) R.certo.push({ tipo: 'fato', chave: 'ok:p:' + x.n, tit: x.n + ' cumpriu o alvo de hoje (' + P(x.pct) + ')', porque: x.entregas.slice(0, 3).join(' · ') });
  /* avanços do dia: um por negócio e etapa (SDR e closer aparecem juntos), do que mais pesa na receita para o que menos */
  const ordAv = ['vendas', 'oportunidades', 'proposta_enviada', 'reuniao_realizada', 'agendamento'], avIdx: Record<string, Relatorio['avancos'][number]> = {};
  for (const p of pes) for (const a of p.avancos ?? []) { const k = a.k + '|' + a.neg; if (avIdx[k]) { if (!avIdx[k]!.pessoas.includes(p.n)) avIdx[k]!.pessoas.push(p.n); continue; } avIdx[k] = { tipo: 'fato', pessoas: [p.n], ...a }; R.avancos.push(avIdx[k]!); }
  for (const a of R.avancos) a.p = a.pessoas.join(' e ');
  const iA = (k: string) => (ordAv.indexOf(k) < 0 ? 9 : ordAv.indexOf(k));
  R.avancos.sort((a, b) => iA(a.k) - iA(b.k) || (b.valor ?? 0) - (a.valor ?? 0));
  const vendHoje = R.avancos.filter(a => a.k === 'vendas');
  if (vendHoje.length) R.certo.push({ tipo: 'fato', chave: 'ok:vendas', tit: vendHoje.length + (vendHoje.length === 1 ? ' venda fechada hoje' : ' vendas fechadas hoje') + (vendHoje.some(a => (a.valor ?? 0) > 0) ? ' (' + BRL(vendHoje.reduce((a, x) => a + (x.valor ?? 0), 0)) + ' em contratos)' : ''), porque: 'Receita contratada que conta para a meta do ciclo.' });
  const resolvidosCand: Array<{ k: string; r: ReturnType<typeof recorrencia> }> = [];
  const ult = hist[hist.length - 1];
  if (ult?.chaves) for (const k of ult.chaves) { const r = recorrencia(k, hist); if (r.interv && r.seguidos > 0) resolvidosCand.push({ k, r }); }

  /* alertas: desvios, gargalos e riscos, com evidência, período, referência e confiança */
  const alerta = (A: Omit<Alerta, 'recorrencia' | 'contexto'>) => { const rc = recorrencia(A.chave, hist); const X: Alerta = { ...A, recorrencia: rc };
    if (rc.seguidos >= 1) { X.nivel = Math.min(3, X.nivel + (rc.seguidos + 1 >= C.recorrente ? 1 : 0)); X.contexto = 'Aparece pelo ' + (rc.seguidos + 1) + 'º relatório seguido (desde ' + DM(rc.desde) + ').' + (rc.seguidos + 1 >= C.recorrente ? ' Recorrente: investigar a causa, não só cobrar o dia.' : '') + (rc.interv ? ' Houve ' + (rc.interv.estado === 'encaminhada' ? 'ação encaminhada' : 'decisão registrada') + ' em ' + DM(rc.interv.data) + ' e o desvio continua.' : ''); }
    R.alertas.push(X); R.chaves.push(X.chave); return X; };
  for (const p of pes) { const pr = R.pessoas.find(x => x.n === p.n), nm = prim(p.n);
    const padK = p.padrao?.recorrente ? (p.padrao.k ?? 'tentativa') : null, padTxt = padK ? 'Padrão: abaixo da meta em ' + p.padrao!.abaixo + ' de ' + p.padrao!.n + ' dias úteis.' : '';
    const diaAl = (p.prod ?? []).filter(x => x.diario && x.alvo > 0 && x.feito < x.alvo * C.pctOk);
    for (const x of diaAl) alerta({ chave: 'dia:' + x.k + ':' + p.n, p: p.n, tipo: x.k === padK ? 'diagnostico' : 'desvio', nivel: Math.min(3, (x.feito === 0 ? 2 : 1) + (x.k === padK ? 1 : 0)), padrao: x.k === padK ? padTxt : '', tit: et(x.k)[0] + ' de ' + nm + ' abaixo do alvo de hoje' + (x.k === padK ? ' (' + p.padrao!.abaixo + ' de ' + p.padrao!.n + ' dias úteis abaixo)' : ''),
      esperado: Q(x.alvo, x.k) + ' (alvo de hoje)', aconteceu: Q(x.feito, x.k) + ' registrados até o corte', desvio: '−' + N(x.alvo - x.feito) + ' (' + P(x.feito / x.alvo) + ' do alvo)',
      evidencia: 'Registros de hoje (fonte única).' + (x.k === padK ? ' ' + padTxt : ''), periodo: 'hoje até ' + (F.corteHora ?? 'o corte') + (x.k === padK ? '; padrão nos últimos ' + p.padrao!.n + ' dias úteis' : ''), referencia: 'alvo de hoje do plano do dia', confianca: pr?.sit === 'sem_registro' ? 'baixa (nenhum registro: pode ser registro atrasado)' : 'alta (contagem direta)',
      causa: pr?.sit === 'bloqueio' ? 'dependência de terceiro registrada' : pr?.sit === 'sem_registro' ? 'execução sem registro ou ausência de execução (não dá para separar só pelos dados)' : 'tempo consumido por outras atividades ou falta de leads para trabalhar (hipótese)',
      impacto: x.falta > 0 ? 'O que faltar entra no atraso do ciclo e é redistribuído nos próximos ' + (x.janela ?? 5) + ' dias úteis.' : '',
      acaoPadrao: pr?.sit === 'sem_registro' ? 'Confirmar com ' + nm + ' o que foi feito e pedir o registro.' : 'Combinar com ' + nm + ' o alvo de amanhã, que já inclui a parcela do que faltou hoje.' });
    if (p.viab?.st === 'inviavel') alerta({ chave: 'viab:' + p.n, p: p.n, tipo: 'risco', nivel: 3, tit: 'Recuperação de ' + nm + ' não cabe na capacidade', esperado: 'recuperar o atraso até o fim do ciclo', aconteceu: p.viab.txt, desvio: '', evidencia: 'Atraso do ciclo × capacidade ' + (p.capFonte ?? '') + ' (plano do dia).', periodo: 'ciclo atual', referencia: 'capacidade de toques/dia', confianca: 'média (capacidade ' + (p.capFonte === 'apontada' ? 'apontada pelo gestor' : 'observada nos últimos 20 dias úteis') + ')', causa: 'meta acima da capacidade ou atraso acumulado', impacto: 'Meta individual do ciclo inalcançável sem decisão.' });
    if (p.quad?.tipo === 'resultado') for (const g of (p.garg ?? []).slice(0, 1)) alerta({ chave: 'conv:' + g.chave + ':' + p.n, p: p.n, tipo: 'diagnostico', nivel: 2, tit: g.nome + ' de ' + nm + ' abaixo da referência', esperado: P(g.ref) + ' (' + g.refTxt + ')', aconteceu: P(g.real), desvio: '', evidencia: g.evid ?? '', periodo: 'ciclo atual', referencia: g.refTxt, confianca: g.conf ?? '', causa: (g.causas ?? []).join('; '), falta: g.falta ?? '', teste: g.teste ?? '', impacto: 'Atividade em dia com conversão baixa: mais volume não resolve.' });
    if (padK && !diaAl.some(x => x.k === padK)) alerta({ chave: 'padrao:' + p.n, p: p.n, tipo: 'diagnostico', nivel: 2, tit: 'Padrão: ' + nm + ' abaixo da meta em ' + p.padrao!.abaixo + ' de ' + p.padrao!.n + ' dias úteis', esperado: 'meta diária de ' + et(padK)[2], aconteceu: p.padrao!.abaixo + ' dias abaixo', desvio: '', evidencia: 'Últimos ' + p.padrao!.n + ' dias úteis (plano do dia).', periodo: 'últimos ' + p.padrao!.n + ' dias úteis', referencia: 'meta do dia', confianca: 'alta (contagem direta)', causa: 'rotina ou agenda incompatível com a meta (hipótese)', impacto: 'Atraso que se acumula no ciclo.' });
    const tAdi = (p.tarefas?.atrasadas ?? []).filter(t => (t.adiamentos ?? 0) >= 2);
    if (tAdi.length) alerta({ chave: 'adiadas:' + p.n, p: p.n, tipo: 'desvio', nivel: 2, tit: tAdi.length + (tAdi.length === 1 ? ' tarefa de ' + nm + ' adiada' : ' tarefas de ' + nm + ' adiadas') + ' duas vezes ou mais', esperado: 'concluir no prazo combinado', aconteceu: tAdi.map(t => t.titulo).slice(0, 3).join('; '), desvio: '', evidencia: 'Histórico de adiamentos da tarefa.', periodo: 'desde a criação da tarefa', referencia: 'prazo original', confianca: 'alta (registro direto)', causa: 'prioridade, dependência ou tarefa que perdeu o sentido', impacto: 'Compromisso que não sai do lugar.' });
  }
  for (const s of F.equipe?.sistemicos ?? []) alerta({ chave: 'sis:' + s.chave, pessoas: s.pessoas, tipo: 'diagnostico', nivel: 2, tit: 'Possível causa sistêmica: ' + s.nome + ' abaixo da referência em ' + s.pessoas.length + ' pessoas', esperado: 'referência do plano ou do histórico', aconteceu: s.pessoas.join(', '), desvio: '', evidencia: 'Gargalos individuais do plano do dia que caem na mesma passagem.', periodo: 'ciclo atual', referencia: 'plano ou histórico de 90 dias', confianca: 'média (padrão em várias pessoas)', causa: 'lead, oferta, preço ou processo, antes de desempenho individual', impacto: 'Cobrar volume de cada um não corrige uma causa comum.' });
  if (reunPassou.length >= 2 && reunNo.length / reunPassou.length >= 0.3) alerta({ chave: 'noshow', tipo: 'diagnostico', nivel: reunPassou.length >= C.minN ? 2 : 1, tit: 'Comparecimento: ' + reunNo.length + ' de ' + reunPassou.length + ' reuniões de hoje sem o cliente (no-show)', esperado: 'cliente presente', aconteceu: reunNo.map(r => r.cliente ?? '').filter(Boolean).slice(0, 3).join('; '), desvio: '', evidencia: 'Status das reuniões na agenda.', periodo: 'hoje', referencia: 'reuniões já no horário', confianca: reunPassou.length >= C.minN ? 'média' : 'baixa (um dia, amostra pequena): sinal a investigar, não problema comprovado', causa: 'confirmação, intervalo entre agendamento e reunião ou qualificação no agendamento', impacto: 'Menos oportunidades qualificadas nas próximas semanas, mesmo com agendamentos em dia.' });
  const mes = F.equipe?.mes ?? null;
  if (mes) for (const s of (mes.sinais ?? []).filter(s => s.grav >= 2 && ['meta', 'trajetoria', 'demanda', 'capacidade'].includes(s.origem)).slice(0, 4)) alerta({ chave: 'mes:' + s.origem + ':' + (s.ind ?? ''), tipo: 'risco', nivel: s.grav >= 3 ? 3 : 2, tit: s.tit, esperado: s.esperado ?? '', aconteceu: s.oque ?? '', desvio: s.desvio ?? '', evidencia: 'Sinais do ciclo (projeção e trajetória).', periodo: mes.nome ?? 'ciclo atual', referencia: 'meta do ciclo', confianca: 'projeção (premissa: o ritmo atual continua)', causa: '', impacto: 'Afeta o resultado do ciclo.' });
  const qt = F.equipe?.quarter ?? null;
  if (qt && qt.meta > 0) {
    for (const av of qt.avisos ?? []) { const k = String(av.id ?? '').replace(/^lq:/, ''), gat = /^gat:/.test(k);
      alerta({ chave: 'qtr:' + k, tipo: gat ? 'risco' : 'desvio', nivel: gat ? 2 : 1, tit: av.titulo, esperado: '', aconteceu: av.texto ?? '', desvio: '', evidencia: 'Plano do quarter.', periodo: qt.nome ?? 'quarter', referencia: gat ? 'limite do gatilho definido no plano' : 'prazo e compromissos do plano do quarter', confianca: gat ? 'medida dos últimos 30 dias, com amostra mínima' : 'alta (registro direto)', causa: '', impacto: 'Afeta a execução da estratégia do quarter.', acaoPadrao: 'Abrir o quarter e registrar a decisão.' }); }
    if (qt.risco) alerta({ chave: 'qtr:receita', tipo: 'risco', nivel: 2, tit: 'Meta do ' + (qt.nome ?? 'quarter') + ' em risco', esperado: BRL(qt.meta), aconteceu: 'Projeção ' + BRL(qt.projecao), desvio: '−' + BRL(qt.meta - (qt.projecao ?? 0)), evidencia: 'Reprevisão do plano do quarter.', periodo: qt.nome ?? 'quarter', referencia: 'meta vigente do quarter', confianca: 'projeção (premissa: o ritmo atual continua)', causa: '', impacto: 'Afeta o resultado do quarter.' });
  }
  R.alertas.sort((a, b) => b.nivel - a.nivel || (a.tipo === 'risco' ? -1 : 0));

  /* o que deu errado: os desvios relevantes, com o roteiro de 7 passos */
  for (const a of R.alertas.filter(a => a.tipo !== 'risco' || a.nivel >= 2).slice(0, 12)) R.errado.push({ tipo: a.tipo, chave: a.chave, tit: a.tit, esperado: a.esperado, aconteceu: a.aconteceu, desvio: a.desvio, evidencia: a.evidencia, causa: a.causa ? 'Possível causa: ' + a.causa + '.' : '', impacto: a.impacto, acao: '' });
  /* resolvidos depois de uma intervenção: estavam no último relatório, com ação registrada, e hoje não aparecem */
  for (const x of resolvidosCand) if (!R.chaves.includes(x.k)) R.certo.push({ tipo: 'fato', chave: 'resolvido:' + x.k, tit: 'Desvio que aparecia até ' + DM(ult!.data) + ' não aparece hoje', porque: 'Depois da ' + (x.r.interv!.estado === 'encaminhada' ? 'ação encaminhada' : 'decisão') + ' de ' + DM(x.r.interv!.data) + (x.r.interv!.texto ? ' (' + x.r.interv!.texto + ')' : '') + '. Um dia não prova a correção: acompanhar.' });

  /* pendências */
  for (const p of pes) for (const t of (p.tarefas?.atrasadas ?? []).concat(p.tarefas?.hoje ?? [])) { const cl = classePendencia(t);
    R.pendencias.push({ id: t.id, titulo: t.titulo, resp: p.n, prazo: t.prazo, neg: t.neg ?? null, negNome: t.negNome ?? '', classe: cl, classeNome: CLASSES_PENDENCIA[cl], adiamentos: t.adiamentos ?? 0, prazoOriginal: t.prazoOriginal ?? t.prazo, tipo: 'fato',
      motivo: cl === 'sem_validade' ? 'O negócio ligado já foi encerrado.' : cl === 'terceiro' ? 'Adiada por depender de terceiro' + (t.ultimoMotivo ? ': ' + t.ultimoMotivo : '') + '.' : cl === 'decisao' ? 'Adiada ' + t.adiamentos + ' vezes: decidir se continua, muda de responsável ou é cancelada.' : cl === 'prioridade' ? (t.prioridade === 'alta' ? 'Prioridade alta.' : t.cardCritico ? 'Ligada a um negócio crítico.' : 'Atrasada há ' + t.diasAtraso + ' dias.') : 'Não concluída no prazo.' }); }
  const ordP: ClassePendencia[] = ['sem_validade', 'decisao', 'prioridade', 'terceiro', 'bloqueada', 'reagendar']; R.pendencias.sort((a, b) => ordP.indexOf(a.classe) - ordP.indexOf(b.classe));

  /* intervenções do gestor, priorizadas por relevância, urgência e impacto */
  const rec = (x: Omit<Recomendacao, 'grav' | 'tipo'>, grav: number) => { R.recomendacoes.push({ ...x, grav, tipo: 'recomendacao' }); };
  const sisAtiv = R.alertas.find(a => a.chave === 'sis:atividade'), cobertos = sisAtiv?.pessoas ?? [];
  for (const a of R.alertas) {
    const nm = a.p ? prim(a.p) : 'a equipe', rc = a.recorrencia ?? { seguidos: 0, desde: null, interv: null }, pS = a.p ? R.pessoas.find(x => x.n === a.p) : null;
    if (a.chave.startsWith('dia:') && pS && pS.sit === 'sem_registro') { rec({ chave: a.chave, problema: a.tit, evidencia: 'Nenhum registro de ' + nm + ' até o corte.' + (a.padrao ? ' ' + a.padrao : ''), consequencia: 'Se não houve execução, o dia vira atraso; se houve sem registro, os números do LAB ficam errados.', acao: 'Confirmar com ' + nm + ' o que foi feito e pedir o registro.', resp: 'gestor', prazo: 'hoje', indicador: 'registros do dia' }, a.padrao ? 3 : 2); continue; }
    if ((a.chave.startsWith('padrao:') || (a.chave.startsWith('dia:') && (a.padrao || rc.seguidos + 1 >= C.recorrente))) && a.p && cobertos.includes(a.p)) continue;   /* a causa provável é comum: a recomendação é a da equipe */
    if (a.chave.startsWith('viab:')) rec({ chave: a.chave, problema: a.tit, evidencia: a.aconteceu, consequencia: 'Sem decisão, a meta individual de ' + nm + ' fica inalcançável e o atraso cresce todo dia.', acao: 'Decidir: redistribuir leads, ampliar a capacidade, melhorar a conversão ou rever a meta (a meta não muda sozinha).', resp: 'gestor', prazo: 'amanhã', indicador: 'toques/dia × capacidade' }, 4.5);
    else if (a.chave.startsWith('conv:')) rec({ chave: a.chave, problema: a.tit, evidencia: a.evidencia, consequencia: 'Mais volume não converte em resultado: o esforço extra seria desperdiçado.', acao: a.teste ? 'Testar: ' + a.teste + '.' : 'Acompanhar 2 reuniões ou ligações de ' + nm + ' antes de cobrar volume.', resp: 'gestor com ' + nm, prazo: 'esta semana', indicador: a.tit.split(' de ')[0]! }, 3);
    else if (a.chave === 'sis:atividade') rec({ chave: a.chave, problema: a.tit, evidencia: a.evidencia + ' Pessoas: ' + (a.pessoas ?? []).join(', ') + '.', consequencia: 'Cobrar volume de cada um não resolve se a meta, a capacidade ou a entrada de leads estiverem fora do real.', acao: 'Revisar com a equipe a agenda, a capacidade e a entrada de leads; se a meta de atividade não cabe, rever a meta.', resp: 'gestor', prazo: 'esta semana', indicador: 'cumprimento do alvo diário da equipe' }, 3);
    else if (a.chave.startsWith('sis:')) rec({ chave: a.chave, problema: a.tit, evidencia: a.evidencia, consequencia: 'Cobrança individual não corrige causa comum (lead, oferta, preço ou processo).', acao: 'Investigar a passagem com a equipe (amostra de negócios perdidos nessa etapa) antes de cobrar indivíduos.', resp: 'gestor', prazo: 'esta semana', indicador: 'taxa da passagem na equipe' }, 3);
    else if (a.chave === 'noshow') rec({ chave: a.chave, problema: a.tit, evidencia: a.evidencia, consequencia: 'Agendamento em dia com comparecimento baixo reduz oportunidades sem aparecer no volume.', acao: 'Investigar o comparecimento (confirmação, tempo até a reunião, qualificação) antes de pedir mais prospecção.', resp: 'gestor', prazo: 'esta semana', indicador: 'agendada → realizada' }, rc.seguidos ? 3 : 2);
    else if (a.chave.startsWith('padrao:') || (a.chave.startsWith('dia:') && (a.padrao || rc.seguidos + 1 >= C.recorrente))) rec({ chave: a.chave, problema: a.tit, evidencia: ((a.contexto ?? '') + ' ' + a.evidencia).trim(), consequencia: 'Atraso que se acumula no ciclo e pressiona os próximos dias.', acao: 'Conversa de causa com ' + nm + ' (agenda, leads disponíveis, outras demandas) e um combinado verificável para amanhã.', resp: 'gestor com ' + nm, prazo: 'amanhã', indicador: 'cumprimento do alvo diário' }, 3);
    else if (a.chave.startsWith('adiadas:')) rec({ chave: a.chave, problema: a.tit, evidencia: a.aconteceu, consequencia: 'Compromisso que não sai do lugar e esconde uma decisão pendente.', acao: 'Revisar com ' + nm + ': manter com novo prazo realista, trocar de responsável ou cancelar com confirmação.', resp: 'gestor com ' + nm, prazo: 'amanhã', indicador: 'tarefas adiadas 2× ou mais = 0' }, 2);
    else if (a.chave === 'qtr:receita') rec({ chave: a.chave, problema: a.tit, evidencia: [a.aconteceu, 'meta ' + a.esperado, a.desvio].filter(Boolean).join(' · '), consequencia: 'O resultado do quarter fica abaixo do aprovado se nada mudar nos próximos meses.', acao: 'Levar à revisão do quarter: iniciativas, metas dos meses ou a própria meta, com motivo registrado.', resp: 'gestor', prazo: 'até o fechamento do mês', indicador: 'reprevisão do quarter × meta' }, 3);
    else if (a.chave.startsWith('qtr:')) rec({ chave: a.chave, problema: a.tit, evidencia: [a.aconteceu, a.contexto].filter(Boolean).join(' '), consequencia: /^qtr:gat:/.test(a.chave) ? 'O plano do quarter definiu este limite como sinal de revisão: seguir sem decidir é ignorar o próprio plano.' : /^qtr:marco:/.test(a.chave) ? 'Entrega atrasada adia o teste da hipótese e o efeito na receita do quarter.' : 'Sem o registro, o próximo passo do quarter fica sem base.',
      acao: /^qtr:gat:/.test(a.chave) ? 'Abrir o quarter (fase 6) e registrar a decisão sobre o gatilho.' : /^qtr:marco:/.test(a.chave) ? 'Atualizar a situação do marco no quarter (fase 4) ou replanejar com o responsável.' : /^qtr:(fech|enc):/.test(a.chave) ? 'Registrar o fechamento no quarter (fase 6).' : 'Planejar e publicar o próximo quarter.', resp: 'gestor', prazo: /^qtr:gat:/.test(a.chave) ? 'esta semana' : 'até a revisão semanal', indicador: 'plano do quarter' }, a.nivel + 0.5);
    else if (a.chave.startsWith('mes:')) rec({ chave: a.chave, problema: a.tit, evidencia: [a.aconteceu, a.esperado, a.desvio].filter(Boolean).join(' '), consequencia: 'A meta do ciclo fica em risco se o ritmo não mudar.', acao: 'Levar ao Planejamento (correção de rota): revisar premissas, ritmo ou meta pelo processo de aprovação.', resp: 'gestor', prazo: 'até a revisão semanal', indicador: 'projeção ajustada × meta' }, a.nivel + 1);
  }
  const pendDec = R.pendencias.filter(x => x.classe === 'decisao' || x.classe === 'sem_validade');
  if (pendDec.length) rec({ chave: 'pend:decisao', problema: pendDec.length + (pendDec.length === 1 ? ' pendência exige' : ' pendências exigem') + ' decisão (adiadas 2× ou mais, ou ligadas a negócio encerrado)', evidencia: pendDec.slice(0, 3).map(x => x.titulo + ' (' + prim(x.resp) + ')').join('; '), consequencia: 'Tarefas sem sentido ou travadas continuam aparecendo como compromisso.', acao: 'Decidir na lista de pendências: reagendar, trocar de responsável ou cancelar (com confirmação).', resp: 'gestor', prazo: 'amanhã', indicador: 'pendências que exigem decisão = 0' }, 2);
  const seen = new Set<string>(); R.recomendacoes = R.recomendacoes.filter(x => (seen.has(x.chave) ? false : (seen.add(x.chave), true))).sort((a, b) => b.grav - a.grav);
  for (const x of R.recomendacoes) { const e = R.errado.find(y => y.chave === x.chave); if (e && !e.acao) e.acao = x.acao; }
  for (const e of R.errado) if (!e.acao) { const a = R.alertas.find(y => y.chave === e.chave); e.acao = a && a.padrao && a.p && cobertos.includes(a.p) ? 'Faz parte da possível causa sistêmica da equipe: ver a recomendação da equipe em "O que exige sua intervenção".' : a?.acaoPadrao ?? ''; }

  /* metas do ciclo e do quarter: relação com a estratégia, sem alterar a meta */
  if (mes && mes.meta != null && mes.meta > 0) { const risco = R.alertas.some(a => a.chave.startsWith('mes:'));
    R.metas.push({ tipo: risco ? 'risco' : 'fato', obj: 'Receita de ' + (mes.nome ?? 'o ciclo'), situacao: BRL(mes.realizado) + ' contratados de ' + BRL(mes.meta), esperado: mes.esperado != null ? BRL(mes.esperado) + ' esperados até hoje (proporcional aos dias úteis)' : '', desvio: mes.esperado != null ? (mes.realizado >= mes.esperado ? '+' : '−') + BRL(Math.abs(mes.realizado - mes.esperado)) + ' contra o esperado até hoje' : '',
      projecao: mes.projecao != null ? BRL(mes.projecao) + ' (projeção ajustada do LAB)' : '', premissas: 'Projeção ajustada: ritmo do ciclo + pipeline ponderado pela chance histórica de cada etapa.', impacto: mes.projecao != null && mes.projecao < mes.meta ? 'Faltariam ' + BRL(mes.meta - mes.projecao) + ' para a meta no ritmo atual.' : mes.projecao != null ? 'No ritmo atual a meta é alcançada.' : '', acao: risco ? 'Levar à correção de rota do Planejamento; o relatório não altera a meta.' : '' }); }
  else if (F.plano?.status === 'ativo') R.limitacoes.push({ tipo: 'fato', txt: 'O ciclo não tem meta de receita da operação: o relatório não liga os desvios a uma meta do mês.' });
  if (qt && qt.meta > 0) R.metas.push({ tipo: qt.risco ? 'risco' : 'fato', obj: 'Receita no ' + (qt.nome ?? 'quarter'), situacao: BRL(qt.realizado) + ' contratados de ' + BRL(qt.meta) + ' (meta vigente do quarter' + (qt.metaOriginal != null && qt.metaOriginal !== qt.meta ? '; original ' + BRL(qt.metaOriginal) : '') + ')',
    esperado: '', desvio: qt.projecao != null ? (qt.projecao >= qt.meta ? '+' : '−') + BRL(Math.abs(qt.projecao - qt.meta)) + ' da projeção contra a meta' : '', projecao: qt.projecao != null ? BRL(qt.projecao) + ' (reprevisão do quarter' + (qt.impactoAtrasos ? '; ' + BRL(qt.projecaoComAtrasos) + ' descontando iniciativas atrasadas' : '') + ')' : '',
    premissas: qt.premissas ?? 'Programa de ciclos do LAB.', impacto: qt.leitura ?? '', acao: qt.risco ? 'Levar à revisão do quarter: a meta não muda sozinha.' : '' });
  else R.limitacoes.push({ tipo: 'fato', txt: 'Sem plano do quarter publicado: o relatório liga os desvios só à meta do ciclo.' });

  /* resumo */
  const comp = R.comparacoes.filter(x => x.status !== 'sem_dado' && x.status !== 'sem_meta'), ating = comp.filter(x => x.status === 'atingido').length;
  const crit3 = R.alertas.filter(a => a.nivel >= 3).length, crit2 = R.alertas.filter(a => a.nivel === 2).length;
  const st = !pes.length ? 'sem_dado' : crit3 ? 'critico' : crit2 || comp.some(x => x.status === 'abaixo') ? 'atencao' : 'bom';
  const topErr = R.errado[0], topAv = R.avancos[0] ?? null, topRisco = R.alertas.find(a => a.tipo === 'risco') ?? null, topRec = R.recomendacoes[0] ?? null;
  R.resumo = { status: st, statusNome: { bom: 'Dia dentro do previsto', atencao: 'Dia com desvios que pedem atenção', critico: 'Dia com desvio crítico', sem_dado: 'Sem dados para avaliar' }[st],
    objetivos: { atingidos: ating, total: comp.length }, desvio: topErr ? topErr.tit : '', avanco: topAv ? (topAv.txt ?? et(topAv.k)[1] + ': ' + (topAv.nome ?? '')) + ' (' + topAv.pessoas.map(prim).join(' e ') + ')' : '',
    risco: topRisco ? topRisco.tit : '', decisao: topRec ? topRec.acao : '', metaMes: R.metas[0] && R.metas[0].tipo === 'risco' ? R.metas[0].impacto || R.metas[0].situacao : '',
    pessoas: { total: ativos.length, atencao: ativos.filter(x => x.sit !== 'em_dia' && x.sit !== 'sem_meta').length } };
  return R;
}

/* a essência do relatório (o que entra no hash): comparações, alertas, situação das pessoas e pendências. Ruído fora: qualquer recálculo com a mesma essência é "sem mudança" */
export function essenciaDoRelatorio(R: Relatorio) {
  return { c: R.comparacoes.map(x => [x.k, x.periodo, x.previsto, x.realizado]), a: R.alertas.map(x => [x.chave, x.nivel, x.contexto ?? '']), p: R.pessoas.map(p => [p.n, p.sit]), pd: R.pendencias.map(x => [x.id, x.classe]) };
}
/* complemento: o que mudou entre o relatório original e um novo cálculo do mesmo dia */
export function diferencas(A: Pick<Relatorio, 'comparacoes' | 'chaves'> | null, B: Pick<Relatorio, 'comparacoes' | 'chaves'> | null): string[] {
  const out: string[] = [], idx = (L?: Comparacao[]) => { const m: Record<string, Comparacao> = {}; for (const c of L ?? []) m[c.k + ':' + c.periodo + ':' + (c.escopo ?? '')] = c; return m; }, a = idx(A?.comparacoes), b = idx(B?.comparacoes);
  for (const k of Object.keys(b)) { const x = a[k], y = b[k]!; if (!x) { out.push(y.nome + ': novo indicador'); continue; } if (x.realizado !== y.realizado || x.previsto !== y.previsto) out.push(y.nome + ': ' + N(x.realizado) + '/' + N(x.previsto) + ' → ' + N(y.realizado) + '/' + N(y.previsto)); }
  const ca = A?.chaves ?? [], cb = B?.chaves ?? [];
  for (const k of cb.filter(k => !ca.includes(k))) out.push('alerta novo: ' + k); for (const k of ca.filter(k => !cb.includes(k))) out.push('alerta saiu: ' + k);
  return out;
}
/* o que o tique de 15 minutos faz agora: nada, gerar ou complementar (regra pura; testes/daily_worker.test.js) */
export const HORA_FECHAMENTO = '17:30', HORA_COMPLEMENTO = '23:30', MAX_FALHAS = 4;
export function decidirTique(t: { existe: boolean; rodando?: boolean; sem_expediente?: boolean; falhas?: number; complementado?: boolean; cfg?: { hora?: string; ativo?: boolean } | null } | null, hm: string): 'agendado' | 'complemento' | null {
  const cfg = { hora: HORA_FECHAMENTO, ativo: true, ...(t?.cfg ?? {}) };
  if (!t || cfg.ativo === false) return null;
  if (t.rodando || t.sem_expediente) return null;
  if (!t.existe) return hm >= cfg.hora && (t.falhas ?? 0) < MAX_FALHAS ? 'agendado' : null;
  return hm >= HORA_COMPLEMENTO && !t.complementado ? 'complemento' : null;
}
/* hora e data locais no fuso (o Worker roda em UTC) */
export function agoraLocal(fuso: string, agora: Date) {
  const p: Record<string, string> = {};
  for (const x of new Intl.DateTimeFormat('en-CA', { timeZone: fuso, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(agora)) p[x.type] = x.value;
  return { iso: p.year + '-' + p.month + '-' + p.day, hm: p.hour + ':' + p.minute };
}
