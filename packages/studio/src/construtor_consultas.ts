/* Construtor "e se" no banco: monta o estado medido de um sujeito (equipe, vendedor ou canal) num período com as fontes da V2
   e roda a simulação pura; guarda perguntas; transforma uma pergunta em experimento (@lab/hipoteses).
   Taxas por coorte elegível (avançou ÷ avançou + perdeu + parou além do prazo); margem pelas vendas com custo lançado (@lab/economia),
   senão pela política de preço; marketing pelo investimento lançado por canal e mês. Sem dado → null, nunca zero. */
import type { Sql } from 'postgres';
import { economiaDaVenda as economia, politicaVigente, type Politica } from '@lab/economia';
import { iniciarExperimento, montarContexto } from '@lab/hipoteses';
import { relatorio } from '@lab/metricas';
import { somarDias, type Operacao } from '@lab/planejamento';
import { ErroDeStudio } from './consultas.js';
import {
  alvoDaClausula, catalogo, derivar, fecharBase, formatar, frase, indicador, normalizar, opcoesMantendo, premissasDaPolitica, quantoPrecisa, rij, sensibilidadeDoIndicador, simularESe,
  type Clausula, type ContextoSimulacao, type Estado, type EtapaFunil, type Referencias,
} from './construtor.js';

const DIA = 86_400_000, DIAS_MES = 30.4375;
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const dataOk = (d: unknown): d is string => typeof d === 'string' && DATA.test(d) && !Number.isNaN(Date.parse(d));
const UUID = /^[0-9a-f-]{36}$/i;
const CADENCIA_LEAD_DIAS = 5;

export interface Sujeito { id: string; t: string; tipo: 'equipe' | 'vend' | 'canal' }
interface NegocioPop { id: string; dono: string | null; canal: string | null; status: 'aberto' | 'ganho' | 'perdido'; papelAtual: string; alcancados: string[]; criadoEm: number; etapaDesde: number; valorFechado: number | null }
interface Etapa extends EtapaFunil { prazo: number | null }

async function etapas(sql: Sql, op: Operacao): Promise<Etapa[]> {
  const [funil] = await sql<{ id: string }[]>`select id from lab.funil where operacao_id = ${op.id} and principal limit 1`;
  if (!funil) throw new ErroDeStudio('a operação não tem funil principal', 409);
  const L = await sql<{ chave: string; nome: string; papel: string; prazo_dias: number | null }[]>`select chave, nome, papel, prazo_dias from lab.etapa where funil_id = ${funil.id} and ativa and papel <> 'perdido' order by ordem`;
  return L.map(e => ({ chave: e.chave, nome: e.nome, papel: e.papel, prazo: e.prazo_dias }));
}
async function populacao(sql: Sql, op: Operacao, de: string, ate: string): Promise<NegocioPop[]> {
  const L = await sql<any[]>`
    select n.id, n.dono_id, c.chave as canal, n.status, e.papel, n.valor_fechado, n.criado_em, coalesce(n.etapa_desde, n.criado_em) as desde,
           coalesce((select jsonb_agg(distinct e2.papel) from lab.negocio_transicao t join lab.etapa e2 on e2.id = t.para_etapa_id where t.negocio_id = n.id), '[]'::jsonb) as alcancados
    from lab.negocio n join lab.etapa e on e.id = n.etapa_id join lab.funil f on f.id = n.funil_id left join lab.canal c on c.id = n.canal_id
    where n.operacao_id = ${op.id} and n.tipo = 'novo' and f.principal and (n.criado_em at time zone ${op.fuso})::date >= ${de}::date and (n.criado_em at time zone ${op.fuso})::date <= ${ate}::date`;
  return L.map(l => ({ id: l.id, dono: l.dono_id, canal: l.canal, status: l.status, papelAtual: l.papel, alcancados: l.alcancados, criadoEm: Date.parse(l.criado_em), etapaDesde: Date.parse(l.desde), valorFechado: l.valor_fechado == null ? null : Number(l.valor_fechado) }));
}
export async function sujeitos(sql: Sql, op: Operacao, de: string, ate: string): Promise<Sujeito[]> {
  const pop = await populacao(sql, op, de, ate);
  const pessoas = await sql<{ id: string; nome: string }[]>`select id, nome from lab.pessoa where operacao_id = ${op.id} and ativa order by nome`;
  const canais = await sql<{ chave: string; nome: string }[]>`select chave, nome from lab.canal where operacao_id = ${op.id} and ativo order by nome`;
  const comLeads = new Set(pop.map(p => p.dono).filter(Boolean)), canaisPop = new Set(pop.map(p => p.canal).filter(Boolean));
  return [{ id: 'equipe', t: 'a equipe', tipo: 'equipe' } as Sujeito]
    .concat(pessoas.filter(p => comLeads.has(p.id)).map(p => ({ id: 'v:' + p.id, t: p.nome, tipo: 'vend' as const })))
    .concat(canais.filter(c => canaisPop.has(c.chave)).map(c => ({ id: 'c:' + c.chave, t: 'o canal ' + c.nome, tipo: 'canal' as const })));
}
const filtraSujeito = (pop: NegocioPop[], suj: string) => pop.filter(d => suj === 'equipe' || (suj.startsWith('v:') ? d.dono === suj.slice(2) : (d.canal ?? '') === suj.slice(2)));

/* conversão de cada passagem só com a população elegível: avançaram ÷ (avançaram + perdidos na etapa + parados além do prazo).
   Quem ainda está na etapa dentro do prazo (lead: 5 dias; demais: 2× o prazo da etapa, mínimo 7) fica de fora. Sem elegível: null, nunca 0. */
export function conversaoElegivel(pop: NegocioPop[], E: Etapa[], agora: number) {
  const n = E.length - 1, pos = new Map(E.map((e, i) => [e.papel, i]));
  const alcance = (d: NegocioPop) => { let al = 0; for (const p of d.alcancados) { const i = pos.get(p); if (i != null && i > al) al = i; } if (d.status === 'ganho') al = n; else { const i = pos.get(d.papelAtual); if (i != null && i > al) al = i; } return al; };
  const num = Array<number>(n).fill(0), den = Array<number>(n).fill(0), pend = Array<number>(n).fill(0);
  for (const d of pop) {
    const al = alcance(d), aberto = d.status === 'aberto';
    for (let i = 0; i < n && i <= al; i++) {
      if (al > i) { num[i]!++; den[i]!++; continue; }
      if (aberto) { const prazo = (i === 0 ? CADENCIA_LEAD_DIAS : Math.max(7, 2 * (E[i]!.prazo ?? 0))) * DIA; if (agora - d.etapaDesde < prazo) { pend[i]!++; continue; } }
      den[i]!++;
    }
  }
  return { conv: num.map((x, i) => (den[i] ? x / den[i]! : null)), num, den, pend };
}

async function marketing(sql: Sql, op: Operacao, canal: string | null, de: string, ate: string) {
  const L = await sql<{ canal: string; inv: string; imp: string | null; cli: string | null }[]>`
    select c.chave as canal, sum(i.valor) as inv, sum(i.impressoes) as imp, sum(i.cliques) as cli from lab.investimento_canal i join lab.canal c on c.id = i.canal_id
    where i.operacao_id = ${op.id} and i.mes >= date_trunc('month', ${de}::date) and i.mes <= ${ate}::date ${canal ? sql`and c.chave = ${canal}` : sql``} group by 1`;
  const pagos = L.filter(x => Number(x.inv) > 0).map(x => x.canal);
  if (!L.length) return { mk: null, pagos };
  return { mk: { inv: L.reduce((s, x) => s + Number(x.inv), 0), imp: L.reduce((s, x) => s + Number(x.imp ?? 0), 0), cli: L.reduce((s, x) => s + Number(x.cli ?? 0), 0) }, pagos };
}

/* o estado medido de um sujeito num período */
export async function modeloDoSujeito(sql: Sql, op: Operacao, suj: string, de: string, ate: string, agora = Date.now(), pre?: { E: Etapa[]; pop: NegocioPop[]; pol: Politica; rel: Awaited<ReturnType<typeof relatorio>> }): Promise<Estado> {
  const E = pre?.E ?? (await etapas(sql, op)), todos = pre?.pop ?? (await populacao(sql, op, de, ate)), pol = pre?.pol ?? (await politicaVigente(sql, op.id));
  const rel = pre?.rel ?? (await relatorio(sql, op, { de, ate: somarDias(ate, 1) }));
  const pop = filtraSujeito(todos, suj), ganhos = pop.filter(d => d.status === 'ganho'), ehVend = suj.startsWith('v:'), canal = suj.startsWith('c:') ? suj.slice(2) : null;
  const CE = conversaoElegivel(pop, E, agora), fontes: Record<string, string> = {};
  const receita = ganhos.reduce((s, g) => s + (g.valorFechado ?? 0), 0), ticket = ganhos.length ? receita / ganhos.length : 0;
  /* economia: as vendas do sujeito com custo lançado (fato); sem elas, a política de preço (estimativa) */
  const ids = new Set(ganhos.map(g => g.id)), econ = rel.vendas.economia.filter(e => ids.has(e.negocioId) && e.economia && e.margemContribuicao != null);
  let mPct: number | null = null, comPct: number | null = null, impPct: number | null = null, taxaPct: number | null = null, custoPct: number | null = null, cx: number | null = null, margemEstimada = false;
  const cxDe = (cond: string | null) => { const c = pol.condicoes.find(x => x.chave === (cond ?? 'vista')); const partes = c?.partes?.length ? c.partes : [{ fracao: 1, dias: 0 }]; return partes.filter(p => p.dias <= 30).reduce((s, p) => s + p.fracao, 0); };
  if (econ.length) {
    const R = econ.reduce((s, e) => s + e.economia!.preco, 0);
    mPct = econ.reduce((s, e) => s + e.economia!.mc, 0) / R; comPct = econ.reduce((s, e) => s + e.economia!.comissao, 0) / R;
    impPct = econ.reduce((s, e) => s + e.economia!.deducoes.reduce((t, d) => t + d.valor, 0), 0) / R; taxaPct = econ.reduce((s, e) => s + e.economia!.taxa + e.economia!.antecipacao, 0) / R;
    custoPct = econ.reduce((s, e) => s + e.economia!.custos, 0) / R; cx = econ.reduce((s, e) => s + e.economia!.preco * cxDe(e.economia!.condicao), 0) / R;
    fontes.margem = `custos lançados em ${econ.length} venda${econ.length > 1 ? 's' : ''}`;
  } else if (ticket > 0 && pol.margemAlvo != null) {
    /* a política no ticket médio: custo tal que a MC bruta % = margem-alvo */
    const e0 = economia({ preco: ticket, custos: [] }, pol), custos = Math.max(0, e0.receitaLiquida * (1 - pol.margemAlvo));
    const p = premissasDaPolitica(pol, ticket, custos); if (p) { mPct = p.mPct; comPct = p.comPct; impPct = p.impPct; taxaPct = p.taxaPct; custoPct = p.custoPct; margemEstimada = true; fontes.margem = p.fonte + ' (margem-alvo no ticket médio)'; }
    cx = cxDe(null);
  } else fontes.margem = ganhos.length ? 'nenhuma venda com custo lançado e a política não tem margem-alvo' : 'sem vendas no período';
  const mk = ehVend ? { mk: null, pagos: [] as string[] } : await marketing(sql, op, canal, de, ate);
  const Lp = mk.mk ? (canal ? pop.length : pop.filter(d => mk.pagos.includes(d.canal ?? '')).length) : null;
  if (mk.mk) fontes.marketing = `investimento lançado por canal e mês (${mk.pagos.length} canal${mk.pagos.length > 1 ? 'is' : ''} pago${mk.pagos.length > 1 ? 's' : ''})`;
  const meses = Math.max(1 / 30, (Date.parse(ate) - Date.parse(de) + DIA) / (DIAS_MES * DIA));
  const fixos = pol.custosFixosMes != null ? pol.custosFixosMes * meses : null; if (fixos != null) fontes.fixos = `custos fixos do mês na política de preço × ${meses.toFixed(1).replace('.', ',')} meses`;
  const vends = new Set(pop.map(d => d.dono).filter(Boolean)), nVend = ehVend ? 1 : vends.size || null;
  fontes.conversoes = 'coorte elegível: avançou ÷ (avançou + perdeu + parou além do prazo), negócios criados no período';
  const s: Estado = {
    etapas: E, L: pop.length, Lp, conv: CE.conv, convInfo: CE, total: null, nVend, ticket, nTicket: ganhos.length, mPct, custoPct, comPct, impPct, taxaPct, cx, fixos,
    inv: mk.mk?.inv ?? null, imp: mk.mk?.imp ?? null, cli: mk.mk?.cli ?? null, mk: !!mk.mk, n: pop.length, fontes, margemEstimada,
  };
  fecharBase(s); return s;
}
/* maior volume mensal de leads que o sujeito (ou o time) já absorveu, nos últimos 12 meses */
export async function capacidadeDeLeads(sql: Sql, op: Operacao, suj: string, ate: string): Promise<number | null> {
  const dono = suj.startsWith('v:') ? suj.slice(2) : null;
  const L = await sql<{ n: number }[]>`select count(*)::int as n from lab.negocio n join lab.funil f on f.id = n.funil_id where n.operacao_id = ${op.id} and n.tipo = 'novo' and f.principal
    and n.criado_em >= ${somarDias(ate, -365)}::date and n.criado_em < ${somarDias(ate, 1)}::date ${dono ? sql`and n.dono_id = ${dono}` : sql``} group by date_trunc('month', n.criado_em at time zone ${op.fuso})`;
  return L.length ? Math.max(...L.map(x => x.n)) : null;
}

/* ---------- a pergunta completa ---------- */
export interface EntradaConstrutor { sujeito?: unknown; de?: unknown; ate?: unknown; clausulas?: unknown; res?: unknown; hz?: unknown; tempo?: unknown; meta?: { ind?: unknown; alvo?: unknown; mant?: unknown } | null }
const OPS = new Set(['maior', 'menor', 'chegasse', 'igual']), UNS = new Set(['%', 'pp', 'rs', 'q']);
export function lerClausulas(v: unknown): Clausula[] {
  if (!Array.isArray(v)) return [];
  if (v.length > 6) throw new ErroDeStudio('até 6 condições por pergunta');
  return v.map((c, i) => {
    const o = c as Record<string, unknown>;
    if (!o || typeof o.ind !== 'string' || !o.ind) throw new ErroDeStudio(`condição ${i + 1}: escolha o indicador`);
    if (!OPS.has(String(o.op))) throw new ErroDeStudio(`condição ${i + 1}: operador inválido`);
    const num = o.num == null || o.num === '' ? null : Number(String(o.num).replace(',', '.'));
    if (num != null && !Number.isFinite(num)) throw new ErroDeStudio(`condição ${i + 1}: número inválido`);
    return { ind: o.ind.slice(0, 40), op: o.op as Clausula['op'], num, un: UNS.has(String(o.un)) ? (o.un as Clausula['un']) : 'q', ref: typeof o.ref === 'string' && o.ref ? o.ref.slice(0, 80) : null, mant: typeof o.mant === 'string' && o.mant ? o.mant.slice(0, 20) : null };
  });
}
export async function simularConstrutor(sql: Sql, op: Operacao, b: EntradaConstrutor, hoje: string, agora = Date.now()) {
  const de = dataOk(b.de) ? b.de : somarDias(hoje, -op.janelaHistoricaDias), ate = dataOk(b.ate) ? b.ate : hoje;
  if (ate < de) throw new ErroDeStudio('o período termina antes de começar');
  const suj = typeof b.sujeito === 'string' && b.sujeito ? b.sujeito : 'equipe', res = typeof b.res === 'string' && b.res ? b.res : 'R';
  const cls = lerClausulas(b.clausulas);
  const [E, pop, pol, rel] = await Promise.all([etapas(sql, op), populacao(sql, op, de, ate), politicaVigente(sql, op.id), relatorio(sql, op, { de, ate: somarDias(ate, 1) })]);
  const pre = { E, pop, pol, rel };
  const nomes = new Map((await sql<{ id: string; nome: string }[]>`select id, nome from lab.pessoa where operacao_id = ${op.id}`).map(p => [p.id, p.nome]));
  const nomesCanal = new Map((await sql<{ chave: string; nome: string }[]>`select chave, nome from lab.canal where operacao_id = ${op.id}`).map(c => [c.chave, c.nome]));
  const nomeDe = (id: string) => (id === 'equipe' ? 'a equipe' : id.startsWith('v:') ? nomes.get(id.slice(2)) ?? id.slice(2) : 'o canal ' + (nomesCanal.get(id.slice(2)) ?? id.slice(2)));
  if (suj !== 'equipe' && !(suj.startsWith('v:') && nomes.has(suj.slice(2))) && !(suj.startsWith('c:') && nomesCanal.has(suj.slice(2)))) throw new ErroDeStudio('sujeito não encontrado (use equipe, v:<pessoa> ou c:<canal>)', 404);
  const M = await modeloDoSujeito(sql, op, suj, de, ate, agora, pre);
  for (const cl of cls) normalizar(cl, E);
  /* referências só quando alguma condição pede ("igual a…") */
  const refs: Referencias = {};
  if (cls.some(c => c.op === 'igual' && c.ref === 'anterior')) { const L = (Date.parse(ate) - Date.parse(de)) / DIA + 1; refs.anterior = await modeloDoSujeito(sql, op, suj, somarDias(de, -L), somarDias(de, -1), agora); }
  if (cls.some(c => c.op === 'igual' && ['mediana', 'p75', 'media', 'melhor', 'pior'].includes(c.ref ?? ''))) {
    const tipo = suj.startsWith('c:') ? 'c:' : 'v:', ids = tipo === 'v:' ? [...new Set(pop.map(p => p.dono).filter((x): x is string => !!x))].map(x => 'v:' + x) : [...new Set(pop.map(p => p.canal).filter((x): x is string => !!x))].map(x => 'c:' + x);
    refs.pares = await Promise.all(ids.map(async id => ({ id, M: await modeloDoSujeito(sql, op, id, de, ate, agora, pre) }))); refs.tipoPares = tipo === 'c:' ? 'canais' : 'vendedores';
  }
  const nomeados = cls.filter(c => c.op === 'igual' && c.ref && /^(v|c):/.test(c.ref)).map(c => c.ref!);
  if (nomeados.length) { refs.porId = {}; for (const id of new Set(nomeados)) refs.porId[id] = await modeloDoSujeito(sql, op, id, de, ate, agora, pre); }
  const meses = Math.max(1, Math.round(((Date.parse(ate) - Date.parse(de)) / DIA + 1) / DIAS_MES));
  const ctx: ContextoSimulacao = { minN: 10, refs, capacidade: await capacidadeDeLeads(sql, op, suj.startsWith('v:') ? suj : 'equipe', ate), meses, res, sujeito: nomeDe(suj), ehVendedor: suj.startsWith('v:') };
  const R = simularESe(M, cls, ctx);
  /* "quanto precisa": o indicador pedido, a partir do cenário simulado */
  let meta: unknown = null;
  if (b.meta && typeof b.meta === 'object' && typeof b.meta.ind === 'string' && b.meta.alvo != null && b.meta.alvo !== '') {
    const ind = normalizar({ ind: b.meta.ind }, E).ind, Ir = indicador(res, E), alvoN = Number(String(b.meta.alvo).replace(',', '.'));
    if (Number.isFinite(alvoN)) { const r = quantoPrecisa(R.S, ind, res, Ir.tipo === 'taxa' ? alvoN / 100 : alvoN, typeof b.meta.mant === 'string' ? b.meta.mant : null); meta = { ind, indicador: indicador(ind, E), res, alvo: alvoN, ...r }; }
  }
  const primeira = R.linhas[0], sens = primeira ? sensibilidadeDoIndicador(R.M, primeira.cl.ind, res, primeira.cl.mant) : [];
  /* a mesma pergunta nos pares (quem já está perto do cenário?) */
  const refsPares = refs.pares ?? [];
  const comparacao = refsPares.length && !R.erros.length ? refsPares.map(p => { const S2 = simularESe(p.M, structuredClone(cls), { ...ctx, refs: {} }); return { id: p.id, nome: nomeDe(p.id), n: p.M.n, antes: S2.M ? (derivar(S2.M) as unknown as Record<string, number | null>)[res] ?? null : null, depois: S2.erros.length ? null : (S2.S as unknown as Record<string, number | null>)[res] ?? null }; }) : [];
  const cat = catalogo(E).filter(x => x.entrada && !x.oculto && (!x.mkt || M.mk) && (!x.fix || M.fixos != null) && !(x.k in { imp: 1, ctr: 1, cpc: 1, tx: 1 } && !(M.imp && M.cli)));
  return {
    sujeito: { id: suj, nome: nomeDe(suj) }, periodo: { de, ate, meses }, res, etapas: E, catalogo: cat, mantendo: Object.fromEntries(cat.map(x => [x.k, opcoesMantendo(x.k, M)]).filter(([, v]) => v)),
    frase: frase(R, res, b.tempo === 'futuro' ? 'futuro' : 'passado'), M: R.M, S: R.S, linhas: R.linhas, erros: R.erros, alertas: R.alertas, premissas: R.premissas, premissasL: R.premissasL, ordem: R.ordem, fontes: M.fontes ?? {},
    meta, sensibilidade: primeira ? { ind: primeira.cl.ind, indicador: primeira.I, pontos: sens } : null, comparacao,
    formatos: Object.fromEntries(['V', 'R', 'margem', 'mm', 'ro', 'caixa', 'pe', 'cac', 'roas', 'tpm', 'vnec', 'L', 'ticket'].map(k => [k, [formatar(k, (R.M as unknown as Record<string, number | null>)[k], E), formatar(k, (R.S as unknown as Record<string, number | null>)[k], E)]])),
  };
}

/* ---------- perguntas salvas ---------- */
export async function perguntasSalvas(sql: Sql, op: Operacao) {
  return (await sql<any[]>`select id, nome, sujeito, periodo, clausulas, resultado, por, criado_em from lab.studio_pergunta where operacao_id = ${op.id} order by criado_em desc limit 100`)
    .map(p => ({ id: p.id, nome: p.nome, sujeito: p.sujeito, periodo: p.periodo, clausulas: p.clausulas, res: p.resultado, por: p.por, criadaEm: p.criado_em }));
}
export async function salvarPergunta(sql: Sql, op: Operacao, b: { nome?: unknown; sujeito?: unknown; periodo?: unknown; clausulas?: unknown; res?: unknown }, por: string | null) {
  const nome = typeof b.nome === 'string' ? b.nome.trim().slice(0, 120) : '';
  if (!nome) throw new ErroDeStudio('dê um nome à pergunta');
  const cls = lerClausulas(b.clausulas); if (!cls.length) throw new ErroDeStudio('a pergunta precisa de ao menos uma condição');
  const per = b.periodo && typeof b.periodo === 'object' ? (b.periodo as Record<string, unknown>) : {};
  const periodo = dataOk(per.de) && dataOk(per.ate) ? { de: per.de, ate: per.ate } : { ciclos: Math.max(1, Math.min(12, Number(per.ciclos) || 1)) };
  const [r] = await sql<{ id: string }[]>`insert into lab.studio_pergunta (operacao_id, nome, sujeito, periodo, clausulas, resultado, por)
    values (${op.id}, ${nome}, ${typeof b.sujeito === 'string' && b.sujeito ? b.sujeito : 'equipe'}, ${sql.json(periodo as never)}, ${sql.json(cls as never)}, ${typeof b.res === 'string' && b.res ? b.res : 'R'}, ${por ?? ''}) returning id`;
  return { id: r!.id, nome };
}
export async function apagarPergunta(sql: Sql, op: Operacao, id: string) {
  if (!UUID.test(id)) throw new ErroDeStudio('pergunta não encontrada', 404);
  const r = await sql`delete from lab.studio_pergunta where id = ${id} and operacao_id = ${op.id}`;
  if (!r.count) throw new ErroDeStudio('pergunta não encontrada', 404);
  return { ok: true };
}

/* ---------- a pergunta vira experimento: a 1ª condição é a métrica e o alvo ---------- */
const METRICA_POR_PAPEL: Record<string, string> = { contato: 'conv_contato', qualificado: 'conv_qualificado', agendada: 'conv_agendada', realizada: 'conv_realizada', oportunidade: 'conv_oportunidade', proposta: 'conv_proposta', ganho: 'conv_ganho' };
const PASSO_POR_PAPEL: Record<string, string> = { agendada: 'passo_agendada', realizada: 'passo_realizada', proposta: 'passo_proposta', ganho: 'passo_ganho' };
export function metricaDaClausula(cl: Clausula, E: EtapaFunil[]): string | null {
  const r = rij(cl.ind);
  if (r) { const papel = E[r[1]]?.papel ?? ''; if (r[0] === 0) return papel === 'ganho' ? 'taxa_ganho' : METRICA_POR_PAPEL[papel] ?? null; if (r[1] - r[0] === 1) return PASSO_POR_PAPEL[papel] ?? METRICA_POR_PAPEL[papel] ?? null; return METRICA_POR_PAPEL[papel] ?? null; }
  const mapa: Record<string, string> = { L: 'leads', ticket: 'ticket_medio', mPct: 'margem_percentual', cpl: 'cpl_medio', cac: 'cac_medio', inv: 'investimento_total', desc: 'desconto_medio', V: 'vendas', R: 'receita' };
  return mapa[cl.ind] ?? null;
}
export async function virarExperimento(sql: Sql, op: Operacao, hoje: string, b: { titulo?: unknown; sujeito?: unknown; de?: unknown; ate?: unknown; clausulas?: unknown; fimPrevisto?: unknown; decisaoId?: unknown }) {
  const cls = lerClausulas(b.clausulas), E = await etapas(sql, op);
  if (!cls.length) throw new ErroDeStudio('a pergunta precisa de uma condição para virar experimento');
  const cl = normalizar(cls[0]!, E), metrica = metricaDaClausula(cl, E);
  if (!metrica) throw new ErroDeStudio(`"${indicador(cl.ind, E).t}" não tem uma métrica acompanhável no dicionário: escolha uma conversão, leads, ticket, margem, CPL ou CAC como primeira condição`);
  const R = await simularConstrutor(sql, op, { sujeito: b.sujeito, de: b.de, ate: b.ate, clausulas: cls }, hoje);
  if (R.erros.length) throw new ErroDeStudio('a pergunta tem erros: ' + R.erros.join(' '), 409);
  const linha = R.linhas[0]!, alvo = linha.alvo.v!;
  const titulo = typeof b.titulo === 'string' && b.titulo.trim() ? b.titulo.trim().slice(0, 200) : R.frase.slice(0, 200);
  const ctx = await montarContexto(sql, op, hoje);
  const x = await iniciarExperimento(sql, op, ctx, hoje, { titulo, metrica, alvo, fimPrevisto: b.fimPrevisto, decisaoId: b.decisaoId });
  return { experimento: x, metrica, alvo, antes: linha.antes, frase: R.frase, resultadoSimulado: R.formatos };
}

