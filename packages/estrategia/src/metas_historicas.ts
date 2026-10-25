/* Metas oficiais por ciclo e meta de qualquer intervalo. Portado do LAB V1 (lab_metas.js; testes/lab_metas.test.js é o contrato).
   D16 ciclo replanejado: a referência consolidada é a ÚLTIMA versão aprovada; original, revisões e final ficam preservadas.
   D17 ciclo passado sem plano oficial e sem evidência: "meta desconhecida" (nunca a configuração de hoje, nunca zero); fica fora do atingimento; estimativa só como registro próprio.
   D18 "Este ano": meta final dos ciclos + meta proporcional acumulada até hoje + realizado + projeção, separados.
   D19 registro da meta de cada ciclo encerrado: imutável, idempotente; correção = revisão auditável (novo registro).
   D20 ciclos anteriores ao início da operação ficam FORA: nem meta, nem realizado, nem projeção; não são "desconhecidos". */
import type { MetaDoPlano, PlanoDoc } from './plano_ciclo.js';

export const VERSAO_REGRA_METAS = 1;
export const PROJECAO_MINIMA = 0.1; /* projeção do ano só depois de 10% dos dias elegíveis (ponderados) do ano */
export const ESTADOS_META = { conhecida: 'Meta conhecida', desconhecida: 'Meta desconhecida', sem_meta: 'Sem meta definida', estimada: 'Estimativa', fora: 'Antes do início da operação' } as const;
export type EstadoMeta = keyof typeof ESTADOS_META;
export const FONTES_META: Record<string, string> = { fora: 'antes do início da operação', plano: 'plano do ciclo', configuracao: 'meta cadastrada', observacao: 'meta observada no ciclo', foto_diaria: 'Fechamento do dia', revisao: 'revisão', estimativa: 'estimativa', nenhuma: '—' };
const num = (v: unknown): number | null => { const n = Number(v); return v != null && v !== '' && isFinite(n) ? n : null; };
const igual = (x: number | null, y: number | null) => (x == null && y == null) || (x != null && y != null && Math.abs(x - y) < 0.005);
const norm = (t: unknown) => String(t ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

/* meta de um indicador da empresa num conjunto de metas do plano */
export function metaEmpresa(metas: Record<string, MetaDoPlano> | null | undefined, ind: string) { const M = metas ?? {}; const k = Object.keys(M).find(id => M[id] && M[id]!.ind === ind && (M[id]!.escopo ?? 'empresa') === 'empresa'); return k ? num(M[k]!.alvo) : null; }
/* meta de receita da empresa: a explícita; sem ela, o alvo do plano reverso quando é de receita */
export function receitaDoPlano(metas: Record<string, MetaDoPlano> | null | undefined, reverso?: Record<string, unknown> | null) { const m = metaEmpresa(metas, 'receita'); if (m != null && m > 0) return m; const r = reverso ?? {}; const a = num(r.alvo); return r.tipo === 'receita' && a != null && a > 0 ? a : null; }
export function metasDaEmpresa(metas: Record<string, MetaDoPlano> | null | undefined) { const out: Record<string, number> = {}; for (const m of Object.values(metas ?? {})) { if (m && m.ind && (m.escopo ?? 'empresa') === 'empresa' && num(m.alvo) != null) out[m.ind] = num(m.alvo)!; } return out; }
export function metasPorPessoa(metas: Record<string, MetaDoPlano> | null | undefined) { const out: Record<string, number> = {}; for (const m of Object.values(metas ?? {})) { if (m && m.ind === 'receita' && m.escopo === 'pessoa' && m.ref && (num(m.alvo) ?? 0) > 0) out[m.ref] = num(m.alvo)!; } return out; }
export function metaDaPessoa(pessoas: Record<string, unknown> | null | undefined, nome: string) { const P = pessoas ?? {}; const k = Object.keys(P).find(n => norm(n) === norm(nome)); return k ? num(P[k]) : null; }

/* linha do tempo das versões do plano (D16): aprovada na ativação, cada versão substituída por replanejamento, final */
export interface VersaoMeta { tipo: 'aprovada' | 'substituida' | 'final'; n: number | null; receita: number | null; metas: Record<string, number>; em: unknown; por: string; motivo: string; vigenteAte?: string | null; desde?: string | null }
export function versoes(P: PlanoDoc | null | undefined): VersaoMeta[] {
  const p = P ?? {}, V = p.versoes ?? {}, ks = Object.keys(V).filter(k => V[k]).sort((a, b) => (V[a]!.n || 0) - (V[b]!.n || 0)), out: VersaoMeta[] = [];
  if (p.original) out.push({ tipo: 'aprovada', n: 1, receita: receitaDoPlano(p.original.metas, p.original.reverso), metas: metasDaEmpresa(p.original.metas), em: p.original.em ?? null, por: p.original.por ?? '', motivo: 'meta aprovada na ativação do plano' });
  for (const k of ks) { const v = V[k]!; out.push({ tipo: 'substituida', n: Number(v.n) || null, receita: receitaDoPlano(v.metas, v.reverso), metas: metasDaEmpresa(v.metas), vigenteAte: v.corte ?? null, em: v.em ?? null, por: v.por ?? '', motivo: v.motivo ?? '' }); }
  const ult = ks.length ? V[ks[ks.length - 1]!]! : null;
  out.push({
    tipo: 'final', n: Number(p.versao) || ks.length + 1, receita: receitaDoPlano(p.metas, p.reverso), metas: metasDaEmpresa(p.metas), desde: ult ? ult.corte ?? null : null,
    em: ult ? ult.em ?? null : p.original ? p.original.em ?? null : null, por: ult ? ult.por ?? '' : p.original ? p.original.por ?? '' : '', motivo: ult ? ult.motivo ?? '' : p.original ? 'meta aprovada na ativação do plano' : '',
  });
  return out;
}

/* meta oficial de um ciclo calculada das fontes (sem olhar o registro) */
export interface EntradaSnapshot {
  chave?: string; ini?: string; fim?: string; encerrado?: boolean; plano?: PlanoDoc | null;
  obs?: Record<string, { v?: unknown; fonte?: string; pessoas?: Record<string, unknown> }>; fotos?: Record<string, { meta?: { receita?: unknown } }>;
  metaMensal?: unknown; metasVend?: Record<string, unknown>;
}
export interface Snapshot {
  chave: string; ini: string; fim: string; encerrado: boolean; estado: EstadoMeta; receita: number | null; pessoas: Record<string, number>; metas: Record<string, number>; fonte: string; motivo: string;
  evidencia: { dia: string; fonte?: string } | null; plano: { status: string; versao: number; versoes: VersaoMeta[] } | null;
}
export function snapshot(inp: EntradaSnapshot): Snapshot {
  const P = inp.plano ?? null, st = P ? P.status ?? 'rascunho' : null, enc = !!inp.encerrado;
  const base = { chave: inp.chave ?? '', ini: inp.ini ?? '', fim: inp.fim ?? '', encerrado: enc };
  const sai = (o: Pick<Snapshot, 'estado' | 'receita' | 'fonte' | 'motivo'> & Partial<Snapshot>): Snapshot => ({ ...base, pessoas: {}, metas: {}, evidencia: null, plano: P ? { status: st!, versao: Number(P.versao) || 1, versoes: versoes(P) } : null, ...o });
  const dentro = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= base.ini && d < base.fim;
  const pos = (o: Record<string, unknown> | null | undefined) => { const out: Record<string, number> = {}; for (const k of Object.keys(o ?? {})) { const v = num(o![k]); if (v != null && v > 0) out[k] = v; } return out; };
  const ob = Object.keys(inp.obs ?? {}).filter(dentro).sort().pop();
  /* metas individuais fora do plano: as de hoje no ciclo em andamento; no encerrado, só as observadas na época (nunca as de hoje) */
  const vend = enc ? pos(ob ? inp.obs![ob]?.pessoas : null) : pos(inp.metasVend);
  if (P && (st === 'ativo' || st === 'fechado')) {
    const r = receitaDoPlano(P.metas, P.reverso);
    if (r != null && r > 0) return sai({ estado: 'conhecida', receita: r, pessoas: { ...vend, ...metasPorPessoa(P.metas) }, metas: metasDaEmpresa(P.metas), fonte: 'plano', motivo: `meta final do plano ${st} (versão ${Number(P.versao) || 1})` });
    if (enc) return sai({ estado: 'desconhecida', receita: null, fonte: 'plano', motivo: `plano ${st} sem meta de receita da empresa` });
  }
  if (!enc) {
    const mm = num(inp.metaMensal);
    return mm != null && mm > 0 ? sai({ estado: 'conhecida', receita: mm, pessoas: vend, fonte: 'configuracao', motivo: `meta cadastrada (ciclo em andamento${P ? ', plano em ' + st : ', sem plano'})` })
      : sai({ estado: 'sem_meta', receita: null, pessoas: vend, fonte: 'nenhuma', motivo: 'nenhuma meta definida para o ciclo' });
  }
  if (ob) {
    const o = inp.obs![ob] ?? {}; const v = num(o.v);
    if (v != null && v > 0) return sai({ estado: 'conhecida', receita: v, pessoas: pos(o.pessoas), fonte: 'observacao', evidencia: { dia: ob, fonte: o.fonte ?? '' }, motivo: `meta em vigor registrada em ${ob} (${o.fonte ?? 'origem não informada'})` });
    if (o.fonte === 'nenhuma') return sai({ estado: 'sem_meta', receita: null, fonte: 'observacao', evidencia: { dia: ob, fonte: 'nenhuma' }, motivo: `registrado em ${ob} que o ciclo não tinha meta` });
  }
  const F = inp.fotos ?? {}, fo = Object.keys(F).filter(dentro).filter(d => (num(F[d]?.meta?.receita) ?? 0) > 0).sort().pop();
  if (fo) return sai({ estado: 'conhecida', receita: num(F[fo]!.meta!.receita), fonte: 'foto_diaria', evidencia: { dia: fo }, motivo: `meta registrada no Fechamento do dia de ${fo}` });
  return sai({ estado: 'desconhecida', receita: null, fonte: 'nenhuma', motivo: (P ? `plano em ${st} (nunca ativado)` : 'ciclo sem plano') + ' e sem registro da meta em vigor durante o ciclo; a meta da configuração de hoje não vale para o passado' });
}

/* registros do ciclo: r1 = encerramento, rN = revisão ou estimativa (só acrescenta) */
export interface Registro {
  n: number; tipo: 'encerramento' | 'recuperacao' | 'correcao' | 'estimativa' | string; em: unknown; por: string; versaoRegra: number; chave: string; ini: string; fim: string; estado: EstadoMeta; receita: number | null;
  pessoas: Record<string, unknown>; metas: Record<string, unknown>; fonte: string; motivo: string; evidencia?: unknown; plano?: unknown; revisaDe?: string; justificativa?: string; origem?: string | null; limitacoes?: string | null; registradoPor?: string; registradoEm?: unknown;
}
export interface DocMetaCiclo { registros?: Record<string, Registro | null | undefined>; obs?: Record<string, { v?: unknown; fonte?: string; pessoas?: Record<string, unknown> }> }
export type Oficial = (Snapshot | Registro) & { id?: string; registrado: boolean; estimativas: Array<Registro & { id: string }>; historico: Array<Registro & { id: string }>; divergencia: { estado: EstadoMeta; receita: number | null; fonte: string; motivo: string } | null };
/* meta oficial = último registro oficial (correção vale; estimativa não substitui); sem registro, o snapshot das fontes */
export function oficial(doc: DocMetaCiclo | null | undefined, snap: Snapshot | null | undefined): Oficial {
  const R = doc?.registros ?? {}, ks = Object.keys(R).filter(k => R[k] && typeof R[k] === 'object').sort((a, b) => (R[a]!.n || 0) - (R[b]!.n || 0));
  const hist = ks.map(k => ({ id: k, ...R[k]! })), of = hist.filter(r => r.tipo !== 'estimativa'), est = hist.filter(r => r.tipo === 'estimativa');
  if (!of.length) return { ...(snap ?? ({} as Snapshot)), registrado: false, estimativas: est, historico: hist, divergencia: null };
  const r = of[of.length - 1]!, s = snap;
  const div = s && s.encerrado && (s.estado !== r.estado || !igual(s.receita, r.receita)) ? { estado: s.estado, receita: s.receita, fonte: s.fonte, motivo: s.motivo } : null;
  return { ...r, registrado: true, estimativas: est, historico: hist, divergencia: div };
}
/* registro do encerramento (D19): só quando o ciclo encerrou e ainda não há nenhum registro. Idempotente */
export function registroInicial(doc: DocMetaCiclo | null | undefined, snap: Snapshot | null | undefined, ctx?: { agora?: unknown; autor?: string; tipo?: string; registradoPor?: string; registradoEm?: unknown }) {
  const R = doc?.registros ?? {};
  if (Object.keys(R).some(k => R[k])) return { acao: 'nada' as const, motivo: 'o ciclo já tem registro; correção só por revisão' };
  if (!snap || !snap.encerrado) return { acao: 'nada' as const, motivo: 'ciclo em andamento' };
  const C = ctx ?? {};
  const reg: Registro = { n: 1, tipo: C.tipo ?? 'encerramento', em: C.agora ?? Date.now(), por: C.autor ?? '', versaoRegra: VERSAO_REGRA_METAS, chave: snap.chave, ini: snap.ini, fim: snap.fim, estado: snap.estado, receita: snap.receita, pessoas: snap.pessoas ?? {}, metas: snap.metas ?? {}, fonte: snap.fonte, motivo: snap.motivo, evidencia: snap.evidencia ?? null, plano: snap.plano ?? null };
  if (C.registradoPor) { reg.registradoPor = C.registradoPor; reg.registradoEm = C.registradoEm ?? null; }
  return { acao: 'gravar' as const, id: 'r1', registro: reg };
}
/* revisão auditável (D19) ou estimativa identificada (D17): novo registro, o anterior fica intacto */
export function revisaoDaMeta(doc: DocMetaCiclo | null | undefined, dados: { tipo?: string; receita?: unknown; justificativa?: string; origem?: string; limitacoes?: string; pessoas?: Record<string, unknown> } | null | undefined, ctx?: { agora?: unknown; autor?: string }) {
  const R = doc?.registros ?? {}, ks = Object.keys(R).filter(k => R[k]).sort((a, b) => (R[a]!.n || 0) - (R[b]!.n || 0));
  if (!ks.length) return { erro: 'o ciclo ainda não tem registro de encerramento' };
  const D = dados ?? {}, C = ctx ?? {}, tipo = D.tipo === 'estimativa' ? 'estimativa' : 'correcao', v = num(D.receita), just = String(D.justificativa ?? '').trim();
  if (just.length < 10) return { erro: 'explique o motivo da revisão (pelo menos 10 caracteres)' };
  if (tipo === 'estimativa' && !(v != null && v > 0)) return { erro: 'a estimativa precisa de um valor' };
  if (tipo === 'estimativa' && (!String(D.origem ?? '').trim() || !String(D.limitacoes ?? '').trim())) return { erro: 'a estimativa precisa da origem e das limitações' };
  if (tipo === 'correcao' && v != null && !(v > 0)) return { erro: 'valor inválido' };
  const ultK = ks[ks.length - 1]!, ult = R[ultK]!, n = Math.max(...ks.map(k => Number(R[k]!.n) || 0)) + 1, pos = v != null && v > 0;
  const reg: Registro = {
    n, tipo, em: C.agora ?? Date.now(), por: C.autor ?? '', versaoRegra: VERSAO_REGRA_METAS, revisaDe: ultK, chave: ult.chave, ini: ult.ini, fim: ult.fim,
    estado: tipo === 'estimativa' ? 'estimada' : pos ? 'conhecida' : 'desconhecida', receita: pos ? v : null, pessoas: D.pessoas ?? ult.pessoas ?? {}, metas: ult.metas ?? {},
    fonte: tipo === 'estimativa' ? 'estimativa' : 'revisao', motivo: just, justificativa: just, origem: String(D.origem ?? '').trim() || null, limitacoes: String(D.limitacoes ?? '').trim() || null, plano: ult.plano ?? null,
  };
  return { acao: 'gravar' as const, id: 'r' + n, registro: reg };
}

/* dias AAAA-MM-DD de [ini, fim) por dias corridos */
export function diasCorridos(ini: string, fim: string): string[] {
  const out: string[] = []; if (!ini || !fim) return out; const p = (s: string) => { const x = s.split('-').map(Number); return Date.UTC(x[0]!, x[1]! - 1, x[2]!); };
  for (let t = p(ini), z = p(fim), n = 0; t < z && n < 400; t += 86400000, n++) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}
/* fração ponderada dos dias elegíveis de um ciclo que cai em [a, b] (inclusive) */
export function fracao(dias: string[] | null | undefined, pesos: Record<string, unknown> | null | undefined, a: string, b: string) {
  let tot = 0, part = 0; for (const d of dias ?? []) { const w = pesos && pesos[d] != null && (num(pesos[d]) ?? -1) >= 0 ? num(pesos[d])! : 1; tot += w; if (d >= a && d <= b) part += w; }
  return { tot, part, f: tot > 0 ? part / tot : null };
}
export interface CicloIntervalo { chave: string; nome?: string; ini: string; fim: string; oficial?: { estado?: EstadoMeta | string; receita?: number | null; fonte?: string; motivo?: string } | null; dias?: string[]; pesos?: Record<string, unknown> | null }
export interface ItemIntervalo { chave: string; nome: string; estado: string; fonte: string; meta: number | null; fracao: number | null; contribuicao: number | null; nota: string; motivo: string }
export interface Intervalo { v: number | null; estado: 'invalido' | 'parcial' | 'ok' | 'sem_meta'; itens: ItemIntervalo[]; desconhecidos: string[]; semMeta: string[]; fora: string[]; confianca: 'ok' | 'baixa'; notas: string[]; pesoParte: number; pesoTotal: number }
/* meta atribuída ao intervalo [a, b] (AAAA-MM-DD inclusive), rateada pelos dias elegíveis e pesos de cada ciclo */
export function intervalo(ciclos: CicloIntervalo[] | null | undefined, a: string, b: string): Intervalo {
  if (!a || !b || a > b) return { v: null, estado: 'invalido', itens: [], desconhecidos: [], semMeta: [], fora: [], confianca: 'baixa', notas: ['intervalo vazio ou invertido'], pesoParte: 0, pesoTotal: 0 };
  let v = 0, tem = false, conf: 'ok' | 'baixa' = 'ok', pp = 0, pt = 0; const itens: ItemIntervalo[] = [], desc: string[] = [], sem: string[] = [], fora: string[] = [], notas: string[] = [];
  for (const c of ciclos ?? []) {
    if (c.oficial?.estado === 'fora') { if (fracao(diasCorridos(c.ini, c.fim), null, a, b).part > 0) fora.push(c.chave); continue; }
    let fr = fracao(c.dias, c.pesos, a, b), nota = '';
    if (!(fr.tot > 0)) { fr = fracao(diasCorridos(c.ini, c.fim), null, a, b); nota = 'ciclo sem dia elegível no calendário: rateio por dias corridos'; conf = 'baixa'; }
    pt += fr.tot; pp += fr.part;
    if (!(fr.part > 0)) continue;
    const o = c.oficial ?? {}, m = o.estado === 'conhecida' ? num(o.receita) : null;
    const it: ItemIntervalo = { chave: c.chave, nome: c.nome ?? c.chave, estado: o.estado ?? 'desconhecida', fonte: o.fonte ?? '', meta: m, fracao: fr.f, contribuicao: m != null ? m * fr.f! : null, nota, motivo: o.motivo ?? '' };
    itens.push(it);
    if (m != null) { v += it.contribuicao!; tem = true; } else if (it.estado === 'sem_meta') sem.push(c.chave); else desc.push(c.chave);
  }
  if (desc.length) notas.push(`meta desconhecida em ${desc.join(', ')}: o atingimento do período não é calculado`);
  if (sem.length) notas.push(`sem meta definida em ${sem.join(', ')}`);
  if (conf === 'baixa') notas.push('há ciclo sem dia elegível: parte do rateio usa dias corridos (baixa confiança)');
  if (fora.length) notas.push(`fora da operação (D20): ${fora.join(', ')} não entram na meta nem no realizado`);
  return { v: tem ? v : null, estado: desc.length ? 'parcial' : tem ? 'ok' : 'sem_meta', itens, desconhecidos: desc, semMeta: sem, fora, confianca: conf, notas, pesoParte: pp, pesoTotal: pt };
}
/* atingimento: só com meta conhecida em todo o intervalo (D17: desconhecido fica fora, nunca vira zero) */
export function atingimento(realizado: unknown, I: Intervalo | null | undefined) {
  if (!I || I.estado === 'invalido') return { v: null, motivo: 'intervalo inválido' };
  if (I.estado === 'parcial') return { v: null, motivo: `meta desconhecida em parte do período (${I.desconhecidos.join(', ')})` };
  if (!(I.v != null && I.v > 0)) return { v: null, motivo: 'sem meta no período' };
  return { v: (num(realizado) ?? 0) / I.v, motivo: '' };
}
/* ano (D18): tot = intervalo do ano inteiro (todos os ciclos), acum = do início do ano até a data de referência */
export function anual(tot: Intervalo, acum: Intervalo, realizado: unknown) {
  const real = num(realizado) ?? 0;
  const out = { metaTotal: tot.v, metaTotalEstado: tot.estado, metaAcum: acum.v, metaAcumEstado: acum.estado, realizado: real, atingAcum: null as number | null, projecao: null as number | null, atingProj: null as number | null, fracDecorrida: null as number | null, metodo: '', notas: [] as string[] };
  const at = atingimento(real, acum); out.atingAcum = at.v; if (at.v == null) out.notas.push('atingimento acumulado não calculado: ' + at.motivo);
  if (tot.estado === 'parcial') out.notas.push(`meta final do ano incompleta: ${tot.desconhecidos.join(', ')} com meta desconhecida`);
  const fr = tot.pesoParte > 0 ? acum.pesoParte / tot.pesoParte : null; out.fracDecorrida = fr;
  if (fr != null && fr >= PROJECAO_MINIMA && fr < 1) {
    out.projecao = real / fr; out.metodo = `ritmo por dias elegíveis: realizado ÷ fração ponderada do ano já decorrida (${Math.round(fr * 100)}%)`;
    if (tot.estado === 'ok' && tot.v != null && tot.v > 0) out.atingProj = out.projecao / tot.v; else out.notas.push('projeção de atingimento não calculada: meta final do ano incompleta');
  } else if (fr != null && fr >= 1) { out.projecao = real; out.metodo = 'ano encerrado: projeção = realizado'; if (tot.estado === 'ok' && tot.v != null && tot.v > 0) out.atingProj = real / tot.v; }
  else out.notas.push(`projeção do ano não calculada: menos de ${Math.round(PROJECAO_MINIMA * 100)}% dos dias elegíveis do ano decorridos`);
  return out;
}
