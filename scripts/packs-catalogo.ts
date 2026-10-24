import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Catalogo } from '@lab/nucleo';

export const PASTA_PACKS = join(import.meta.dirname, '../packs');

/* lê todos os packs da pasta packs/ (o nome do arquivo é o id) */
export function lerCatalogo(): Catalogo {
  const out: Catalogo = {};
  for (const f of readdirSync(PASTA_PACKS)) {
    if (!f.endsWith('.json') || f === 'pack.schema.json') continue;
    const id = f.replace(/\.json$/, '');
    try { out[id] = JSON.parse(readFileSync(join(PASTA_PACKS, f), 'utf8')); }
    catch (e) { out[id] = { __erroLeitura: `packs/${f}: JSON inválido — ${(e as Error).message}` }; }
  }
  return out;
}
