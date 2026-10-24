import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import { criarOperacao } from '@lab/conectores';
import { montarContexto } from '@lab/hipoteses';
import { operacao } from '@lab/planejamento';
import {
  campanhas, criarCampanha, encerrarCampanha, ErroDeStudio, funisSalvos, grafoObservado, iniciarCampanha, salvarFunil, simularFunil, type Grafo,
} from '../src/index.js';
import { bancoLimpo, catalogo, semBanco } from '../../conectores/test/ajuda.js';

const HOJE = '2026-10-24';
const falha = async (p: Promise<unknown>) => (await p.then(() => null, e => e)) as ErroDeStudio | null;

describe.skipIf(semBanco)('Studio no banco', () => {
  let sql: postgres.Sql, opId: string;
  beforeAll(async () => {
    sql = await bancoLimpo();
    opId = (await criarOperacao(sql, { slug: 's', nome: 'S', packId: 'base' }, catalogo())).id;
    const [funil] = await sql<{ id: string }[]>`select id from lab.funil where operacao_id = ${opId} and principal`;
    const et = Object.fromEntries((await sql<{ id: string; chave: string }[]>`select id, chave from lab.etapa where operacao_id = ${opId}`).map(e => [e.chave, e.id]));
    const [canal] = await sql<{ id: string }[]>`select id from lab.canal where operacao_id = ${opId} and chave = 'pago'`;
    /* 10 negócios: lead→contato (10), contato→agendada (6) ou perdido (4), agendada→realizada (5) ou perdido (1), realizada→proposta (4) ou perdido (1),
       proposta→negociacao (3) ou perdido (1), negociacao→ganho (2) ou perdido (1) e uma volta negociacao→proposta (ignorada: sem ciclos) */
    const negocios: string[] = [];
    for (let i = 0; i < 10; i++) {
      const ganho = i < 2;
      const [n] = await sql<{ id: string }[]>`insert into lab.negocio (operacao_id, funil_id, canal_id, etapa_id, status, valor_fechado, criado_em, fechado_em)
        values (${opId}, ${funil!.id}, ${canal!.id}, ${et.lead}, ${ganho ? 'ganho' : 'aberto'}, ${ganho ? 10000 : null}, '2026-10-01T12:00:00Z', ${ganho ? '2026-10-20T12:00:00Z' : null}) returning id`;
      negocios.push(n!.id);
    }
    const t = (i: number, de: string, para: string, dia: string) => sql`insert into lab.negocio_transicao (operacao_id, negocio_id, de_etapa_id, para_etapa_id, em, origem)
      values (${opId}, ${negocios[i]!}, ${et[de]!}, ${et[para]!}, ${`2026-10-${dia}T12:00:00Z`}, 'evento')`;
    for (let i = 0; i < 10; i++) await t(i, 'lead', 'contato', '02');
    for (let i = 0; i < 6; i++) await t(i, 'contato', 'agendada', '03');
    for (let i = 6; i < 10; i++) await t(i, 'contato', 'perdido', '03');
    for (let i = 0; i < 5; i++) await t(i, 'agendada', 'realizada', '04');
    await t(5, 'agendada', 'perdido', '04');
    for (let i = 0; i < 4; i++) await t(i, 'realizada', 'proposta', '05');
    await t(4, 'realizada', 'perdido', '05');
    for (let i = 0; i < 3; i++) await t(i, 'proposta', 'negociacao', '06');
    await t(3, 'proposta', 'perdido', '06');
    for (let i = 0; i < 2; i++) await t(i, 'negociacao', 'ganho', '07');
    await t(2, 'negociacao', 'perdido', '07');
    await t(2, 'negociacao', 'proposta', '08');            // volta
    await sql`insert into lab.investimento_canal (operacao_id, canal_id, mes, valor) values (${opId}, ${canal!.id}, '2026-10-01', 5000)`;
  });
  afterAll(async () => { await sql?.end(); });

  it('o funil observado sai das passagens reais, ignora voltas e reproduz as vendas do histórico', async () => {
    const op = (await operacao(sql, 's'))!;
    const o = await grafoObservado(sql, op, HOJE);
    expect(o.ignoradas).toBe(1);
    expect(o.grafo.entrada).toBe('lead');
    const taxa = (de: string, para: string) => o.grafo.arestas.find(a => a.de === de && a.para === para)!.taxa;
    expect(taxa('lead', 'contato')).toBe(1);
    expect(taxa('contato', 'agendada')).toBe(0.6);
    expect(taxa('contato', 'perdido')).toBe(0.4);
    expect(taxa('agendada', 'realizada')).toBeCloseTo(0.8333, 4);
    expect(taxa('negociacao', 'ganho')).toBeCloseTo(0.6667, 4);
    const ctx = await montarContexto(sql, op, HOJE);
    const r = simularFunil(o.grafo, ctx);
    expect(r.ok).toBe(true);
    expect(r.entrada).toBe(10);
    expect(r.simulacao!.vendas).toBeCloseTo(2, 2);                // o modelo de fluxo reproduz as 2 vendas reais
    expect(r.simulacao!.receita).toBeCloseTo(20000, 0);
    expect(r.alavancas.length).toBeGreaterThan(0);
    expect(r.alavancas[0]!.ganhoVendas).toBeGreaterThan(0);
  });

  it('funis desenhados são versionados e o antigo continua guardado', async () => {
    const op = (await operacao(sql, 's'))!;
    const g: Grafo = { entrada: 'a', nos: [{ id: 'a', nome: 'A', tipo: 'etapa' }, { id: 'g', nome: 'G', tipo: 'ganho' }, { id: 'p', nome: 'P', tipo: 'perdido' }], arestas: [{ de: 'a', para: 'g', taxa: 'conv_ganho' }, { de: 'a', para: 'p', taxa: 0.5 }] };
    expect((await falha(salvarFunil(sql, op, '', g)))!.message).toMatch(/nome/);
    expect((await falha(salvarFunil(sql, op, 'X', { ...g, arestas: [...g.arestas, { de: 'g', para: 'a', taxa: 0.1 }] })))!.message).toMatch(/terminal/);
    expect(await salvarFunil(sql, op, 'Meu funil', g)).toMatchObject({ versao: 1 });
    expect(await salvarFunil(sql, op, 'Meu funil', g)).toMatchObject({ versao: 2 });
    const lista = await funisSalvos(sql, op);
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ nome: 'Meu funil', versao: 2 });
    expect((await sql`select count(*)::int as n from lab.studio_funil`)[0]!.n).toBe(2);
    await expect(sql`update lab.studio_funil set nome = 'x'`).rejects.toThrow(/só de acréscimo/);
    await expect(sql`delete from lab.studio_funil`).rejects.toThrow(/só de acréscimo/);
  });

  it('campanha: projeta pelo CPL do canal, congela o plano e compara com o realizado ao encerrar', async () => {
    const op = (await operacao(sql, 's'))!;
    const ctx = await montarContexto(sql, op, HOJE);
    expect((await falha(criarCampanha(sql, op, ctx, HOJE, { nome: 'C', canal: 'nao-existe', fim: '2026-12-31', orcamento: 1000 })))!.status).toBe(404);
    expect((await falha(criarCampanha(sql, op, ctx, HOJE, { nome: 'C', canal: 'pago', fim: '2026-12-31', orcamento: 0 })))!.message).toMatch(/orçamento/);
    expect((await falha(criarCampanha(sql, op, ctx, HOJE, { nome: 'C', canal: 'pago', fim: '2026-01-01', orcamento: 1000 })))!.message).toMatch(/anterior/);
    const { id, projecao } = await criarCampanha(sql, op, ctx, HOJE, { nome: 'Black Friday', canal: 'pago', fim: '2026-12-31', orcamento: 10000 });
    /* CPL do canal no histórico: 5.000 ÷ 10 leads = 500 → 20 leads → 4 vendas de 10.000 */
    expect(projecao).toMatchObject({ ok: true, cpl: 500, leads: 20 });
    expect(projecao.vendas).toBeCloseTo(4, 2);
    expect(projecao.receita).toBeCloseTo(40000, 0);
    expect(projecao.cac).toBeCloseTo(2500, 0);
    expect(projecao.roi).toBeCloseTo(3, 2);

    expect((await campanhas(sql, op))[0]).toMatchObject({ status: 'planejada', realizado: null, desvios: null });
    /* uma campanha planejada que não vai acontecer pode ser encerrada: vira registro (sem leads, sem vendas) na memória */
    expect(await encerrarCampanha(sql, op, id)).toMatchObject({ status: 'encerrada', realizado: { leads: 0, vendas: 0 } });
  });

  it('o plano não muda, o andamento só avança e a campanha encerrada é definitiva', async () => {
    const op = (await operacao(sql, 's'))!;
    const ctx = await montarContexto(sql, op, HOJE);
    const { id } = await criarCampanha(sql, op, ctx, HOJE, { nome: 'Outbound de novembro', canal: 'pago', fim: '2026-11-30', orcamento: 10000 });
    await expect(sql`update lab.campanha set orcamento = 1 where id = ${id}`).rejects.toThrow(/plano não pode mudar/);
    await expect(sql`delete from lab.campanha where id = ${id}`).rejects.toThrow(/só de acréscimo/);
    expect(await iniciarCampanha(sql, op, id)).toMatchObject({ status: 'rodando' });
    expect((await falha(iniciarCampanha(sql, op, id)))!.status).toBe(409);
    await expect(sql`update lab.campanha set status = 'planejada' where id = ${id}`).rejects.toThrow(/não volta atrás/);

    /* chegam 4 leads na janela, 1 vira venda de 12.000; gastou-se 8.000 */
    const [funil] = await sql<{ id: string }[]>`select id from lab.funil where operacao_id = ${opId} and principal`;
    const [canal] = await sql<{ id: string }[]>`select id from lab.canal where operacao_id = ${opId} and chave = 'pago'`;
    const et = Object.fromEntries((await sql<{ id: string; chave: string }[]>`select id, chave from lab.etapa where operacao_id = ${opId}`).map(e => [e.chave, e.id]));
    for (let i = 0; i < 4; i++) await sql`insert into lab.negocio (operacao_id, funil_id, canal_id, etapa_id, status, valor_fechado, criado_em, fechado_em)
      values (${opId}, ${funil!.id}, ${canal!.id}, ${i === 0 ? et.ganho : et.lead}, ${i === 0 ? 'ganho' : 'aberto'}, ${i === 0 ? 12000 : null}, '2026-11-05T12:00:00Z', ${i === 0 ? '2026-11-20T12:00:00Z' : null})`;
    const andamento = (await campanhas(sql, op)).find(c => c.id === id)!;
    expect(andamento.realizado).toMatchObject({ leads: 4, vendas: 1, receita: 12000 });
    /* sem investimento informado, vale o lançado por mês para o canal nos meses da campanha (aqui, outubro: 5.000) */
    expect(andamento.realizado).toMatchObject({ investimento: 5000, cac: 5000 });

    const r = await encerrarCampanha(sql, op, id, 8000);
    expect(r.realizado).toMatchObject({ leads: 4, vendas: 1, receita: 12000, investimento: 8000, cac: 8000 });
    expect(r.realizado.roi).toBeCloseTo(0.5, 4);
    const dv = Object.fromEntries(r.desvios.map(d => [d.campo, d]));
    expect(dv.vendas!.diferenca).toBeCloseTo(1 - 4, 1);
    expect(r.memoria).toMatch(/Meta de vendas não atingida/);
    expect((await sql`select tipo from lab.aprendizado order by id desc limit 1`)[0]!.tipo).toBe('nao_funcionou');
    expect((await falha(encerrarCampanha(sql, op, id)))!.status).toBe(409);
    await expect(sql`update lab.campanha set resultado = '{}' where id = ${id}`).rejects.toThrow(/encerrada não muda/);
    const final = (await campanhas(sql, op)).find(c => c.id === id)!;
    expect(final).toMatchObject({ status: 'encerrada' });
    expect(final.realizado).toMatchObject({ vendas: 1, investimento: 8000 });
  });
});
