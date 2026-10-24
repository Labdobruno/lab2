/* Leitura tolerante de números e datas como chegam de planilhas brasileiras. */

/* "1.234,56" · "1234.56" · "R$ 1.234" · "12%" → número (12% vira 0,12). Vazio → null. */
export function lerNumero(entrada: unknown): number | null {
  if (typeof entrada === 'number') return Number.isFinite(entrada) ? entrada : null;
  if (typeof entrada !== 'string') return null;
  let s = entrada.trim().replace(/^R\$\s*/i, '').replace(/\s/g, '');
  if (!s) return null;
  const pct = s.endsWith('%');
  if (pct) s = s.slice(0, -1);
  const virgula = s.lastIndexOf(','), ponto = s.lastIndexOf('.');
  if (virgula > ponto) s = s.replace(/\./g, '').replace(',', '.');           // 1.234,56
  else if (ponto > virgula && virgula >= 0) s = s.replace(/,/g, '');           // 1,234.56
  else if (virgula < 0 && /^\-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); // 1.234 (milhar)
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return pct ? n / 100 : n;
}

/* "15/10/2026" · "15/10/2026 14:03" · "2026-10-15" · ISO → "AAAA-MM-DD" ou ISO completo. Vazio/ruim → null. */
export function lerData(entrada: unknown): string | null {
  if (entrada instanceof Date) return Number.isNaN(entrada.getTime()) ? null : entrada.toISOString();
  if (typeof entrada !== 'string') return null;
  const s = entrada.trim();
  if (!s) return null;
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (br) {
    const [, d, m, a, h, mi, se] = br;
    const ano = a!.length === 2 ? 2000 + Number(a) : Number(a);
    const dia = `${ano}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`;
    if (!validaDia(ano, Number(m), Number(d))) return null;
    return h ? `${dia}T${h.padStart(2, '0')}:${mi}:${se ?? '00'}` : dia;
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    if (!validaDia(Number(iso[1]), Number(iso[2]), Number(iso[3])) || Number.isNaN(Date.parse(s))) return null;
    return s;
  }
  return null;
}

function validaDia(a: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(a, m, 0)).getUTCDate();
}

/* "Tráfego Pago" → "trafego_pago": chave estável a partir de um nome livre */
export function chaveDe(nome: string): string {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'sem_nome';
}
