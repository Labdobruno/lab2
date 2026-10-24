import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import { criarOperacao, packDaOperacao } from '@lab/conectores';
import { VARIAVEIS } from '@lab/nucleo';
import { operacao, acrescentarMetas } from '@lab/planejamento';
import {
  avaliarHipoteses, checarQualidade, concluirExperimento, decisoes, ErroDeMemoria, experimentos, iniciarExperimento, montarContexto, registrarDecisao,
} from '../src/index.js';
import { bancoLimpo, catalogo, semBanco } from '../../conectores/test/ajuda.js';

const falha = async (p: Promise<unknown>) => (await p.then(() => null, e => e)) as ErroDeMemoria | null;
const HOJE = '2026-10-24';

describe.skipIf(semBanco)('hipóteses no banco', () => {
  let sql: postgres.Sql, opId: string;
  beforeAll(async () => {
    sql = await bancoLimpo();
    ({ id: opId } = await criarOperacao(sql, { slug: 'h', nome: 'H', packId: 'base' }, catalogo()));
  });
  afterAll(async () => { await sql?.end(); });

  it('sem nenhum dado: contexto completo, nada dispara e nada vira zero por engano', async () => {
    const op = (await operacao(sql, 'h'))!;
    const ctx = await montarContexto(sql, op, HOJE);
    expect(Object.keys(ctx).sort()).toEqual(Object.keys(VARIAVEIS).sort());
    expect(ctx.taxa_ganho).toBeNull();
    expect(ctx.cac_medio).toBeNull();
    expect(ctx.ticket_medio).toBeNull();
    expect(ctx.vendas).toBe(0);
    const pack = packDaOperacao('base', undefined, catalogo()).pack!;
    const r = avaliarHipoteses(pack.hipoteses, ctx, 3);
    expect(r.achados).toEqual([]);
    expect(r.errosDeFormula).toEqual([]);
  });

  it('com dados: dispara descontos altos e cac acima da margem, com os números certos', async () => {
    const op = (await operacao(sql, 'h'))!;
    const [funil] = await sql<{ id: string }[]>`select id from lab.funil where operacao_id = ${opId} and principal`;
    const et = async (papel: string) => (await sql<{ id: string }[]>`select id from lab.etapa where operacao_id = ${opId} and papel = ${papel} limit 1`)[0]!.id;
    const [canal] = await sql<{ id: string }[]>`select id from lab.canal where operacao_id = ${opId} and ativo limit 1`;
    const [ganho, lead] = [await et('ganho'), await et('lead')];
    /* 12 vendas de 10.000 com preço de referência 12.000 (desconto 16,7%), custos 6.000 (margem 40%) */
    for (let i = 0; i < 12; i++) {
      const [n] = await sql<{ id: string }[]>`insert into lab.negocio (operacao_id, funil_id, canal_id, etapa_id, status, valor_fechado, criado_em, fechado_em)
        values (${opId}, ${funil!.id}, ${canal!.id}, ${ganho}, 'ganho', 10000, '2026-09-01T12:00:00Z', '2026-09-20T12:00:00Z') returning id`;
      await sql`insert into lab.preco_negocio (operacao_id, negocio_id, momento, valor, em) values (${opId}, ${n!.id}, 'referencia', 12000, '2026-09-01T12:00:00Z')`;
      await sql`insert into lab.preco_negocio (operacao_id, negocio_id, momento, valor, linhas, em) values (${opId}, ${n!.id}, 'fechado', 10000, ${sql.json([{ chave: 'custo', valor: 6000 }])}, '2026-09-20T12:00:00Z')`;
    }
    await sql`insert into lab.negocio (operacao_id, funil_id, canal_id, etapa_id, criado_em, valor_estimado) values (${opId}, ${funil!.id}, ${canal!.id}, ${lead}, '2026-09-02T12:00:00Z', 5000)`;
    await sql`insert into lab.investimento_canal (operacao_id, canal_id, mes, valor) values (${opId}, ${canal!.id}, '2026-09-01', 60000)`;

    const ctx = await montarContexto(sql, op, HOJE);
    expect(ctx).toMatchObject({ vendas: 12, receita: 120000, ticket_medio: 10000, margem_percentual: 0.4, investimento_total: 60000, cac_medio: 5000 });
    expect(ctx.desconto_medio).toBeCloseTo(1 / 6, 5);
    const pack = packDaOperacao('base', undefined, catalogo()).pack!;
    const r = avaliarHipoteses(pack.hipoteses, ctx, 5);
    const por = Object.fromEntries(r.achados.map(a => [a.chave, a]));
    expect(por.desconto_alto!.impacto).toBe(Math.round(((120000 * (1 / 6)) / (1 - 1 / 6)) * 100) / 100);   // R$ 24.000
    expect(por.cac_acima_da_margem!.impacto).toBe((5000 - 0.4 * 10000) * 12);                                  // R$ 12.000
    expect(r.achados[0]!.chave).toBe('desconto_alto');
    expect(r.semDados.map(s => s.chave)).toContain('churn_alto');
  });

  it('qualidade de dados: acha o que está torto e dá exemplos', async () => {
    const op = (await operacao(sql, 'h'))!;
    await sql`insert into lab.pessoa (operacao_id, nome, funcao) values (${opId}, 'Sara', 'sdr')`;
    const q = await checarQualidade(sql, op, HOJE);
    const por = Object.fromEntries(q.checagens.map(c => [c.chave, c]));
    expect(por.ganho_sem_valor!.ok).toBe(true);
    expect(por.ganho_sem_preco_fechado!.ok).toBe(true);
    expect(por.pessoas_sem_meta).toMatchObject({ quantidade: 1, exemplos: ['Sara'], ok: false });
    expect(por.negocios_abertos_sem_dono!.quantidade).toBe(1);
    expect(por.abertos_sem_valor!.ok).toBe(true);
    await acrescentarMetas(sql, opId, '2026-10-01', [{ indicador: 'tentativa', pessoaId: (await sql<{ id: string }[]>`select id from lab.pessoa where nome = 'Sara'`)[0]!.id, valor: 100 }]);
    expect((await checarQualidade(sql, op, HOJE)).checagens.find(c => c.chave === 'pessoas_sem_meta')!.ok).toBe(true);
    /* dado torto de propósito */
    const [n] = await sql<{ id: string }[]>`select id from lab.negocio where status = 'ganho' limit 1`;
    await sql`update lab.negocio set valor_fechado = null where id = ${n!.id}`;
    await sql`update lab.negocio set fechado_em = criado_em - interval '1 day' where id = (select id from lab.negocio where status = 'ganho' and id <> ${n!.id} limit 1)`;
    const q2 = await checarQualidade(sql, op, HOJE);
    expect(q2.problemas[0]!.severidade).toBe('alta');
    expect(q2.problemas.map(p => p.chave)).toEqual(expect.arrayContaining(['ganho_sem_valor', 'fechamento_antes_da_criacao']));
    expect(q2.checagens.find(c => c.chave === 'ganho_sem_valor')!.exemplos).toEqual([n!.id]);
  });

  it('canvas de decisão: valida, guarda e não muda', async () => {
    const op = (await operacao(sql, 'h'))!;
    expect((await falha(registrarDecisao(sql, op, { pergunta: '', escolha: 'x' })))!.message).toMatch(/pergunta/);
    expect((await falha(registrarDecisao(sql, op, { pergunta: 'p', escolha: 'x', revisarEm: 'amanhã' })))!.message).toMatch(/AAAA-MM-DD/);
    const d = await registrarDecisao(sql, op, { hipoteseId: 'desconto_alto', pergunta: ' Mantemos o desconto? ', opcoes: ['Manter', 'Limitar a 10%'], escolha: 'Limitar a 10%', porque: 'Margem', criterioSucesso: 'desconto médio < 10%', revisarEm: '2026-11-30', contexto: { desconto_medio: 0.17 } });
    expect(d).toMatchObject({ pergunta: 'Mantemos o desconto?', revisarEm: '2026-11-30' });
    const lista = await decisoes(sql, op);
    expect(lista).toHaveLength(1);
    expect(lista[0]!.opcoes).toEqual([{ nome: 'Manter' }, { nome: 'Limitar a 10%' }]);
    await expect(sql`update lab.decisao set escolha = 'outra'`).rejects.toThrow(/só de acréscimo/);
    await expect(sql`delete from lab.decisao`).rejects.toThrow(/só de acréscimo/);
  });

  it('experimento: guarda o ponto de partida, mede ao concluir, escreve na memória e congela', async () => {
    const op = (await operacao(sql, 'h'))!;
    const ctx0 = await montarContexto(sql, op, HOJE);
    expect((await falha(iniciarExperimento(sql, op, ctx0, HOJE, { titulo: 'T', metrica: 'inventada', alvo: 1 })))!.message).toMatch(/dicionário/);
    expect((await falha(iniciarExperimento(sql, op, ctx0, HOJE, { titulo: 'T', metrica: 'desconto_medio', alvo: '' })))!.message).toMatch(/alvo/);
    const dec = (await decisoes(sql, op))[0]!;
    const e = await iniciarExperimento(sql, op, ctx0, HOJE, { titulo: 'Limitar desconto a 10%', metrica: 'desconto_medio', alvo: 0.1, fimPrevisto: '2026-11-30', decisaoId: dec.id as string, hipoteseId: 'desconto_alto' });
    expect(e.baseline).toBeCloseTo(1 / 6, 5);
    const rodando = await experimentos(sql, op, ctx0);
    expect(rodando[0]).toMatchObject({ status: 'rodando', nome: 'Desconto médio', unidade: '%' });
    expect(rodando[0]!.atual).toBeCloseTo(1 / 6, 5);

    /* nada mudou: o alvo não foi atingido */
    const r = await concluirExperimento(sql, op, e.id as string, ctx0, { conclusao: 'Time não aplicou a regra.' });
    expect(r).toMatchObject({ status: 'concluido', atingiu: false });
    expect(r.memoria).toMatch(/Alvo não atingido/);
    const [mem] = await sql`select tipo, texto from lab.aprendizado where operacao_id = ${opId} order by id desc limit 1`;
    expect(mem).toMatchObject({ tipo: 'nao_funcionou' });
    expect((await falha(concluirExperimento(sql, op, e.id as string, ctx0, {})))!.status).toBe(409);
    await expect(sql`update lab.experimento set titulo = 'x'`).rejects.toThrow(/só de acréscimo/);

    /* o alvo foi atingido (o desconto caiu) e o descarte também vai para a memória */
    const e2 = await iniciarExperimento(sql, op, ctx0, HOJE, { titulo: 'Manter as vendas', metrica: 'vendas', alvo: 12 });
    const r2 = await concluirExperimento(sql, op, e2.id as string, ctx0, {});
    expect(r2).toMatchObject({ atingiu: true });
    expect((await sql`select tipo from lab.aprendizado order by id desc limit 1`)[0]!.tipo).toBe('funcionou');
    const e3 = await iniciarExperimento(sql, op, ctx0, HOJE, { titulo: 'Abandonado', metrica: 'vendas', alvo: 99 });
    expect(await concluirExperimento(sql, op, e3.id as string, ctx0, { descartar: true })).toMatchObject({ status: 'descartado', atingiu: null });
    expect((await falha(concluirExperimento(sql, op, '00000000-0000-4000-8000-000000000000', ctx0, {})))!.status).toBe(404);
  });
});
