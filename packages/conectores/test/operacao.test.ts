import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import { atualizarPackDaOperacao, criarOperacao } from '@lab/conectores';
import { bancoLimpo, catalogo, semBanco } from './ajuda.js';

describe.skipIf(semBanco)('operação', () => {
  let sql: postgres.Sql;
  beforeAll(async () => { sql = await bancoLimpo(); });
  afterAll(async () => { await sql?.end(); });

  it('cria a operação com os catálogos do pack', async () => {
    const { id } = await criarOperacao(sql, { slug: 'solar-teste', nome: 'Solar Teste', packId: 'solar-b2c' }, catalogo());
    const etapas = await sql`select e.chave, e.papel, e.ordem, f.chave as funil from lab.etapa e join lab.funil f on f.id = e.funil_id where e.operacao_id = ${id} order by f.chave, e.ordem`;
    expect(etapas.filter(e => e.funil === 'aquisicao').map(e => e.chave)).toEqual(['lead', 'reuniao_ag', 'reuniao_ok', 'sql', 'orc_sol', 'orc_ok', 'visita_ag', 'visita_ok', 'negociacao', 'contrato_env', 'ganho', 'perdido']);
    expect(etapas.filter(e => e.funil === 'carteira')).toHaveLength(5);
    const [{ n }] = await sql`select count(*)::int as n from lab.tipo_atividade where operacao_id = ${id} and meta_diaria`;
    expect(n).toBe(1);
    const canais = await sql`select c.chave, p.chave as pai from lab.canal c left join lab.canal p on p.id = c.pai_id where c.operacao_id = ${id} order by c.chave`;
    expect(canais.find(c => c.chave === 'meta_ads')!.pai).toBe('pago');
    const pol = await sql`select versao from lab.politica_preco where operacao_id = ${id}`;
    expect(pol).toHaveLength(1);
  });

  it('ajustes da operação funcionam como um pack filho', async () => {
    const { id } = await criarOperacao(sql, { slug: 'ajustada', nome: 'Ajustada', packId: 'base',
      ajustes: { atividades: [{ chave: 'ligacao', nome: 'Ligação', papel: 'tentativa', metaDiaria: true }], precificacao: { margemAlvo: 0.3, margemMinima: 0.2 } } }, catalogo());
    const [a] = await sql`select nome from lab.tipo_atividade where operacao_id = ${id} and chave = 'ligacao'`;
    expect(a!.nome).toBe('Ligação');
    const [p] = await sql`select margem_alvo::float as alvo from lab.politica_preco where operacao_id = ${id}`;
    expect(p!.alvo).toBe(0.3);
  });

  it('reaplicar o pack é idempotente e versiona a política só quando ela muda', async () => {
    const [op] = await sql`select id from lab.operacao where slug = 'ajustada'`;
    const r1 = await atualizarPackDaOperacao(sql, op!.id, catalogo());
    expect(r1.politicaNova).toBe(false);
    const r2 = await atualizarPackDaOperacao(sql, op!.id, catalogo(), { precificacao: { margemAlvo: 0.35, margemMinima: 0.2 } });
    expect(r2.politicaNova).toBe(true);
    const vs = await sql`select versao from lab.politica_preco where operacao_id = ${op!.id} order by versao`;
    expect(vs.map(v => v.versao)).toEqual([1, 2]);
    /* a atividade "ligacao" saiu dos ajustes: fica inativa, não some */
    const [lig] = await sql`select ativo from lab.tipo_atividade where operacao_id = ${op!.id} and chave = 'ligacao'`;
    expect(lig!.ativo).toBe(false);
  });

  it('política de preço e transições não aceitam alteração', async () => {
    await expect(sql`update lab.politica_preco set observacao = 'x'`).rejects.toThrow(/só de acréscimo/);
  });

  it('pack inválido não cria operação', async () => {
    await expect(criarOperacao(sql, { slug: 'ruim', nome: 'Ruim', packId: 'nao-existe' }, catalogo())).rejects.toThrow(/não existe/);
  });
});
