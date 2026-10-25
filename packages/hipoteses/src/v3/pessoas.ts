/* Pessoas: benchmark entre vendedores, receita potencial, gargalos, sensibilidade, alertas, matriz volume × eficiência,
   transferência de performance, drill-down e lista de leads. Puro: recebe a coorte já carregada (um registro por negócio).
   Espelha lab.js da V1 (labCalc, labPotencial, labAlertas, labMatriz, labTransf, labDrill, labLeads). */
import { wilson } from '@lab/metricas';

const DIA = 86_400_000;
export const mediana = (a: number[]): number | null => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = Math.floor(s.length / 2); return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2; };
export const quantil = (a: number[], q: number): number | null => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), p = (s.length - 1) * q, i = Math.floor(p); return s[i]! + (s[Math.min(i + 1, s.length - 1)]! - s[i]!) * (p - i); };
const media = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

/* um negócio da coorte: alcance = maior etapa atingida (índice em E); entrouEm[i] = quando chegou na etapa i (ms) */
export interface NegocioPessoa {
  id: string; nome?: string | null; pessoa: string | null; canal: string | null; segmento?: string | null;
  criadoEm: number; fechadoEm: number | null; status: 'aberto' | 'ganho' | 'perdido'; alcance: number; entrouEm: Array<number | null>; valor: number | null; etapaAtual?: string | null;
}
export interface Funil {
  E: string[]; N: number[]; conv: Array<number | null>; perdas: number[]; valorEt: number[]; tempo: Array<number | null>; tempoN: number[];
  vendas: number; receita: number; ticket: number | null; nTicket: number; ciclo: number | null; total: number | null; pop: NegocioPessoa[];
}
/* funil de uma população: volumes, taxas, ticket, ciclo, tempos e receita (identidade: entradas × taxas × ticket) */
export function funilDe(pop: NegocioPessoa[], E: string[]): Funil {
  const N = E.map(() => 0), perdas = E.map(() => 0), tempos: number[][] = E.map(() => []), valorEt = E.map(() => 0), ganhos: NegocioPessoa[] = [];
  for (const d of pop) {
    const al = Math.min(d.alcance, E.length - 1);
    for (let i = 0; i <= al; i++) N[i]!++;
    if (d.status === 'perdido') perdas[al]!++;
    const v = d.valor ?? 0; for (let i = 0; i <= al; i++) valorEt[i]! += v;
    for (let i = 0; i < al; i++) { const t0 = d.entrouEm[i], t1 = d.entrouEm[i + 1]; if (t0 && t1 && t1 >= t0) tempos[i]!.push((t1 - t0) / DIA); }
    if (d.status === 'ganho') ganhos.push(d);
  }
  const conv = E.slice(0, -1).map((_, i) => (N[i] ? N[i + 1]! / N[i]! : null));
  const vals = ganhos.map(d => d.valor ?? 0).filter(v => v > 0), receita = vals.reduce((s, v) => s + v, 0), ticket = vals.length ? receita / vals.length : null;
  const ciclo = media(ganhos.map(d => ((d.fechadoEm ?? 0) - d.criadoEm) / DIA).filter(x => x >= 0));
  return { E, N, conv, perdas, valorEt, tempo: tempos.map(t => media(t)), tempoN: tempos.map(t => t.length), vendas: N[N.length - 1]!, receita, ticket, nTicket: vals.length, ciclo, total: N[0] ? N[N.length - 1]! / N[0]! : null, pop };
}
/* receita pela fórmula explícita (taxa nula conta 0) */
export const receitaFormula = (entradas: number, taxas: Array<number | null>, ticket: number | null | undefined): number => taxas.reduce<number>((x, t) => x * (t ?? 0), entradas) * (ticket ?? 0);
export function passos(E: string[], entradas: number, taxas: Array<number | null>, ticket: number | null): Array<{ de: number; taxa: number | null; para: number; etapa: string }> {
  let x = entradas; return taxas.map((t, i) => { const y = x * (t ?? 0); const p = { de: x, taxa: t, para: y, etapa: E[i + 1]! }; x = y; return p; });
}

export interface Bench { mediana: number | null; p75: number | null; max: number | null; n: number }
export interface Pessoas { E: string[]; vends: string[]; porV: Record<string, Funil>; equipe: Funil; bench: Bench[]; minN: number; ticketMediano: number | null; coorte: NegocioPessoa[] }
/* tudo o que as telas usam, calculado uma vez: funil por vendedor e da equipe, benchmark por etapa (vendedores com n ≥ minN) */
export function calcularPessoas(coorte: NegocioPessoa[], E: string[], minN = 5): Pessoas {
  const vends = [...new Set(coorte.map(d => d.pessoa).filter((p): p is string => !!p))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const porV: Record<string, Funil> = {}; for (const v of vends) porV[v] = funilDe(coorte.filter(d => d.pessoa === v), E);
  const equipe = funilDe(coorte, E);
  const bench = E.slice(0, -1).map((_, i) => { const xs = vends.filter(v => porV[v]!.N[i]! >= minN).map(v => porV[v]!.conv[i]).filter((x): x is number => x != null); return { mediana: mediana(xs), p75: quantil(xs, 0.75), max: xs.length ? Math.max(...xs) : null, n: xs.length }; });
  const ticketsV = vends.filter(v => porV[v]!.nTicket >= 2).map(v => porV[v]!.ticket!);
  return { E, vends, porV, equipe, bench, minN, ticketMediano: mediana(ticketsV), coorte };
}

/* receita potencial: leva cada etapa ao benchmark (quartil superior) e recalcula; efeito isolado por etapa */
export interface Potencial { i: number; ganho: number; de: number | null; para: number | null }
export function potencial(F: Funil, bench: Bench[], ticketRef: number | null): Potencial[] {
  const t = F.ticket ?? ticketRef ?? 0, base = receitaFormula(F.N[0]!, F.conv, t);
  return F.conv.map((c, i) => { const b = bench[i]?.p75 ?? null; if (b == null || c == null || c >= b) return { i, ganho: 0, de: c, para: b }; const tx = [...F.conv]; tx[i] = b; return { i, ganho: receitaFormula(F.N[0]!, tx, t) - base, de: c, para: b }; });
}
/* gargalos da equipe: soma, vendedor a vendedor, do que entraria no benchmark (ou do vendedor em foco) */
export interface Gargalo { i: number; de: string; para: string; conv: number | null; bench: number | null; gap: number | null; volume: number; total: number; afetados: Array<{ v: string; ganho: number; de: number | null }> }
export function gargalos(X: Pessoas, foco?: string | null): Gargalo[] {
  const F = foco ? (X.porV[foco] ?? X.equipe) : X.equipe;
  return X.E.slice(0, -1).map((_, i) => {
    const pots = foco ? [] : X.vends.map(v => ({ v, g: potencial(X.porV[v]!, X.bench, X.ticketMediano)[i]! })).filter(x => x.g.ganho > 0).sort((a, b) => b.g.ganho - a.g.ganho);
    const total = foco ? potencial(F, X.bench, X.ticketMediano)[i]!.ganho : pots.reduce((s, x) => s + x.g.ganho, 0), b = X.bench[i]!.p75;
    return { i, de: X.E[i]!, para: X.E[i + 1]!, conv: F.conv[i]!, bench: b, gap: F.conv[i] != null && b != null ? F.conv[i]! - b : null, volume: F.N[i]!, total, afetados: pots.map(x => ({ v: x.v, ganho: x.g.ganho, de: x.g.de })) };
  }).sort((a, b) => b.total - a.total);
}
/* sensibilidade: +10% relativo em cada variável (as demais fixas) e "se chegar ao benchmark" */
export function sensibilidade(X: Pessoas, F: Funil) {
  const tk = F.ticket ?? X.ticketMediano ?? 0, base = receitaFormula(F.N[0]!, F.conv, tk);
  const linhas: Array<{ k: string; nome: string; atual: number | null; mais10: number; impacto: number; bench: number | null }> = [{ k: 'vol', nome: X.E[0]! + ' (entradas)', atual: F.N[0]!, mais10: receitaFormula(F.N[0]! * 1.1, F.conv, tk), impacto: 0, bench: null }];
  F.conv.forEach((c, i) => { const t = [...F.conv]; t[i] = c == null ? null : Math.min(1, c * 1.1); const b = X.bench[i]!.p75; const tb = [...F.conv]; if (b != null && c != null && b > c) tb[i] = b; linhas.push({ k: 't' + i, nome: X.E[i]! + ' → ' + X.E[i + 1]!, atual: c, mais10: receitaFormula(F.N[0]!, t, tk), impacto: 0, bench: b != null && c != null && b > c ? receitaFormula(F.N[0]!, tb, tk) - base : null }); });
  linhas.push({ k: 'tk', nome: 'Ticket', atual: tk, mais10: receitaFormula(F.N[0]!, F.conv, tk * 1.1), impacto: 0, bench: null });
  for (const l of linhas) l.impacto = l.mais10 - base;
  return { base, linhas: linhas.sort((a, b) => b.impacto - a.impacto) };
}

/* alertas de inteligência: gargalo (≥ 10 p.p. abaixo da mediana), oportunidade (converte 1,15× a equipe com < 0,7× do volume médio),
   anomalia (taxa de ganho nos últimos 60 dias < 0,75× o histórico anterior), tendência (ticket 4 semanas × 4 anteriores, ≥ 10%) */
export interface Alerta { t: 'gargalo' | 'oport' | 'anom' | 'tend'; pessoa?: string; i?: number; txt: string; dados: Record<string, number | null> }
export interface Encerrado { pessoa: string | null; status: 'ganho' | 'perdido'; fechadoEm: number; valor: number | null }
const pct = (v: number | null | undefined, d = 1) => (v == null || !Number.isFinite(v) ? '—' : (v * 100).toFixed(d).replace('.', ',') + '%');
const brl = (v: number) => 'R$ ' + Math.round(v).toLocaleString('pt-BR');
export function alertas(X: Pessoas, encerrados: Encerrado[] = [], agora = Date.now()): Alerta[] {
  const out: Alerta[] = [], E = X.E, minN = X.minN;
  E.slice(0, -1).forEach((_, i) => { const b = X.bench[i]!; for (const v of X.vends) { const F = X.porV[v]!; if (F.N[i]! >= minN && b.mediana != null && F.conv[i] != null && b.mediana - F.conv[i]! >= 0.10) out.push({ t: 'gargalo', pessoa: v, i, txt: `${v}: ${E[i]} → ${E[i + 1]} está ${((b.mediana - F.conv[i]!) * 100).toFixed(1).replace('.', ',')} p.p. abaixo da mediana dos vendedores (${pct(F.conv[i])} contra ${pct(b.mediana)}, n=${F.N[i]}).`, dados: { conv: F.conv[i]!, mediana: b.mediana, n: F.N[i]! } }); } });
  const volMedio = media(X.vends.map(v => X.porV[v]!.N[0]!));
  for (const v of X.vends) { const F = X.porV[v]!; if (F.N[0]! >= minN && X.equipe.total != null && F.total != null && F.total > X.equipe.total * 1.15 && volMedio && F.N[0]! < volMedio * 0.7) out.push({ t: 'oport', pessoa: v, txt: `${v} converte ${pct(F.total)} das entradas (equipe ${pct(X.equipe.total)}), mas recebeu ${Math.round((1 - F.N[0]! / volMedio) * 100)}% menos oportunidades que a média.`, dados: { total: F.total, equipe: X.equipe.total, volume: F.N[0]!, volMedio } }); }
  for (const v of X.vends) {
    const b = encerrados.filter(d => d.pessoa === v), rec = b.filter(d => d.fechadoEm >= agora - 60 * DIA), ant = b.filter(d => d.fechadoEm < agora - 60 * DIA);
    if (rec.length >= minN && ant.length >= minN) { const r1 = rec.filter(d => d.status === 'ganho').length / rec.length, r0 = ant.filter(d => d.status === 'ganho').length / ant.length; if (r0 > 0 && r1 < r0 * 0.75) out.push({ t: 'anom', pessoa: v, txt: `A taxa de ganho de ${v} nos últimos 60 dias (${pct(r1)}, n=${rec.length}) caiu ${Math.round((1 - r1 / r0) * 100)}% em relação ao histórico anterior (${pct(r0)}, n=${ant.length}).`, dados: { recente: r1, anterior: r0, nRec: rec.length, nAnt: ant.length } }); }
  }
  const g = encerrados.filter(d => d.status === 'ganho' && (d.valor ?? 0) > 0), tk = (a: number, b: number) => { const xs = g.filter(d => d.fechadoEm >= a && d.fechadoEm < b).map(d => d.valor!); return { m: media(xs), n: xs.length }; };
  const t1 = tk(agora - 28 * DIA, agora + 1), t0 = tk(agora - 56 * DIA, agora - 28 * DIA);
  if (t1.n >= 3 && t0.n >= 3 && t0.m && t1.m != null && Math.abs(t1.m / t0.m - 1) >= 0.10) out.push({ t: 'tend', txt: `Ticket médio ${t1.m > t0.m ? 'subiu' : 'caiu'} ${Math.round(Math.abs(t1.m / t0.m - 1) * 100)}% nas últimas 4 semanas (${brl(t1.m)}, n=${t1.n} contra ${brl(t0.m)}, n=${t0.n}).`, dados: { atual: t1.m, anterior: t0.m, nAtual: t1.n, nAnterior: t0.n } });
  return out;
}

/* matriz volume × eficiência: linhas nas medianas; cada quadrante sugere uma investigação, não um julgamento */
export const QUADRANTE_HIPOTESE: Record<string, string> = {
  'alto volume · baixa eficiência': 'Investigar qualificação e condução: muita entrada, pouca conversão.',
  'baixo volume · alta eficiência': 'Testar mais volume: converte bem, recebe pouco.',
  'alto volume · alta eficiência': 'Estudar o que faz e documentar como padrão.',
  'baixo volume · baixa eficiência': 'Investigar prospecção e método; checar carga e origem dos leads.',
};
export function matriz(X: Pessoas) {
  const pts = X.vends.filter(v => X.porV[v]!.N[0]! > 0).map(v => ({ v, x: X.porV[v]!.N[0]!, y: X.porV[v]!.total ?? 0 }));
  if (!pts.length) return { pts: [], mX: null, mY: null };
  const mX = mediana(pts.map(p => p.x))!, mY = mediana(pts.map(p => p.y))!;
  return { mX, mY, pts: pts.map(p => { const q = (p.x >= mX ? 'alto volume' : 'baixo volume') + ' · ' + (p.y >= mY ? 'alta eficiência' : 'baixa eficiência'); return { ...p, quadrante: q, hipotese: QUADRANTE_HIPOTESE[q]! }; }) };
}
/* pontos fortes de uma pessoa: etapas no quartil superior, ticket acima da mediana, volume acima da mediana */
export function pontosFortes(X: Pessoas, v: string): string[] {
  const F = X.porV[v]; if (!F) return []; const out: string[] = [];
  F.conv.forEach((c, i) => { const b = X.bench[i]!; if (c != null && b.p75 != null && F.N[i]! >= X.minN && c >= b.p75) out.push(`${X.E[i]} → ${X.E[i + 1]} (${pct(c)}, quartil superior)`); });
  if (F.ticket && X.ticketMediano && F.ticket > X.ticketMediano * 1.05) out.push(`Ticket ${Math.round((F.ticket / X.ticketMediano - 1) * 100)}% acima da mediana (${brl(F.ticket)})`);
  const volMed = mediana(X.vends.map(x => X.porV[x]!.N[0]!)); if (volMed != null && F.N[0]! > volMed * 1.1) out.push(`Volume de entradas acima da mediana (${F.N[0]} contra ${Math.round(volMed)})`);
  return out;
}
/* fonte de comparação: equipe, mediana dos vendedores, quartil superior ou outro vendedor */
export interface Fonte { N: Array<number | null>; conv: Array<number | null>; ticket: number | null; ciclo?: number | null; nome: string }
export function fonteDe(X: Pessoas, cmp: string): Fonte | null {
  if (cmp === 'equipe') return { N: X.equipe.N, conv: X.equipe.conv, ticket: X.equipe.ticket, ciclo: X.equipe.ciclo, nome: 'Equipe' };
  if (cmp === 'mediana' || cmp === 'p75') return { N: X.E.map((_, i) => mediana(X.vends.map(x => X.porV[x]!.N[i]!))), conv: X.bench.map(b => (cmp === 'p75' ? b.p75 : b.mediana)), ticket: X.ticketMediano, ciclo: mediana(X.vends.map(x => X.porV[x]!.ciclo).filter((x): x is number => x != null)), nome: cmp === 'p75' ? 'Quartil superior' : 'Mediana dos vendedores' };
  const F = X.porV[cmp]; return F ? { N: F.N, conv: F.conv, ticket: F.ticket, ciclo: F.ciclo, nome: cmp } : null;
}
/* transferência de performance: "e se A tivesse a variável X de B?" — efeito isolado por variável e a combinação marcada */
export function transferencia(X: Pessoas, a: string, b: string, marcadas: string[] = []) {
  const A = X.porV[a], fonte = fonteDe(X, b); if (!A || !fonte) return null;
  const tkA = A.ticket ?? X.ticketMediano ?? 0, base = receitaFormula(A.N[0]!, A.conv, tkA);
  const vars: Array<[string, string]> = [['vol', 'Volume de entradas'], ...X.E.slice(0, -1).map((e, i): [string, string] => ['t' + i, e + ' → ' + X.E[i + 1]!]), ['tk', 'Ticket']];
  const aplica = (sel: string[]) => { let n = A.N[0]!, tx = [...A.conv], tk = tkA; for (const k of sel) { if (k === 'vol') n = fonte.N[0] ?? n; else if (k === 'tk') tk = fonte.ticket ?? tk; else { const i = Number(k.slice(1)); if (fonte.conv[i] != null) tx[i] = fonte.conv[i]!; } } return receitaFormula(n, tx, tk); };
  const val = (F: { N: Array<number | null>; conv: Array<number | null>; ticket: number | null }, k: string) => (k === 'vol' ? F.N[0] ?? null : k === 'tk' ? F.ticket : F.conv[Number(k.slice(1))] ?? null);
  const linhas = vars.map(([k, nome]) => { const r = aplica([k]); return { k, nome, de: val({ N: A.N, conv: A.conv, ticket: tkA }, k), para: val(fonte, k), receita: r, incremento: r - base, pct: base ? r / base - 1 : null }; });
  const comb = aplica(marcadas);
  return { a, b: fonte.nome, base, linhas, combinacao: { marcadas, receita: comb, incremento: comb - base, pct: base ? comb / base - 1 : null } };
}
/* drill-down de uma conversão: de quê, quem, quando, de onde */
export interface LinhaDrill { chave: string; n: number; avancaram: number; conv: number | null; ic: { baixo: number; alto: number } | null }
export function drill(coorte: NegocioPessoa[], i: number, por: (d: NegocioPessoa) => string | null | undefined): LinhaDrill[] {
  const g = new Map<string, NegocioPessoa[]>(); for (const d of coorte) { const k = por(d) || '—'; (g.get(k) ?? g.set(k, []).get(k)!).push(d); }
  return [...g].map(([chave, ds]) => { const n = ds.filter(d => d.alcance >= i).length, a = ds.filter(d => d.alcance >= i + 1).length; return { chave, n, avancaram: a, conv: n ? a / n : null, ic: wilson(a, n) }; }).filter(l => l.n > 0).sort((a, b) => a.chave.localeCompare(b.chave, 'pt-BR'));
}
export const mesDe = (ms: number) => { const t = new Date(ms); return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}`; };
export function drillCompleto(X: Pessoas, i: number, foco?: string | null) {
  const base = foco ? X.coorte.filter(d => d.pessoa === foco) : X.coorte, F = foco ? (X.porV[foco] ?? X.equipe) : X.equipe;
  const pot = foco ? potencial(F, X.bench, X.ticketMediano)[i]!.ganho : X.vends.reduce((s, v) => s + potencial(X.porV[v]!, X.bench, X.ticketMediano)[i]!.ganho, 0);
  return { i, de: X.E[i]!, para: X.E[i + 1]!, conv: F.conv[i]!, n: F.N[i]!, bench: X.bench[i]!.p75, potencial: pot,
    grupos: { ...(foco ? {} : { pessoa: drill(base, i, d => d.pessoa) }), canal: drill(base, i, d => d.canal), mes: drill(base, i, d => mesDe(d.criadoEm)), segmento: drill(base, i, d => d.segmento) } };
}
/* os leads por trás de um número do funil: os da coorte que chegaram na etapa i (ou passaram dela) */
export function leadsDaEtapa(F: Funil, i: number) {
  const ds = F.pop.filter(d => d.alcance >= i).sort((a, b) => b.alcance - a.alcance || (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR'));
  return { etapa: F.E[i]!, total: ds.length, nela: ds.filter(d => d.alcance === i && d.status === 'aberto').length, leads: ds.map(d => ({ id: d.id, nome: d.nome ?? null, pessoa: d.pessoa, canal: d.canal, status: d.status, alcance: d.alcance, etapaAtual: d.etapaAtual ?? F.E[Math.min(d.alcance, F.E.length - 1)]!, criadoEm: d.criadoEm, chegouEm: d.entrouEm[i] ?? null })) };
}
/* meta reversa: quantas entradas para a meta, pelas taxas da base (arredondando para cima em cada etapa) */
export function metaReversa(F: Funil, meta: number, ticketRef: number | null) {
  const tk = F.ticket ?? ticketRef ?? 0; if (!(tk > 0) || !(meta > 0)) return null;
  const vendas = Math.ceil(meta / tk), nec: Array<number | null> = []; let x: number | null = vendas;
  for (let i = F.E.length - 2; i >= 0; i--) { const t = F.conv[i]; nec[i + 1] = x; x = t != null && t > 0 && x != null ? Math.ceil(x / t) : null; if (x == null) { for (let j = i; j >= 0; j--) nec[j] = null; break; } }
  if (x != null) nec[0] = x;
  return { meta, ticket: tk, vendas, necessarios: F.E.map((e, i) => ({ etapa: e, necessario: nec[i] ?? null, tem: F.N[i]!, faltam: nec[i] != null ? Math.max(0, nec[i]! - F.N[i]!) : null })) };
}
