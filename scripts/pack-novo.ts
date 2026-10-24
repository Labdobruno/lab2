/* npm run pack:novo licitacao-b2b              → cria packs/licitacao-b2b.json herdando de "base"
   npm run pack:novo licitacao-b2b -- --de solar-b2c  → herda de outro pack */
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { lerCatalogo, PASTA_PACKS } from './packs-catalogo.js';

const args = process.argv.slice(2);
const id = args.find(a => !a.startsWith('--'));
const i = args.indexOf('--de');
const herda = i >= 0 ? args[i + 1] : 'base';
if (!id || !/^[a-z0-9][a-z0-9_-]*$/.test(id)) { console.log('uso: npm run pack:novo <id-do-pack> [-- --de <pack-pai>]   (id em minúsculas, ex.: licitacao-b2b)'); process.exit(1); }
const destino = join(PASTA_PACKS, `${id}.json`);
if (existsSync(destino)) { console.log(`packs/${id}.json já existe`); process.exit(1); }
if (!herda || !lerCatalogo()[herda]) { console.log(`o pack-pai "${herda}" não existe`); process.exit(1); }

const modelo = {
  $schema: './pack.schema.json',
  id, nome: id, versao: '0.1.0', herda,
  descricao: 'Descreva o modelo de negócio em uma frase.',
  textos: {},
  funis: [],
  atividades: [],
  canais: [],
  motivosPerda: [],
};
writeFileSync(destino, JSON.stringify(modelo, null, 2) + '\n');
console.log(`criado packs/${id}.json (herda de "${herda}").
Próximos passos:
  1. Declare só o que muda em relação a "${herda}" (veja docs/packs.md).
  2. npm run pack:validar ${id}`);
