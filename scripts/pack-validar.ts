/* npm run pack:validar            → confere todos os packs
   npm run pack:validar solar-b2c  → confere um e mostra o resumo do pack resolvido */
import { resolverPack } from '@lab/nucleo';
import { lerCatalogo } from './packs-catalogo.js';

const cat = lerCatalogo();
const alvo = process.argv[2];
const ids = alvo ? [alvo] : Object.keys(cat);
let falhou = false;
for (const id of ids) {
  const bruto = cat[id] as { __erroLeitura?: string } | undefined;
  if (bruto?.__erroLeitura) { console.log(`✗ ${id}\n  - ${bruto.__erroLeitura}`); falhou = true; continue; }
  const r = resolverPack(id, cat);
  console.log(`${r.ok ? '✓' : '✗'} ${id}${r.pack ? `  (${r.pack.linhagem.join(' → ')})` : ''}`);
  r.erros.forEach(e => console.log(`  erro:  ${e}`));
  r.avisos.forEach(a => console.log(`  aviso: ${a}`));
  if (!r.ok) falhou = true;
  if (alvo && r.pack) {
    const p = r.pack;
    for (const f of p.funis) console.log(`  funil ${f.chave} (${f.lado}${f.principal ? ', principal' : ''}): ${f.etapas.map(e => `${e.chave}[${e.papel}]`).join(' → ')}`);
    console.log(`  atividades: ${p.atividades.map(a => a.chave + (a.metaDiaria ? '*' : '')).join(', ')}   (* = meta diária)`);
    console.log(`  canais: ${p.canais.map(c => c.chave).join(', ')}`);
    console.log(`  motivos de perda: ${p.motivosPerda.map(m => m.chave).join(', ')}`);
    console.log(`  precificação: ${p.precificacao.linhas.map(l => l.chave).join(', ')} · condições: ${p.precificacao.condicoes.map(c => c.chave).join(', ')}`);
  }
}
process.exit(falhou ? 1 : 0);
