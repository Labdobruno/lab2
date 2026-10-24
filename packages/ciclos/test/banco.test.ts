import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import { criarOperacao } from '@lab/conectores';
import { operacao } from '@lab/planejamento';
import {
  aprendizados, confirmarEsforco, criarQuarter, definirMeta, definirPrograma, ErroDeRegra, escolherCenario, fecharCiclo, quarterDaOperacao,
  registrarAprendizado, retratos, travarQuarter,
} from '../src/index.js';
import { bancoLimpo, catalogo, semBanco } from '../../conectores/test/ajuda.js';

const falha = async (p: Promise<unknown>) => (await p.then(() => null, e => e)) as ErroDeRegra | null;

describe.skipIf(semBanco)('quarter e fechamento no banco', () => {
  let sql: postgres.Sql;
  beforeAll(async () => { sql = await bancoLimpo(); await criarOperacao(sql, { slug: 'q', nome: 'Q', packId: 'base' }, catalogo()); });
  afterAll(async () => { await sql?.end(); });
  const DATA = '2026-10-10';

  it('os 6 passos só andam na ordem', async () => {
    const op = (await operacao(sql, 'q'))!;
    expect((await falha(definirMeta(sql, op, DATA, { receita: 300000 })))!.status).toBe(404);
    const q0 = await criarQuarter(sql, op, DATA);
    expect(q0.rotulo).toBe('Q4 2026');
    expect(q0.quarter).toMatchObject({ fase: 1, status: 'rascunho' });
    expect((await falha(escolherCenario(sql, op, DATA, 'base')))!.message).toMatch(/passo 2/);
    expect((await falha(definirMeta(sql, op, DATA, { receita: 0 })))!.message).toMatch(/receita/);

    const q2 = await definirMeta(sql, op, DATA, { receita: 300000, ticketMedio: 10000, taxas: { oportunidades: 0.4, reuniao_realizada: 0.5, agendamento: 0.8, contato: 0.5, tentativa: 0.25 } });
    expect(q2.quarter).toMatchObject({ fase: 2, receitaMeta: 300000 });
    expect(q2.cenarios!.base.totais.vendas).toBe(30);
    expect((await falha(confirmarEsforco(sql, op, DATA)))!.message).toMatch(/passo 3/);
    expect((await falha(escolherCenario(sql, op, DATA, 'maluco')))!.message).toMatch(/cenário/);
    expect((await escolherCenario(sql, op, DATA, 'conservador')).quarter!.fase).toBe(3);
    expect((await confirmarEsforco(sql, op, DATA)).quarter!.fase).toBe(4);
    expect((await falha(definirPrograma(sql, op, DATA, [1, -1, 1])))!.message).toMatch(/pesos/);
    const q5 = await definirPrograma(sql, op, DATA, [1, 1, 2]);
    expect(q5.quarter!.fase).toBe(5);
    expect(q5.programa!.ciclos.map(c => c.metaReceita)).toEqual([75000, 75000, 150000]);

    /* refazer um passo anterior derruba os seguintes */
    expect((await definirMeta(sql, op, DATA, { receita: 400000, ticketMedio: 10000 })).quarter).toMatchObject({ fase: 2, cenario: null });
    await escolherCenario(sql, op, DATA, 'base'); await confirmarEsforco(sql, op, DATA); await definirPrograma(sql, op, DATA);
  });

  it('travar grava as metas dos 3 ciclos e congela o plano', async () => {
    const op = (await operacao(sql, 'q'))!;
    await sql`insert into lab.pessoa (operacao_id, nome, funcao) values (${op.id}, 'Sara', 'sdr'), (${op.id}, 'Caio', 'closer')`;
    const q = await travarQuarter(sql, op, DATA);
    expect(q.quarter).toMatchObject({ fase: 6, status: 'travado' });
    const metas = await sql`select ciclo_inicio::text, indicador, pessoa_id, valor from lab.meta where operacao_id = ${op.id} and indicador = 'receita' order by ciclo_inicio`;
    expect(metas.map(m => m.ciclo_inicio)).toEqual(['2026-10-01', '2026-11-01', '2026-12-01']);
    expect(metas.reduce((s, m) => s + Number(m.valor), 0)).toBe(400000);
    expect((await sql`select count(*)::int as n from lab.meta where pessoa_id is not null`)[0]!.n).toBeGreaterThan(0);
    expect((await falha(definirMeta(sql, op, DATA, { receita: 1 })))!.status).toBe(409);
    await expect(sql`update lab.quarter set receita_meta = 1`).rejects.toThrow(/só de acréscimo/);
    expect((await quarterDaOperacao(sql, op, DATA)).quarter!.status).toBe('travado');
  });

  it('o ciclo só fecha depois do último dia útil, uma vez, e o retrato é imutável e íntegro', async () => {
    const op = (await operacao(sql, 'q'))!;
    expect((await falha(fecharCiclo(sql, op, '2026-10-10', '2026-10-30')))!.message).toMatch(/último dia útil/);
    const r = await fecharCiclo(sql, op, '2026-10-10', '2026-10-31');
    expect(r.assinatura).toHaveLength(64);
    expect(r.dados.ciclo).toMatchObject({ inicio: '2026-10-01', fim: '2026-11-01' });
    expect(r.dados.quarter).toMatchObject({ rotulo: 'Q4 2026', cenario: 'base' });
    expect((await falha(fecharCiclo(sql, op, '2026-10-10', '2026-11-03')))!.status).toBe(409);
    await expect(sql`update lab.retrato_ciclo set dados = '{}'`).rejects.toThrow(/só de acréscimo/);
    await expect(sql`delete from lab.retrato_ciclo`).rejects.toThrow(/só de acréscimo/);
    const lista = await retratos(sql, op);
    expect(lista).toHaveLength(1);
    expect(lista[0]!.integro).toBe(true);
  });

  it('aprendizados só acrescentam e validam', async () => {
    const op = (await operacao(sql, 'q'))!;
    expect((await falha(registrarAprendizado(sql, op, { tipo: 'x', texto: 'a' })))!.message).toMatch(/tipo/);
    expect((await falha(registrarAprendizado(sql, op, { tipo: 'decisao', texto: '   ' })))!.message).toMatch(/escreva/);
    await registrarAprendizado(sql, op, { tipo: 'funcionou', texto: ' Cadência de 5 toques ', cicloInicio: '2026-10-01' });
    const l = await aprendizados(sql, op);
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ tipo: 'funcionou', texto: 'Cadência de 5 toques', cicloInicio: '2026-10-01' });
    await expect(sql`delete from lab.aprendizado`).rejects.toThrow(/só de acréscimo/);
  });
});
