import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import { criarOperacao } from '@lab/conectores';
import { operacao } from '@lab/planejamento';
import { drillPessoas, leadsPessoas, metaReversaPessoas, painelPessoas, transferirPerformance } from '../src/index.js';
import { bancoLimpo, catalogo, semBanco } from '../../conectores/test/ajuda.js';

const AGORA = Date.UTC(2026, 9, 24, 12);
describe.skipIf(semBanco)('pessoas no banco', () => {
  let sql: postgres.Sql, opId: string;
  beforeAll(async () => {
    sql = await bancoLimpo();
    ({ id: opId } = await criarOperacao(sql, { slug: 'pp', nome: 'PP', packId: 'base' }, catalogo()));
    const et = async (papel: string) => (await sql<{ id: string }[]>`select id from lab.etapa where operacao_id = ${opId} and papel = ${papel} limit 1`)[0]!.id;
    const [funil] = await sql<{ id: string }[]>`select id from lab.funil where operacao_id = ${opId} and principal`;
    const [canal] = await sql<{ id: string }[]>`select id from lab.canal where operacao_id = ${opId} and ativo limit 1`;
    const E = { lead: await et('lead'), contato: await et('contato'), agendada: await et('agendada'), realizada: await et('realizada'), proposta: await et('proposta'), negociacao: await et('negociacao'), ganho: await et('ganho'), perdido: await et('perdido') };
    const pessoa = async (nome: string) => (await sql<{ id: string }[]>`insert into lab.pessoa (operacao_id, nome, funcao) values (${opId}, ${nome}, 'closer') returning id`)[0]!.id;
    const ana = await pessoa('Ana'), bia = await pessoa('Bia');
    /* Ana: 10 leads → 8 agendadas → 4 propostas → 2 ganhos de 20 mil; Bia: 10 leads → 4 agendadas → 2 propostas → 1 ganho de 30 mil */
    const planta = async (dono: string, N: number[], valor: number) => {
      for (let i = 0; i < N[0]!; i++) {
        const al = i < N[3]! ? 'ganho' : i < N[2]! ? 'proposta' : i < N[1]! ? 'agendada' : 'lead', ganho = al === 'ganho';
        const [n] = await sql<{ id: string }[]>`insert into lab.negocio (operacao_id, funil_id, canal_id, dono_id, etapa_id, status, valor_fechado, criado_em, fechado_em)
          values (${opId}, ${funil!.id}, ${canal!.id}, ${dono}, ${E[al]}, ${ganho ? 'ganho' : 'aberto'}, ${ganho ? valor : null}, '2026-09-01T12:00:00Z', ${ganho ? '2026-09-25T12:00:00Z' : null}) returning id`;
        const passos = al === 'lead' ? [] : al === 'agendada' ? ['agendada'] : al === 'proposta' ? ['agendada', 'proposta'] : ['agendada', 'proposta', 'ganho'];
        for (const [k, p] of passos.entries()) await sql`insert into lab.negocio_transicao (operacao_id, negocio_id, para_etapa_id, em, origem) values (${opId}, ${n!.id}, ${E[p as keyof typeof E]}, ${new Date(Date.UTC(2026, 8, 3 + k * 7, 12)).toISOString()}, 'evento')`;
      }
    };
    await planta(ana, [10, 8, 4, 2], 20000); await planta(bia, [10, 4, 2, 1], 30000);
  });
  afterAll(async () => { await sql?.end(); });

  it('painel: funil por pessoa com salto contando as etapas anteriores, benchmark, gargalo principal e matriz', async () => {
    const op = (await operacao(sql, 'pp'))!;
    const P = await painelPessoas(sql, op, '2026-08-01', '2026-10-24', AGORA, 3);
    expect(P.etapas.map(e => e.papel)).toEqual(['lead', 'contato', 'agendada', 'realizada', 'proposta', 'negociacao', 'ganho']);
    expect(P.coorte).toBe(20); expect(P.semDono).toBe(0);
    const ana = P.pessoas.find(p => p.nome === 'Ana')!, bia = P.pessoas.find(p => p.nome === 'Bia')!;
    expect(ana.funil.N).toEqual([10, 8, 8, 4, 4, 2, 2]);    // salto lead→agendada conta "contato"; proposta→ganho conta "negociação"
    expect(bia.funil.N).toEqual([10, 4, 4, 2, 2, 1, 1]); expect(bia.funil.ticket).toBe(30000);
    expect(P.equipe.N[0]).toBe(20); expect(P.bench[0]!.n).toBe(2); expect(P.bench[0]!.p75).toBeCloseTo(0.7);
    expect(P.principal!.i).toBe(0); expect(P.principal!.afetados.map(a => a.v)).toEqual(['Bia']);
    expect(bia.potencial[0]!.ganho).toBeCloseTo(10 * 0.7 * 0.5 * 0.5 * 30000 - 30000);
    expect(P.matriz.pts.find(p => p.v === 'Ana')!.quadrante).toBe('alto volume · alta eficiência');
    expect(P.alertas.find(a => a.t === 'gargalo')).toMatchObject({ pessoa: 'Bia', i: 0 });
  });
  it('transferência, drill-down, leads e meta reversa', async () => {
    const op = (await operacao(sql, 'pp'))!;
    const T = await transferirPerformance(sql, op, '2026-08-01', '2026-10-24', 'Bia', 'Ana', ['t0'], 3);
    expect(T.base).toBe(30000); expect(T.linhas.find(l => l.k === 't0')!.receita).toBeCloseTo(60000);
    const D = await drillPessoas(sql, op, '2026-08-01', '2026-10-24', 0, null, 3);
    expect(D.grupos.pessoa!.map(l => [l.chave, l.n, l.avancaram])).toEqual([['Ana', 10, 8], ['Bia', 10, 4]]); expect(D.grupos.mes[0]!.chave).toBe('2026-09');
    const L = await leadsPessoas(sql, op, '2026-08-01', '2026-10-24', 4, 'Ana', 3); expect(L.total).toBe(4); expect(L.leads[0]!.status).toBe('ganho');
    const R = (await metaReversaPessoas(sql, op, '2026-08-01', '2026-10-24', 100000, 'Ana', 3))!; expect(R.vendas).toBe(5); expect(R.necessarios[0]!.necessario).toBe(25);
  });
});
