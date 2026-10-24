/* Gera packs/pack.schema.json: o editor passa a sugerir campos e apontar erros enquanto se escreve um pack. */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { PackArquivo } from '@lab/nucleo';
import { PASTA_PACKS } from './packs-catalogo.js';

const schema = z.toJSONSchema(PackArquivo, { target: 'draft-2020-12', unrepresentable: 'any' });
writeFileSync(join(PASTA_PACKS, 'pack.schema.json'), JSON.stringify({ title: 'Pack do LAB V2', ...schema }, null, 2) + '\n');
console.log('packs/pack.schema.json atualizado');
