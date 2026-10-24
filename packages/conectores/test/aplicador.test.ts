import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import { Aplicador, criarOperacao } from '@lab/conectores';
import type { Comando } from '@lab/nucleo';
import { bancoLimpo, catalogo, novoConector, semBanco } from './ajuda.js';

describe.skipIf(semBanco)('aplicador', () => {
  let sql: postgres.Sql, op: string, con: string;
  const aplicar = (cmds: Comando[], mapa?: object) => sql.begin(tx => new Aplicador(tx, { operacaoId: op, conectorId: con, mapa: mapa as never }).aplicar(cmds));
  const negocio = async (ref: string) => (await sql`
    select n.*, e.chave as etapa, c.chave as canal, p.nome as dono, m.chave as motivo from lab.negocio n
    join lab.vinculo v on v.interno_id = n.id and v.entidade = 'negocio' and v.ref = ${ref}
    join lab.etapa e on e.id = n.etapa_id left join lab.canal c on c.id = n.canal_id left join lab.pessoa p on p.id = n.dono_id
    left join lab.motivo_perda m on m.id = n.motivo_perda_id`)[0]!;
  const transicoes = async (ref: string) => (await sql`
    select e.chave, t.origem, t.em from lab.negocio_transicao t join lab.etapa e on e.id = t.para_etapa_id
    join lab.vinculo v on v.interno_id = t.negocio_id and v.entidade = 'negocio' and v.ref = ${ref} order by t.em, t.id`).map(x => `${x.chave}:${x.origem}`);

  beforeAll(async () => {
    sql = await bancoLimpo();
    op = (await criarOperacao(sql, { slug: 'solar', nome: 'Solar', packId: 'solar-b2c' }, catalogo())).id;
    con = (await novoConector(sql, op, 'canonico')).id;
  });
  afterAll(async () => { await sql?.end(); });

  it('cria negócio, conta, pessoa e canal; registra a entrada no funil', async () => {
    await aplicar([
      { tipo: 'negocio.upsert', ref: 'n1', contaRef: 'c1', canalRef: 'Meta Ads', donoRef: 'u:marina', etapa: 'lead', criadoEm: '2026-10-01T10:00:00Z', valorEstimado: 20000, atualizadoEm: '2026-10-01T10:00:00Z' },
      { tipo: 'conta.upsert', ref: 'c1', nome: 'Ana Lima', cidade: 'Curitiba', uf: 'PR' },
      { tipo: 'pessoa.upsert', ref: 'u:marina', nome: 'Marina', funcao: 'closer' },
    ]);
    const n = await negocio('n1');
    expect(n).toMatchObject({ etapa: 'lead', canal: 'meta_ads', dono: 'Marina', status: 'aberto' });
    expect(Number(n.valor_estimado)).toBe(20000);
    expect(await transicoes('n1')).toEqual(['lead:inferida']);
  });

  it('mudança de etapa sem evento vira transição inferida; com evento, vale o evento', async () => {
    await aplicar([{ tipo: 'negocio.upsert', ref: 'n1', criadoEm: '2026-10-01T10:00:00Z', etapa: 'reuniao_ag', etapaDesde: '2026-10-02T09:00:00Z', atualizadoEm: '2026-10-02T09:00:00Z' }]);
    await aplicar([
      { tipo: 'negocio.upsert', ref: 'n1', criadoEm: '2026-10-01T10:00:00Z', etapa: 'reuniao_ok', etapaDesde: '2026-10-03T15:00:00Z', atualizadoEm: '2026-10-03T15:00:00Z' },
      { tipo: 'negocio.transicao', negocioRef: 'n1', para: 'reuniao_ok', de: 'reuniao_ag', em: '2026-10-03T15:00:00Z' },
    ]);
    expect(await transicoes('n1')).toEqual(['lead:inferida', 'reuniao_ag:inferida', 'reuniao_ok:evento']);
    expect((await negocio('n1')).etapa).toBe('reuniao_ok');
  });

  it('dado mais velho da fonte não sobrescreve o mais novo', async () => {
    await aplicar([{ tipo: 'negocio.upsert', ref: 'n1', criadoEm: '2026-10-01T10:00:00Z', etapa: 'lead', valorEstimado: 1, atualizadoEm: '2026-10-01T12:00:00Z' }]);
    const n = await negocio('n1');
    expect(n.etapa).toBe('reuniao_ok');
    expect(Number(n.valor_estimado)).toBe(20000);
  });

  it('ganho fecha o negócio; perdido grava o motivo (e cria motivo novo para revisar)', async () => {
    await aplicar([{ tipo: 'negocio.upsert', ref: 'n1', criadoEm: '2026-10-01T10:00:00Z', etapa: 'ganho', etapaDesde: '2026-10-10T18:00:00Z', valorFechado: 21334.68, atualizadoEm: '2026-10-10T18:00:00Z' }]);
    const g = await negocio('n1');
    expect(g.status).toBe('ganho');
    expect(new Date(g.fechado_em).toISOString()).toBe('2026-10-10T18:00:00.000Z');
    await aplicar([{ tipo: 'negocio.upsert', ref: 'n2', criadoEm: '2026-10-05T10:00:00Z', etapa: 'perdido', motivoPerda: 'Preço', atualizadoEm: '2026-10-06T10:00:00Z' }]);
    expect((await negocio('n2')).motivo).toBe('preco');
    await aplicar([{ tipo: 'negocio.upsert', ref: 'n3', criadoEm: '2026-10-05T10:00:00Z', etapa: 'perdido', motivoPerda: 'Mudou de cidade' }]);
    const [m] = await sql`select chave, a_revisar from lab.motivo_perda where operacao_id = ${op} and chave = 'mudou_de_cidade'`;
    expect(m!.a_revisar).toBe(true);
  });

  it('etapa desconhecida dá erro claro; o mapa da fonte resolve', async () => {
    await expect(aplicar([{ tipo: 'negocio.upsert', ref: 'n4', criadoEm: '2026-10-05T10:00:00Z', etapa: 'qualificacao' }])).rejects.toThrow(/config\.mapa\.etapas/);
    await aplicar([{ tipo: 'negocio.upsert', ref: 'n4', criadoEm: '2026-10-05T10:00:00Z', etapa: 'qualificacao' }], { etapas: { qualificacao: 'sql' } });
    expect((await negocio('n4')).etapa).toBe('sql');
  });

  it('transição de negócio que ainda não chegou é erro recuperável', async () => {
    await expect(aplicar([{ tipo: 'negocio.transicao', negocioRef: 'n-futuro', para: 'sql', em: '2026-10-05T10:00:00Z' }])).rejects.toThrow(/ainda não chegou/);
  });

  it('atividade conta uma vez só', async () => {
    const a: Comando = { tipo: 'atividade.registrar', ref: 'a1', atividade: 'tentativa', em: '2026-10-02T10:00:00Z', pessoaRef: 'u:marina', negocioRef: 'n1', quantidade: 3 };
    await aplicar([a]); await aplicar([a]);
    const [{ total }] = await sql`select sum(quantidade)::int as total from lab.atividade where operacao_id = ${op}`;
    expect(total).toBe(3);
    await expect(aplicar([{ ...a, ref: 'a2', atividade: 'ligacao_magica' } as Comando])).rejects.toThrow(/config\.mapa\.atividades/);
  });

  it('preço, recebimento, contrato, evento de CS e investimento', async () => {
    await aplicar([
      { tipo: 'preco.registrar', negocioRef: 'n1', momento: 'aprovado', valor: 21000, limite: 20000, em: '2026-10-08T10:00:00Z' },
      { tipo: 'preco.registrar', negocioRef: 'n1', momento: 'fechado', valor: 21334.68, em: '2026-10-10T18:00:00Z', condicao: 'c6040', linhas: [{ chave: 'kit', valor: 9000 }] },
      { tipo: 'recebimento.upsert', ref: 't1', negocioRef: 'n1', valorPrevisto: 12800.8, previstoEm: '2026-10-15', status: 'previsto' },
      { tipo: 'contrato.upsert', ref: 'k1', contaRef: 'c1', negocioOrigemRef: 'n1', recorrente: false, valorPeriodo: 21334.68, inicio: '2026-10-10', status: 'ativo' },
      { tipo: 'evento_cs.registrar', ref: 'e1', contaRef: 'c1', evento: 'indicacao', em: '2026-10-20T10:00:00Z' },
      { tipo: 'investimento.upsert', canalRef: 'Meta Ads', mes: '2026-10', valor: 3500, leadsPlataforma: 120 },
    ]);
    await aplicar([{ tipo: 'recebimento.upsert', ref: 't1', negocioRef: 'n1', valorPrevisto: 12800.8, previstoEm: '2026-10-15', valorRecebido: 12800.8, recebidoEm: '2026-10-16', status: 'pago' }]);
    const [r] = await sql`select status, recebido_em::text, conta_id is not null as tem_conta from lab.recebimento`;
    expect(r).toMatchObject({ status: 'pago', recebido_em: '2026-10-16', tem_conta: true });
    const [cond] = await sql`select chave, a_revisar from lab.condicao_pagamento where operacao_id = ${op} and chave = 'c6040'`;
    expect(cond!.a_revisar).toBe(true);
    const precos = await sql`select momento from lab.preco_negocio order by momento`;
    expect(precos.map(p => p.momento)).toEqual(['aprovado', 'fechado']);
    const [inv] = await sql`select valor::float, leads_plataforma from lab.investimento_canal`;
    expect(inv).toMatchObject({ valor: 3500, leads_plataforma: 120 });
    const [{ n }] = await sql`select count(*)::int as n from lab.evento_cs`;
    expect(n).toBe(1);
  });

  it('o histórico de etapas não aceita alteração', async () => {
    await expect(sql`update lab.negocio_transicao set origem = 'evento'`).rejects.toThrow(/só de acréscimo/);
  });
});
