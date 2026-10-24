import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import type postgres from 'postgres';
import { criarApp, lerSegredo, rodadaAgendada } from '../src/app.js';
import { CATALOGO } from '../src/catalogo.js';
import { bancoLimpo, semBanco } from '../../../packages/conectores/test/ajuda.js';

const TOKEN = 'token-de-teste-com-mais-de-24-caracteres';

it('todo pack da pasta packs/ está no catálogo do Worker', () => {
  const naPasta = readdirSync(join(import.meta.dirname, '../../../packs')).filter(f => f.endsWith('.json') && f !== 'pack.schema.json').map(f => f.replace(/\.json$/, ''));
  expect(Object.keys(CATALOGO).sort()).toEqual(naPasta.sort());
});

it('conectores não alcançam os segredos do próprio LAB', () => {
  const s = lerSegredo({ ADMIN_TOKEN: 'x', DATABASE_URL: 'y', AMICTA_CHAVE: 'amk' });
  expect(s('ADMIN_TOKEN')).toBeUndefined();
  expect(s('DATABASE_URL')).toBeUndefined();
  expect(s('amicta_chave')).toBeUndefined();
  expect(s('AMICTA_CHAVE')).toBe('amk');
});

describe.skipIf(semBanco)('API', () => {
  let sql: postgres.Sql, app: (r: Request) => Promise<Response>;
  const chamar = (metodo: string, caminho: string, corpo?: unknown, cab: Record<string, string> = {}) =>
    app(new Request(`https://lab.teste${caminho}`, {
      method: metodo, headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json', ...cab },
      ...(corpo !== undefined ? { body: typeof corpo === 'string' ? corpo : JSON.stringify(corpo) } : {}),
    }));

  beforeAll(async () => {
    sql = await bancoLimpo();
    app = criarApp({ sql, env: { ADMIN_TOKEN: TOKEN, LIC_N8N: 'segredo-n8n' } });
  });
  afterAll(async () => { await sql?.end(); });

  it('saúde', async () => {
    const r = await app(new Request('https://lab.teste/saude'));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true, banco: 'ok' });
  });

  it('admin exige token', async () => {
    expect((await app(new Request('https://lab.teste/admin/operacoes'))).status).toBe(401);
    const semToken = criarApp({ sql, env: {} });
    expect((await semToken(new Request('https://lab.teste/admin/operacoes'))).status).toBe(503);
  });

  it('métricas: dicionário, período inválido e operação inexistente', async () => {
    expect(((await (await chamar('GET', '/admin/metricas/dicionario')).json()) as any[]).some(m => m.chave === 'cac')).toBe(true);
    expect((await chamar('GET', '/admin/operacoes/nao-existe/metricas?de=2026-10-01&ate=2026-11-01')).status).toBe(404);
  });

  it('lista packs válidos', async () => {
    const r = await (await chamar('GET', '/admin/packs')).json() as any[];
    expect(r.every(p => p.ok)).toBe(true);
  });

  it('cria operação e recusa duplicada', async () => {
    expect((await chamar('POST', '/admin/operacoes', { slug: 'licitacao', nome: 'Assessoria de licitação', packId: 'base' })).status).toBe(201);
    expect((await chamar('POST', '/admin/operacoes', { slug: 'licitacao', nome: 'De novo', packId: 'base' })).status).toBe(409);
    expect((await chamar('POST', '/admin/operacoes', { slug: 'x', nome: 'X', packId: 'nao-existe' })).status).toBe(400);
  });

  it('cria conectores validando config e segredo', async () => {
    const ruim = await chamar('POST', '/admin/conectores', { operacao: 'licitacao', tipo: 'amicta-crm-v1', nome: 'crm', config: { dadosPessoais: 'todos' } });
    expect(ruim.status).toBe(400);
    expect((await ruim.json() as any).erro).toMatch(/dadosPessoais/);
    expect((await chamar('POST', '/admin/conectores', { operacao: 'licitacao', tipo: 'canonico', nome: 'n8n', segredoRef: 'ADMIN_TOKEN' })).status).toBe(400);
    const ok = await chamar('POST', '/admin/conectores', { operacao: 'licitacao', tipo: 'canonico', nome: 'n8n', segredoRef: 'LIC_N8N' });
    expect(ok.status).toBe(201);
    expect((await ok.json() as any).webhook).toMatch(/^\/entrada\//);
    expect((await chamar('POST', '/admin/conectores', { operacao: 'licitacao', tipo: 'planilha', nome: 'planilhas' })).status).toBe(201);
  });

  it('webhook público entra pelo conector, com a chave dele', async () => {
    const [c] = await sql`select id from lab.conector where nome = 'n8n'`;
    const corpo = { id: 'l1', comandos: [{ tipo: 'negocio.upsert', ref: 'E-1', etapa: 'agendada', criadoEm: '2026-10-01', canalRef: 'outbound' }] };
    const r = await app(new Request(`https://lab.teste/entrada/${c!.id}`, { method: 'POST', headers: { authorization: 'Bearer segredo-n8n' }, body: JSON.stringify(corpo) }));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ aplicados: 1 });
    expect((await app(new Request('https://lab.teste/entrada/nao-e-uuid', { method: 'POST', body: '{}' }))).status).toBe(404);
  });

  it('importa planilha pela API e mostra a saúde do conector', async () => {
    const [c] = await sql`select id from lab.conector where nome = 'planilhas'`;
    const csv = 'id;cliente;canal;responsavel;etapa;criado_em\nE-2;Prefeitura X;Evento Setorial;Bruno;proposta;10/10/2026';
    const r = await chamar('POST', `/admin/conectores/${c!.id}/importar?nome=negocios.csv`, csv, { 'content-type': 'text/csv' });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true, aplicados: 1 });
    const s = await (await chamar('GET', `/admin/conectores/${c!.id}/saude`)).json() as any;
    expect(s.entradas.aplicado).toBe(1);
    expect(s.revisar).toEqual([expect.objectContaining({ o_que: 'canal', chave: 'evento_setorial' })]);
  });

  it('rodada agendada processa todos os conectores ativos', async () => {
    const r = await rodadaAgendada({ sql, env: { ADMIN_TOKEN: TOKEN } });
    expect(Object.keys(r).sort()).toEqual(['n8n', 'planilhas']);
  });
});
