/* Plano do ciclo: consistência das metas, modelo direto e cenários por premissa, replanejamento com corte, fallback de taxa, sugestão por pessoa,
   responsabilidade por indicador, necessário × viável × déficit e programa de ciclos. Portado do LAB V1 (lab_objetivos.js; testes/lab_objetivos.test.js é o contrato).
   Operadores de objetivo, critérios, classe do desvio, veredito, ponte, distribuição e mínimo diário já vivem em @lab/dia. */
import { brl, num, pct, TX } from './quarter.js';

export const VERSAO_PLANO = 1;
const pp = (v: number | null | undefined) => (v == null || !isFinite(v) ? '—' : (v > 0 ? '+' : '') + (Math.round(v * 1000) / 10).toLocaleString('pt-BR') + ' p.p.');
export const NOME_TAXA: Record<string, string> = { [TX.oportVenda]: 'Oportunidade → venda', [TX.realOport]: 'Reunião realizada → oportunidade', [TX.leadAg]: 'Lead → reunião agendada', [TX.leadVenda]: 'Lead → venda', [TX.agReal]: 'Reunião agendada → realizada' };
/* classificação do indicador: resultado, direcionador, eficiência (taxa), restrição econômica, capacidade */
export const TIPO_INDICADOR: Record<string, 'resultado' | 'restricao' | 'direcionador' | 'eficiencia' | 'capacidade'> = {
  receita: 'resultado', vendas: 'resultado', ticket: 'resultado', margem: 'restricao', leads: 'direcionador', contato: 'direcionador', tentativa: 'direcionador', agendamento: 'direcionador', reuniao_realizada: 'direcionador', oportunidades: 'direcionador', proposta_enviada: 'direcionador',
  [TX.leadAg]: 'eficiencia', [TX.realOport]: 'eficiencia', [TX.oportVenda]: 'eficiencia', [TX.leadVenda]: 'eficiencia', [TX.agReal]: 'eficiencia', cap_reunioes: 'capacidade', cap_contatos: 'capacidade',
};

/* ---------- consistência das metas: as metas são compatíveis entre si e com as premissas? Nunca altera as metas ---------- */
export interface Objetivo { ind: string; op?: string; alvo?: unknown; alvo2?: unknown; escopo?: string; ref?: string }
export interface PremissasPlano { ticket?: number | null; margem?: number | null; taxas?: Record<string, number | null | undefined>; capacidade?: Record<string, number | null | undefined>; n?: Record<string, number | null | undefined> }
export interface Achado { tipo: 'incompativel' | 'exige_melhoria' | 'sem_definicao' | 'sem_dado'; kpis: string[]; texto: string; numeros?: Record<string, number | null> }
export function consistencia(objs: Objetivo[] | null | undefined, prem?: PremissasPlano | null) {
  const P = prem ?? {}, out: Achado[] = [], T = P.taxas ?? {}, cap = P.capacidade ?? {}, N = P.n ?? {}, L = objs ?? [];
  const get = (ind: string, op?: string) => L.find(o => o && o.ind === ind && (o.escopo ?? 'empresa') === 'empresa' && (!op || (o.op ?? 'atingir') === op)) ?? null;
  const alvo = (o: Objetivo | null) => (o ? num(o.alvo) : null);
  const R = get('receita'), V = get('vendas'), TK = get('ticket'), MG = get('margem'), taxas = [TX.oportVenda, TX.realOport, TX.leadAg, TX.leadVenda].map(k => get(k)).filter((o): o is Objetivo => !!o);
  for (const o of L) if (o && o.ind.includes('>') && !TIPO_INDICADOR[o.ind]) out.push({ tipo: 'sem_definicao', kpis: [o.ind], texto: `A conversão "${o.ind}" não aponta para uma definição oficial (etapa inicial e final). Escolha uma do catálogo.` });
  const r = alvo(R), v = alvo(V), tkMin = TK && (TK.op === 'min' || (TK.op ?? 'atingir') === 'atingir') ? alvo(TK) : null, tkMax = TK && TK.op === 'max' ? alvo(TK) : null, tkRef = num(P.ticket);
  if (r != null && v != null && tkMin != null && v * tkMin > r * (1 + 1e-9) && (R!.op ?? 'atingir') === 'atingir')
    out.push({ tipo: 'incompativel', kpis: ['receita', 'vendas', 'ticket'], texto: `Com ${v} vendas a pelo menos ${brl(tkMin)} a receita fica em no mínimo ${brl(v * tkMin)}, acima da meta de receita de ${brl(r)}. Ajuste uma das três.`, numeros: { receitaMin: v * tkMin, receita: r } });
  if (r != null && v != null && tkMax != null && v * tkMax < r)
    out.push({ tipo: 'incompativel', kpis: ['receita', 'vendas', 'ticket'], texto: `Com ${v} vendas a no máximo ${brl(tkMax)} a receita chega a ${brl(v * tkMax)}, abaixo da meta de ${brl(r)}.`, numeros: { receitaMax: v * tkMax, receita: r } });
  const tkUsado = tkMin ?? tkRef, vendasNec = r != null && tkUsado != null && tkUsado > 0 ? Math.ceil(r / tkUsado) : v;
  if (r != null && tkUsado == null) out.push({ tipo: 'sem_dado', kpis: ['receita', 'ticket'], texto: 'Não há ticket (meta nem histórico) para converter a meta de receita em vendas.' });
  if (r != null && v != null && tkUsado != null && tkUsado > 0 && vendasNec != null && vendasNec > v && (V!.op ?? 'atingir') !== 'min')
    out.push({ tipo: 'incompativel', kpis: ['receita', 'vendas'], texto: `Para ${brl(r)} com ticket ${brl(tkUsado)} são necessárias ${vendasNec} vendas; a meta de vendas é ${v}.`, numeros: { vendasNec, vendas: v } });
  if (tkMin != null && tkRef != null && tkMin > tkRef * 1.0001) out.push({ tipo: 'exige_melhoria', kpis: ['ticket'], texto: `Ticket mínimo de ${brl(tkMin)} acima do histórico de ${brl(tkRef)}${N.ticket ? ` (n=${N.ticket})` : ''}: +${pct(tkMin / tkRef - 1)}. Trate como hipótese e diga de onde vem a melhoria (mix, preço, segmento).`, numeros: { alvo: tkMin, ref: tkRef, delta: tkMin / tkRef - 1 } });
  for (const o of taxas) {
    const h = num(T[o.ind]), a = num(o.alvo); if (a == null) continue;
    if (h != null && a > h * 1.0001 && (o.op ?? 'atingir') !== 'max') { const d = a - h; out.push({ tipo: 'exige_melhoria', kpis: [o.ind], texto: `${NOME_TAXA[o.ind] ?? o.ind} de ${pct(a)} acima do histórico de ${pct(h)}${N[o.ind] ? ` (n=${N[o.ind]})` : ''} (${pp(d)}). É uma melhoria assumida, não um dado.`, numeros: { alvo: a, ref: h } }); }
    if (o.ind === TX.oportVenda && vendasNec != null && a > 0) { const oportNec = Math.ceil(vendasNec / a), c = num(cap.oportunidades); if (c != null && oportNec > c) out.push({ tipo: 'incompativel', kpis: [TX.oportVenda, 'vendas'], texto: `${vendasNec} vendas a ${pct(a)} pedem ${oportNec} oportunidades; a capacidade/pipeline informado é ${c}.`, numeros: { oportNec, cap: c } }); }
  }
  const mg = MG ? alvo(MG) : null, mgRef = num(P.margem);
  if (mg != null && mgRef != null && (MG!.op ?? 'min') !== 'max' && mg > mgRef * 1.0001) out.push({ tipo: 'exige_melhoria', kpis: ['margem'], texto: `Margem mínima de ${pct(mg)} acima da margem de referência ${pct(mgRef)}${N.margem ? ` (n=${N.margem})` : ''}. Sem mudança de preço, mix ou custo, a meta de receita pode ser atingida com a margem violada.`, numeros: { alvo: mg, ref: mgRef } });
  if (mg != null && mgRef == null) out.push({ tipo: 'sem_dado', kpis: ['margem'], texto: 'Não há margem de referência (vendas com custos lançados) para avaliar a meta de margem.' });
  const ov = num(T[TX.oportVenda]), ro = num(T[TX.realOport]), capReal = num(cap.reuniao_realizada);
  if (vendasNec != null && capReal != null && ov != null && ov > 0 && ro != null && ro > 0) { const realNec = Math.ceil(Math.ceil(vendasNec / ov) / ro); if (realNec > capReal) out.push({ tipo: 'incompativel', kpis: ['vendas', 'cap_reunioes'], texto: `${vendasNec} vendas pedem ${realNec} reuniões realizadas no período pelas taxas atuais; a capacidade informada é ${capReal}. Aumente capacidade, taxas (como hipótese) ou reveja a meta.`, numeros: { realNec, cap: capReal } }); }
  return { achados: out, vendasNec, tkUsado, ok: !out.some(a => a.tipo === 'incompativel') };
}

/* ---------- cenários por indicador: cada cenário = conjunto de premissas alteradas; o resultado é consolidado pela mesma cadeia ---------- */
export interface BaseCenarios {
  metas?: { receita?: number | null; vendas?: number | null; margem?: number | null }; vendasReal?: number | null; receitaReal?: number | null; pipeVendas?: number | null; leadsRestantes?: number | null; cabe?: number | null;
  ticket?: number | null; margem?: number | null; taxas?: Record<string, number | null | undefined>; taxaLeadVenda?: number | null; n?: Record<string, number>; capacidade?: Record<string, number>; var?: Record<string, { p25?: number | null; p75?: number | null }>;
}
export const PREMISSAS_CENARIO = ['ticket', 'margem', 'leadsRestantes', 'cabe', 'pipeVendas', 'taxas.' + TX.leadAg, 'taxas.' + TX.agReal, 'taxas.' + TX.realOport, 'taxas.' + TX.oportVenda];
const le = (o: Record<string, any>, k: string): unknown => (k.startsWith('taxas.') ? (o.taxas ?? {})[k.slice(6)] : o[k]);
const poe = (o: Record<string, any>, k: string, v: number) => { if (k.startsWith('taxas.')) { o.taxas = { ...(o.taxas ?? {}) }; o.taxas[k.slice(6)] = v; } else o[k] = v; };
/* cadeia direta: do que entra (leads restantes) ao resultado */
export function modelo(b: BaseCenarios) {
  const T = b.taxas ?? {}, tx = [TX.leadAg, TX.agReal, TX.realOport, TX.oportVenda].map(k => num(T[k])), lv = tx.every((x): x is number => x != null && x > 0) ? tx.reduce<number>((a, x) => a * x, 1) : num(b.taxaLeadVenda);
  const leads = Math.max(0, num(b.leadsRestantes) ?? 0), cabe = b.cabe == null ? 1 : Math.max(0, Math.min(1, num(b.cabe) ?? 1)), pipe = Math.max(0, num(b.pipeVendas) ?? 0);
  const novas = lv != null ? leads * lv * cabe : null, vendas = novas == null ? null : (num(b.vendasReal) ?? 0) + pipe + novas, tk = num(b.ticket);
  const receita = vendas == null || tk == null ? null : (num(b.receitaReal) ?? 0) + (pipe + novas!) * tk, mg = num(b.margem), margemR = receita == null || mg == null ? null : receita * mg;
  const agendamento = tx[0] != null ? leads * tx[0] : null, reuniao_realizada = agendamento != null && tx[1] != null ? agendamento * tx[1] : null, oportunidades = reuniao_realizada != null && tx[2] != null ? reuniao_realizada * tx[2] : null;
  return { leads, agendamento, reuniao_realizada, oportunidades, novas, pipe, vendas, receita, margemPct: mg, margemR, ticket: tk, taxaLeadVenda: lv, falta: [lv == null ? 'taxas da cadeia (ou lead → venda)' : null, tk == null ? 'ticket' : null].filter((x): x is string => !!x) };
}
export type Modelo = ReturnType<typeof modelo>;
export interface Regras { conservador?: Record<string, number>; otimista?: Record<string, number>; notas?: Record<string, string> }
export interface Cenario { nome: string; premissas: Array<{ premissa: string; de: number; para: number; delta: number; nota: string }>; modelo: Modelo; resultado: { vendas: number | null; receita: number | null; margemR: number | null; margemPct: number | null; ticket: number | null; leads: number; oportunidades: number | null; reuniao_realizada: number | null; agendamento: number | null }; auto?: boolean; igualAoNeutro?: boolean }
export function cenarios(base: BaseCenarios | null | undefined, regras?: Regras | null) {
  const B = base ?? {}, R = regras ?? {}, notas = R.notas ?? {};
  const aplicar = (deltas: Record<string, number> | undefined, nome: string): Cenario => {
    const b = JSON.parse(JSON.stringify(B)) as Record<string, any>, alt: Cenario['premissas'] = [];
    for (const k of Object.keys(deltas ?? {})) {
      if (!PREMISSAS_CENARIO.includes(k)) continue; const v0 = num(le(B as Record<string, any>, k)), d = num(deltas![k]); if (v0 == null || d == null || d === 0) continue;
      let v1 = v0 * (1 + d); if (k.startsWith('taxas.') || k === 'cabe' || k === 'margem') v1 = Math.max(0, Math.min(1, v1));
      poe(b, k, v1); alt.push({ premissa: k, de: v0, para: v1, delta: d, nota: notas[k] ?? '' });
    }
    const M = modelo(b); return { nome, premissas: alt, modelo: M, resultado: { vendas: M.vendas, receita: M.receita, margemR: M.margemR, margemPct: M.margemPct, ticket: M.ticket, leads: M.leads, oportunidades: M.oportunidades, reuniao_realizada: M.reuniao_realizada, agendamento: M.agendamento } };
  };
  let cons = R.conservador, consAuto = false;
  if (!cons && B.var) { cons = {}; for (const k of Object.keys(B.var)) { const v0 = num(le(B as Record<string, any>, k)), p25 = num(B.var[k]?.p25); if (v0 != null && v0 > 0 && p25 != null && p25 < v0) cons[k] = p25 / v0 - 1; } consAuto = Object.keys(cons).length > 0; }
  const neutro = aplicar({}, 'neutro'), conservador = aplicar(cons ?? {}, 'conservador'), otimista = aplicar(R.otimista ?? {}, 'otimista');
  conservador.auto = consAuto; conservador.igualAoNeutro = !conservador.premissas.length; otimista.igualAoNeutro = !otimista.premissas.length;
  const M = B.metas ?? {}, nomes = ['conservador', 'neutro', 'otimista'] as const, C = { neutro, conservador, otimista };
  const comparacao = (['receita', 'vendas', 'margemR'] as const).map(k => {
    const meta = k === 'margemR' ? (num(M.margem) != null && neutro.resultado.receita != null ? num(M.margem)! * neutro.resultado.receita : null) : num(M[k]);
    const real = k === 'receita' ? num(B.receitaReal) : k === 'vendas' ? num(B.vendasReal) : null;
    const cen: Record<string, { v: number | null; gap: number | null }> = {}; for (const c of nomes) { const v = C[c].resultado[k]; cen[c] = { v, gap: meta != null && v != null ? v - meta : null }; }
    return { kpi: k, meta, real, cenarios: cen };
  });
  const conflitos: Array<{ cenario: string; texto: string }> = [];
  for (const c of nomes) { const r = C[c].resultado, mr = num(M.receita), mm = num(M.margem); if (mr != null && r.receita != null && r.receita >= mr && mm != null && r.margemPct != null && r.margemPct < mm - 1e-9) conflitos.push({ cenario: c, texto: `O cenário ${c} atinge a receita (${brl(r.receita)}) com margem de ${pct(r.margemPct)}, abaixo da mínima de ${pct(mm)}: comercialmente possível, economicamente incompatível com o objetivo.` }); }
  const R0 = neutro.resultado.receita;
  const sensibilidade = R0 == null ? [] : PREMISSAS_CENARIO.filter(k => k !== 'margem' && num(le(B as Record<string, any>, k)) != null)
    .map(k => { const up = aplicar({ [k]: 0.1 }, 's').resultado.receita, dn = aplicar({ [k]: -0.1 }, 's').resultado.receita; return { premissa: k, mais10: up == null ? null : up - R0, menos10: dn == null ? null : dn - R0 }; })
    .filter((s): s is { premissa: string; mais10: number; menos10: number | null } => s.mais10 != null).sort((a, b) => Math.abs(b.mais10) - Math.abs(a.mais10));
  return { neutro, conservador, otimista, comparacao, conflitos, sensibilidade, versao: VERSAO_PLANO };
}

/* ---------- replanejamento a partir de uma data de corte: o patch guarda a versão anterior inteira e nunca toca o original ---------- */
export interface MetaDoPlano { ind: string; escopo?: string; ref?: string | null; alvo?: unknown; op?: string }
export interface PlanoDoc {
  status?: 'rascunho' | 'ativo' | 'fechado' | string; versao?: number; metas?: Record<string, MetaDoPlano>; premissas?: Record<string, unknown>; reverso?: Record<string, unknown>; pessoas?: Record<string, unknown>; txCanal?: Record<string, unknown>; cadeia?: unknown;
  original?: { em?: unknown; por?: string; metas?: Record<string, MetaDoPlano>; reverso?: Record<string, unknown> }; versoes?: Record<string, VersaoPlano>; corte?: string; fechamento?: { em?: unknown; por?: string };
}
export interface VersaoPlano { n: number; em: number | string; por: string; corte: string; motivo: string; metas: Record<string, MetaDoPlano>; premissas: Record<string, unknown>; reverso: Record<string, unknown>; pessoas: Record<string, unknown>; txCanal: Record<string, unknown>; cadeia: unknown; status: string; realizadoNoCorte: Record<string, unknown> }
export function replanejar(plano: PlanoDoc | null | undefined, corte: string, realizado: Record<string, unknown> | null | undefined, mudancas: { metas?: Record<string, MetaDoPlano>; premissas?: Record<string, unknown>; reverso?: Record<string, unknown>; pessoas?: Record<string, unknown>; txCanal?: Record<string, unknown>; motivo?: string } | null | undefined, ctx?: { agora?: number | string; autor?: string }) {
  const P = plano ?? {}, M = mudancas ?? {}, C = ctx ?? {};
  if (!corte || !/^\d{4}-\d{2}-\d{2}$/.test(corte)) return { erro: 'data de corte inválida' };
  if (P.status === 'fechado') return { erro: 'plano fechado: crie o plano do próximo ciclo' };
  if (!M.motivo) return { erro: 'informe o motivo do replanejamento' };
  const n = Number(P.versao) || 1;
  const ant: VersaoPlano = { n, em: C.agora ?? Date.now(), por: C.autor ?? '', corte, motivo: M.motivo, metas: P.metas ?? {}, premissas: P.premissas ?? {}, reverso: P.reverso ?? {}, pessoas: P.pessoas ?? {}, txCanal: P.txCanal ?? {}, cadeia: P.cadeia ?? null, status: P.status ?? 'rascunho', realizadoNoCorte: realizado ?? {} };
  const patch: Partial<PlanoDoc> & { versao: number; corte: string; versoes: Record<string, VersaoPlano>; restanteNoCorte: Record<string, number> } = { versao: n + 1, corte, versoes: { ['v' + n]: ant }, restanteNoCorte: {} };
  for (const k of ['metas', 'premissas', 'reverso', 'pessoas', 'txCanal'] as const) if (M[k] !== undefined) (patch as Record<string, unknown>)[k] = M[k];
  const metas = patch.metas ?? P.metas ?? {};
  for (const id of Object.keys(metas)) {
    const m = metas[id]!; if (!m.ind || (m.escopo ?? 'empresa') !== 'empresa') continue; const r = realizado ? num(realizado[m.ind]) : null;
    if (r != null && num(m.alvo) != null && !m.ind.includes('>') && m.ind !== 'ticket' && m.ind !== 'margem') patch.restanteNoCorte[m.ind] = Math.max(0, num(m.alvo)! - r);
  }
  return { patch, versao: n + 1, anterior: ant, hist: { acao: 'replanejou a partir de ' + corte, de: 'v' + n, para: 'v' + (n + 1), motivo: M.motivo } };
}

/* ---------- fallback de taxa com nível explícito: candidatos em ordem; o 1º com amostra ≥ minN vence ---------- */
export interface Candidato { v?: number | null; n?: number | null; nivel: string }
export function fallback(cands: Candidato[] | null | undefined, minN = 5) {
  const L = (cands ?? []).filter(c => c && num(c.v) != null), mn = minN || 5;
  const ok = L.find(c => (Number(c.n) || 0) >= mn); if (ok) return { confianca: (ok.n ?? 0) >= 30 ? 'alta' : 'media', ...ok, v: num(ok.v)!, semAmostra: false };
  const ult = L[L.length - 1]; return ult ? { confianca: 'baixa', semAmostra: true, ...ult, v: num(ult.v)! } : { v: null, nivel: 'nenhum', confianca: 'nenhuma', semAmostra: true };
}
/* ---------- responsabilidade por indicador: quem produz, contribui, influencia, aprova ---------- */
export const PAPEL_RESP = { primario: 'responsável', contribui: 'contribui', influencia: 'influencia', aprova: 'aprova/intervém' } as const;
export type PapelResp = keyof typeof PAPEL_RESP;
export function responsaveis(pessoas: Record<string, { resp?: Record<string, PapelResp | string | null | undefined> }> | null | undefined) {
  const por: Record<string, Record<PapelResp, string[]>> = {};
  for (const n of Object.keys(pessoas ?? {})) { const r = pessoas![n]?.resp ?? {}; for (const ind of Object.keys(r)) { const papel = r[ind]; if (!papel) continue; const e = (por[ind] = por[ind] ?? { primario: [], contribui: [], influencia: [], aprova: [] }); if (papel in e) e[papel as PapelResp].push(n); } }
  const avisos: Array<{ ind: string; tipo: 'sem_responsavel' | 'varios_responsaveis'; pessoas?: string[]; texto: string }> = [];
  for (const ind of Object.keys(por)) {
    const e = por[ind]!; if (!e.primario.length) avisos.push({ ind, tipo: 'sem_responsavel', texto: 'ninguém é o responsável primário por ' + ind });
    if (e.primario.length > 1) avisos.push({ ind, tipo: 'varios_responsaveis', pessoas: [...e.primario], texto: `${e.primario.join(' e ')} dividem ${ind}: cada resultado conta uma vez, para quem fez (o dono do negócio)` });
  }
  return { por, avisos };
}
/* ---------- sugestão individual com evidência: "para o mesmo resultado, A precisa trabalhar N% mais volume que B" ---------- */
export interface PessoaTaxa { nome: string; taxa?: { v?: number | null; n?: number | null; fonte?: string } | null; volume?: number; resultado?: number }
export function sugestoes(pessoas: PessoaTaxa[] | null | undefined, minN = 5) {
  const mn = minN || 5, L = (pessoas ?? []).filter(p => p && p.taxa && (num(p.taxa.v) ?? 0) > 0) as Array<PessoaTaxa & { taxa: { v: number; n?: number | null; fonte?: string } }>;
  const ref = L.filter(p => (Number(p.taxa.n) || 0) >= mn).sort((a, b) => b.taxa.v - a.taxa.v)[0];
  if (!ref) return { ref: null, itens: [], nota: `nenhuma pessoa com amostra suficiente (n ≥ ${mn}) para servir de referência` };
  const itens = L.filter(p => p.nome !== ref.nome).map(p => {
    const extra = ref.taxa.v / p.taxa.v - 1, amostra = (Number(p.taxa.n) || 0) >= mn ? 'suficiente' : 'pequena';
    return {
      nome: p.nome, ref: ref.nome, extra, taxa: p.taxa.v, taxaRef: ref.taxa.v, n: p.taxa.n ?? 0, nRef: ref.taxa.n ?? 0, fonte: p.taxa.fonte ?? '', amostra, relevante: extra > 0.1 && amostra === 'suficiente',
      texto: `Para o mesmo resultado, ${p.nome} precisaria trabalhar ${pct(extra)} mais volume que ${ref.nome} (taxa ${pct(p.taxa.v)} × ${pct(ref.taxa.v)}; n=${p.taxa.n ?? 0} × ${ref.taxa.n ?? 0}${p.taxa.fonte ? '; fonte ' + p.taxa.fonte : ''}).` + (amostra === 'pequena' ? ' Amostra pequena: só referência.' : ''),
      confirmar: 'mix de origem, carteira, tempo de função e período antes de virar meta',
    };
  });
  return { ref: ref.nome, itens: itens.sort((a, b) => b.extra - a.extra), nota: '' };
}

/* ---------- necessário × viável × déficit: nunca reduz a meta; mostra o déficit e simula alternativas ---------- */
export function viabilidade(nec: Record<string, number | null | undefined> | null | undefined, cap: Record<string, number | null | undefined> | null | undefined, ctx?: { ticket?: number | null; taxas?: Record<string, number | null | undefined>; metaReceita?: number | null; pessoasCloser?: number | null; duMedio?: number | null }) {
  const N = nec ?? {}, Cp = cap ?? {}, C = ctx ?? {};
  type Item = { etapa: string; necessario: number; viavel: number | null; capacidade?: number; deficit: number | null; estado: 'sem_capacidade' | 'deficit' | 'ok' };
  const itens: Item[] = [];
  for (const k of ['contato', 'agendamento', 'reuniao_realizada']) {
    const n = num(N[k]), c = num(Cp[k]); if (n == null) continue;
    if (c == null) { if (k === 'agendamento') continue; itens.push({ etapa: k, necessario: n, viavel: null, deficit: null, estado: 'sem_capacidade' }); continue; }
    itens.push({ etapa: k, necessario: n, viavel: Math.min(n, c), capacidade: c, deficit: Math.max(0, n - c), estado: n > c ? 'deficit' : 'ok' });
  }
  const r = itens.find(i => i.etapa === 'reuniao_realizada' && i.estado === 'deficit'), alternativas: Array<{ k: string; texto: string; receitaViavel?: number; vendasViaveis?: number }> = [];
  if (r && r.viavel != null && r.deficit != null) {
    const T = C.taxas ?? {}, ro = num(T[TX.realOport]), ov = num(T[TX.oportVenda]), tx = ro != null && ro > 0 && ov != null && ov > 0 ? ro * ov : null, tk = num(C.ticket);
    const vendasViaveis = tx != null ? r.viavel * tx : null, receitaViavel = vendasViaveis != null && tk ? vendasViaveis * tk : null;
    alternativas.push({ k: 'capacidade', texto: `Ampliar a capacidade de reuniões realizadas em ${Math.ceil(r.deficit)} no ciclo${C.duMedio ? ` (≈ ${(r.deficit / C.duMedio).toFixed(1)} por dia útil)` : ''}.` });
    if (C.pessoasCloser && C.duMedio && (r.capacidade ?? 0) > 0) { const porPessoa = r.capacidade! / C.pessoasCloser; alternativas.push({ k: 'equipe', texto: `Redistribuir ou ampliar a equipe: ${Math.ceil(r.deficit / porPessoa)} closer(es) a mais com a capacidade média atual (${Math.round(porPessoa)} reuniões/ciclo cada).` }); }
    if (tx != null) alternativas.push({ k: 'conversao', texto: `Melhorar a conversão reunião → venda em ${pct(r.necessario / r.viavel - 1)} (de ${pct(tx)} para ${pct((tx * r.necessario) / r.viavel)}), como hipótese explícita.` });
    if (receitaViavel != null && vendasViaveis != null) alternativas.push({ k: 'objetivo', texto: `Rever o objetivo: com a capacidade atual e as taxas de referência cabem ${vendasViaveis.toFixed(1)} vendas ≈ ${brl(receitaViavel)}${num(C.metaReceita) ? ` (${pct(receitaViavel / Number(C.metaReceita))} da meta)` : ''}.`, receitaViavel, vendasViaveis });
  }
  const ag = itens.find(i => i.etapa === 'agendamento' && i.estado === 'deficit'); if (ag) alternativas.push({ k: 'agendamento', texto: `Reuniões agendadas: faltam ${Math.ceil(ag.deficit!)} no ciclo; ampliar a capacidade de agendamento dos SDRs, redistribuir leads ou melhorar a taxa contato → agendada.` });
  const ct = itens.find(i => i.etapa === 'contato' && i.estado === 'deficit'); if (ct) alternativas.push({ k: 'contato', texto: `Contatos: faltam ${Math.ceil(ct.deficit!)} no ciclo; ampliar capacidade de prospecção, redistribuir leads ou aceitar menos leads trabalhados (e menos reuniões).` });
  return { itens, deficit: itens.some(i => i.estado === 'deficit'), alternativas, nota: 'A meta não é reduzida automaticamente: o déficit fica visível até uma decisão (capacidade, equipe, conversão como hipótese, ou revisão do objetivo).' };
}

/* ---------- programa de ciclos: meta agregada de 2 a 6 ciclos consecutivos (chaves 'AAAA-MM'), ciclos conectados, sem dupla contagem.
   A meta ORIGINAL de cada ciclo é a agregada repartida por dias úteis × peso (congelada); a VIGENTE de cada ciclo não fechado é o que falta do programa repartido entre os abertos. ---------- */
export interface Programa { meta?: { receita?: number | null; vendas?: number | null }; ciclos?: string[]; pesos?: Record<string, number | null>; original?: Record<string, Record<string, number | null>> }
export interface EstadoCiclo { status?: 'fechado' | 'atual' | 'futuro'; du?: number; real?: Record<string, number | null | undefined> }
export function programa(prog: Programa | null | undefined, estado: Record<string, EstadoCiclo> | null | undefined) {
  const P = prog ?? {}, E = estado ?? {}, ks = [...(P.ciclos ?? [])], M = P.meta ?? {}, pz = P.pesos ?? {};
  if (ks.length < 2 || ks.length > 6) return { erro: 'o programa precisa de 2 a 6 ciclos' };
  if (new Set(ks).size !== ks.length) return { erro: 'ciclo repetido no programa (o mesmo resultado contaria duas vezes)' };
  for (let i = 1; i < ks.length; i++) { const a = ks[i - 1]!.split('-').map(Number), b = ks[i]!.split('-').map(Number); if (b[0]! * 12 + b[1]! - (a[0]! * 12 + a[1]!) !== 1) return { erro: `os ciclos precisam ser consecutivos (${ks[i - 1]} → ${ks[i]})` }; }
  const peso = (k: string) => { const e = E[k] ?? {}, w = pz[k] != null && Number(pz[k]) >= 0 ? Number(pz[k]) : 1; return Math.max(0, Number(e.du) || 0) * w; };
  const reparte = (total: number | null, alvo: string[]) => { const s = alvo.reduce((a, k) => a + peso(k), 0), out: Record<string, number> = {}; if (total == null) return out; for (const k of alvo) out[k] = s > 0 ? (total * peso(k)) / s : total / alvo.length; return out; };
  const inds = (['receita', 'vendas'] as const).filter(i => num(M[i]) != null), orig: Record<string, Record<string, number | null>> = {}, vig: Record<string, Record<string, number | null>> = {};
  for (const i of inds) { const o = reparte(num(M[i]), ks); for (const k of ks) (orig[k] = orig[k] ?? {})[i] = P.original?.[k]?.[i] != null ? Number(P.original[k]![i]) : o[k] ?? null; }
  const fechados = ks.filter(k => E[k]?.status === 'fechado'), abertos = ks.filter(k => E[k]?.status !== 'fechado');
  const realDe = (k: string, i: string) => num(E[k]?.real?.[i]);
  const acum: Record<string, number> = {}, falta: Record<string, number> = {};
  for (const i of inds) {
    acum[i] = ks.reduce((a, k) => a + (realDe(k, i) ?? 0), 0);
    const realFech = fechados.reduce((a, k) => a + (realDe(k, i) ?? 0), 0), resto = Math.max(0, num(M[i])! - realFech), v = reparte(resto, abertos);
    for (const k of ks) (vig[k] = vig[k] ?? {})[i] = E[k]?.status === 'fechado' ? null : v[k] ?? null;
    falta[i] = Math.max(0, num(M[i])! - acum[i]!);
  }
  const ciclos = ks.map((k, idx) => {
    const e = E[k] ?? {}, r: Record<string, number | null> = {}; for (const i of inds) r[i] = realDe(k, i);
    const ant = idx > 0 ? ks[idx - 1]! : null, saldoAnterior: Record<string, number> = {}; if (ant && E[ant]?.status === 'fechado') for (const i of inds) saldoAnterior[i] = (realDe(ant, i) ?? 0) - (orig[ant]?.[i] ?? 0);
    const diferenca: Record<string, number | null> = {}; for (const i of inds) { const base = e.status === 'fechado' ? orig[k]?.[i] : vig[k]?.[i]; diferenca[i] = r[i] != null && base != null ? r[i]! - base : null; }
    return { key: k, status: e.status ?? 'futuro', du: Number(e.du) || 0, original: orig[k] ?? {}, vigente: vig[k] ?? {}, real: r, saldoAnterior, diferenca };
  });
  return { ciclos, meta: M, realizado: acum, falta, inds: inds as string[], completo: abertos.length === 0 };
}
