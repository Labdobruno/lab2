/* Economia da venda: motor puro. Uma venda não vale o "valor fechado": vale o que sobra depois de deduções (imposto, taxa da condição,
   antecipação), comissão, custos e o custo do dinheiro até receber. Regras da V1 (precEcon, margemVenda, comissaoDaMargem, fórmula de preço),
   generalizadas: deduções, condições e comissão são configuração da política (pack); o motor só soma. Fonte única: ninguém recalcula fora daqui.
   Vocabulário: receita bruta (preço) → líquido antes da comissão → receita líquida (RL) → MC bruta = RL − custos → MC = MC bruta − custo financeiro do prazo.
   MC % é sempre sobre a RL; a % sobre o preço anda ao lado, nomeada. */
import type { CategoriaCusto, TipoComissao } from '@lab/nucleo';

export const DIAS_MES = 30.4375;                       // único lugar onde "dias por mês" existe
export const VERSAO_ECONOMIA = '2026-11-01.1';

export interface LinhaPolitica { chave: string; nome: string; grupo: 'deducao' | 'custo_variavel' | 'comissao'; base: 'percentual_preco' | 'percentual_liquido' | 'fixo' | 'informado'; valor?: number | null; excluir?: string[]; categoria?: CategoriaCusto }
export interface CondicaoPolitica { chave: string; nome: string; taxa: number; antecipacao?: number; partes?: Array<{ fracao: number; dias: number }> }
export interface ComissaoPolitica { tipo: TipoComissao; alvo?: number | null; minima?: number | null }
export interface Politica {
  versao: number; margemAlvo: number | null; margemMinima: number | null; descontoMaximo: number | null; custoCapitalMes: number;
  custosFixosMes: number | null; lucroDesejadoMes: number | null; comissao: ComissaoPolitica; linhas: LinhaPolitica[]; condicoes: CondicaoPolitica[];
}
export const POLITICA_VAZIA: Politica = { versao: 0, margemAlvo: null, margemMinima: null, descontoMaximo: null, custoCapitalMes: 0, custosFixosMes: null, lucroDesejadoMes: null, comissao: { tipo: 'nenhuma' }, linhas: [], condicoes: [{ chave: 'vista', nome: 'À vista', taxa: 0 }] };
export const CONDICAO_PADRAO: CondicaoPolitica = { chave: 'vista', nome: 'À vista', taxa: 0, partes: [{ fracao: 1, dias: 0 }] };

/* a política a partir da precificação do pack (ou do que a operação publicou por cima) */
export function politicaDe(pr: {
  margemAlvo?: number | null; margemMinima?: number | null; descontoMaximo?: number | null; custoCapitalMes?: number | null; custosFixosMes?: number | null; lucroDesejadoMes?: number | null;
  comissao?: ComissaoPolitica | null; linhas?: LinhaPolitica[] | null; condicoes?: Array<Partial<CondicaoPolitica> & { chave: string; nome: string }> | null;
}, versao = 0): Politica {
  const condicoes = (pr.condicoes ?? []).map(c => ({ chave: c.chave, nome: c.nome, taxa: c.taxa ?? 0, antecipacao: c.antecipacao ?? 0, partes: c.partes?.length ? c.partes : [{ fracao: 1, dias: 0 }] }));
  return {
    versao, margemAlvo: pr.margemAlvo ?? null, margemMinima: pr.margemMinima ?? null, descontoMaximo: pr.descontoMaximo ?? null, custoCapitalMes: pr.custoCapitalMes ?? 0,
    custosFixosMes: pr.custosFixosMes ?? null, lucroDesejadoMes: pr.lucroDesejadoMes ?? null, comissao: pr.comissao ?? { tipo: 'nenhuma' }, linhas: pr.linhas ?? [], condicoes: condicoes.length ? condicoes : [CONDICAO_PADRAO],
  };
}

/* comissão atrelada à margem (V1, decisão de 09/10/2026: não há teto): linear entre (margem mínima → comissão mínima) e (margem alvo → comissão alvo),
   piso na mínima, continua subindo acima da alvo; comissão fixa = sempre a alvo. margem e saídas em fração. */
export function comissaoDaMargem(margem: number, p: { alvo: number; minima: number; margemAlvo: number; margemMinima: number; fixa?: boolean }): number {
  if (p.fixa) return p.alvo;
  const dm = p.margemAlvo - p.margemMinima;
  if (!(dm > 0)) return margem >= p.margemAlvo ? p.alvo : p.minima;
  const c = p.minima + ((margem - p.margemMinima) / dm) * (p.alvo - p.minima);
  return Math.max(p.minima, c);
}

export interface CustoInformado { chave: string; valor: number; categoria?: CategoriaCusto | null; nome?: string }
export interface EntradaVenda { preco: number; custos: CustoInformado[]; condicao?: string | null; comissaoFixa?: number | null; fixoPct?: number | null; semCustoFinanceiro?: boolean }
export interface Economia {
  versao: string; preco: number; condicao: string; politicaVersao: number;
  deducoes: Array<{ chave: string; nome: string; base: number; pct: number | null; valor: number }>;   // impostos e afins (percentual sobre o preço, menos exclusões; ou fixo)
  taxa: number; antecipacao: number; liquidoAntesComissao: number;
  comissao: number; comissaoPct: number; comissaoOrigem: 'nenhuma' | 'fixa' | 'por_margem' | 'informada'; comissaoIteracoes: number;
  receitaLiquida: number; deducoesTotal: number;
  custos: number; custosPorCategoria: Record<string, number>; custosItens: CustoInformado[];
  diasMedioRecebimento: number; capitalExposto: number; custoFinanceiro: number; custoVariavel: number;
  mcBruta: number; mcBrutaPct: number | null; mc: number; mcPct: number | null; mcPctPreco: number | null;
  fixo: number | null; lucro: number | null; lucroPct: number | null;
}
const num = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : 0);

/* a economia de uma venda ao preço P, pela política dada (a venda guarda a versão da política do dia: nada aqui lê "a vigente") */
export function economiaDaVenda(e: EntradaVenda, pol: Politica): Economia {
  const P = Math.max(0, num(e.preco)), itens = (e.custos ?? []).filter(c => c && isFinite(Number(c.valor)));
  const cond = pol.condicoes.find(c => c.chave === (e.condicao ?? 'vista')) ?? pol.condicoes.find(c => c.chave === 'vista') ?? pol.condicoes[0] ?? CONDICAO_PADRAO;
  const custoDe = (chave: string) => itens.filter(c => c.chave === chave).reduce((s, c) => s + num(c.valor), 0);
  /* custos: linhas "informado" da política (com categoria) + o que veio sem linha (categoria do item ou cpv) */
  const linhasInformadas = pol.linhas.filter(l => l.base === 'informado' && l.grupo !== 'comissao');
  const custosItens: CustoInformado[] = itens.filter(c => !pol.linhas.some(l => l.chave === c.chave && l.grupo === 'deducao')).map(c => ({ chave: c.chave, valor: num(c.valor), categoria: c.categoria ?? linhasInformadas.find(l => l.chave === c.chave)?.categoria ?? 'cpv', nome: c.nome ?? linhasInformadas.find(l => l.chave === c.chave)?.nome ?? c.chave }));
  const custos = custosItens.reduce((s, c) => s + c.valor, 0), custosPorCategoria: Record<string, number> = {};
  for (const c of custosItens) custosPorCategoria[c.categoria ?? 'cpv'] = (custosPorCategoria[c.categoria ?? 'cpv'] ?? 0) + c.valor;
  /* deduções sobre o preço: percentuais (menos exclusões), fixas, ou informadas na venda */
  const deducoes: Economia['deducoes'] = [];
  for (const l of pol.linhas.filter(l => l.grupo === 'deducao')) {
    /* um valor informado na venda para a dedução é fato da venda e vale por cima do percentual da política */
    if (itens.some(c => c.chave === l.chave)) { deducoes.push({ chave: l.chave, nome: l.nome, base: P, pct: null, valor: custoDe(l.chave) }); continue; }
    if (l.base === 'percentual_preco') { const base = Math.max(0, P - (l.excluir ?? []).reduce((s, k) => s + custoDe(k), 0)); deducoes.push({ chave: l.chave, nome: l.nome, base, pct: num(l.valor), valor: base * num(l.valor) }); }
    else if (l.base === 'fixo') deducoes.push({ chave: l.chave, nome: l.nome, base: P, pct: null, valor: num(l.valor) });
    else if (l.base === 'informado') deducoes.push({ chave: l.chave, nome: l.nome, base: P, pct: null, valor: 0 });
  }
  const dedTotal = deducoes.reduce((s, d) => s + d.valor, 0), taxa = P * num(cond.taxa), antecipacao = P * num(cond.antecipacao);
  const liq = P - dedTotal - taxa - antecipacao;
  /* comissão: informada na venda (fixa), fixa da política, por margem (iteração de ponto fixo: a margem depende da comissão e vice-versa) */
  let pct = 0, origem: Economia['comissaoOrigem'] = 'nenhuma', it = 0;
  const C = pol.comissao;
  if (e.comissaoFixa != null && isFinite(e.comissaoFixa)) { pct = Math.max(0, e.comissaoFixa); origem = 'informada'; }
  else if (C.tipo === 'fixa') { pct = num(C.alvo); origem = 'fixa'; }
  else if (C.tipo === 'por_margem' && pol.margemAlvo != null && pol.margemMinima != null) {
    origem = 'por_margem'; pct = num(C.alvo);
    const par = { alvo: num(C.alvo), minima: num(C.minima), margemAlvo: pol.margemAlvo, margemMinima: pol.margemMinima };
    for (it = 1; it <= 60; it++) { const rl = liq * (1 - pct), m = rl > 0 ? (rl - custos) / rl : 0, novo = comissaoDaMargem(m, par); const prox = pct + 0.7 * (novo - pct); if (Math.abs(prox - pct) < 1e-10) { pct = prox; break; } pct = prox; }
  }
  /* linhas "comissao" percentuais sobre o líquido da política (ex.: comissão de parceiro) somam à comissão */
  const comExtra = pol.linhas.filter(l => l.grupo === 'comissao' && l.base === 'percentual_liquido').reduce((s, l) => s + num(l.valor), 0);
  const comissao = liq * (pct + comExtra), RL = liq - comissao;
  /* custo financeiro do prazo: a empresa banca os custos até o cliente pagar; dias médios = Σ fração × dias; capital exposto = custos */
  const partes = cond.partes?.length ? cond.partes : [{ fracao: 1, dias: 0 }], diasMedio = partes.reduce((s, p) => s + p.fracao * p.dias, 0);
  const custoFinanceiro = e.semCustoFinanceiro ? 0 : custos * num(pol.custoCapitalMes) * (diasMedio / DIAS_MES);
  const cv = custos + custoFinanceiro, mcBruta = RL - custos, mc = RL - cv;
  const fixo = e.fixoPct != null ? P * num(e.fixoPct) : null, lucro = fixo != null ? mc - fixo : null;
  return {
    versao: VERSAO_ECONOMIA, preco: P, condicao: cond.chave, politicaVersao: pol.versao, deducoes, taxa, antecipacao, liquidoAntesComissao: liq,
    comissao, comissaoPct: pct + comExtra, comissaoOrigem: origem, comissaoIteracoes: it, receitaLiquida: RL, deducoesTotal: dedTotal + taxa + antecipacao + comissao,
    custos, custosPorCategoria, custosItens, diasMedioRecebimento: diasMedio, capitalExposto: custos, custoFinanceiro, custoVariavel: cv,
    mcBruta, mcBrutaPct: RL > 0 ? mcBruta / RL : null, mc, mcPct: RL > 0 ? mc / RL : null, mcPctPreco: P > 0 ? mc / P : null, fixo, lucro, lucroPct: lucro != null && P > 0 ? lucro / P : null,
  };
}

/* fórmula de preço da V1 (kit fora da base do imposto, comissão c sobre o líquido, imposto t): Preço = [Custo ÷ ((1 − m)(1 − c)) − kit] ÷ (1 − t) + kit */
export const precoFormula = (custo: number, kit: number, m: number, t: number, c: number) => (custo / ((1 - m) * (1 - c)) - kit) / (1 - t) + kit;

/* preço que entrega uma MC bruta % (sobre a RL) numa condição: inverte o motor por bissecção, então vale para qualquer política.
   Ida e volta: economiaDaVenda(precoParaMargem(m)).mcBrutaPct = m. Sem solução (margem ≥ 100% ou custos zero) devolve nulo. */
export function precoParaMargem(custos: CustoInformado[], pol: Politica, margem: number, opts: { condicao?: string | null; comissaoFixa?: number | null } = {}): number | null {
  const C = custos.reduce((s, c) => s + num(c.valor), 0);
  if (!(C > 0) || !(margem < 1) || !(margem >= 0)) return null;
  const f = (P: number) => economiaDaVenda({ preco: P, custos, condicao: opts.condicao, comissaoFixa: opts.comissaoFixa, semCustoFinanceiro: true }, pol).mcBrutaPct ?? -1;
  let lo = C, hi = C * 2;
  for (let i = 0; i < 60 && f(hi) < margem; i++) hi *= 2;
  if (f(hi) < margem) return null;
  for (let i = 0; i < 100; i++) { const mid = (lo + hi) / 2; if (f(mid) < margem) lo = mid; else hi = mid; if (hi - lo < 1e-6) break; }
  return Math.round(((lo + hi) / 2) * 100) / 100;
}
export function precoRecomendado(custos: CustoInformado[], pol: Politica, opts: { condicao?: string | null; comissaoFixa?: number | null } = {}) {
  return { recomendado: pol.margemAlvo != null ? precoParaMargem(custos, pol, pol.margemAlvo, opts) : null, piso: pol.margemMinima != null ? precoParaMargem(custos, pol, pol.margemMinima, opts) : null };
}

/* alçada: fechar (ou aprovar) abaixo do piso ou com desconto acima do máximo exige motivo; a exceção fica registrada com o impacto na MC */
export function alcada(x: { preco: number; piso: number | null; aprovado?: number | null; descontoMaximo?: number | null; mcNoPiso?: number | null; mcNoPreco?: number | null }) {
  const abaixoDoPiso = x.piso != null && x.preco < x.piso - 0.005;
  const desconto = x.aprovado && x.aprovado > 0 ? 1 - x.preco / x.aprovado : null;
  const acimaDoDesconto = desconto != null && x.descontoMaximo != null && desconto > x.descontoMaximo + 1e-9;
  const impactoMc = x.mcNoPiso != null && x.mcNoPreco != null ? x.mcNoPiso - x.mcNoPreco : null;
  const motivos = [abaixoDoPiso ? `preço ${brl(x.preco)} abaixo do piso ${brl(x.piso!)}` : '', acimaDoDesconto ? `desconto ${pct(desconto!)} acima do máximo ${pct(x.descontoMaximo!)}` : ''].filter(Boolean);
  return { exige: abaixoDoPiso || acimaDoDesconto, abaixoDoPiso, desconto, acimaDoDesconto, impactoMc, texto: motivos.join('; ') };
}
/* desconto entre o aprovado e o final e a MC perdida nele */
export function mcPerdida(aprovado: Economia | null, final: Economia | null) {
  if (!aprovado || !final) return { desconto: null, mcPerdida: null };
  return { desconto: aprovado.preco > 0 ? 1 - final.preco / aprovado.preco : null, mcPerdida: aprovado.mc - final.mc };
}
/* margem agregada = Σ MC ÷ Σ RL (não é média das margens) */
export function margemAgregada(L: Array<Pick<Economia, 'mc' | 'receitaLiquida'>>) {
  const rl = L.reduce((s, e) => s + e.receitaLiquida, 0), mc = L.reduce((s, e) => s + e.mc, 0);
  return { mc, receitaLiquida: rl, pct: rl > 0 ? mc / rl : null, n: L.length };
}
/* contribuição necessária no mês: quanto falta para empatar com o custo fixo e para o lucro desejado, em R$ e em vendas pela MC média */
export function contribuicaoNecessaria(x: { custosFixosMes: number | null; lucroDesejadoMes: number | null; mcAcumulada: number; mcMediaPorVenda: number | null }) {
  const fixo = x.custosFixosMes, lucro = x.lucroDesejadoMes ?? 0;
  if (fixo == null) return { estado: 'sem_fixo' as const, texto: 'Custo fixo do mês não informado na política: não dá para dizer quantas vendas faltam para empatar.' };
  const faltaEmpatar = Math.max(0, fixo - x.mcAcumulada), faltaLucro = Math.max(0, fixo + lucro - x.mcAcumulada);
  const v = (r: number) => (x.mcMediaPorVenda && x.mcMediaPorVenda > 0 ? Math.ceil(r / x.mcMediaPorVenda - 1e-9) : null);
  return { estado: faltaEmpatar > 0 ? ('abaixo' as const) : faltaLucro > 0 ? ('empatou' as const) : ('lucro' as const), fixo, lucroDesejado: lucro, mcAcumulada: x.mcAcumulada, faltaEmpatar, vendasParaEmpatar: v(faltaEmpatar), faltaLucro, vendasParaLucro: v(faltaLucro), texto: faltaEmpatar > 0 ? `Faltam ${brl(faltaEmpatar)} de MC para pagar a estrutura${v(faltaEmpatar) != null ? ` (≈ ${v(faltaEmpatar)} venda(s) pela MC média)` : ''}.` : faltaLucro > 0 ? `A estrutura está paga; faltam ${brl(faltaLucro)} para o lucro desejado${v(faltaLucro) != null ? ` (≈ ${v(faltaLucro)} venda(s))` : ''}.` : 'Estrutura paga e lucro desejado atingido.' };
}
/* break-even do desconto: com um desconto d, quantas vendas a mais são necessárias para a mesma contribuição (volEq = MC atual ÷ MC com desconto) */
export function breakEvenDesconto(base: EntradaVenda, pol: Politica, desconto: number) {
  const atual = economiaDaVenda(base, pol), nova = economiaDaVenda({ ...base, preco: base.preco * (1 - desconto) }, pol);
  const volEq = nova.mc > 0 ? atual.mc / nova.mc : null;
  return { desconto, precoNovo: nova.preco, mcAtual: atual.mc, mcNova: nova.mc, volEq, volumeExtra: volEq != null ? volEq - 1 : null, texto: volEq == null ? `Com ${pct(desconto)} de desconto a venda não contribui mais: nenhum volume compensa.` : `Com ${pct(desconto)} de desconto cada venda contribui ${brl(nova.mc)} em vez de ${brl(atual.mc)}: precisa de ${pct(volEq - 1)} mais volume para a mesma contribuição.` };
}
/* previsto × real × efetiva: o previsto é o que a venda dizia (custos informados); o real é o custo lançado; a efetiva é o real só quando tudo foi lançado */
export function previstoRealEfetiva(previsto: Economia | null, real: Economia | null, completo: boolean) {
  const efetiva = real && completo ? real : previsto;
  return { previsto, real, completo, parcial: !!real && !completo, efetiva, fonte: (real && completo ? 'real' : 'prevista') as 'real' | 'prevista', erroOrcamento: previsto && real && completo ? real.custos - previsto.custos : null };
}
export const brl = (v: number | null | undefined) => (v == null || !isFinite(v) ? '—' : 'R$ ' + Math.round(v).toLocaleString('pt-BR'));
export const pct = (v: number | null | undefined) => (v == null || !isFinite(v) ? '—' : (Math.round(v * 1000) / 10).toLocaleString('pt-BR') + '%');
