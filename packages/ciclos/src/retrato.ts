/* Assinatura do retrato: SHA-256 do JSON com chaves em ordem, para provar que o conteúdo não mudou. */
export function canonico(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonico).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().filter(k => (v as Record<string, unknown>)[k] !== undefined).map(k => `${JSON.stringify(k)}:${canonico((v as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(v) ?? 'null';
}

export async function assinar(dados: unknown): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonico(dados)));
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/* só se fecha um ciclo depois do último dia útil dele */
export function podeFechar(uteis: string[], hoje: string): { pode: boolean; motivo?: string } {
  const ultimo = uteis.at(-1);
  if (!ultimo) return { pode: false, motivo: 'o ciclo não tem dias úteis' };
  return hoje > ultimo ? { pode: true } : { pode: false, motivo: `o ciclo só pode ser fechado depois de ${ultimo}, o último dia útil dele` };
}
