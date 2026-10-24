import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import { criarOperacao } from '@lab/conectores';
import { operacaoPorSlug, relatorio } from '../src/index.js';
import { bancoLimpo, catalogo, semBanco } from '../../conectores/test/ajuda.js';

describe.skipIf(semBanco)('relatório no banco', () => {
  let sql: postgres.Sql;
  beforeAll(async () => { sql = await bancoLimpo(); });
  afterAll(async () => { await sql?.end(); });

  it('lê o modelo canônico e calcula pelos papéis', async () => {
    await criarOperacao(sql, { slug: 'teste', nome: 'Teste', packId: 'base' }, catalogo());
    const op = (await operacaoPorSlug(sql, 'teste'))!;
    const [funil] = await sql<{ id: string }[]>`select id from lab.funil where operacao_id = ${op.id} and principal`;
    const et = async (papel: string) => (await sql<{ id: string }[]>`select id from lab.etapa where operacao_id = ${op.id} and papel = ${papel} order by ordem limit 1`)[0]!.id;
    const [canal] = await sql<{ id: string }[]>`select id from lab.canal where operacao_id = ${op.id} and ativo limit 1`;
    const [lead, contato, ganho] = [await et('lead'), await et('contato'), await et('ganho')];

    const novo = async (etapa: string, extra: { status?: string; fechado?: string; valor?: number } = {}) => (await sql<{ id: string }[]>`
      insert into lab.negocio (operacao_id, funil_id, canal_id, etapa_id, status, valor_fechado, criado_em, fechado_em)
      values (${op.id}, ${funil!.id}, ${canal!.id}, ${etapa}, ${extra.status ?? 'aberto'}, ${extra.valor ?? null}, '2026-10-05T12:00:00Z', ${extra.fechado ?? null}) returning id`)[0]!.id;
    await novo(lead);
    const b = await novo(contato);
    const g = await novo(ganho, { status: 'ganho', valor: 10000, fechado: '2026-10-20T12:00:00Z' });
    await sql`insert into lab.negocio_transicao (operacao_id, negocio_id, para_etapa_id, em, origem) values (${op.id}, ${b}, ${contato}, '2026-10-06T12:00:00Z', 'evento')`;
    await sql`insert into lab.preco_negocio (operacao_id, negocio_id, momento, valor, linhas, em) values (${op.id}, ${g}, 'fechado', 10000, ${sql.json([{ chave: 'imposto', valor: 1000 }])}, '2026-10-20T12:00:00Z')`;
    await sql`insert into lab.investimento_canal (operacao_id, canal_id, mes, valor) values (${op.id}, ${canal!.id}, '2026-10-01', 3000)`;

    const r = await relatorio(sql, op, { de: '2026-10-01', ate: '2026-11-01' });
    expect(r.coorte.coorte).toBe(3);
    expect(r.coorte.etapas.find(e => e.papel === 'contato')).toMatchObject({ sucessos: 2 });
    expect(r.fluxo).toMatchObject({ contato: 1 });
    expect(r.canais).toHaveLength(1);
    expect(r.canais[0]).toMatchObject({ leads: 3, vendas: 1, receita: 10000, cpl: 1000, cac: 3000, margemContribuicao: 9000, mcMenosCac: 6000 });
    expect(r.taxaDeGanho).toMatchObject({ sucessos: 1, total: 1 });
    expect(r.vendas.margemPercentual).toBe(0.9);
    expect(r.retencao.mrrInicial).toBeNull();

    const vazio = await relatorio(sql, op, { de: '2025-01-01', ate: '2025-02-01' });
    expect(vazio.coorte.coorte).toBe(0);
    expect(vazio.canais).toEqual([]);
  });
});
