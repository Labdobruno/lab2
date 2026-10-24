/* Motor do plano do dia: regras puras (sem banco, sem relógio), portadas do LAB V1 (plano_dia_motor.js, versão 2026-10-09.1)
   com os 40 testes de plano_dia.test.js como contrato. Três tipos de afirmação, sempre rotulados:
     'proj' projeção matemática (volume × taxa conhecida) · 'hist' evidência histórica (observada, com amostra) · 'hip' hipótese (efeito ainda não medido). */
import { wilson } from '@lab/metricas';

export const CLASSES = ['critica', 'alta', 'normal', 'estrategica'] as const;
export type Classe = (typeof CLASSES)[number];
export const NOME_CLASSE: Record<Classe, string> = { critica: 'Crítica', alta: 'Alta', normal: 'Normal', estrategica: 'Estratégica' };
export type Evidencia = 'proj' | 'hist' | 'hip';
export const NOME_EVIDENCIA: Record<Evidencia, string> = { proj: 'Projeção matemática', hist: 'Evidência histórica', hip: 'Hipótese de melhoria' };
export const rank = (c: Classe | string) => { const i = CLASSES.indexOf(c as Classe); return i < 0 ? 9 : i; };

/* critérios configuráveis pelo gestor (o pack pode mudar; a tela mostra padrão × configurado) */
export interface Criterios { parado: number; proposta: number; novoLeadHoras: number; janelaRecup: number; minN: number; pctOk: number; diasPadrao: number; janelaConv: number; maturacaoConv: number }
export const CRITERIOS_PADRAO: Criterios = { parado: 5, proposta: 3, novoLeadHoras: 24, janelaRecup: 5, minN: 10, pctOk: 0.9, diasPadrao: 10, janelaConv: 90, maturacaoConv: 30 };
export const criterios = (c?: Partial<Criterios> | null): Criterios => ({ ...CRITERIOS_PADRAO, ...(c ?? {}) });

/* ---------- §4: insuficiência de resultado × atraso operacional ---------- */
export type TipoQuadrante = 'sem_dado' | 'em_dia' | 'resultado' | 'operacional' | 'ambos';
export interface Quadrante { tipo: TipoQuadrante; pa: number | null; pr: number | null; tit: string; txt: string }
export function quadrante(ativ: { meta: number; feito: number } | null, res: { meta: number; feito: number } | null, crit?: Partial<Criterios>): Quadrante {
  const C = criterios(crit), r = (x: { meta: number; feito: number } | null) => (x && x.meta > 0 ? x.feito / x.meta : null), pa = r(ativ), pr = r(res);
  if (pa == null && pr == null) return { tipo: 'sem_dado', pa, pr, tit: 'Sem meta para comparar', txt: 'Sem metas no plano do ciclo para esta pessoa.' };
  const aOk = pa == null ? null : pa >= C.pctOk, rOk = pr == null ? null : pr >= C.pctOk;
  if (aOk !== false && rOk !== false) return { tipo: 'em_dia', pa, pr, tit: 'Dentro do plano', txt: 'Atividade e resultado acompanham o plano até hoje.' };
  if (aOk !== false && rOk === false) return { tipo: 'resultado', pa, pr, tit: 'Insuficiência de resultado', txt: 'A produção está no ritmo, mas o resultado não acompanha. O problema provável está na conversão ou no tempo de ciclo, não no volume de esforço.' };
  if (aOk === false && rOk !== false) return { tipo: 'operacional', pa, pr, tit: 'Atraso operacional', txt: 'O resultado está em dia, mas a atividade está abaixo do necessário para sustentar os próximos dias e o próximo ciclo.' };
  return { tipo: 'ambos', pa, pr, tit: 'Atraso operacional e de resultado', txt: 'Atividade e resultado abaixo do plano. Recuperar o volume de atividade é a primeira alavanca; a conversão vem em seguida.' };
}

/* ---------- §3.3: a meta de hoje cabe na capacidade? ---------- */
export type StatusViabilidade = 'sem_cap' | 'ok' | 'janela' | 'ciclo' | 'inviavel';
export interface Viabilidade { st: StatusViabilidade; txt: string; cap: number | null; alvoHoje: number; ritmoJanela: number; ritmoFim: number; janela: number; deficit?: number }
export function viabilidade(x: { falta: number; metaHoje: number; atraso: number; cap: number | null; metaRestante?: number; diasRest?: number }, crit?: Partial<Criterios>): Viabilidade {
  const C = criterios(crit), cap = Number(x.cap) > 0 ? Number(x.cap) : null, dr = Math.max(0, x.diasRest || 0);
  const janela = Math.max(1, Math.min(C.janelaRecup, dr + 1));
  const ritmoJanela = (x.metaHoje || 0) + (x.atraso || 0) / janela;                            // zerar o atraso em até N dias úteis
  const ritmoFim = ((x.metaRestante || 0) + (x.metaHoje || 0) + (x.atraso || 0)) / (dr + 1);    // ou espalhar até o fim do ciclo
  const base = { cap, alvoHoje: x.falta || 0, ritmoJanela, ritmoFim, janela };
  if (cap == null) return { ...base, st: 'sem_cap', txt: 'Capacidade diária não informada: o LAB não consegue dizer se a recuperação cabe na agenda.' };
  if (x.falta <= cap) return { ...base, st: 'ok', txt: `O alvo de hoje cabe na capacidade (${Math.round(cap)}/dia).` };
  if (ritmoJanela <= cap) return { ...base, st: 'janela', txt: `Zerar todo o atraso hoje não cabe na capacidade (${Math.round(cap)}/dia). Recuperando em ${janela} dias úteis, o ritmo necessário é ${Math.ceil(ritmoJanela)}/dia, que cabe.` };
  if (ritmoFim <= cap) return { ...base, st: 'ciclo', txt: `O atraso só cabe se for espalhado até o fim do ciclo: ${Math.ceil(ritmoFim)}/dia (capacidade ${Math.round(cap)}).` };
  return { ...base, st: 'inviavel', deficit: ritmoFim - cap, txt: `Recuperação inviável com a capacidade atual: mesmo espalhando até o fim do ciclo seriam ${Math.ceil(ritmoFim)}/dia para uma capacidade de ${Math.round(cap)}. Decisão gerencial: redistribuir, aumentar a capacidade, melhorar a conversão (menos volume por resultado) ou rever a meta.` };
}

/* ---------- §6: negócio negligenciado ---------- */
export interface CardEntrada {
  etapaIdx?: number; diasSemAtiv?: number; diasNaEtapa?: number; refEtapa?: number | null; valor?: number; pv?: number | null;
  semProximo?: boolean; tarefaVencida?: boolean; proposta?: boolean; reuniaoSemContinuidade?: boolean; semHistorico?: boolean;
}
export interface Negligencia { alerta: boolean; motivos: string[]; ve?: number; score?: number; classe?: Classe; acao?: string; prazo?: string }
export function negligencia(c: CardEntrada, crit?: Partial<Criterios>): Negligencia {
  const C = criterios(crit), m: string[] = [];
  const semAtiv = c.diasSemAtiv ?? 0;
  if (c.tarefaVencida) m.push('tarefa vencida ligada ao negócio');
  if (c.semProximo) m.push('sem próximo passo (nenhuma tarefa, agendamento ou contato futuro)');
  if (semAtiv >= C.parado) m.push(`sem atividade registrada há ${Math.floor(semAtiv)} dias`);
  if ((c.refEtapa ?? 0) > 0 && (c.diasNaEtapa ?? 0) > (c.refEtapa ?? 0)) m.push(`na etapa há ${Math.floor(c.diasNaEtapa ?? 0)} dias (referência ${c.refEtapa})`);
  if (c.proposta && semAtiv >= C.proposta) m.push(`proposta/negociação sem acompanhamento há ${Math.floor(semAtiv)} dias`);
  if (c.reuniaoSemContinuidade) m.push('reunião realizada sem continuidade registrada');
  if (c.semHistorico) m.push('histórico insuficiente para avaliar o estado do negócio');
  if (!m.length) return { alerta: false, motivos: [] };
  /* a idade sozinha não decide: pesa valor esperado, etapa e o tipo de falha */
  const ve = (Number(c.valor) || 0) * ((c.pv ?? 0) > 0 ? (c.pv as number) : 0.05);
  const urg = 1 + Math.min(3, semAtiv / Math.max(1, C.parado)) + (c.semProximo ? 1 : 0) + (c.tarefaVencida ? 1 : 0) + (c.proposta ? 1 : 0);
  const classe: Classe = (c.proposta || c.tarefaVencida) && (c.semProximo || semAtiv >= C.parado) ? 'critica' : c.semProximo || semAtiv >= C.parado ? 'alta' : 'normal';
  const acao = c.tarefaVencida ? 'Resolver a tarefa vencida ou replanejar com justificativa' : c.proposta ? 'Falar com o cliente sobre a proposta e registrar a decisão ou o próximo passo com data'
    : c.reuniaoSemContinuidade ? 'Registrar o resultado da reunião e marcar o próximo passo' : c.semProximo ? 'Definir o próximo passo com data (tarefa ou agendamento)' : 'Fazer contato e registrar a atividade';
  return { alerta: true, motivos: m, ve, score: ve * urg + urg, classe, acao, prazo: classe === 'critica' ? 'hoje' : classe === 'alta' ? 'hoje ou amanhã' : 'nesta semana' };
}

/* ---------- §7: ordem de execução: classe → quem habilita mais → horário → valor ---------- */
export function ordenar<T extends { classe: Classe | string; score?: number; habilita?: number; hora?: string | null }>(itens: T[]): T[] {
  return itens.slice().sort((a, b) => rank(a.classe) - rank(b.classe) || (b.habilita || 0) - (a.habilita || 0) || (a.hora && b.hora ? String(a.hora).localeCompare(String(b.hora)) : 0) || (b.score || 0) - (a.score || 0));
}

/* ---------- §10: executar × não executar, e a carga de amanhã ----------
   Regra oficial: amanhã = meta de amanhã + ⌈atraso de amanhã ÷ janela de amanhã⌉ */
export interface EtapaCenario { k: string; nome: string; falta: number; metaHoje: number; feito: number; alvo: number; atrasoTotal: number; metaAmanha: number; jAmanha: number; tx: number | null; para: string }
export interface Pendencias { tarefasVencidas?: number; tarefasHoje?: number; cadVencidos?: number; semCad?: number; semProximo?: number }
export interface LadoCenario { pendencias: number; etapas: Array<{ k: string; nome: string; planejado: number; adicional: number; amanha: number; atraso: number }>; tarefasAmanha: number; esperado: Array<{ k: string; de: number; para: string; n: number; tx: number }>; sobrecarga?: boolean; perdido?: unknown; semProximo?: number }
export function cenarios(x: { etapas: EtapaCenario[]; pend?: Pendencias; amanha?: { tarefas?: number; reunioes?: number; cadPrevistos?: number }; cap?: number | null }): { exec: LadoCenario; nao: LadoCenario; cap: number | null; amanha: { tarefas?: number; reunioes?: number; cadPrevistos?: number } } {
  const E = x.etapas || [], P = x.pend || {}, A = x.amanha || {};
  const esperado = E.filter(e => e.falta > 0 && (e.tx ?? 0) > 0).map(e => ({ k: e.k, de: e.falta, para: e.para, n: e.falta * (e.tx as number), tx: e.tx as number }));
  const pendHoje = (P.tarefasVencidas || 0) + (P.tarefasHoje || 0) + (P.cadVencidos || 0) + (P.semCad || 0);
  const amanha = (e: EtapaCenario, feitoFinal: number) => {
    const atr = Math.max(0, (e.atrasoTotal || 0) + (e.metaHoje || 0) - feitoFinal), j = Math.max(1, e.jAmanha || 1), parc = atr > 1e-9 ? Math.ceil(atr / j - 1e-9) : 0;
    return { k: e.k, nome: e.nome, planejado: e.metaAmanha || 0, adicional: parc, amanha: (e.metaAmanha || 0) + parc, atraso: atr };
  };
  const exec: LadoCenario = { pendencias: 0, etapas: E.map(e => amanha(e, Math.max(e.feito || 0, e.alvo || 0))), tarefasAmanha: A.tarefas || 0, esperado };
  const nao: LadoCenario = { pendencias: pendHoje, etapas: E.map(e => amanha(e, e.feito || 0)), tarefasAmanha: (A.tarefas || 0) + (P.tarefasVencidas || 0) + (P.tarefasHoje || 0), esperado, perdido: esperado, semProximo: P.semProximo || 0 };
  const cap = Number(x.cap) > 0 ? Number(x.cap) : null;
  const cont = (L: LadoCenario['etapas'], k: string) => (L.find(e => e.k === k) || { amanha: 0 }).amanha;
  const kDiaria = E[0]?.k ?? 'tentativa';
  exec.sobrecarga = cap != null && cont(exec.etapas, kDiaria) > cap;
  nao.sobrecarga = cap != null && cont(nao.etapas, kDiaria) > cap;
  return { exec, nao, cap, amanha: A };
}

/* ---------- §10.6: padrões recorrentes ---------- */
export interface Padrao { recorrente: boolean; n: number; abaixo: number; seguidos?: number; tend?: number | null }
export function padrao(dias: Array<{ iso: string; meta: number; feito: number }>, crit?: Partial<Criterios>): Padrao {
  const C = criterios(crit), D = (dias || []).filter(d => d.meta > 0);
  if (D.length < 5) return { recorrente: false, n: D.length, abaixo: 0 };
  const abaixo = D.filter(d => d.feito < d.meta * C.pctOk).length;
  let seguidos = 0; for (let i = D.length - 1; i >= 0 && D[i]!.feito < D[i]!.meta * C.pctOk; i--) seguidos++;
  const meia = Math.floor(D.length / 2), pc = (L: typeof D) => { const m = L.reduce((a, d) => a + d.meta, 0); return m ? L.reduce((a, d) => a + d.feito, 0) / m : null; };
  const ant = pc(D.slice(0, meia)), rec = pc(D.slice(meia));
  return { recorrente: abaixo >= Math.ceil(D.length * 0.6), n: D.length, abaixo, seguidos, tend: ant != null && rec != null ? rec - ant : null };
}

/* ---------- §8: gargalo ----------
   v = volumes da pessoa no ciclo (fluxo no período); h = os mesmos volumes nos 90 dias anteriores; plano = taxa embutida nas metas; eq = taxa da equipe */
export const PASSOS: ReadonlyArray<readonly [string, string, string]> = [
  ['tentativa', 'contato', 'Tentativa → contato efetivo'], ['contato', 'agendamento', 'Contato efetivo → reunião agendada'], ['tentativa', 'agendamento', 'Tentativa → reunião agendada'],
  ['agendamento', 'reuniao_realizada', 'Agendada → realizada (comparecimento)'], ['reuniao_realizada', 'oportunidades', 'Realizada → oportunidade'], ['oportunidades', 'vendas', 'Oportunidade → venda'],
];
export interface Hipotese { prob: string; causas: string[]; falta: string; teste: string; ind: string; bib: string | null }
export const HIPOTESES: Record<string, Hipotese> = {
  atividade: { prob: 'Poucas tentativas de contato feitas', causas: ['volume de atividade abaixo do plano', 'tempo consumido por outras tarefas', 'falta de leads para trabalhar'], falta: 'tempo gasto por atividade (não registrado)', teste: 'bloquear duas janelas fixas de prospecção por dia durante uma semana e comparar o volume', ind: 'tentativas por dia', bib: 'H-COM-008' },
  'tentativa>contato': { prob: 'Muitas tentativas, poucos contatos efetivos', causas: ['lista ou base de contatos de baixa qualidade', 'canal ou horário de contato', 'abordagem inicial'], falta: 'resultado de cada tentativa por canal e horário', teste: 'comparar a taxa de contato efetivo por horário e canal nas próximas duas semanas', ind: 'contatos efetivos por tentativa', bib: 'H-COM-004' },
  'contato>agendamento': { prob: 'Muitos contatos efetivos, poucos agendamentos', causas: ['qualificação', 'proposta de valor na conversa', 'objeção não tratada'], falta: 'motivo de não agendar registrado na conversa', teste: 'ouvir 3 conversas e aplicar o roteiro de qualificação por duas semanas', ind: 'reuniões por contato efetivo', bib: 'H-COM-004' },
  'tentativa>agendamento': { prob: 'Muitas tentativas, poucos agendamentos', causas: ['qualidade da lista', 'abordagem e qualificação', 'canal ou horário'], falta: 'resultado de cada tentativa registrado (atendeu ou não)', teste: 'registrar o resultado de toda tentativa por uma semana para separar "não atendeu" de "atendeu e não agendou"', ind: 'reuniões por tentativa', bib: 'H-COM-004' },
  'agendamento>reuniao_realizada': { prob: 'Muitas reuniões agendadas, poucas realizadas', causas: ['falta de confirmação', 'agendamento sem compromisso real do cliente', 'intervalo longo entre agendar e reunir'], falta: 'confirmação registrada antes da reunião', teste: 'confirmar toda reunião na véspera e 1 h antes por duas semanas e comparar o comparecimento', ind: 'comparecimento', bib: null },
  'reuniao_realizada>oportunidades': { prob: 'Muitas reuniões realizadas, poucas oportunidades', causas: ['qualificação antes da reunião', 'diagnóstico na reunião', 'aderência do lead à oferta'], falta: 'motivo de não avançar registrado após a reunião', teste: 'auditar 2 reuniões gravadas ou acompanhar 2 reuniões ao vivo', ind: 'oportunidades por reunião realizada', bib: null },
  'oportunidades>vendas': { prob: 'Muitas oportunidades, poucas vendas', causas: ['condução da negociação e follow-up', 'preço ou condição de pagamento', 'autoridade do decisor', 'qualidade das oportunidades'], falta: 'motivo de perda preenchido em todo negócio perdido', teste: 'follow-up estruturado e revisão semanal das negociações abertas', ind: 'vendas por oportunidade', bib: 'H-COM-003' },
};
export interface Gargalo extends Partial<Hipotese> { chave: string; nome: string; real: number; ref: number; refTxt: string; evid: string; conf: string; grav: number; hist?: number | null; plano?: number | null; equipe?: number | null; n?: number; k?: number; ci?: [number, number] | null }
export type Volumes = Record<string, number>;
export function gargalo(v: Volumes, h: Volumes | null, plano: Record<string, number> | null, eq: Record<string, { k: number; n: number }> | null, ativ: { meta: number; feito: number } | null, crit?: Partial<Criterios>): Gargalo[] {
  const C = criterios(crit), out: Gargalo[] = [], temConv = (v.contato || 0) > 0 || !!(h && (h.contato || 0) > 0);
  if (ativ && ativ.meta > 0 && ativ.feito < ativ.meta * 0.8) out.push({ chave: 'atividade', nome: 'Volume de atividade', real: ativ.feito / ativ.meta, ref: 1, refTxt: 'meta até hoje', evid: `Feito ${Math.round(ativ.feito)} de ${Math.round(ativ.meta)} até hoje.`, conf: 'alta (contagem direta)', grav: (ativ.meta - ativ.feito) / ativ.meta, ...HIPOTESES.atividade });
  for (const p of PASSOS) {
    const chave = `${p[0]}>${p[1]}`;
    if (chave === 'tentativa>agendamento' && temConv) continue;
    if ((chave === 'tentativa>contato' || chave === 'contato>agendamento') && !temConv) continue;
    const n = v[p[0]] || 0, k = v[p[1]] || 0; if (n < 1) continue;
    const real = k / n, w = wilson(Math.min(k, n), n), ci: [number, number] | null = w ? [w.baixo, w.alto] : null, hn = h ? h[p[0]] || 0 : 0, hist = hn >= C.minN ? ((h as Volumes)[p[1]] || 0) / hn : null;
    const pl = plano && (plano[chave] ?? 0) > 0 ? (plano[chave] as number) : null, e = eq && eq[chave] && eq[chave].n >= C.minN ? eq[chave].k / eq[chave].n : null;
    const ref = pl != null ? pl : hist != null ? hist : e, refTxt = pl != null ? 'plano' : hist != null ? 'seu histórico de 90 dias' : e != null ? 'equipe' : '';
    if (ref == null || real >= ref * 0.9) continue;
    const conf = n < 5 ? 'baixa (amostra muito pequena)' : ci && ci[1] < ref ? 'alta (mesmo o melhor caso da faixa de 95% fica abaixo da referência)' : n >= C.minN ? 'média' : 'baixa (amostra pequena)';
    out.push({ chave, nome: p[2], real, ref, refTxt, hist, plano: pl, equipe: e, n, k, ci, conf, grav: (ref - real) / ref,
      evid: `${k} de ${n} no ciclo (${Math.round(real * 100)}%) contra ${Math.round(ref * 100)}% (${refTxt})${hist != null && refTxt !== 'seu histórico de 90 dias' ? `; seu histórico: ${Math.round(hist * 100)}%` : ''}${e != null && refTxt !== 'equipe' ? `; equipe: ${Math.round(e * 100)}%` : ''}.`, ...(HIPOTESES[chave] ?? {}) });
  }
  return out.sort((a, b) => b.grav - a.grav);
}
/* gargalo sistêmico: a mesma passagem abaixo da referência em várias pessoas */
export function sistemico(porPessoa: Record<string, Array<{ chave: string; nome: string }>>, min = 2): Array<{ chave: string; nome: string; pessoas: string[] }> {
  const m: Record<string, { chave: string; nome: string; pessoas: string[] }> = {};
  for (const n of Object.keys(porPessoa)) for (const g of porPessoa[n] ?? []) (m[g.chave] = m[g.chave] || { chave: g.chave, nome: g.nome, pessoas: [] }).pessoas.push(n);
  return Object.values(m).filter(x => x.pessoas.length >= min).sort((a, b) => b.pessoas.length - a.pessoas.length);
}

/* ---------- §9: benefício esperado de produzir um volume (cadeia de taxas; para na taxa ausente) ---------- */
export function beneficio(qtd: number, cadeia: Array<{ para: string; tx: number | null; fonte?: string; n?: number }>): Array<{ para: string; n: number; tx: number; fonte?: string }> {
  let x = qtd; const passos: Array<{ para: string; n: number; tx: number; fonte?: string }> = [];
  for (const p of cadeia || []) { if (!((p.tx ?? 0) > 0)) break; x *= p.tx as number; passos.push({ para: p.para, n: x, tx: p.tx as number, ...(p.fonte ? { fonte: p.fonte } : {}) }); }
  return passos;
}

/* ---------- capacidade observada: o que a pessoa já faz num dia bom (percentil 80 dos dias com atividade; mínimo 5 dias) ---------- */
export function capacidadeObservada(toquesPorDia: number[]): { v: number | null; n: number; mediana?: number; max?: number } {
  const A = (toquesPorDia || []).filter(n => n > 0).sort((a, b) => a - b);
  if (A.length < 5) return { v: null, n: A.length };
  const q = (p: number) => { const i = (A.length - 1) * p, k = Math.floor(i); return A[k]! + (A[Math.min(k + 1, A.length - 1)]! - A[k]!) * (i - k); };
  return { v: Math.round(q(0.8)), n: A.length, mediana: q(0.5), max: A[A.length - 1] };
}
