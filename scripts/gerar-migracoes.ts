/* Embute as migrations (supabase/migrations/*.sql) no Worker: apps/api/src/migracoes.gen.ts.
   Rode `npm run migracoes:gerar` ao criar uma migration; um teste confere que o arquivo está em dia. */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const raiz = join(import.meta.dirname, '..');
export function conteudoGerado(): string {
  const pasta = join(raiz, 'supabase/migrations');
  const lista = readdirSync(pasta).filter(f => f.endsWith('.sql')).sort().map(nome => ({ nome, sql: readFileSync(join(pasta, nome), 'utf8') }));
  return `/* GERADO por scripts/gerar-migracoes.ts: não edite. */\nexport const MIGRACOES: ReadonlyArray<{ nome: string; sql: string }> = ${JSON.stringify(lista, null, 2)};\n`;
}
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop()!)) {
  writeFileSync(join(raiz, 'apps/api/src/migracoes.gen.ts'), conteudoGerado());
  console.log('migracoes.gen.ts atualizado');
}
