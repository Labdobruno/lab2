import { afterAll, describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';
import { migrar } from '../src/migracoes.js';
import { MIGRACOES } from '../src/migracoes.gen.js';
import { conteudoGerado } from '../../../scripts/gerar-migracoes.js';
import { URL_BANCO, semBanco } from '../../../packages/conectores/test/ajuda.js';

const PASTA = join(import.meta.dirname, '../../../supabase/migrations');

it('as migrations embutidas no Worker estão em dia (rode npm run migracoes:gerar)', () => {
  expect(readFileSync(join(import.meta.dirname, '../src/migracoes.gen.ts'), 'utf8')).toBe(conteudoGerado());
  expect(MIGRACOES.map(m => m.nome)).toEqual(readdirSync(PASTA).filter(f => f.endsWith('.sql')).sort());
});

describe.skipIf(semBanco)('aplicador de migrations', () => {
  const sql = semBanco ? (undefined as never) : postgres(URL_BANCO!, { max: 1, prepare: false, fetch_types: false, onnotice: () => {} });
  afterAll(async () => { await sql?.end(); });

  it('banco vazio: aplica tudo, uma vez só', async () => {
    await sql.unsafe('drop schema if exists lab cascade');
    expect(await migrar(sql)).toEqual(MIGRACOES.map(m => m.nome));
    expect(await migrar(sql)).toEqual([]);
    expect((await sql`select to_regclass('lab.quarter') is not null as ok`)[0]!.ok).toBe(true);
  });

  it('banco que recebeu as duas primeiras à mão: só aplica o que falta', async () => {
    await sql.unsafe('drop schema if exists lab cascade');
    for (const m of MIGRACOES.slice(0, 2)) await sql.unsafe(m.sql);
    expect(await migrar(sql)).toEqual(MIGRACOES.slice(2).map(m => m.nome));
    expect(await migrar(sql)).toEqual([]);
  });

  it('duas execuções ao mesmo tempo não se atropelam', async () => {
    await sql.unsafe('drop schema if exists lab cascade');
    const outra = postgres(URL_BANCO!, { max: 1, prepare: false, fetch_types: false, onnotice: () => {} });
    const [a, b] = await Promise.all([migrar(sql), migrar(outra)]);
    await outra.end();
    expect([...a, ...b].sort()).toEqual(MIGRACOES.map(m => m.nome).sort());
  });

  it('migration com erro desfaz tudo dela e não marca como aplicada', async () => {
    await sql.unsafe('drop schema if exists lab cascade');
    await expect(migrar(sql, [{ nome: 'ruim.sql', sql: 'create table lab.x (a int); select 1/0;' }])).rejects.toThrow();
    expect((await sql`select to_regclass('lab.x') is not null as ok`)[0]!.ok).toBe(false);
    expect((await sql`select count(*)::int as n from lab.migracao`)[0]!.n).toBe(0);
  });
});
