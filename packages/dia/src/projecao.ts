/* "Vamos bater a meta?": projeção do ciclo, chance de bater e sinais com veredito. Regras puras portadas do LAB V1
   (lab_plan.js: lpProjecoes, lpSinais, lpImpactoVendas; lab.js: labForecast). Nada aqui lê banco nem relógio. */
import { brl, classeDesvio, limiares, veredito, type Limiares, type OrigemSinal, type Veredito } from './objetivos.js';

export const VERSAO_PROJECAO = '2026-10-29.1';
const DIA = 86_400_000;
export const FORA_X = 5;   // negócio acima de 5× o ticket fica fora da projeção (pendurar a projeção num negócio só mente)

/* dias úteis decorridos: os anteriores a hoje contam 1; hoje conta a fração do ritual (manhã 0, tarde ½, fim 1; a V1 usava ½ fixo) */
export function decorridos(uteis: string[], hoje: string, fracaoHoje = 0.5): number {
  return uteis.filter(d => d < hoje).length + (uteis.includes(hoje) ? fracaoHoje : 0);
}
/* P(X ≥ k) para X ~ Poisson(λ) */
export function poissonPeloMenos(k: number, lam: number): number {
  if (k <= 0) return 1; if (!(lam > 0)) return 0;
  let s = 0, t = Math.exp(-lam); for (let i = 0; i < k; i++) { s += t; t *= lam / (i + 1); }
  return Math.max(0, Math.min(1, 1 - s));
}
/* ritmo de leads por dia útil: até o 5º dia útil o ritmo do ciclo é misturado ao dos últimos 90 dias (peso = dd ÷ 5); depois vale só o do ciclo */
export function ritmoDeLeads(dd: number, leadsCiclo: number, leads90: number, du90: number) {
  const rAtual = dd >= 1 ? leadsCiclo / dd : null, rHist = leads90 > 0 && du90 > 0 ? leads90 / du90 : null, pesoAt = Math.min(1, dd / 5);
  const ritmo = rAtual == null ? (dd > 0 ? rHist : null) : rHist == null ? rAtual : pesoAt * rAtual + (1 - pesoAt) * rHist;
  return { ritmo, rAtual, rHist, pesoAt };
}

/* ---------- forecast do pipeline: p(venda | etapa) × p(fechar a tempo), com os negócios fora da curva à parte ---------- */
export interface EtapaForecast { chave: string; nome: string; n: number; g: number; duracoes: number[]; abertos: Array<{ id: string; nome: string; valor: number; dono?: string | null }> }
export function forecastPipeline(etapas: EtapaForecast[], restanteDias: number, ticket: number | null, foraX = FORA_X) {
  const limite = ticket && ticket > 0 ? ticket * foraX : null, fora: Array<{ id: string; nome: string; dono: string | null; etapa: string; valor: number; pv: number | null; pt: number | null; vendas: number; esperado: number }> = [];
  const et = etapas.map(e => {
    const pv = e.n ? e.g / e.n : null, pt = e.duracoes.length ? e.duracoes.filter(x => x <= restanteDias).length / e.duracoes.length : null;
    const ehFora = (d: { valor: number }) => limite != null && d.valor > limite, dentro = e.abertos.filter(d => !ehFora(d));
    for (const d of e.abertos.filter(ehFora)) fora.push({ id: d.id, nome: d.nome, dono: d.dono ?? null, etapa: e.nome, valor: d.valor, pv, pt, vendas: (pv ?? 0) * (pt ?? 0), esperado: d.valor * (pv ?? 0) * (pt ?? 0) });
    const valor = e.abertos.reduce((s, d) => s + d.valor, 0), valorC = dentro.reduce((s, d) => s + d.valor, 0);
    return { chave: e.chave, nome: e.nome, n: e.n, g: e.g, pv, pt, nDur: e.duracoes.length, abertos: e.abertos.length, foraN: e.abertos.length - dentro.length, valor, pond: valorC * (pv ?? 0), noPrazo: valorC * (pv ?? 0) * (pt ?? 0), vendas: dentro.length * (pv ?? 0) * (pt ?? 0) };
  });
  fora.sort((a, b) => b.esperado - a.esperado);
  return { et, limite, fora, pipe: et.reduce((s, x) => s + x.valor, 0), pond: et.reduce((s, x) => s + x.pond, 0), noPrazo: et.reduce((s, x) => s + x.noPrazo, 0), pipeV: et.reduce((s, x) => s + x.vendas, 0), foraV: fora.reduce((s, x) => s + x.esperado, 0), foraVendas: fora.reduce((s, x) => s + x.vendas, 0) };
}

/* ---------- as quatro projeções: planejada, ritmo atual, histórica (realizado + pipeline), ajustada (+ leads que ainda entram) ---------- */
export interface EntradaProjecao {
  du: number; dd: number; encerrado?: boolean; futuro?: boolean;
  vendasReal: number; receitaReal: number; pipeV: number; pipeR: number; cabe: number;
  leadsCiclo: number; leads90: number; du90: number; taxaLeadVenda: number | null; ticket: number | null; nTicket: number; minN?: number;
  metas: { vendas?: number | null; receita?: number | null };
}
export interface Projecao {
  du: number; dd: number; rest: number; encerrado: boolean; futuro: boolean; fragil: boolean;
  vendas: { real: number; plan: number | null; ritmo: number | null; hist: number | null; ajust: number | null };
  receita: { real: number; plan: number | null; ritmo: number | null; hist: number | null; ajust: number | null };
  comp: { real: number; pipe: number; novas: number } | null; cabe: number; novasV: number; pipeV: number; leadsRest: number | null;
  ritmoLeads: number | null; ritmoAtual: number | null; ritmoHist: number | null; pesoAtual: number; prob: number | null; probMotivo: string | null;
}
export function projecoes(e: EntradaProjecao): Projecao {
  const rest = Math.max(0, e.du - e.dd), encerrado = !!e.encerrado, futuro = !!e.futuro, tk = e.ticket ?? 0;
  const RL = ritmoDeLeads(e.dd, e.leadsCiclo, e.leads90, e.du90);
  const leadsRest = RL.ritmo != null ? RL.ritmo * rest : null, novasV = leadsRest != null && e.taxaLeadVenda ? leadsRest * e.taxaLeadVenda * e.cabe : 0;
  const vd = e.vendasReal, vr = e.receitaReal;
  const vendas: Projecao['vendas'] = { real: vd, plan: e.metas.vendas ?? null, ritmo: encerrado ? vd : e.dd >= 1 ? vd + (vd / e.dd) * rest : null, hist: encerrado ? vd : vd + e.pipeV, ajust: null };
  const receita: Projecao['receita'] = { real: vr, plan: e.metas.receita ?? (e.metas.vendas != null && tk ? e.metas.vendas * tk : null), ritmo: encerrado ? vr : e.dd >= 1 ? vr + (vr / e.dd) * rest : null, hist: encerrado ? vr : vr + e.pipeR, ajust: null };
  vendas.ajust = encerrado ? vd : vendas.hist! + novasV; receita.ajust = encerrado ? vr : receita.hist! + novasV * tk;
  if (futuro) { vendas.hist = vendas.ajust = vendas.ritmo = null; receita.hist = receita.ajust = receita.ritmo = null; }
  const r: Projecao = { du: e.du, dd: e.dd, rest, encerrado, futuro, fragil: e.dd < 3, vendas, receita, comp: encerrado || futuro ? null : { real: vr, pipe: e.pipeR, novas: novasV * tk },
    cabe: e.cabe, novasV, pipeV: e.pipeV, leadsRest, ritmoLeads: RL.ritmo, ritmoAtual: RL.rAtual, ritmoHist: RL.rHist, pesoAtual: RL.pesoAt, prob: null, probMotivo: null };
  /* chance de bater a meta de vendas: Poisson com média = vendas que ainda devem entrar pela projeção ajustada; só com amostra de ticket */
  const mv = e.metas.vendas;
  if (mv == null) r.probMotivo = 'sem meta de vendas';
  else if (encerrado || futuro) r.probMotivo = encerrado ? 'ciclo encerrado' : 'ciclo ainda não começou';
  else if (e.nTicket < (e.minN ?? 10)) r.probMotivo = `poucas vendas na janela histórica (${e.nTicket} de ${e.minN ?? 10})`;
  else r.prob = poissonPeloMenos(Math.ceil(mv - vd), Math.max(0, (vendas.ajust ?? 0) - vd));
  return r;
}

/* ---------- impacto estimado de um déficit numa etapa: leva o déficit pelas taxas até vendas × ticket ---------- */
export type TaxasCadeia = Partial<Record<'leads>agendamento' | 'agendamento>reuniao_realizada' | 'reuniao_realizada>oportunidades' | 'oportunidades>vendas', number | null>>;
const ORDEM = ['leads', 'agendamento', 'reuniao_realizada', 'oportunidades', 'vendas'] as const;
const PASSO: Record<string, keyof TaxasCadeia> = { leads: 'leads>agendamento', agendamento: 'agendamento>reuniao_realizada', reuniao_realizada: 'reuniao_realizada>oportunidades', oportunidades: 'oportunidades>vendas' };
export function impactoVendas(ind: string, def: number, taxas: TaxasCadeia, ticket: number | null, extra?: { agendamentoPorContato?: number | null; contatoPorTentativa?: number | null }): { receita: number | null; vendas?: number; txt: string } {
  let x = def, k: string = ind;
  if (!(def > 0)) return { receita: null, txt: '' };
  if (ind === 'tentativa') { if (!(extra?.contatoPorTentativa! > 0)) return { receita: null, txt: 'sem taxa histórica para estimar' }; x *= extra!.contatoPorTentativa!; k = 'contato'; }
  if (k === 'contato') { if (!(extra?.agendamentoPorContato! > 0)) return { receita: null, txt: 'sem taxa histórica para estimar' }; x *= extra!.agendamentoPorContato!; k = 'agendamento'; }
  if (k === 'proposta_enviada') k = 'oportunidades';
  let i = ORDEM.indexOf(k as (typeof ORDEM)[number]); if (i < 0) return { receita: null, txt: '' };
  const passos: string[] = [];
  for (; i < ORDEM.length - 1; i++) { const t = taxas[PASSO[ORDEM[i]!]!]; if (!(t && t > 0)) return { receita: null, txt: 'sem taxa histórica para estimar' }; x *= t; passos.push(Math.round(t * 100) + '%'); }
  const tk = ticket ?? 0;
  return { receita: x * tk, vendas: x, txt: '≈ ' + x.toFixed(1).replace('.', ',') + ' vendas a menos (' + passos.join(' × ') + ') × ticket ' + brl(tk) };
}

/* ---------- sinais e veredito ---------- */
export type Zona = 'topo' | 'meio' | 'fundo' | 'cap' | 'hip';
export const ZONA: Record<string, Zona> = { leads: 'topo', tentativa: 'topo', contato: 'topo', agendamento: 'meio', reuniao_realizada: 'meio', proposta_enviada: 'fundo', oportunidades: 'fundo', vendas: 'fundo', receita: 'fundo' };
export const NOME_ZONA: Record<Zona, string> = { topo: 'Geração de demanda', meio: 'Reuniões e qualificação', fundo: 'Fechamento e receita', cap: 'Capacidade da equipe', hip: 'Hipóteses' };
export interface Sinal { origem: OrigemSinal; ind?: string; z: Zona; grav: 1 | 2 | 3; tit: string; oque: string; esperado: string; desvio: string; impacto: number | null; impTxt?: string; conf: string; investigar: string; acao: string; pessoa?: string; maturacao?: boolean; amostraPequena?: boolean; classe?: { k: string; nome: string; verificar: string } | null }
export interface Incidente { z: Zona; nome: string; L: Sinal[]; grav: number; impacto: number }
export interface EntradaSinais {
  dd: number; du: number; proj: Projecao; metas: { receita?: number | null; vendas?: number | null }; ticket: number | null; nTicket: number; cfg?: Record<string, unknown> | null;
  linhas: Array<{ ind: string; alvo: number; esp: number; real: number | null; semDado?: boolean; semAcesso?: boolean }>;   // metas da empresa: volumes (não taxas)
  taxas: TaxasCadeia; extra?: { agendamentoPorContato?: number | null; contatoPorTentativa?: number | null };
  leadsAdicionais?: number | null;
  capacidade?: Array<{ pessoa: string; campo: string; cap: number; nec: number }>;
  conversoes?: Array<{ ind: string; nome: string; z: Zona; mes: { v: number; n: number } | null; hist: { v: number; n: number } | null }>;
  nomes: Record<string, string>; fmt: (ind: string, v: number) => string;
}
export function sinais(X: EntradaSinais): { sinais: Sinal[]; incidentes: Incidente[]; veredito: Veredito; volOk: boolean | null; limiares: Limiares } {
  const L = limiares(X.cfg), out: Sinal[] = [], minN = L.minN, proj = X.proj, nome = (k: string) => X.nomes[k] ?? k, f = X.fmt;
  if (proj.futuro) return { sinais: [], incidentes: [], veredito: veredito({ dadosFaltam: false }), volOk: null, limiares: L };
  const mr = X.metas.receita ?? null, mv = X.metas.vendas ?? null;
  /* meta em risco (receita tem precedência sobre vendas) */
  if (!proj.encerrado && X.dd >= 2) {
    if (mr != null && proj.receita.ajust != null && proj.receita.ajust < mr * L.metaRisco) { const gap = mr - proj.receita.ajust;
      out.push({ origem: 'meta', ind: 'receita', maturacao: proj.cabe < 0.5, z: 'fundo', grav: gap / mr > 0.25 ? 3 : 2, tit: 'Meta de receita em risco', oque: 'A projeção ajustada de fechamento é ' + brl(proj.receita.ajust) + '.', esperado: 'Meta ' + brl(mr) + '.', desvio: '−' + brl(gap) + ' (' + Math.round((gap / mr) * 100) + '%)', impacto: gap, conf: proj.fragil ? 'baixa (poucos dias úteis decorridos)' : X.nTicket >= minN ? 'média' : 'baixa (poucas vendas na janela)', investigar: 'Quais etapas estão abaixo da trajetória e quanto o pipeline aberto ainda rende.', acao: 'Rever o plano reverso: o adicional de leads/reuniões necessário até o fim do ciclo.' }); }
    else if (mv != null && proj.vendas.ajust != null && proj.vendas.ajust < mv * L.metaRisco) { const gap = mv - proj.vendas.ajust;
      out.push({ origem: 'meta', ind: 'vendas', maturacao: proj.cabe < 0.5, z: 'fundo', grav: gap / mv > 0.25 ? 3 : 2, tit: 'Meta de vendas em risco', oque: 'A projeção ajustada é ' + gap.toFixed(1).replace('.', ',') + ' vendas abaixo.', esperado: mv + ' vendas.', desvio: '−' + gap.toFixed(1).replace('.', ',') + ' vendas', impacto: gap * (X.ticket ?? 0), conf: proj.fragil ? 'baixa' : 'média', investigar: 'Etapas abaixo da trajetória e pipeline aberto.', acao: 'Plano reverso: o que falta gerar a partir de hoje.' }); }
  }
  /* indicadores atrás da trajetória esperada (volumes da empresa) */
  for (const l of X.linhas) { if (!(X.dd >= 2) || l.real == null || !(l.esp > 0) || l.real >= l.esp * L.trajetoria || l.ind === 'vendas' || l.ind === 'receita') continue;
    const def = l.esp - l.real, chain = impactoVendas(l.ind, def, X.taxas, X.ticket, X.extra), z = ZONA[l.ind] ?? 'topo';
    out.push({ origem: 'trajetoria', ind: l.ind, z, grav: l.real < l.esp * L.trajetoriaGrave ? 3 : 2, tit: nome(l.ind) + ' abaixo da trajetória', oque: f(l.ind, l.real) + ' até hoje.', esperado: f(l.ind, l.esp) + ' até hoje (meta ' + f(l.ind, l.alvo) + ' no ciclo, proporcional aos dias úteis).', desvio: '−' + f(l.ind, def) + ' (' + Math.round((def / l.esp) * 100) + '%)', impacto: chain.receita, impTxt: chain.txt, conf: X.dd < 3 ? 'baixa (início do ciclo)' : 'média', investigar: z === 'topo' ? 'Volume de prospecção, taxa de contato e origem dos leads.' : z === 'meio' ? 'Comparecimento, qualidade dos agendamentos e conversão reunião → oportunidade.' : 'Propostas paradas e negociações sem avanço.', acao: 'Abrir uma hipótese ou registrar uma ação corretiva.' }); }
  /* demanda insuficiente para o plano reverso */
  if (X.leadsAdicionais != null && !proj.encerrado && X.dd >= 1 && proj.ritmoLeads != null) { const ritmo = proj.ritmoLeads * Math.max(0, X.du - X.dd);
    if (ritmo < X.leadsAdicionais * 0.9) out.push({ origem: 'demanda', ind: 'leads', z: 'topo', grav: 2, tit: 'Geração de demanda insuficiente para a meta', oque: 'No ritmo atual entram mais ' + Math.round(ritmo) + ' leads até o fim do ciclo.', esperado: 'O plano reverso pede +' + Math.round(X.leadsAdicionais) + ' leads novos (descontado o que o pipeline já deve fechar).', desvio: '−' + Math.round(X.leadsAdicionais - ritmo) + ' leads', impacto: impactoVendas('leads', X.leadsAdicionais - ritmo, X.taxas, X.ticket).receita, conf: 'média', investigar: 'Canais com menos entrada que o normal.', acao: 'Reforçar a geração de demanda ou rever a meta.' }); }
  /* capacidade por pessoa */
  for (const c of X.capacidade ?? []) { const deficit = c.nec - c.cap; if (!(deficit > 0)) continue;
    out.push({ origem: 'capacidade', ind: 'tentativa', pessoa: c.pessoa, z: 'cap', grav: deficit / c.cap > 0.3 ? 3 : 2, tit: c.pessoa + ': atividade necessária acima da capacidade', oque: 'Para a parte dela(e) na meta, precisaria de ' + Math.round(c.nec) + ' ' + c.campo + '/dia útil.', esperado: 'Capacidade: ' + Math.round(c.cap) + '/dia.', desvio: '+' + Math.round(deficit) + '/dia', impacto: null, conf: 'alta (cálculo direto das premissas)', investigar: 'Conversão da pessoa (melhorar eficiência reduz o volume necessário).', acao: 'Melhorar conversão, redistribuir leads, aumentar capacidade ou rever a meta.' }); }
  /* conversões do ciclo × histórico (com maturação: só sinaliza com amostra; amostra pequena sai com confiança baixa, nunca some) */
  for (const c of X.conversoes ?? []) { const m = c.mes, h = c.hist; if (!m || !h || !(m.n >= 2) || !(h.n >= 2) || !(m.v < h.v * L.conversao)) continue; const pequena = m.n < minN || h.n < minN;
    out.push({ origem: 'conversao', ind: c.ind, z: c.z, grav: 1, amostraPequena: pequena, tit: c.nome + ' abaixo do histórico' + (pequena ? ' (amostra pequena)' : ''), oque: Math.round(m.v * 100) + '% (coorte do ciclo, n=' + m.n + ', ainda amadurecendo).', esperado: Math.round(h.v * 100) + '% (n=' + h.n + ').', desvio: (Math.round((m.v - h.v) * 1000) / 10).toLocaleString('pt-BR') + ' p.p.', impacto: null, conf: pequena ? 'baixa: amostra abaixo da mínima (' + minN + ')' : 'baixa: coorte recente ainda pode avançar', investigar: 'Etapa seguinte do funil.' + (pequena ? ' Confirme com mais observações antes de agir.' : ''), acao: pequena ? 'Acompanhar; não tratar como fato até a amostra chegar à mínima.' : 'Acompanhar; se persistir por 2 semanas, abrir hipótese.' }); }
  /* atividade em dia, resultado abaixo: volume ok nunca significa resultado ok */
  const vs = X.linhas.filter(l => /^(leads|tentativa|contato|agendamento|reuniao_realizada)$/.test(l.ind) && l.real != null && l.esp > 0), volOk = vs.length ? vs.every(l => l.real! >= l.esp * L.volumeOk) : null;
  const espR = X.linhas.find(l => l.ind === 'receita');
  if (volOk && espR && espR.esp > 0 && X.dd >= 2 && !proj.encerrado && proj.receita.real < espR.esp * L.trajetoria)
    out.push({ origem: 'resultado', ind: 'receita', z: 'fundo', grav: 2, tit: 'Atividade em dia, resultado abaixo do esperado', oque: 'Receita realizada ' + brl(proj.receita.real) + ' até hoje com o volume de atividade dentro do plano.', esperado: brl(espR.esp) + ' até hoje (meta proporcional aos dias úteis).', desvio: '−' + brl(espR.esp - proj.receita.real), impacto: null, conf: 'observado', investigar: 'Conversão por etapa, qualidade da demanda por canal, ticket e maturação; não é falta de atividade.', acao: 'Olhar a classe de cada sinal de conversão antes de pedir mais volume.' });
  /* dados ausentes que impedem o diagnóstico */
  const faltam = X.linhas.filter(l => l.semDado || l.semAcesso).map(l => nome(l.ind) + (l.semAcesso ? ' (sem acesso)' : ''));
  if (faltam.length && X.dd >= 2) out.push({ origem: 'dados', z: 'topo', grav: 1, tit: 'Metas sem dado para medir', oque: faltam.join(', ') + '.', esperado: 'Registro das atividades ou do funil (ou a fonte conectada).', desvio: '', impacto: null, conf: 'não avaliável', investigar: 'se a atividade acontece e não é registrada, o LAB não enxerga; sem dado não há diagnóstico', acao: 'corrigir o registro antes de cobrar resultado' });
  /* classe do desvio e veredito conjunto */
  for (const s of out) s.classe = classeDesvio({ origem: s.origem, ind: s.ind, volOk: !!volOk, maturacao: s.maturacao });
  const V = veredito({ metaRisco: X.dd >= 2 && !proj.encerrado && (mr != null || mv != null) ? out.some(s => s.origem === 'meta') : null, volOk, convBaixa: out.some(s => s.origem === 'conversao' || s.origem === 'resultado'), confBaixa: out.some(s => s.amostraPequena), dadosFaltam: out.some(s => s.origem === 'dados') });
  /* incidentes por zona: gravidade máxima; impacto = o maior (sinais encadeados contariam o mesmo dinheiro duas vezes) */
  const inc: Partial<Record<Zona, Incidente>> = {};
  for (const s of out) (inc[s.z] = inc[s.z] ?? { z: s.z, nome: NOME_ZONA[s.z], L: [], grav: 0, impacto: 0 }).L.push(s);
  const incidentes = Object.values(inc).map(I => ({ ...I, grav: Math.max(...I.L.map(s => s.grav)), impacto: Math.max(...I.L.map(s => s.impacto ?? 0)) })).sort((a, b) => b.grav - a.grav || b.impacto - a.impacto);
  return { sinais: out, incidentes, veredito: V, volOk, limiares: L };
}
