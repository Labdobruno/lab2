import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import { criarOperacao } from '@lab/conectores';
import { acrescentarMetas, fechamento, metasVigentes, operacao, sugestaoBuildup } from '../src/index.js';
import { bancoLimpo, catalogo, semBanco } from '../../conectores/test/ajuda.js';

describe.skipIf(semBanco)('planejamento no banco', () => {
  let sql: postgres.Sql;
  beforeAll(async () => { sql = await bancoLimpo(); });
  afterAll(async () => { await sql?.end(); });

  it('meta só acrescenta: vale a mais recente e o passado fica', async () => {
    await criarOperacao(sql, { slug: 'p', nome: 'P', packId: 'base' }, catalogo());
    const op = (await operacao(sql, 'p'))!;
    await acrescentarMetas(sql, op.id, '2026-10-01', [{ indicador: 'receita', valor: 100000 }]);
    await acrescentarMetas(sql, op.id, '2026-10-01', [{ indicador: 'receita', valor: 120000, nota: 'revisão' }]);
    expect((await metasVigentes(sql, op.id, '2026-10-01'))).toEqual([{ indicador: 'receita', pessoaId: null, valor: 120000 }]);
    expect((await sql`select count(*)::int as n from lab.meta`)[0]!.n).toBe(2);
    await expect(sql`update lab.meta set valor = 1`).rejects.toThrow(/só de acréscimo/);
    await expect(acrescentarMetas(sql, op.id, '2026-10-01', [{ indicador: 'xyz', valor: 1 }])).rejects.toThrow(/desconhecido/);
  });

  it('ritmo e fechamento leem o realizado das atividades', async () => {
    const op = (await operacao(sql, 'p'))!;
    const [pes] = await sql<{ id: string }[]>`insert into lab.pessoa (operacao_id, nome, funcao) values (${op.id}, 'Sara', 'sdr') returning id`;
    const [tipo] = await sql<{ id: string }[]>`select id from lab.tipo_atividade where operacao_id = ${op.id} and papel = 'tentativa' limit 1`;
    await sql`insert into lab.atividade (operacao_id, tipo_id, pessoa_id, em, quantidade) values (${op.id}, ${tipo!.id}, ${pes!.id}, '2026-10-02T15:00:00Z', 12)`;
    await acrescentarMetas(sql, op.id, '2026-10-01', [{ indicador: 'tentativa', pessoaId: pes!.id, valor: 210 }]);
    const f = await fechamento(sql, op, '2026-10-02');
    const linha = f.linhas.find(l => l.pessoa === 'Sara')!;
    expect(linha).toMatchObject({ realizadoNoDia: 12, realizadoNoCiclo: 12, esperadoAteHoje: 20, status: 'atras' });
    expect(f.resumo.at(-1)).toMatch(/atrás|Ninguém/);
  });

  it('build-up sem histórico avisa em vez de inventar', async () => {
    const op = (await operacao(sql, 'p'))!;
    const r = await sugestaoBuildup(sql, op, '2026-10-02', 100000);
    expect(r.ok).toBe(false);
    expect(r.avisos.length).toBeGreaterThan(0);
    const com = await sugestaoBuildup(sql, op, '2026-10-02', 100000, { ticketMedio: 10000 });
    expect(com.totais.vendas).toBe(10);
  });
});
