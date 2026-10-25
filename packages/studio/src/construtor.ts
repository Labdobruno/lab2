/* Construtor de hipóteses ("E se…?"): um modelo linear da operação — leads × passagens do funil = vendas × ticket = receita,
   receita × margem = margem de contribuição, menos marketing e custos fixos = resultado — e as perguntas sobre ele:
   "se X fosse Y, mantendo Z, qual seria o impacto em W?", "quanto X precisa ser para W chegar a K?", sensibilidade.
   Puro: recebe o estado medido (montado pelas consultas) e devolve números com a explicação de cada passo.
   Porta o lbc* da V1 sem o vocabulário solar: o custo da venda é "custo variável (% do ticket)", e a margem vem da política
   de preço (@lab/economia) quando não há vendas com custo lançado. */
import { economiaDaVenda, type CustoInformado, type Politica } from '@lab/economia';

/* ---------- vocabulário ---------- */
export interface EtapaFunil { chave: string; nome: string; papel?: string | null }
export type TipoIndicador = 'valor' | 'volume' | 'taxa' | 'mult';
export type Area = 'Marketing' | 'Comercial' | 'Receita' | 'Financeiro' | 'Operação' | 'Resultado';
export interface Indicador { k: string; t: string; area: Area; tipo: TipoIndicador; mkt?: boolean; entrada?: boolean; menorMelhor?: boolean; grupo?: boolean; oculto?: boolean; atalho?: string; fix?: boolean }
export const AREAS: Area[] = ['Marketing', 'Comercial', 'Receita', 'Financeiro', 'Operação'];
export const CLIQUE = ['imp', 'ctr', 'cpc', 'tx'];              // só aparecem se houver impressões/cliques lançados
export const RESULTADOS = ['R', 'margem', 'mm', 'ro', 'caixa', 'V', 'pe', 'cac', 'roas', 'tpm', 'vnec'];
export const RESULTADOS_MARGEM = ['margem', 'mm', 'ro', 'pe', 'vnec', 'tpm'];
/* indicadores por período (fluxo): mudam de escala quando a pergunta é "por mês" ou "em 12 meses" */
export const FLUXO = new Set(['L', 'Lp', 'V', 'R', 'margem', 'inv', 'mm', 'caixa', 'fixos', 'ro', 'pe', 'vnec', 'imp', 'cli']);
/* indicadores que só existem com vendas: referência sem venda não vira zero */
export const DE_VENDA = ['ticket', 'desc', 'mPct', 'custoPct', 'comPct', 'impPct', 'taxaPct', 'cx'];

export function catalogo(E: EtapaFunil[]): Indicador[] {
  const out: Indicador[] = [
    { k: 'inv', t: 'investimento em mídia', area: 'Marketing', tipo: 'valor', mkt: true, entrada: true },
    { k: 'imp', t: 'volume de impressões', area: 'Marketing', tipo: 'volume', mkt: true, entrada: true },
    { k: 'ctr', t: 'CTR (cliques ÷ impressões)', area: 'Marketing', tipo: 'taxa', mkt: true, entrada: true },
    { k: 'cpc', t: 'custo por clique (CPC)', area: 'Marketing', tipo: 'valor', mkt: true, entrada: true, menorMelhor: true },
    { k: 'tx', t: 'conversão clique → lead', area: 'Marketing', tipo: 'taxa', mkt: true, entrada: true },
    { k: 'cpl', t: 'custo por lead (CPL)', area: 'Marketing', tipo: 'valor', mkt: true, entrada: true, menorMelhor: true },
    { k: 'L', t: 'volume de leads', area: 'Comercial', tipo: 'volume', entrada: true },
    { k: 'nVend', t: 'vendedores atendendo leads', area: 'Operação', tipo: 'volume', entrada: true },
    { k: 'lpv', t: 'leads por vendedor', area: 'Operação', tipo: 'volume', entrada: true },
    { k: 'conv', t: 'conversão entre etapas (escolha de → até)', area: 'Comercial', tipo: 'taxa', entrada: true, grupo: true },
    { k: 'total', t: 'conversão lead → venda', area: 'Comercial', tipo: 'taxa', entrada: true, oculto: true },
  ];
  for (const x of atalhos(E)) out.push({ k: x.k, t: x.t, area: 'Comercial', tipo: 'taxa', entrada: true, atalho: x.r });
  E.slice(0, -1).forEach((e, i) => out.push({ k: 'c' + i, t: 'conversão ' + e.nome.toLowerCase() + ' → ' + E[i + 1]!.nome.toLowerCase(), area: 'Comercial', tipo: 'taxa', entrada: true, oculto: true }));
  out.push(
    { k: 'ticket', t: 'ticket médio', area: 'Receita', tipo: 'valor', entrada: true },
    { k: 'desc', t: 'desconto médio sobre o ticket', area: 'Receita', tipo: 'taxa', entrada: true, menorMelhor: true },
    { k: 'taxaPct', t: 'taxas da condição de pagamento (% da receita)', area: 'Financeiro', tipo: 'taxa', entrada: true, menorMelhor: true },
    { k: 'mPct', t: 'margem de contribuição % do preço', area: 'Financeiro', tipo: 'taxa', entrada: true },
    { k: 'custoPct', t: 'custo variável da venda (% do ticket)', area: 'Financeiro', tipo: 'taxa', entrada: true, menorMelhor: true },
    { k: 'cx', t: 'recebimento no mês da venda', area: 'Financeiro', tipo: 'taxa', entrada: true },
    { k: 'comPct', t: 'comissão (% da receita)', area: 'Financeiro', tipo: 'taxa', entrada: true, menorMelhor: true },
    { k: 'impPct', t: 'impostos e deduções (% da receita)', area: 'Financeiro', tipo: 'taxa', entrada: true, menorMelhor: true },
    { k: 'fixos', t: 'custo fixo do período', area: 'Financeiro', tipo: 'valor', entrada: true, menorMelhor: true, fix: true },
    { k: 'V', t: 'vendas', area: 'Resultado', tipo: 'volume' }, { k: 'R', t: 'receita', area: 'Resultado', tipo: 'valor' },
    { k: 'margem', t: 'margem de contribuição', area: 'Resultado', tipo: 'valor' }, { k: 'mm', t: 'margem após marketing', area: 'Resultado', tipo: 'valor' },
    { k: 'caixa', t: 'caixa no mês da venda', area: 'Resultado', tipo: 'valor' }, { k: 'cac', t: 'CAC (custo de aquisição por venda)', area: 'Resultado', tipo: 'valor', menorMelhor: true },
    { k: 'roas', t: 'ROAS (receita ÷ investimento)', area: 'Resultado', tipo: 'mult' },
    { k: 'tpm', t: 'ticket que preserva a margem % atual', area: 'Resultado', tipo: 'valor' }, { k: 'vnec', t: 'vendas necessárias para manter a margem atual', area: 'Resultado', tipo: 'volume', menorMelhor: true },
    { k: 'ro', t: 'resultado operacional (depois dos custos fixos)', area: 'Resultado', tipo: 'valor', fix: true }, { k: 'pe', t: 'vendas para empatar (ponto de equilíbrio)', area: 'Resultado', tipo: 'volume', menorMelhor: true, fix: true },
  );
  return out;
}
/* atalhos de conversão pelos papéis do funil (só os que existem nas etapas da operação) */
export function atalhos(E: EtapaFunil[]): Array<{ k: string; t: string; r: string }> {
  const ix = (p: string) => E.findIndex(e => e.papel === p), n = E.length - 1, out: Array<{ k: string; t: string; r: string }> = [];
  const add = (k: string, t: string, a: number, b: number) => { if (a >= 0 && b > a && b <= n) out.push({ k, t, r: 'r:' + a + ':' + b }); };
  add('p:agend', 'taxa de agendamento (lead → reunião agendada)', 0, ix('agendada'));
  add('p:compar', 'comparecimento (reunião agendada → realizada)', ix('agendada'), ix('realizada'));
  add('p:oport', 'qualificação (reunião realizada → oportunidade)', ix('realizada'), ix('oportunidade'));
  add('p:prop', 'proposta (reunião realizada → proposta enviada)', ix('realizada'), ix('proposta'));
  add('p:fech', 'proposta → venda (proposta enviada → venda)', ix('proposta'), n);
  add('p:neg', 'fechamento (negociação → venda)', ix('negociacao'), n);
  add('p:total', 'conversão lead → venda (funil inteiro)', 0, n);
  return out;
}
export const atalhoR = (k: string, E: EtapaFunil[]) => atalhos(E).find(x => x.k === k)?.r ?? null;
/* conversão entre duas etapas quaisquer: chave r:i:j (da etapa i até a etapa j; a última é a venda) */
export const rij = (k: string | null | undefined): [number, number] | null => { const m = /^r:(\d+):(\d+)$/.exec(k ?? ''); return m ? [+m[1]!, +m[2]!] : null; };
export function indicador(k: string, E: EtapaFunil[]): Indicador {
  const r = rij(k);
  if (r) { const a = E[r[0]], b = E[r[1]]; return { k, t: 'conversão ' + (a?.nome ?? '?').toLowerCase() + ' → ' + (b?.nome ?? '?').toLowerCase(), area: 'Comercial', tipo: 'taxa', entrada: true }; }
  return catalogo(E).find(x => x.k === k) ?? { k, t: k, area: 'Resultado', tipo: 'valor' };
}
/* perguntas antigas: "lead → venda", atalhos e as passagens vizinhas viram o formato r:i:j */
export function normalizar<T extends { ind: string }>(cl: T, E: EtapaFunil[]): T {
  const n = E.length - 1;
  if (cl.ind === 'total' || cl.ind === 'conv') cl.ind = 'r:0:' + n;
  else if (/^c\d+$/.test(cl.ind)) { const i = +cl.ind.slice(1); cl.ind = 'r:' + i + ':' + (i + 1); }
  else if (cl.ind.startsWith('p:')) cl.ind = atalhoR(cl.ind, E) ?? 'r:0:' + n;
  const r = rij(cl.ind);
  if (r) { let [a, b] = r; a = Math.max(0, Math.min(n - 1, a)); b = Math.max(a + 1, Math.min(n, b)); cl.ind = 'r:' + a + ':' + b; }
  return cl;
}
export const artigo = (k: string, E: EtapaFunil[]) => (/^(conversão|margem|taxa|comissão|receita)/.test(indicador(k, E).t) ? 'a' : 'o');

/* ---------- formatação pt-BR ---------- */
export const fmtNum = (v: number, casas = 0) => v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
export const brl = (v: number, casas = 0) => 'R$ ' + fmtNum(v, casas);
export const pct = (v: number, casas = 1) => fmtNum(v * 100, casas) + '%';
export const pp = (d: number) => (d >= 0 ? '+' : '−') + fmtNum(Math.abs(d) * 100, 1) + ' p.p.';
export function formatar(k: string, v: number | null | undefined, E: EtapaFunil[]): string {
  const I = indicador(k, E); if (v == null || !Number.isFinite(v)) return '—';
  return I.tipo === 'taxa' ? pct(v) : I.tipo === 'volume' ? fmtNum(v, v < 100 && v % 1 ? 1 : 0) : I.tipo === 'mult' ? fmtNum(v, 2) + '×' : k === 'cpc' || k === 'cpl' ? brl(v, 2) : brl(v);
}

/* ---------- o estado do modelo (medido pelas consultas ou alterado por uma cláusula) ---------- */
export interface InfoConv { conv: Array<number | null>; num: number[]; den: number[]; pend?: number[] }
export interface Estado {
  etapas: EtapaFunil[];
  L: number;                       // leads no período
  Lp: number | null;               // leads pagos (dos canais com investimento); null sem marketing
  conv: Array<number | null>;      // passagem i → i+1 (null = sem histórico)
  convInfo?: InfoConv | null;
  total: number | null;            // conversão lead → venda imposta como premissa (substitui as passagens)
  nVend: number | null;
  ticket: number; nTicket?: number;
  mPct: number | null;             // margem de contribuição, % do preço
  custoPct?: number | null;        // custo variável da venda, % do ticket
  cu?: number | null;              // custo por venda em R$ quando ele é mantido constante
  dDed?: number;                   // variação acumulada das deduções (% da receita), que sai inteira da margem
  comPct: number | null; impPct: number | null; taxaPct: number | null;
  cx: number | null;               // fração da receita recebida no mês da venda
  desc?: number | null;            // desconto médio praticado
  fixos: number | null;            // custos fixos do período
  inv: number | null; imp: number | null; cli: number | null;
  mk: boolean;                     // há marketing lançado para o sujeito no período
  n: number;                       // leads na amostra
  b0?: { mPct: number | null; margem: number | null } | null;
  fontes?: Record<string, string>; // de onde veio cada premissa ("custos lançados em 12 vendas", "política de preço v3"…)
  margemEstimada?: boolean;        // margem veio da política, não de vendas com custo lançado
}
export interface Derivado extends Estado {
  V: number | null; totalEf: number | null; R: number | null; lpv: number | null; margem: number | null; mPctEf: number | null; caixa: number | null; mm: number | null;
  ctr: number | null; cpc: number | null; tx: number | null; cpl: number | null; cac: number | null; roas: number | null; tpm: number | null; vnec: number | null; ro: number | null; pe: number | null;
}

export function derivar(s: Estado): Derivado {
  const o = { ...s } as Derivado;
  o.V = o.total != null ? o.L * o.total : o.conv.reduce<number | null>((a, c) => (a == null || c == null ? null : a * c), o.L);
  o.totalEf = o.L && o.V != null ? o.V / o.L : null;
  o.R = o.V == null ? null : o.V * (o.ticket || 0);
  o.lpv = o.nVend ? o.L / o.nVend : null;
  /* margem: % da receita, ou (com custo por venda fixo) vendas × (ticket − custo) */
  o.margem = o.V == null ? null : o.cu != null ? o.V * ((o.ticket || 0) - o.cu) : o.mPct != null ? o.R! * o.mPct : null;
  if (o.margem != null && o.dDed) o.margem -= o.R! * o.dDed;   // comissão/impostos alterados saem inteiros da margem
  o.mPctEf = o.R ? o.margem! / o.R : o.mPct;
  o.caixa = o.R == null ? null : o.R * (o.cx == null ? 1 : o.cx);
  o.mm = o.margem != null ? o.margem - (o.inv ?? 0) : null;
  o.ctr = o.imp ? (o.cli ?? 0) / o.imp : null; o.cpc = o.cli ? (o.inv ?? 0) / o.cli : null; o.tx = o.cli && o.Lp != null ? o.Lp / o.cli : null; o.cpl = o.Lp && o.inv != null ? o.inv / o.Lp : null;
  o.cac = o.V && o.inv != null ? o.inv / o.V : null; o.roas = o.inv && o.R != null ? o.R / o.inv : null;
  o.desc = o.desc ?? 0;
  /* preço que preserva a margem % de hoje e vendas necessárias para manter a margem R$ de hoje */
  const cuEf = o.cu != null ? o.cu : (o.ticket || 0) * (1 - (o.mPct ?? 0)), mpv = (o.ticket || 0) - cuEf;
  o.tpm = o.b0 && o.b0.mPct != null && o.b0.mPct < 1 ? cuEf / (1 - o.b0.mPct) : null;
  o.vnec = o.b0 && o.b0.margem != null && mpv > 0 ? o.b0.margem / mpv : null;
  /* depois dos custos fixos: resultado operacional e quantas vendas pagam a estrutura (fixos + marketing) */
  const base = o.mm != null ? o.mm : o.margem;
  o.ro = o.fixos != null && base != null ? base - o.fixos : null;
  const mpv2 = o.V != null && o.V > 0 && o.margem != null ? o.margem / o.V : null;
  o.pe = o.fixos != null && mpv2 != null && mpv2 > 0 ? (o.fixos + (o.inv ?? 0)) / mpv2 : null;
  return o;
}
/* fecha o estado medido: guarda a base (b0) usada por tpm e vnec */
export function fecharBase(s: Estado): Derivado { const r = derivar(s); s.b0 = { mPct: r.mPctEf, margem: r.margem }; return derivar(s); }

/* valor atual de um indicador no modelo */
export function valor(M: Derivado, k: string): number | null {
  const r = rij(k);
  if (r) { if (r[0] === 0 && r[1] === M.conv.length && M.total != null) return M.totalEf; let p = 1; for (let i = r[0]; i < r[1]; i++) { const c = M.conv[i]; if (c == null) return null; p *= c; } return p; }
  if (k === 'total') return M.totalEf; if (k === 'mPct') return M.mPctEf != null ? M.mPctEf : M.mPct; if (/^c\d+$/.test(k)) return M.conv[+k.slice(1)] ?? null;
  const v = (M as unknown as Record<string, unknown>)[k]; return typeof v === 'number' ? v : null;
}
/* o que pode ficar constante quando um indicador muda (o "mantendo" da frase) */
export function opcoesMantendo(k: string, M?: Estado | null): Array<[string, string]> | null {
  if (k === 'ticket') return [['mpct', 'a margem %'], ['custo', 'o custo por venda']];
  if (k === 'custoPct') return [['preco', 'o preço'], ['mpct', 'a margem %']];
  const r = rij(k); if (r && r[1] - r[0] > 1) return [['dist', 'a mudança espalhada por igual no trecho'], ['prim', 'a mudança toda na primeira etapa'], ['ult', 'a mudança toda na última etapa']];
  if (k === 'L' && M && M.inv != null) return [['inv', 'o investimento'], ['cpl', 'o CPL']];
  return null;
}

/* ---------- aplica "indicador = novo valor" subindo pela árvore; devolve o novo estado e a explicação ---------- */
export interface Aplicacao { s: Estado; passos: string[] }
export function aplicar(s: Estado, k: string, v: number, mant?: string | null): Aplicacao {
  const E = s.etapas, o: Estado = { ...s, conv: s.conv.slice() }, passos: string[] = [];
  const f = (x: number | null | undefined, y: number) => (x ? y / x : 1), org = s.L - (s.Lp ?? 0), setLp = (lp: number) => { o.Lp = lp; o.L = org + lp; };
  const tx = s.cli ? (s.Lp ?? 0) / s.cli : 0, cuBase = () => (s.cu != null ? s.cu : (s.ticket || 0) * (1 - (s.mPct ?? 0)));
  const r = rij(k);
  if (k === 'inv' || k === 'imp') {
    const rr = f(k === 'inv' ? s.inv : s.imp, v); o.inv = (s.inv ?? 0) * rr; o.imp = (s.imp ?? 0) * rr; o.cli = (s.cli ?? 0) * rr; setLp((s.Lp ?? 0) * rr);
    passos.push('mesmo CPM, CTR, CPC e conversão em lead: investimento, impressões, cliques e leads pagos variam ' + fmtNum((rr - 1) * 100, 1) + '% (leads pagos ' + fmtNum(s.Lp ?? 0) + ' → ' + fmtNum(o.Lp!, 1) + '; leads de outros canais ficam em ' + fmtNum(org) + ')');
  } else if (k === 'ctr') { o.cli = (s.imp ?? 0) * v; setLp(o.cli * tx); passos.push('mesmas impressões e investimento: cliques = ' + fmtNum(s.imp ?? 0) + ' × ' + pct(v, 2) + ' = ' + fmtNum(o.cli) + '; leads pagos = cliques × ' + pct(tx) + ' = ' + fmtNum(o.Lp!, 1)); }
  else if (k === 'cpc') { o.cli = v > 0 ? (s.inv ?? 0) / v : 0; setLp(o.cli * tx); passos.push('mesmo investimento: cliques = ' + brl(s.inv ?? 0) + ' ÷ ' + brl(v, 2) + ' = ' + fmtNum(o.cli) + '; leads pagos = ' + fmtNum(o.Lp!, 1)); }
  else if (k === 'tx') { setLp((s.cli ?? 0) * v); passos.push('mesmos cliques: leads pagos = ' + fmtNum(s.cli ?? 0) + ' × ' + pct(v) + ' = ' + fmtNum(o.Lp!, 1)); }
  else if (k === 'cpl') { setLp(v > 0 ? (s.inv ?? 0) / v : 0); passos.push('mesmo investimento: leads pagos = ' + brl(s.inv ?? 0) + ' ÷ ' + brl(v, 2) + ' = ' + fmtNum(o.Lp!, 1) + (org ? ' + ' + fmtNum(org) + ' de outros canais' : '')); }
  else if (k === 'nVend' || k === 'lpv') {
    const lpv = s.nVend ? s.L / s.nVend : 0;
    if (k === 'nVend') { o.nVend = v; o.L = v * lpv; } else o.L = (s.nVend ?? 0) * v;
    if (s.Lp != null && s.L) o.Lp = (s.Lp * o.L) / s.L;
    passos.push(k === 'nVend' ? 'mantendo ' + fmtNum(lpv, 1) + ' leads por vendedor: ' + fmtNum(v) + ' vendedores × ' + fmtNum(lpv, 1) + ' = ' + fmtNum(o.L, 1) + ' leads' : 'mantendo ' + fmtNum(s.nVend ?? 0) + ' vendedores: ' + fmtNum(s.nVend ?? 0) + ' × ' + fmtNum(v, 1) + ' = ' + fmtNum(o.L, 1) + ' leads');
  } else if (k === 'L') {
    o.L = v; if (s.Lp != null) o.Lp = Math.max(0, v - org);
    if (mant === 'cpl' && s.inv != null && s.Lp) { const rr = o.Lp! / s.Lp; o.inv = s.inv * rr; o.imp = (s.imp ?? 0) * rr; o.cli = (s.cli ?? 0) * rr; passos.push('mantendo o CPL (' + brl(s.inv / s.Lp, 2) + '): o investimento acompanha os leads pagos e vai a ' + brl(o.inv)); }
    else if (s.inv != null && s.Lp != null && o.Lp) passos.push('mantendo o investimento: o CPL passa a ' + brl(s.inv / o.Lp, 2));
  } else if (k === 'total') { o.total = v; passos.push('vendas = leads × ' + pct(v)); }
  else if (r) {
    const [a, b] = r, alvo = Math.max(0, Math.min(1, v)), ks: number[] = []; for (let i = a; i < b; i++) ks.push(i);
    o.total = null; const cur = () => ks.reduce((p, i) => p * (o.conv[i] ?? 0), 1), antes = cur();
    if (ks.length === 1) o.conv[a] = alvo;
    else if (mant === 'prim' || mant === 'ult') {
      const ordem = mant === 'prim' ? ks.slice() : ks.slice().reverse();
      for (const i of ordem) { const outros = ks.filter(x => x !== i).reduce((p, x) => p * (o.conv[x] ?? 0), 1); if (outros <= 0) { o.conv[i] = alvo > 0 ? 1 : 0; continue; } o.conv[i] = Math.min(1, alvo / outros); if (Math.abs(cur() - alvo) < 1e-9) break; }
      if (Math.abs(cur() - alvo) > 1e-6) { /* não coube numa etapa só: espalha o resto */ const ff = Math.pow(alvo / Math.max(cur(), 1e-12), 1 / ks.length); for (const i of ks) o.conv[i] = Math.min(1, (o.conv[i] ?? 0) * ff); }
    } else {
      if (antes <= 0) for (const i of ks) o.conv[i] = Math.pow(alvo, 1 / ks.length);
      else for (let it = 0; it < ks.length + 1 && Math.abs(cur() - alvo) > 1e-9; it++) {
        const livres = ks.filter(i => (o.conv[i] ?? 0) < 1 - 1e-12 || alvo < cur()); if (!livres.length) break;
        const fixo = ks.filter(i => !livres.includes(i)).reduce((p, i) => p * (o.conv[i] ?? 0), 1), pl = livres.reduce((p, i) => p * (o.conv[i] ?? 0), 1);
        const ff = pl > 0 ? Math.pow(alvo / (fixo * pl), 1 / livres.length) : 1; for (const i of livres) o.conv[i] = Math.min(1, (o.conv[i] || Math.pow(alvo, 1 / ks.length)) * ff);
      }
    }
    const trecho = ks.map(i => E[i]!.nome + ' → ' + E[i + 1]!.nome + ' ' + pct(s.conv[i] ?? 0) + ' → ' + pct(o.conv[i] ?? 0)).join('; ');
    passos.push(ks.length === 1 ? 'só esta passagem muda; as outras etapas do funil ficam iguais' : 'de ' + E[a]!.nome.toLowerCase() + ' até ' + E[b]!.nome.toLowerCase() + ' há ' + ks.length + ' passagens (' + trecho + '); ' + (mant === 'prim' ? 'a mudança foi colocada na primeira' : mant === 'ult' ? 'a mudança foi colocada na última' : 'a mudança foi espalhada por igual (mesmo fator em cada uma)') + '; as etapas fora do trecho ficam iguais');
    if (Math.abs(cur() - alvo) > 1e-6) passos.push('atenção: o máximo possível neste trecho é ' + pct(cur()) + ' (todas as passagens a 100%)');
  } else if (/^c\d+$/.test(k)) { o.conv[+k.slice(1)] = Math.max(0, Math.min(1, v)); o.total = null; }
  else if (k === 'ticket') {
    if (mant === 'custo') { o.cu = cuBase(); passos.push('mantendo o custo por venda em ' + brl(o.cu) + ': margem por venda = ticket − custo = ' + brl(v - o.cu)); }
    else passos.push('mantendo a margem % (' + pct(valor(derivar(s), 'mPct') ?? 0) + '): o custo acompanha o ticket, como numa venda proporcionalmente maior');
    o.ticket = v;
  } else if (k === 'desc') { o.cu = cuBase(); const cheio = (s.ticket || 0) / (1 - (s.desc ?? 0)); o.desc = v; o.ticket = cheio * (1 - v); passos.push('o custo por venda fica em ' + brl(o.cu) + ' e o ticket vai para ' + brl(o.ticket) + ' (' + brl(cheio) + ' − ' + pct(v) + '): o desconto sai inteiro da margem'); }
  else if (k === 'mPct') { o.mPct = v; o.cu = null; }
  else if (k === 'custoPct') {
    const T = s.ticket || 0, dk = T * (v - (s.custoPct ?? 0)), cu1 = cuBase() + dk; o.custoPct = v;
    if (mant === 'mpct') { const m = valor(derivar(s), 'mPct') ?? 0; o.ticket = m < 1 ? cu1 / (1 - m) : T; o.cu = cu1; passos.push('o custo variável passa de ' + brl(T * (s.custoPct ?? 0)) + ' para ' + brl(T * v) + ' por venda; mantendo a margem % (' + pct(m) + '), o ticket vai a ' + brl(cu1) + ' ÷ (1 − ' + pct(m) + ') = ' + brl(o.ticket)); }
    else { o.cu = cu1; passos.push('o custo variável passa de ' + brl(T * (s.custoPct ?? 0)) + ' para ' + brl(T * v) + ' por venda (' + (dk >= 0 ? '+' : '−') + brl(Math.abs(dk)) + '); mantendo o preço, a diferença sai inteira da margem'); }
  } else if (k === 'cx') o.cx = Math.max(0, Math.min(1, v));
  else if (k === 'comPct' || k === 'impPct' || k === 'taxaPct') {
    const de = s[k] ?? 0; o[k] = Math.max(0, Math.min(1, v)); o.dDed = (s.dDed ?? 0) + (o[k]! - de);
    passos.push((k === 'comPct' ? 'comissão' : k === 'taxaPct' ? 'taxas da condição de pagamento' : 'impostos e deduções') + ' de ' + pct(de) + ' para ' + pct(o[k]!) + ' da receita: a diferença (' + pp(o[k]! - de) + ') sai inteira da margem');
  } else if (k === 'fixos') { o.fixos = Math.max(0, v); passos.push('custos fixos do período ' + brl(s.fixos ?? 0) + ' → ' + brl(o.fixos)); }
  return { s: o, passos };
}

/* ---------- cláusulas e referências ---------- */
export type Operador = 'maior' | 'menor' | 'chegasse' | 'igual';
export type Unidade = '%' | 'pp' | 'rs' | 'q';
export interface Clausula { ind: string; op: Operador; num?: number | null; un?: Unidade | null; ref?: string | null; mant?: string | null }
export interface Alvo { v: number | null; rot?: string; n?: number; nota?: string; semVenda?: boolean }
/* referências que as consultas montam para "igual a…": o período anterior, os pares (vendedores ou canais) e sujeitos nomeados */
export interface Referencias { anterior?: Estado | null; pares?: Array<{ id: string; M: Estado }>; porId?: Record<string, Estado>; tipoPares?: 'vendedores' | 'canais' }
export interface ContextoSimulacao { minN?: number; refs?: Referencias; capacidade?: number | null; meses?: number; res?: string; sujeito?: string; ehVendedor?: boolean }

export const mediana = (a: number[]) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = Math.floor(s.length / 2); return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2; };
export const quantil = (a: number[], q: number) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), p = (s.length - 1) * q, i = Math.floor(p); return s[i]! + (s[Math.min(i + 1, s.length - 1)]! - s[i]!) * (p - i); };
const media = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

export function valorDeReferencia(Mx: Estado, k: string): number | null {
  if (DE_VENDA.includes(k) && !((Mx.nTicket ?? 0) > 0)) return null;
  const v = valor(derivar(Mx), k); return v == null || !Number.isFinite(v) ? null : v;
}
export const descreverSujeito = (id: string) => (id === 'equipe' ? 'da equipe' : id.startsWith('c:') ? 'do canal ' + id.slice(2) : 'de ' + id.slice(2));

/* referência de uma cláusula → valor-alvo */
export function alvoDaClausula(cl: Clausula, M: Derivado, ctx: ContextoSimulacao = {}): Alvo {
  const E = M.etapas, I = indicador(cl.ind, E), atual = valor(M, cl.ind), n = Number(cl.num), minN = ctx.minN ?? 10, refs = ctx.refs ?? {};
  if (cl.op === 'igual') {
    if (cl.ref === 'anterior') { const M0 = refs.anterior; if (!M0) return { v: null, rot: 'do período anterior', semVenda: false }; return { v: valorDeReferencia(M0, cl.ind), rot: 'do período anterior', n: M0.n, semVenda: DE_VENDA.includes(cl.ind) && !((M0.nTicket ?? 0) > 0) }; }
    if (['mediana', 'p75', 'media', 'melhor', 'pior'].includes(cl.ref ?? '')) {
      const pares = refs.pares ?? [];
      const vals = pares.map(x => (x.M.n >= minN ? valorDeReferencia(x.M, cl.ind) : null)).filter((x): x is number => x != null && Number.isFinite(x));
      const mm = !!I.menorMelhor;
      const v = cl.ref === 'mediana' ? mediana(vals) : cl.ref === 'media' ? media(vals) : cl.ref === 'p75' ? quantil(vals, mm ? 0.25 : 0.75)
        : cl.ref === 'melhor' ? (vals.length ? (mm ? Math.min(...vals) : Math.max(...vals)) : null) : vals.length ? (mm ? Math.max(...vals) : Math.min(...vals)) : null;
      const gr = refs.tipoPares === 'canais' ? ['canais', 'canal'] : ['vendedores', 'vendedor'];
      const rot: Record<string, string> = { mediana: 'da mediana dos ' + gr[0], media: 'da média dos ' + gr[0], p75: 'do quartil superior dos ' + gr[0], melhor: 'do melhor ' + gr[1], pior: 'do pior ' + gr[1] };
      return { v, rot: rot[cl.ref!], n: vals.length, nota: vals.length + ' ' + gr[0] + ' com n≥' + minN };
    }
    if (cl.ref) { const Mx = refs.porId?.[cl.ref]; if (!Mx) return { v: null, rot: descreverSujeito(cl.ref) }; return { v: valorDeReferencia(Mx, cl.ind), rot: descreverSujeito(cl.ref), n: Mx.n, semVenda: DE_VENDA.includes(cl.ind) && !((Mx.nTicket ?? 0) > 0) }; }
    return { v: null };
  }
  if (!Number.isFinite(n) || cl.num == null) return { v: null };
  if (cl.op === 'chegasse') return { v: I.tipo === 'taxa' ? n / 100 : n };
  if (atual == null) return { v: null };
  const sg = cl.op === 'menor' ? -1 : 1;
  if (cl.un === '%') return { v: atual * (1 + (sg * n) / 100) };
  if (cl.un === 'pp') return { v: atual + (sg * n) / 100 };
  return { v: atual + sg * n };
}

/* combinações que aplicariam o mesmo efeito duas vezes (ou uma premissa anularia a outra) */
export const CONFLITOS: Array<[string, string, string]> = [['ticket', 'desc', 'o ticket e o desconto mexem no mesmo preço'], ['mPct', 'custoPct', 'a margem % e o custo variável definem a mesma margem'], ['mPct', 'desc', 'a margem % e o desconto definem a mesma margem']];
export const ALAVANCAS_LEADS = ['L', 'nVend', 'lpv', 'inv', 'imp', 'ctr', 'cpc', 'tx', 'cpl'];
export function validarCombinacao(cls: Clausula[], E: EtapaFunil[]): string[] {
  const out: string[] = [], vistos: Record<string, number> = {};
  cls.forEach((cl, i) => { if (vistos[cl.ind] != null) out.push('A premissa "' + indicador(cl.ind, E).t + '" aparece nas condições ' + (vistos[cl.ind]! + 1) + ' e ' + (i + 1) + ': junte numa só, para o efeito não ser aplicado duas vezes.'); else vistos[cl.ind] = i; });
  const rs = cls.map((cl, i) => ({ r: rij(cl.ind), i })).filter((x): x is { r: [number, number]; i: number } => !!x.r);
  for (let a = 0; a < rs.length; a++) for (let b = a + 1; b < rs.length; b++) { const A = rs[a]!.r, B = rs[b]!.r; if (A[0] < B[1] && B[0] < A[1] && !(A[0] === B[0] && A[1] === B[1])) out.push('As condições ' + (rs[a]!.i + 1) + ' e ' + (rs[b]!.i + 1) + ' mudam trechos do funil que se sobrepõem: a mesma passagem seria alterada duas vezes. Use trechos separados.'); }
  for (const [x, y, por] of CONFLITOS) { const ix = cls.findIndex(c => c.ind === x), iy = cls.findIndex(c => c.ind === y); if (ix >= 0 && iy >= 0) out.push('As condições ' + (Math.min(ix, iy) + 1) + ' e ' + (Math.max(ix, iy) + 1) + ' conflitam: ' + por + '. Escolha uma das duas.'); }
  const il = cls.findIndex(c => c.ind === 'L'), im = cls.findIndex(c => ALAVANCAS_LEADS.indexOf(c.ind) > 2), ie = cls.findIndex(c => c.ind === 'nVend' || c.ind === 'lpv');
  if (il >= 0 && ie >= 0) out.push('As condições ' + (Math.min(il, ie) + 1) + ' e ' + (Math.max(il, ie) + 1) + ' definem duas vezes o volume de leads (volume de leads e vendedores × leads por vendedor): escolha uma das formas.');
  if (ie >= 0 && im >= 0) out.push('As condições ' + (Math.min(ie, im) + 1) + ' e ' + (Math.max(ie, im) + 1) + ' mexem duas vezes no volume de leads (equipe e marketing): escolha uma das alavancas.');
  if (il >= 0 && im >= 0) out.push('As condições ' + (Math.min(il, im) + 1) + ' e ' + (Math.max(il, im) + 1) + ' mexem duas vezes no volume de leads (o marketing já gera os leads): mude o volume de leads ou a alavanca de marketing.');
  return out;
}
/* entradas válidas: redução até 100%, nada negativo, taxa entre 0 e 100% */
export function validarValor(cl: Clausula, I: Indicador, v: number | null, E: EtapaFunil[]): string {
  const n = Number(cl.num);
  if ((cl.op === 'maior' || cl.op === 'menor' || cl.op === 'chegasse') && cl.num != null && n < 0) return 'use um número positivo (para diminuir, escolha "menor em").';
  if (cl.op === 'menor' && cl.un === '%' && n > 100) return 'não dá para reduzir mais de 100%.';
  if (v == null || !Number.isFinite(v)) return 'sem valor para comparar.';
  if (I.tipo === 'taxa' && (v < 0 || v > 1)) return formatar(cl.ind, v, E) + ' fica fora de 0% a 100%. Ajuste o valor.';
  if ((I.tipo === 'volume' || I.tipo === 'valor') && v < 0) return 'o resultado ficaria negativo (' + formatar(cl.ind, v, E) + ').';
  return '';
}
/* ordem de cálculo: as premissas na ordem em que foram aplicadas e o caminho até o resultado */
export const ordemDeCalculo = (cls: Clausula[], E: EtapaFunil[]) => cls.map((cl, i) => i + 1 + 'ª ' + indicador(cl.ind, E).t).concat(['leads × conversões = vendas', 'vendas × ticket = receita', 'receita × margem % = margem de contribuição', 'margem − marketing − custos fixos = resultado', 'receita × calendário de pagamento = caixa']);

/* ---------- a simulação: aplica as cláusulas em ordem e explica ---------- */
export interface LinhaSimulacao { cl: Clausula; I: Indicador; antes: number | null; alvo: Alvo; passos: string[] }
export interface SimulacaoESe { M: Derivado; S: Derivado; linhas: LinhaSimulacao[]; erros: string[]; alertas: string[]; premissas: string[]; premissasL: Array<[string, string]>; ordem: string[] }

export function simularESe(base: Estado, cls: Clausula[], ctx: ContextoSimulacao = {}): SimulacaoESe {
  const E = base.etapas, minN = ctx.minN ?? 10, res = ctx.res ?? 'R';
  for (const cl of cls) normalizar(cl, E);
  const M = fecharBase({ ...base }); let s: Estado = M; const linhas: LinhaSimulacao[] = [], erros: string[] = [], alertas: string[] = [];
  erros.push(...validarCombinacao(cls, E));
  if (erros.length) return { M, S: M, linhas, erros, alertas, premissas: [], premissasL: [], ordem: [] };
  cls.forEach((cl, i) => {
    const I = indicador(cl.ind, E);
    if (I.fix && M.fixos == null) { erros.push('Sem custos fixos para simular: informe os custos fixos do mês na política de preço (Economia › Política).'); return; }
    if (I.mkt && !M.mk) { erros.push(ctx.ehVendedor ? '"' + I.t + '" não tem caminho até o resultado para um vendedor: marketing é medido por canal. Escolha a equipe ou um canal.' : 'Sem investimento lançado para ' + (ctx.sujeito ?? 'a equipe') + ' no período (Dados › Investimento).'); return; }
    const alvo = alvoDaClausula(cl, derivar(s), ctx);
    if (alvo.v == null || !Number.isFinite(alvo.v)) { erros.push(alvo.semVenda ? 'Condição ' + (i + 1) + ': a referência ' + (alvo.rot ?? '') + ' não tem nenhuma venda no período, então "' + I.t + '" não existe lá (não é zero). Escolha outra referência ou informe o valor.' : 'Complete a referência da condição ' + (i + 1) + (cl.op === 'igual' ? ' (sem amostra suficiente para esta referência)' : '') + '.'); return; }
    if ((I.k === 'nVend' || I.k === 'lpv') && !M.nVend) { erros.push('Condição ' + (i + 1) + ': nenhum vendedor com leads no período.'); return; }
    if ((cl.op === 'maior' || cl.op === 'menor') && valor(derivar(s), cl.ind) == null) { erros.push('Condição ' + (i + 1) + ': "' + I.t + '" não tem valor atual no período (não calculável), então não dá para aumentar ou diminuir. Use "chegasse a" com o valor que você quer testar.'); return; }
    const inval = validarValor(cl, I, alvo.v, E); if (inval) { erros.push('Condição ' + (i + 1) + ': ' + inval); return; }
    const antes = valor(derivar(s), cl.ind), ap = aplicar(s, cl.ind, alvo.v, cl.mant); s = ap.s;
    linhas.push({ cl, I, antes, alvo, passos: ap.passos });
  });
  const S = derivar(s);
  /* taxas sem histórico: não inventa; pede que o gestor informe a taxa como premissa */
  if (!erros.length && S.V == null) {
    const falta = S.conv.map((c, i) => (c == null ? E[i]!.nome + ' → ' + E[i + 1]!.nome : null)).filter((x): x is string => !!x);
    erros.push('Sem histórico suficiente para calcular ' + (falta.length === 1 ? 'a passagem ' : 'as passagens ') + falta.join(', ') + ' neste período e escopo (nenhum negócio elegível). Informe a taxa como premissa: "conversão … chegasse a X%", ou amplie o período.');
  }
  /* taxas com base pequena (usadas e não substituídas por premissa) */
  const subst = new Set<number>(); for (const cl of cls) { const r = rij(cl.ind); if (r) for (let i = r[0]; i < r[1]; i++) subst.add(i); }
  if (M.convInfo) {
    const pq = M.convInfo.den.map((dn, i) => (!subst.has(i) && dn > 0 && dn < minN ? E[i]!.nome + ' → ' + E[i + 1]!.nome + ' (' + M.convInfo!.num[i] + ' de ' + dn + ')' : null)).filter((x): x is string => !!x);
    if (pq.length) alertas.push('Taxas com base pequena (menos de ' + minN + ' negócios elegíveis): ' + pq.join(' · ') + '. Use como indicação, não como certeza.');
  }
  if (M.margemEstimada && RESULTADOS_MARGEM.includes(res)) alertas.push('Margem estimada pela política de preço: nenhuma venda do período tem custo lançado. Lance os custos das vendas (Economia) para a margem ser medida.');
  /* capacidade: o simulado pede mais leads por mês do que já foi absorvido? */
  const meses = Math.max(1, ctx.meses ?? 1), cap = ctx.capacidade;
  if (cap && S.L > M.L && S.L / meses > cap * 1.05) alertas.push('Capacidade: o cenário pede ' + fmtNum(S.L / meses) + ' leads por mês, acima do maior volume que ' + (ctx.ehVendedor ? ctx.sujeito ?? 'a pessoa' : 'o time') + ' já absorveu (' + cap + ' no melhor mês dos últimos 12). As conversões podem não se manter com esse volume.');
  if (S.V != null && M.V != null && S.V > M.V * 1.0001) alertas.push('Capacidade: o cenário pressupõe vendedores, reuniões, entrega e capital de giro suficientes para ' + fmtNum(S.V, 1) + ' vendas (hoje ' + fmtNum(M.V, 1) + '). O LAB não modela essas restrições.');
  if (M.n < minN) alertas.push('Amostra pequena (' + M.n + ' leads no período): trate o resultado como estimativa.');
  /* premissas: tudo o que não foi alterado fica constante */
  const mudou = new Set<string>(); for (const cl of cls) { mudou.add(cl.ind); const r = rij(cl.ind); if (r) { mudou.add('total'); for (let i = r[0]; i < r[1]; i++) mudou.add('c' + i); } }
  const cat = catalogo(E).filter(x => x.entrada && !x.grupo && !x.atalho && !mudou.has(x.k) && (!x.mkt || M.mk) && !CLIQUE.includes(x.k));
  const premissasL: Array<[string, string]> = cat.filter(x => !x.oculto).filter(x => { const v = valor(M, x.k); return v != null && Number.isFinite(v); }).map(x => [x.t, formatar(x.k, valor(M, x.k), E)]);
  const premissas = cat.filter(x => valor(M, x.k) != null).map(x => x.t + ' ' + formatar(x.k, valor(M, x.k), E));
  if (M.fixos == null && RESULTADOS.includes(res) && indicador(res, E).fix) erros.push('Sem custos fixos informados: o resultado operacional e o ponto de equilíbrio precisam deles (Economia › Política).');
  return { M, S, linhas, erros, alertas, premissas, premissasL, ordem: ordemDeCalculo(cls, E) };
}

/* ---------- "quanto precisa?": o valor do indicador que leva o resultado ao alvo, mantendo o resto (bissecção) ---------- */
export type Busca = { v: number; atual: number | null } | { erro: 'inalcançável'; limite: number; valLim: number | null } | { erro: 'sem caminho' };
export function quantoPrecisa(base: Derivado, ind: string, res: string, alvo: number, mant?: string | null): Busca {
  const I = indicador(ind, base.etapas), atual = valor(base, ind);
  const f = (v: number) => { const x = valor(derivar(aplicar(base, ind, v, mant).s), res); return x == null || !Number.isFinite(x) ? null : x; };
  let lo = 0, hi = I.tipo === 'taxa' ? 1 : Math.max(1, (atual ?? 0) * 20, ind === 'ticket' ? 500000 : 100);
  const flo = f(lo), fhi = f(hi); if (flo == null || fhi == null) return { erro: 'sem caminho' };
  if ((flo - alvo) * (fhi - alvo) > 0) { const melhor = Math.abs(fhi - alvo) < Math.abs(flo - alvo) ? hi : lo; return { erro: 'inalcançável', limite: melhor, valLim: f(melhor) }; }
  const sobe = fhi > flo;
  for (let k = 0; k < 80; k++) { const m = (lo + hi) / 2, fm = f(m); if (fm == null) break; if (fm < alvo === sobe) lo = m; else hi = m; }
  return { v: (lo + hi) / 2, atual };
}

/* ---------- sensibilidade: o indicador variando de −30% a +30%, o resto igual ---------- */
export interface PontoSensibilidade { p: number; v: number; r: number | null }
export function sensibilidadeDoIndicador(base: Derivado, ind: string, res: string, mant?: string | null): PontoSensibilidade[] {
  const I = indicador(ind, base.etapas), atual = valor(base, ind); if (atual == null || !Number.isFinite(atual) || !atual) return [];
  return [-0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3].map(p => { let v = atual * (1 + p); if (I.tipo === 'taxa') v = Math.min(1, v); return { p, v, r: valor(derivar(aplicar(base, ind, v, mant).s), res) }; });
}

/* ---------- a frase da pergunta, legível ---------- */
export const UNIDADE_TXT: Record<Unidade, string> = { pp: ' p.p.', '%': '%', rs: ' reais', q: ' unidades' };
export function frase(R: SimulacaoESe, res: string, tempo: 'passado' | 'futuro' = 'passado'): string {
  const E = R.M.etapas, vb = tempo === 'futuro' ? { ser: 'for', imp: 'qual será o impacto em' } : { ser: 'fosse', imp: 'qual seria o impacto em' };
  const partes = R.linhas.map(l => {
    const art = artigo(l.cl.ind, E);
    const ref = l.cl.op === 'igual' ? (art === 'a' ? 'igual à ' : 'igual ao ') + (l.alvo.rot ?? '') : l.cl.op === 'chegasse' ? 'de ' + formatar(l.cl.ind, l.alvo.v, E) : (l.cl.op === 'maior' ? 'maior em ' : 'menor em ') + String(l.cl.num).replace('.', ',') + UNIDADE_TXT[l.cl.un ?? 'q'];
    const mo = opcoesMantendo(l.cl.ind, R.M), mt = mo && l.cl.mant ? mo.find(x => x[0] === l.cl.mant)?.[1] : null;
    return (art === 'a' ? 'a ' : 'o ') + l.I.t + ' ' + vb.ser + ' ' + ref + (mt ? ', mantendo ' + mt : '');
  });
  const Ir = indicador(res, E);
  return partes.length ? 'Se ' + partes.join(' e ') + ', ' + vb.imp.replace(/ em$/, '') + ' ' + (artigo(res, E) === 'a' ? 'na ' : 'no ') + Ir.t + '?' : 'Escolha o que mudar.';
}

/* ---------- premissas financeiras a partir da política de preço (quando não há vendas com custo lançado) ---------- */
export interface PremissasFinanceiras { comPct: number; impPct: number; taxaPct: number; custoPct: number; mPct: number; fonte: string }
export function premissasDaPolitica(pol: Politica, ticket: number, custos: number | CustoInformado[], condicao?: string | null): PremissasFinanceiras | null {
  if (!(ticket > 0)) return null;
  const itens: CustoInformado[] = typeof custos === 'number' ? [{ chave: 'cpv', valor: Math.max(0, custos), categoria: 'cpv' }] : custos;
  const e = economiaDaVenda({ preco: ticket, custos: itens, condicao: condicao ?? null }, pol);
  const ded = e.deducoes.reduce((s, d) => s + d.valor, 0);
  return { comPct: e.comissao / ticket, impPct: ded / ticket, taxaPct: (e.taxa + e.antecipacao) / ticket, custoPct: e.custos / ticket, mPct: e.mcPctPreco ?? 0, fonte: 'estimativa pela política de preço v' + pol.versao + (pol.versao ? '' : ' (vazia)') };
}
