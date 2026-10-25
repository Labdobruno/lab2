/* Economia da venda no banco: política versionada (só acréscimo), precificador, preço registrado com a política do dia congelada e exceção de alçada,
   custo real lançado à mão (sem contas a pagar), economia de um negócio (previsto × real × efetiva) e o painel do período. */
import type { Sql } from 'postgres';
import {
  alcada, breakEvenDesconto, contribuicaoNecessaria, economiaDaVenda, margemAgregada, mcPerdida, politicaDe, precoRecomendado, previstoRealEfetiva,
  type CustoInformado, type Economia, type Politica,
} from './motor.js';

export class ErroDeEconomia extends Error { constructor(m: string, readonly status = 400) { super(m); } }
const DATA = /^\d{4}-\d{2}-\d{2}$/;
export interface PoliticaGravada extends Politica { publicadaEm: string; por: string; motivo: string | null }
const linha = (r: any): PoliticaGravada => ({
  ...politicaDe({ margemAlvo: r.margem_alvo == null ? null : Number(r.margem_alvo), margemMinima: r.margem_minima == null ? null : Number(r.margem_minima), descontoMaximo: r.desconto_maximo == null ? null : Number(r.desconto_maximo),
    custoCapitalMes: Number(r.custo_capital_mes ?? 0), custosFixosMes: r.custos_fixos_mes == null ? null : Number(r.custos_fixos_mes), lucroDesejadoMes: r.lucro_desejado_mes == null ? null : Number(r.lucro_desejado_mes), comissao: r.comissao ?? { tipo: 'nenhuma' }, linhas: r.linhas ?? [], condicoes: r.condicoes ?? [] }, Number(r.versao)),
  publicadaEm: new Date(r.vigente_desde).toISOString(), por: r.por ?? '', motivo: r.motivo ?? r.observacao ?? null,
});
const COLS = (sql: Sql) => sql`versao, vigente_desde, margem_alvo, margem_minima, desconto_maximo, linhas, condicoes, comissao, custo_capital_mes, custos_fixos_mes, lucro_desejado_mes, por, motivo, observacao`;

export async function politicaVigente(sql: Sql, opId: string): Promise<PoliticaGravada> {
  const [r] = await sql<any[]>`select ${COLS(sql)} from lab.politica_preco where operacao_id = ${opId} order by versao desc limit 1`;
  return r ? linha(r) : { ...politicaDe({}), publicadaEm: '', por: '', motivo: null };
}
export async function politicasDaOperacao(sql: Sql, opId: string) {
  const L = (await sql<any[]>`select ${COLS(sql)} from lab.politica_preco where operacao_id = ${opId} order by versao`).map(linha);
  return { vigente: L[L.length - 1] ?? { ...politicaDe({}), publicadaEm: '', por: '', motivo: null }, porVersao: new Map(L.map(p => [p.versao, p])), lista: L };
}
/* publicar: nova versão a partir da vigente com as mudanças; a anterior fica guardada e as vendas feitas com ela continuam lendo a dela */
export async function publicarPolitica(sql: Sql, opId: string, patch: Partial<Pick<Politica, 'margemAlvo' | 'margemMinima' | 'descontoMaximo' | 'custoCapitalMes' | 'custosFixosMes' | 'lucroDesejadoMes' | 'comissao' | 'linhas' | 'condicoes'>>, por: string | null, motivo: string) {
  if (!String(motivo ?? '').trim()) throw new ErroDeEconomia('informe o motivo da nova versão da política');
  const v = await politicaVigente(sql, opId), n: Politica = politicaDe({ ...v, ...patch }, v.versao + 1);
  if (n.margemAlvo != null && n.margemMinima != null && n.margemMinima > n.margemAlvo) throw new ErroDeEconomia('a margem mínima é maior que a margem-alvo');
  for (const c of n.condicoes) { const s = (c.partes ?? []).reduce((a, p) => a + p.fracao, 0); if (c.partes?.length && Math.abs(s - 1) > 1e-6) throw new ErroDeEconomia(`condição "${c.nome}": as partes do recebimento precisam somar 100%`); if (!(c.taxa >= 0 && c.taxa <= 1)) throw new ErroDeEconomia(`condição "${c.nome}": taxa inválida`); }
  for (const l of n.linhas) { if (l.base !== 'informado' && (l.valor == null || !(l.valor >= 0))) throw new ErroDeEconomia(`linha "${l.nome}": falta o valor`); if ((l.base === 'percentual_preco' || l.base === 'percentual_liquido') && l.valor != null && l.valor > 1) throw new ErroDeEconomia(`linha "${l.nome}": percentual acima de 1 (use 0,06 para 6%)`); }
  if (n.comissao.tipo === 'por_margem' && (n.comissao.alvo == null || n.comissao.minima == null || n.margemAlvo == null || n.margemMinima == null)) throw new ErroDeEconomia('comissão por margem precisa de comissão alvo e mínima e de margem alvo e mínima');
  if (n.comissao.tipo === 'fixa' && n.comissao.alvo == null) throw new ErroDeEconomia('comissão fixa precisa do percentual');
  await sql`insert into lab.politica_preco (operacao_id, versao, margem_alvo, margem_minima, desconto_maximo, linhas, condicoes, observacao, comissao, custo_capital_mes, custos_fixos_mes, lucro_desejado_mes, por, motivo)
    values (${opId}, ${n.versao}, ${n.margemAlvo}, ${n.margemMinima}, ${n.descontoMaximo}, ${sql.json(n.linhas as never)}, ${sql.json(n.condicoes as never)}, ${motivo.trim()}, ${sql.json(n.comissao as never)}, ${n.custoCapitalMes}, ${n.custosFixosMes}, ${n.lucroDesejadoMes}, ${por ?? ''}, ${motivo.trim()})`;
  /* condições novas viram catálogo da operação (as vendas apontam para elas) */
  for (const c of n.condicoes) await sql`insert into lab.condicao_pagamento (operacao_id, chave, nome, taxa, ativo, a_revisar) values (${opId}, ${c.chave}, ${c.nome}, ${c.taxa}, true, false) on conflict (operacao_id, chave) do update set nome = excluded.nome, taxa = excluded.taxa, ativo = true, a_revisar = false`;
  return politicaVigente(sql, opId);
}

const custosDe = (b: unknown): CustoInformado[] => (Array.isArray(b) ? b : []).map((c: any) => ({ chave: String(c.chave ?? ''), valor: Number(c.valor), ...(c.categoria ? { categoria: c.categoria } : {}) })).filter(c => c.chave && isFinite(c.valor) && c.valor >= 0);
/* precificador: dado o custo, o preço recomendado e o piso em cada condição (não grava) */
export async function precificar(sql: Sql, opId: string, b: { custos: unknown; comissaoFixa?: number | null }) {
  const custos = custosDe(b.custos); if (!custos.length) throw new ErroDeEconomia('informe ao menos um custo da venda');
  const pol = await politicaVigente(sql, opId);
  return {
    politica: { versao: pol.versao, margemAlvo: pol.margemAlvo, margemMinima: pol.margemMinima, descontoMaximo: pol.descontoMaximo }, custos: custos.reduce((s, c) => s + c.valor, 0),
    porCondicao: pol.condicoes.map(c => { const r = precoRecomendado(custos, pol, { condicao: c.chave, comissaoFixa: b.comissaoFixa ?? null }); return { condicao: c.chave, nome: c.nome, recomendado: r.recomendado, piso: r.piso, economia: r.recomendado != null ? economiaDaVenda({ preco: r.recomendado, custos, condicao: c.chave, comissaoFixa: b.comissaoFixa ?? null }, pol) : null }; }),
    aviso: pol.margemAlvo == null ? 'A política não tem margem-alvo: publique uma versão com margem alvo e mínima para o LAB recomendar preço.' : null,
  };
}

async function negocioDe(sql: Sql, opId: string, negocioId: string) {
  const [n] = await sql<any[]>`select n.id, n.status, n.valor_fechado, n.fechado_em, n.dono_id, p.nome as dono, c.chave as canal, coalesce(k.nome, n.atributos->>'cliente', 'Negócio') as nome
    from lab.negocio n left join lab.pessoa p on p.id = n.dono_id left join lab.canal c on c.id = n.canal_id left join lab.conta k on k.id = n.conta_id where n.id = ${negocioId} and n.operacao_id = ${opId}`;
  if (!n) throw new ErroDeEconomia('negócio não encontrado nesta operação', 404);
  return { id: n.id as string, status: n.status as string, valorFechado: n.valor_fechado == null ? null : Number(n.valor_fechado), fechadoEm: n.fechado_em ? new Date(n.fechado_em).toISOString() : null, donoId: n.dono_id as string | null, dono: (n.dono ?? null) as string | null, canal: (n.canal ?? null) as string | null, nome: n.nome as string };
}
async function precosDe(sql: Sql, negocioId: string) {
  return (await sql<any[]>`select p.id, p.momento, p.valor, p.linhas, p.em, p.politica_versao, p.comissao_fixa, p.por, p.excecao, c.chave as condicao, p.limite from lab.preco_negocio p left join lab.condicao_pagamento c on c.id = p.condicao_id where p.negocio_id = ${negocioId} order by p.em, p.id`)
    .map(r => ({ id: Number(r.id), momento: r.momento as 'referencia' | 'aprovado' | 'fechado', valor: Number(r.valor), custos: custosDe(r.linhas), em: new Date(r.em).toISOString(), politicaVersao: r.politica_versao == null ? null : Number(r.politica_versao), comissaoFixa: r.comissao_fixa == null ? null : Number(r.comissao_fixa), por: r.por ?? '', excecao: r.excecao ?? null, condicao: (r.condicao ?? null) as string | null, limite: r.limite == null ? null : Number(r.limite) }));
}
/* registrar um preço (referência, aprovado ou fechado) com a política do dia congelada; abaixo do piso ou acima do desconto máximo exige motivo e grava a exceção */
export async function registrarPreco(sql: Sql, op: { id: string; fuso: string }, negocioId: string, b: { momento: string; valor: unknown; condicao?: string | null; custos?: unknown; comissaoFixa?: number | null; motivo?: string | null; por?: string | null; em?: string | null }) {
  if (!['referencia', 'aprovado', 'fechado'].includes(b.momento)) throw new ErroDeEconomia('momento deve ser: referencia, aprovado, fechado');
  const valor = Number(b.valor); if (!(valor >= 0) || !isFinite(valor)) throw new ErroDeEconomia('informe o valor');
  const N = await negocioDe(sql, op.id, negocioId), pol = await politicaVigente(sql, op.id), anteriores = await precosDe(sql, negocioId);
  const custos = b.custos != null ? custosDe(b.custos) : [...anteriores].reverse().find(p => p.custos.length)?.custos ?? [];
  const condicao = b.condicao ?? [...anteriores].reverse().find(p => p.condicao)?.condicao ?? null;
  let condicaoId: string | null = null;
  if (condicao) { const [c] = await sql<{ id: string }[]>`select id from lab.condicao_pagamento where operacao_id = ${op.id} and chave = ${condicao}`; if (!c) throw new ErroDeEconomia(`condição de pagamento "${condicao}" não existe nesta operação`); condicaoId = c.id; }
  /* alçada só para aprovado e fechado, e só com custos para calcular o piso */
  let excecao: Record<string, unknown> | null = null;
  if (b.momento !== 'referencia' && custos.length) {
    const rec = precoRecomendado(custos, pol, { condicao, comissaoFixa: b.comissaoFixa ?? null }), aprovado = [...anteriores].reverse().find(p => p.momento === 'aprovado')?.valor ?? null;
    const A = alcada({ preco: valor, piso: rec.piso, aprovado: b.momento === 'fechado' ? aprovado : null, descontoMaximo: pol.descontoMaximo, mcNoPiso: rec.piso != null ? economiaDaVenda({ preco: rec.piso, custos, condicao, comissaoFixa: b.comissaoFixa ?? null }, pol).mc : null, mcNoPreco: economiaDaVenda({ preco: valor, custos, condicao, comissaoFixa: b.comissaoFixa ?? null }, pol).mc });
    if (A.exige) {
      const motivo = String(b.motivo ?? '').trim();
      if (motivo.length < 5) throw new ErroDeEconomia(`fora da alçada (${A.texto}; impacto na MC ${A.impactoMc != null ? 'R$ ' + Math.round(A.impactoMc).toLocaleString('pt-BR') : '—'}): informe o motivo para registrar a exceção`, 409);
      excecao = { motivo, piso: rec.piso, aprovado, desconto: A.desconto, impactoMc: A.impactoMc, texto: A.texto, em: new Date().toISOString(), por: b.por ?? '' };
    }
  }
  const em = b.em && DATA.test(b.em) ? b.em + 'T12:00:00Z' : new Date().toISOString();
  await sql`insert into lab.preco_negocio (operacao_id, negocio_id, momento, valor, condicao_id, linhas, em, politica_versao, comissao_fixa, por, excecao)
    values (${op.id}, ${negocioId}, ${b.momento}, ${valor}, ${condicaoId}, ${sql.json(custos as never)}, ${em}, ${pol.versao}, ${b.comissaoFixa ?? null}, ${b.por ?? ''}, ${excecao ? sql.json(excecao as never) : null})
    on conflict (negocio_id, momento, em) do update set valor = excluded.valor, condicao_id = excluded.condicao_id, linhas = excluded.linhas, politica_versao = excluded.politica_versao, comissao_fixa = excluded.comissao_fixa, por = excluded.por, excecao = excluded.excecao`;
  /* o preço fechado de uma venda ganha é o valor da venda (operações sem conector preenchem por aqui) */
  if (b.momento === 'fechado' && N.status === 'ganho' && (N.valorFechado == null || Math.abs(N.valorFechado - valor) > 0.005)) await sql`update lab.negocio set valor_fechado = ${valor} where id = ${negocioId}`;
  return economiaDoNegocio(sql, op, negocioId);
}
/* custo real lançado (só acréscimo); "completo" diz que todo o custo da venda foi lançado e a economia efetiva passa a ser a real */
export async function lancarCustoReal(sql: Sql, op: { id: string }, negocioId: string, b: { chave: string; valor: unknown; categoria?: string | null; nota?: string | null; completo?: boolean; por?: string | null; em?: string | null }) {
  await negocioDe(sql, op.id, negocioId);
  const valor = Number(b.valor), chave = String(b.chave ?? '').trim();
  if (!chave) throw new ErroDeEconomia('informe a chave do custo (ex.: kit, instalacao)');
  if (!(valor >= 0) || !isFinite(valor)) throw new ErroDeEconomia('informe o valor');
  if (b.categoria && !['cpv', 'servico', 'contingencia', 'interno', 'reserva'].includes(b.categoria)) throw new ErroDeEconomia('categoria deve ser: cpv, servico, contingencia, interno, reserva');
  await sql`insert into lab.custo_real (operacao_id, negocio_id, chave, valor, categoria, em, por, nota, completo) values (${op.id}, ${negocioId}, ${chave}, ${valor}, ${b.categoria ?? null}, ${b.em && DATA.test(b.em) ? b.em : sql`current_date`}, ${b.por ?? ''}, ${b.nota ?? null}, ${b.completo === true})`;
  return economiaDoNegocio(sql, op, negocioId);
}
/* a economia de um negócio: referência, aprovado e fechado pela política congelada; desconto e MC perdida; exceção; previsto × real × efetiva */
export async function economiaDoNegocio(sql: Sql, op: { id: string }, negocioId: string) {
  const [N, P, pols, reais] = await Promise.all([negocioDe(sql, op.id, negocioId), precosDe(sql, negocioId), politicasDaOperacao(sql, op.id),
    sql<any[]>`select chave, valor, categoria, em::text, por, nota, completo, criado_em from lab.custo_real where negocio_id = ${negocioId} order by id`]);
  const polDe = (v: number | null) => (v != null && pols.porVersao.get(v)) || pols.vigente;
  const ult = (m: 'referencia' | 'aprovado' | 'fechado') => [...P].reverse().find(p => p.momento === m) ?? null;
  const ref = ult('referencia'), apr = ult('aprovado'), fec = ult('fechado');
  const custosPrev = fec?.custos.length ? fec.custos : apr?.custos.length ? apr.custos : ref?.custos ?? [], condicao = fec?.condicao ?? apr?.condicao ?? ref?.condicao ?? null;
  const econ = (p: typeof fec, custos = p?.custos.length ? p.custos : custosPrev) => (p ? economiaDaVenda({ preco: p.valor, custos, condicao: p.condicao ?? condicao, comissaoFixa: p.comissaoFixa }, polDe(p.politicaVersao)) : null);
  const precoFechado = fec ? fec.valor : N.status === 'ganho' && N.valorFechado != null ? N.valorFechado : null;
  const polFechado = fec ? polDe(fec.politicaVersao) : pols.vigente;
  const eFec: Economia | null = precoFechado != null ? economiaDaVenda({ preco: precoFechado, custos: custosPrev, condicao, comissaoFixa: fec?.comissaoFixa ?? null }, polFechado) : null;
  const eApr = econ(apr), eRef = econ(ref);
  const custosReais: CustoInformado[] = reais.map(r => ({ chave: r.chave, valor: Number(r.valor), ...(r.categoria ? { categoria: r.categoria } : {}) })), completo = reais.some(r => r.completo);
  const eReal = precoFechado != null && custosReais.length ? economiaDaVenda({ preco: precoFechado, custos: custosReais, condicao, comissaoFixa: fec?.comissaoFixa ?? null }, polFechado) : null;
  const pre = previstoRealEfetiva(eFec, eReal, completo), rec = custosPrev.length ? precoRecomendado(custosPrev, polFechado, { condicao, comissaoFixa: fec?.comissaoFixa ?? null }) : { recomendado: null, piso: null };
  return {
    negocio: N, politica: { versao: polFechado.versao, vigente: pols.vigente.versao, congelada: !!fec?.politicaVersao }, condicao, custosPrevistos: custosPrev,
    referencia: eRef, aprovado: eApr, fechado: eFec, recomendado: rec.recomendado, piso: rec.piso, desconto: mcPerdida(eApr, eFec), excecao: fec?.excecao ?? apr?.excecao ?? null,
    custosReais: reais.map(r => ({ chave: r.chave, valor: Number(r.valor), categoria: r.categoria, em: r.em, por: r.por, nota: r.nota, completo: r.completo })), real: eReal, efetiva: pre.efetiva, fonte: pre.fonte, parcial: pre.parcial, erroOrcamento: pre.erroOrcamento,
    historico: P.map(p => ({ id: p.id, momento: p.momento, valor: p.valor, em: p.em, condicao: p.condicao, politicaVersao: p.politicaVersao, por: p.por, excecao: p.excecao })),
  };
}

/* painel do período: cada venda ganha pela economia efetiva; agregados por vendedor, canal, condição e faixa de ticket; erro de orçamento; contribuição do mês; break-even do desconto */
export async function painelEconomia(sql: Sql, op: { id: string; fuso: string }, de: string, ate: string) {
  if (!DATA.test(de) || !DATA.test(ate) || de >= ate) throw new ErroDeEconomia('período inválido');
  const [vendas, pols, invs] = await Promise.all([
    sql<any[]>`select n.id from lab.negocio n join lab.funil f on f.id = n.funil_id where n.operacao_id = ${op.id} and f.principal and n.status = 'ganho' and n.tipo = 'novo' and (n.fechado_em at time zone ${op.fuso})::date >= ${de}::date and (n.fechado_em at time zone ${op.fuso})::date < ${ate}::date order by n.fechado_em`,
    politicasDaOperacao(sql, op.id),
    sql<any[]>`select c.chave as canal, i.valor, i.mes::text as mes from lab.investimento_canal i join lab.canal c on c.id = i.canal_id where i.operacao_id = ${op.id} and i.mes >= date_trunc('month', ${de}::date) and i.mes < ${ate}::date`,
  ]);
  const pol = pols.vigente, L = await Promise.all(vendas.map(v => economiaDoNegocio(sql, op, v.id)));
  const itens = L.map(x => { const e = x.efetiva, piso = x.piso; return { id: x.negocio.id, nome: x.negocio.nome, dono: x.negocio.dono ?? '(sem vendedor)', canal: x.negocio.canal ?? '(sem canal)', condicao: x.condicao ?? 'vista', fechadoEm: x.negocio.fechadoEm, preco: e?.preco ?? x.negocio.valorFechado, rl: e?.receitaLiquida ?? null, mc: e?.mc ?? null, mcPct: e?.mcPct ?? null, mcPctPreco: e?.mcPctPreco ?? null, custoFinanceiro: e?.custoFinanceiro ?? null, capitalExposto: e?.capitalExposto ?? null, desconto: x.desconto.desconto, mcPerdida: x.desconto.mcPerdida, abaixoDoPiso: piso != null && e != null && e.preco < piso - 0.005, excecao: x.excecao, fonte: x.fonte, parcial: x.parcial, erroOrcamento: x.erroOrcamento, politicaVersao: x.politica.versao, semEconomia: !e }; });
  const comE = itens.filter(i => i.mc != null), ag = margemAgregada(comE.map(i => ({ mc: i.mc!, receitaLiquida: i.rl! })));
  const grupo = (k: (i: (typeof itens)[number]) => string) => { const m = new Map<string, typeof itens>(); for (const i of itens) (m.get(k(i)) ?? m.set(k(i), []).get(k(i))!).push(i); return [...m].map(([nome, Ls]) => { const c = Ls.filter(i => i.mc != null), a = margemAgregada(c.map(i => ({ mc: i.mc!, receitaLiquida: i.rl! }))), descs = Ls.filter(i => i.desconto != null); return { nome, n: Ls.length, receita: Ls.reduce((s, i) => s + (i.preco ?? 0), 0), mc: c.length ? a.mc : null, mcPct: a.pct, descontoMedio: descs.length ? descs.reduce((s, i) => s + i.desconto!, 0) / descs.length : null, abaixoDoPiso: Ls.filter(i => i.abaixoDoPiso).length, mcPerdida: Ls.reduce((s, i) => s + (i.mcPerdida ?? 0), 0), excecoes: Ls.filter(i => i.excecao).length, capitalExposto: c.length ? c.reduce((s, i) => s + (i.capitalExposto ?? 0), 0) / c.length : null, custoFinanceiro: c.reduce((s, i) => s + (i.custoFinanceiro ?? 0), 0) }; }); };
  /* canal: investimento do período (D21: mês sem lançamento anula CPL/CAC/ROI); retorno sobre margem */
  const meses: string[] = []; for (let a = Number(de.slice(0, 4)), m = Number(de.slice(5, 7)); meses.length < 120; ) { const k = a + '-' + String(m).padStart(2, '0'), fimMes = (m === 12 ? a + 1 + '-01' : a + '-' + String(m + 1).padStart(2, '0')) + '-01'; if (fimMes > ate) break; meses.push(k); m++; if (m > 12) { m = 1; a++; } }
  const porCanal = grupo(i => i.canal).map(g => { const inv = invs.filter(i => i.canal === g.nome), primeiro = inv.map(i => i.mes.slice(0, 7)).sort()[0], faltam = inv.length && primeiro ? meses.filter(m => m >= primeiro && !inv.some(i => i.mes.slice(0, 7) === m)) : [], investimento = inv.length && !faltam.length ? inv.reduce((s, i) => s + Number(i.valor), 0) : null;
    return { ...g, investimento, mesesSemLancamento: faltam, cac: investimento != null && g.n ? investimento / g.n : null, retorno: investimento != null && g.mc != null ? g.mc - investimento : null, roiSobreMargem: investimento && g.mc != null ? g.mc / investimento - 1 : null }; });
  const precos = comE.map(i => i.preco!).sort((a, b) => a - b), q = (f: number) => (precos.length ? precos[Math.min(precos.length - 1, Math.floor(f * precos.length))]! : 0);
  const faixas = precos.length >= 4 ? [q(0.25), q(0.5), q(0.75)] : [];
  const porFaixa = faixas.length ? grupo(i => (i.preco == null ? 'sem preço' : i.preco < faixas[0]! ? `até ${Math.round(faixas[0]!)}` : i.preco < faixas[1]! ? `${Math.round(faixas[0]!)} a ${Math.round(faixas[1]!)}` : i.preco < faixas[2]! ? `${Math.round(faixas[1]!)} a ${Math.round(faixas[2]!)}` : `acima de ${Math.round(faixas[2]!)}`)) : [];
  const comReal = L.filter(x => x.fonte === 'real' && x.fechado && x.real), erroOrc = { n: comReal.length, previsto: comReal.reduce((s, x) => s + x.fechado!.custos, 0), real: comReal.reduce((s, x) => s + x.real!.custos, 0), pendentes: L.filter(x => x.parcial).length };
  const mcMedia = comE.length ? ag.mc / comE.length : null;
  const contribuicao = contribuicaoNecessaria({ custosFixosMes: pol.custosFixosMes, lucroDesejadoMes: pol.lucroDesejadoMes, mcAcumulada: ag.mc, mcMediaPorVenda: mcMedia });
  /* break-even do desconto na venda típica (preço e custos médios) */
  const tipica = comE.length ? { preco: comE.reduce((s, i) => s + i.preco!, 0) / comE.length, custos: [{ chave: 'custos', valor: L.filter(x => x.efetiva).reduce((s, x) => s + x.efetiva!.custos, 0) / comE.length }], condicao: 'vista' } : null;
  const breakEven = tipica ? [0.05, 0.1, 0.15, 0.2].map(d => breakEvenDesconto(tipica, pol, d)) : [];
  return {
    periodo: { de, ate }, politica: { versao: pol.versao, margemAlvo: pol.margemAlvo, margemMinima: pol.margemMinima, descontoMaximo: pol.descontoMaximo, custosFixosMes: pol.custosFixosMes, lucroDesejadoMes: pol.lucroDesejadoMes },
    resumo: { vendas: itens.length, comEconomia: comE.length, semEconomia: itens.length - comE.length, receita: itens.reduce((s, i) => s + (i.preco ?? 0), 0), receitaLiquida: ag.receitaLiquida, mc: ag.mc, mcPct: ag.pct, mcMediaPorVenda: mcMedia, mcPerdida: itens.reduce((s, i) => s + (i.mcPerdida ?? 0), 0), abaixoDoPiso: itens.filter(i => i.abaixoDoPiso).length, excecoes: itens.filter(i => i.excecao).length, reais: comReal.length, parciais: erroOrc.pendentes },
    vendas: itens, porVendedor: grupo(i => i.dono), porCanal, porCondicao: grupo(i => i.condicao), porFaixa, erroOrcamento: erroOrc, contribuicao, breakEven, tipica,
  };
}
