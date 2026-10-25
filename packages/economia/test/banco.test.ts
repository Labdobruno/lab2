import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import { criarOperacao } from '@lab/conectores';
import { operacao, type Operacao } from '@lab/planejamento';
import { relatorio } from '@lab/metricas';
import { economiaDoNegocio, ErroDeEconomia, lancarCustoReal, painelEconomia, politicaVigente, precificar, precoFormula, publicarPolitica, registrarPreco } from '../src/index.js';
import { bancoLimpo, catalogo, semBanco } from '../../conectores/test/ajuda.js';

const falha = async (p: Promise<unknown>) => (await p.then(() => null, e => e)) as ErroDeEconomia | null;

describe.skipIf(semBanco)('economia da venda no banco', () => {
  let sql: postgres.Sql, op: Operacao, ana: string, bia: string, v1: string, v2: string, v3: string;
  beforeAll(async () => {
    sql = await bancoLimpo();
    await criarOperacao(sql, { slug: 'eco', nome: 'Eco', packId: 'base' }, catalogo());
    op = (await operacao(sql, 'eco'))!;
    const ps = await sql<{ id: string; nome: string }[]>`insert into lab.pessoa (operacao_id, nome, funcao) values (${op.id}, 'Ana', 'closer'), (${op.id}, 'Bia', 'closer') returning id, nome`;
    ana = ps.find(p => p.nome === 'Ana')!.id; bia = ps.find(p => p.nome === 'Bia')!.id;
    const [funil] = await sql<{ id: string }[]>`select id from lab.funil where operacao_id = ${op.id} and principal`;
    const [ganho] = await sql<{ id: string }[]>`select id from lab.etapa where operacao_id = ${op.id} and chave = 'ganho'`;
    const [canal] = await sql<{ id: string }[]>`select id from lab.canal where operacao_id = ${op.id} order by chave limit 1`;
    const venda = async (dono: string, valor: number, fechado: string) => (await sql<{ id: string }[]>`insert into lab.negocio (operacao_id, funil_id, dono_id, canal_id, etapa_id, etapa_desde, criado_em, status, fechado_em, valor_fechado, valor_estimado, atributos)
      values (${op.id}, ${funil!.id}, ${dono}, ${canal!.id}, ${ganho!.id}, ${fechado}, '2026-10-01T12:00:00Z', 'ganho', ${fechado}, ${valor}, ${valor}, ${sql.json({ cliente: 'C' })}) returning id`)[0]!.id;
    v1 = await venda(ana, 100000, '2026-10-10T15:00:00Z'); v2 = await venda(bia, 90000, '2026-10-12T15:00:00Z'); v3 = await venda(bia, 50000, '2026-10-15T15:00:00Z');
  });
  afterAll(async () => { await sql?.end(); });

  it('política: a do pack é a v1; publicar cria a v2 com motivo e valida', async () => {
    const p0 = await politicaVigente(sql, op.id); expect(p0.versao).toBe(1); expect(p0.margemAlvo).toBeNull();
    expect((await falha(publicarPolitica(sql, op.id, { margemAlvo: 0.24 }, 'Bruno', '')))?.message).toMatch(/motivo/);
    expect((await falha(publicarPolitica(sql, op.id, { margemAlvo: 0.2, margemMinima: 0.24 }, 'Bruno', 'teste')))?.message).toMatch(/mínima é maior/);
    const p = await publicarPolitica(sql, op.id, { margemAlvo: 0.24, margemMinima: 0.2, descontoMaximo: 0.1, custosFixosMes: 50000, lucroDesejadoMes: 20000, comissao: { tipo: 'fixa', alvo: 0.02 },
      linhas: [{ chave: 'imposto', nome: 'Impostos', grupo: 'deducao', base: 'percentual_preco', valor: 0.1 }, { chave: 'custo_direto', nome: 'Custo direto', grupo: 'custo_variavel', base: 'informado', categoria: 'cpv' }],
      condicoes: [{ chave: 'vista', nome: 'À vista', taxa: 0 }, { chave: 'cartao', nome: 'Cartão 12x', taxa: 0.02, antecipacao: 0.01, partes: [{ fracao: 1, dias: 30 }] }] }, 'Bruno', 'política inicial da operação');
    expect(p.versao).toBe(2); expect(p.comissao.tipo).toBe('fixa'); expect(p.por).toBe('Bruno');
    expect((await sql`select 1 from lab.condicao_pagamento where operacao_id = ${op.id} and chave = 'cartao'`).length).toBe(1);
    await expect(sql`update lab.politica_preco set margem_alvo = 0.5 where operacao_id = ${op.id}`).rejects.toThrow(/acréscimo/);
  });

  it('precificador: recomendado e piso por condição; à vista bate com a fórmula fechada', async () => {
    const r = await precificar(sql, op.id, { custos: [{ chave: 'custo_direto', valor: 40000 }] });
    const vista = r.porCondicao.find(c => c.condicao === 'vista')!, cartao = r.porCondicao.find(c => c.condicao === 'cartao')!;
    expect(vista.recomendado).toBeCloseTo(precoFormula(40000, 0, 0.24, 0.1, 0.02), 1); expect(vista.economia!.mcBrutaPct).toBeCloseTo(0.24, 5);
    expect(cartao.recomendado!).toBeGreaterThan(vista.recomendado!); expect(vista.piso!).toBeLessThan(vista.recomendado!);
    expect((await falha(precificar(sql, op.id, { custos: [] })))?.message).toMatch(/custo/);
  });

  it('registrar preço: aprovado no recomendado; fechado abaixo do piso sem motivo é recusado com o impacto; com motivo grava a exceção e congela a política', async () => {
    const custos = [{ chave: 'custo_direto', valor: 40000 }], r = await precificar(sql, op.id, { custos }), rec = r.porCondicao[0]!;
    const A = await registrarPreco(sql, op, v1, { momento: 'aprovado', valor: rec.recomendado!, condicao: 'vista', custos, por: 'Bruno', em: '2026-10-08' });
    expect(A.aprovado!.mcBrutaPct).toBeCloseTo(0.24, 4); expect(A.aprovado!.politicaVersao).toBe(2); expect(A.excecao).toBeNull();
    const baixo = rec.piso! - 2000;
    const e = await falha(registrarPreco(sql, op, v1, { momento: 'fechado', valor: baixo, por: 'Ana', em: '2026-10-10' }));
    expect(e?.status).toBe(409); expect(e?.message).toMatch(/abaixo do piso/); expect(e?.message).toMatch(/impacto na MC R\$/);
    const F = await registrarPreco(sql, op, v1, { momento: 'fechado', valor: baixo, motivo: 'cliente estratégico, fechou dois projetos', por: 'Ana', em: '2026-10-10' });
    expect(F.excecao!.motivo).toMatch(/estratégico/); expect(F.excecao!.impactoMc).toBeGreaterThan(0); expect(F.fechado!.preco).toBe(baixo); expect(F.politica.congelada).toBe(true); expect(F.desconto.desconto).toBeGreaterThan(0); expect(F.desconto.mcPerdida).toBeGreaterThan(0);
    expect(F.negocio.valorFechado).toBe(baixo); expect(F.fonte).toBe('prevista');
    /* v2 dentro da alçada; v3 sem custos registrados (economia só pelo preço, sem piso) */
    const B = await registrarPreco(sql, op, v2, { momento: 'fechado', valor: 90000, condicao: 'cartao', custos: [{ chave: 'custo_direto', valor: 50000 }], por: 'Bia', em: '2026-10-12' });
    expect(B.excecao).toBeNull(); expect(B.fechado!.taxa + B.fechado!.antecipacao).toBeCloseTo(90000 * 0.03); expect(B.fechado!.diasMedioRecebimento).toBe(30);
    expect((await falha(registrarPreco(sql, op, v3, { momento: 'fechado', valor: 1, condicao: 'pix', por: 'x' })))?.message).toMatch(/condição/);
  });

  it('custo real: parcial não vira efetiva; completo vira, com o erro de orçamento; a política nova não reescreve a venda', async () => {
    let E = await lancarCustoReal(sql, op, v1, { chave: 'custo_direto', valor: 30000, categoria: 'cpv', por: 'Bruno', em: '2026-10-20' });
    expect(E.parcial).toBe(true); expect(E.fonte).toBe('prevista'); expect(E.real!.custos).toBe(30000);
    E = await lancarCustoReal(sql, op, v1, { chave: 'frete', valor: 13000, categoria: 'servico', completo: true, por: 'Bruno', em: '2026-10-25' });
    expect(E.fonte).toBe('real'); expect(E.erroOrcamento).toBe(3000); expect(E.efetiva!.custos).toBe(43000); expect(E.custosReais.length).toBe(2);
    await expect(sql`delete from lab.custo_real where negocio_id = ${v1}`).rejects.toThrow(/acréscimo/);
    const antes = (await economiaDoNegocio(sql, op, v1)).fechado!.mc;
    await publicarPolitica(sql, op.id, { linhas: [{ chave: 'imposto', nome: 'Impostos', grupo: 'deducao', base: 'percentual_preco', valor: 0.2 }, { chave: 'custo_direto', nome: 'Custo direto', grupo: 'custo_variavel', base: 'informado', categoria: 'cpv' }] }, 'Bruno', 'imposto subiu');
    const depois = await economiaDoNegocio(sql, op, v1); expect(depois.fechado!.mc).toBeCloseTo(antes); expect(depois.politica.versao).toBe(2); expect(depois.politica.vigente).toBe(3);
    /* venda sem preço registrado lê a política vigente e o valor do negócio */
    const S = await economiaDoNegocio(sql, op, v3); expect(S.fechado!.preco).toBe(50000); expect(S.politica.congelada).toBe(false); expect(S.politica.versao).toBe(3); expect(S.piso).toBeNull();
  });

  it('painel do período: margem agregada, por vendedor com abaixo do piso e MC perdida, por condição, contribuição do mês, break-even; o relatório das métricas lê a mesma conta', async () => {
    const P = await painelEconomia(sql, op, '2026-10-01', '2026-11-01');
    expect(P.resumo.vendas).toBe(3); expect(P.resumo.comEconomia).toBe(3); expect(P.resumo.excecoes).toBe(1); expect(P.resumo.abaixoDoPiso).toBe(1); expect(P.resumo.reais).toBe(1);
    const ana = P.porVendedor.find(v => v.nome === 'Ana')!, bia = P.porVendedor.find(v => v.nome === 'Bia')!;
    expect(ana.abaixoDoPiso).toBe(1); expect(ana.mcPerdida).toBeGreaterThan(0); expect(ana.excecoes).toBe(1); expect(bia.n).toBe(2); expect(bia.abaixoDoPiso).toBe(0);
    expect(P.porCondicao.map(c => c.nome).sort()).toEqual(['cartao', 'vista']); expect(P.porCondicao.find(c => c.nome === 'cartao')!.custoFinanceiro).toBe(0);
    expect(P.resumo.mcPct).toBeCloseTo(P.resumo.mc / P.resumo.receitaLiquida); expect(P.contribuicao.estado).not.toBe('sem_fixo'); if (P.contribuicao.estado === 'sem_fixo') throw new Error('x');
    expect(P.contribuicao.fixo).toBe(50000); expect(P.breakEven.length).toBe(4); expect(P.breakEven[1]!.volEq).toBeGreaterThan(1);
    expect(P.porCanal[0]!.investimento).toBeNull();
    const R = await relatorio(sql, op, { de: '2026-10-01', ate: '2026-11-01' });
    const mc = R.vendas.economia.filter(e => e.margemContribuicao != null).reduce((s, e) => s + e.margemContribuicao!, 0), rl = R.vendas.economia.filter(e => e.margemContribuicao != null).reduce((s, e) => s + e.receitaLiquida!, 0);
    expect(R.vendas.margemPercentual).toBeCloseTo(mc / rl, 3);
    const ev1 = R.vendas.economia.find(e => e.negocioId === v1)!; expect(ev1.politicaVersao).toBe(2); expect(ev1.margemContribuicao).toBeCloseTo(P.vendas.find(v => v.id === v1)!.mc! + 3000, 0);
  });
});
