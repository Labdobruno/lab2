/* Aplica no banco as migrations que ainda faltam, na ordem. Só roda os arquivos embutidos no próprio Worker.
   Cada uma roda numa transação com trava, então dois processos ao mesmo tempo não se atropelam.
   Bancos que já receberam as primeiras migrations à mão são reconhecidos pelas tabelas que elas criaram. */
import type { Sql } from 'postgres';
import { MIGRACOES } from './migracoes.gen.js';

const JA_APLICADAS_A_MAO: Record<string, string> = {
  '20261024000001_modelo_canonico.sql': 'lab.operacao',
  '20261025000001_metas.sql': 'lab.meta',
};

export async function migrar(sql: Sql, lista = MIGRACOES): Promise<string[]> {
  await sql`create schema if not exists lab`;
  await sql`create table if not exists lab.migracao (nome text primary key, aplicada_em timestamptz not null default now())`;
  await sql.unsafe(`alter table lab.migracao enable row level security;
    do $$ begin
      if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on lab.migracao from anon; end if;
      if exists (select 1 from pg_roles where rolname = 'authenticated') then revoke all on lab.migracao from authenticated; end if;
    end $$;`);
  const [{ n } = { n: 0 }] = await sql<{ n: number }[]>`select count(*)::int as n from lab.migracao`;
  if (n === 0) {
    for (const [nome, tabela] of Object.entries(JA_APLICADAS_A_MAO)) {
      const [{ existe } = { existe: false }] = await sql<{ existe: boolean }[]>`select to_regclass(${tabela}) is not null as existe`;
      if (existe) await sql`insert into lab.migracao (nome) values (${nome}) on conflict do nothing`;
    }
  }
  const feitas: string[] = [];
  for (const m of lista) {
    const [ja] = await sql`select 1 from lab.migracao where nome = ${m.nome}`;
    if (ja) continue;
    await sql.begin(async tx => {
      await tx`select pg_advisory_xact_lock(7240001)`;
      const [jaAgora] = await tx`select 1 from lab.migracao where nome = ${m.nome}`;
      if (jaAgora) return;
      await tx.unsafe(m.sql);
      await tx`insert into lab.migracao (nome) values (${m.nome})`;
      feitas.push(m.nome);
    });
  }
  return feitas;
}

/* uma vez por processo do Worker: a primeira chamada autenticada confere o banco */
let conferido: Promise<void> | null = null;
export function garantirMigracoes(sql: Sql): Promise<void> {
  conferido ??= migrar(sql).then(() => undefined, e => { conferido = null; throw e; });
  return conferido;
}
