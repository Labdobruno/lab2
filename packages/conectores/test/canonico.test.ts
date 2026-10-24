import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import { criarOperacao, receberWebhook } from '@lab/conectores';
import { bancoLimpo, catalogo, novoConector, semBanco } from './ajuda.js';

describe.skipIf(semBanco)('conector canônico (n8n, Make, scripts)', () => {
  let sql: postgres.Sql, linha: any;
  const dep = () => ({ sql, segredos: (r: string) => (r === 'N8N' ? 'segredo-forte' : undefined) });
  beforeAll(async () => {
    sql = await bancoLimpo();
    const op = (await criarOperacao(sql, { slug: 'lic', nome: 'Licitação', packId: 'base' }, catalogo())).id;
    linha = await novoConector(sql, op, 'canonico', {}, 'N8N');
  });
  afterAll(async () => { await sql?.end(); });

  const enviar = (corpo: unknown, chave = 'segredo-forte') =>
    receberWebhook(dep(), linha, { cabecalhos: new Headers({ authorization: `Bearer ${chave}` }), corpo: JSON.stringify(corpo) });

  it('aplica um lote de comandos', async () => {
    const r = await enviar({ id: 'lote-1', comandos: [
      { tipo: 'pessoa.upsert', ref: 'bruno', nome: 'Bruno', funcao: 'closer' },
      { tipo: 'negocio.upsert', ref: 'L-1', donoRef: 'bruno', canalRef: 'outbound', etapa: 'agendada', criadoEm: '2026-10-01' },
      { tipo: 'atividade.registrar', ref: 'lig-1', atividade: 'tentativa', em: '2026-10-01T09:00:00Z', pessoaRef: 'bruno', quantidade: 10 },
    ] });
    expect(r).toMatchObject({ http: 200, corpo: { aplicados: 1, erros: 0 } });
    const [{ n }] = await sql`select count(*)::int as n from lab.negocio`;
    expect(n).toBe(1);
  });

  it('chave errada é recusada', async () => {
    expect((await enviar({ comandos: [] }, 'chute')).http).toBe(401);
  });

  it('comando inválido fica registrado como erro, com a explicação', async () => {
    const r = await enviar({ id: 'lote-2', comandos: [{ tipo: 'negocio.upsert', ref: 'L-2' }] });
    expect(r.corpo).toMatchObject({ erros: 1 });
    const [e] = await sql`select erro from lab.entrada_bruta where chave_idem = 'lote:lote-2'`;
    expect(e!.erro).toMatch(/criadoEm/);
  });

  it('corpo que não é lote volta 400', async () => {
    expect((await enviar({ nada: true })).http).toBe(400);
  });
});
