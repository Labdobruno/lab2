/* Banco de teste: recria o schema "lab" do zero aplicando as migrations reais. */
import postgres from 'postgres';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Catalogo } from '@lab/nucleo';

const RAIZ = join(import.meta.dirname, '../../..');
export const URL_BANCO = process.env.DATABASE_URL;
export const semBanco = !URL_BANCO;

export function catalogo(): Catalogo {
  const pasta = join(RAIZ, 'packs');
  return Object.fromEntries(readdirSync(pasta).filter(f => f.endsWith('.json') && f !== 'pack.schema.json')
    .map(f => [f.replace(/\.json$/, ''), JSON.parse(readFileSync(join(pasta, f), 'utf8'))]));
}

export async function bancoLimpo() {
  // mesmas opções do Worker em produção (pooler do Supabase): pega bugs que só apareceriam lá
  const sql = postgres(URL_BANCO!, { max: 1, prepare: false, fetch_types: false, onnotice: () => {} });
  await sql.unsafe('drop schema if exists lab cascade');
  const pasta = join(RAIZ, 'supabase/migrations');
  for (const f of readdirSync(pasta).sort()) await sql.unsafe(readFileSync(join(pasta, f), 'utf8'));
  return sql;
}

export async function novoConector(sql: postgres.Sql, operacaoId: string, tipo: string, config: object = {}, segredoRef: string | null = null) {
  const [c] = await sql<{ id: string }[]>`insert into lab.conector (operacao_id, tipo, nome, config, segredo_ref)
    values (${operacaoId}, ${tipo}, ${tipo + '-' + Math.random().toString(36).slice(2, 7)}, ${sql.json(config as never)}, ${segredoRef}) returning id`;
  const [linha] = await sql`select id, operacao_id, tipo, nome, config, segredo_ref, ativo, cursor from lab.conector where id = ${c!.id}`;
  return linha as any;
}
