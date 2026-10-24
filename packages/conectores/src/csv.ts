/* Leitor de CSV tolerante ao que o Excel e o Google Planilhas exportam:
   separador ";" ou "," (detectado pelo cabeçalho), aspas com "" escapado, quebra de linha dentro de aspas,
   CRLF e BOM. */
export function lerCSV(texto: string): { cabecalho: string[]; linhas: string[][] } {
  const t = texto.replace(/^﻿/, '');
  const primeira = t.slice(0, t.search(/\r?\n/) >= 0 ? t.search(/\r?\n/) : t.length);
  const contar = (s: string, c: string) => s.split(c).length - 1;
  const sep = contar(primeira, ';') > contar(primeira, ',') ? ';' : contar(primeira, '\t') > contar(primeira, ',') ? '\t' : ',';

  const linhas: string[][] = [];
  let campo = '', linha: string[] = [], aspas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i]!;
    if (aspas) {
      if (c === '"') {
        if (t[i + 1] === '"') { campo += '"'; i++; } else aspas = false;
      } else campo += c;
      continue;
    }
    if (c === '"' && campo === '') { aspas = true; continue; }
    if (c === sep) { linha.push(campo); campo = ''; continue; }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      linha.push(campo); linhas.push(linha); linha = []; campo = '';
      continue;
    }
    campo += c;
  }
  if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha); }
  const naoVazias = linhas.filter(l => l.some(x => x.trim() !== ''));
  const [cabecalho = [], ...resto] = naoVazias;
  return { cabecalho: cabecalho.map(h => h.trim()), linhas: resto };
}
