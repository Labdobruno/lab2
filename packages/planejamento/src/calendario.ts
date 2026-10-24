/* Ciclo e calendário. Datas são texto AAAA-MM-DD; a conta é feita em UTC para não depender do fuso da máquina. */
export interface CalendarioOperacao { feriados: 'BR' | 'nenhum' | string[]; diasUteis: number[]; inicioCicloDia: number }

const t = (d: string) => Date.parse(`${d}T00:00:00Z`);
const f = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const somarDias = (d: string, n: number) => f(t(d) + n * 86_400_000);
export const diaDaSemana = (d: string) => new Date(t(d)).getUTCDay();   // 0 = domingo

function pascoa(ano: number): string {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4;
  const g = Math.floor((8 * b + 13) / 25), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/* nacionais fixos + Carnaval, Sexta-feira Santa e Corpus Christi */
export function feriadosBR(ano: number): string[] {
  const fixos = ['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', ...(ano >= 2024 ? ['11-20'] : []), '12-25'].map(x => `${ano}-${x}`);
  const p = pascoa(ano);
  return [...fixos, somarDias(p, -48), somarDias(p, -47), somarDias(p, -2), somarDias(p, 60)].sort();
}

export function ehDiaUtil(d: string, cal: CalendarioOperacao): boolean {
  if (!cal.diasUteis.includes(diaDaSemana(d))) return false;
  const lista = cal.feriados === 'BR' ? feriadosBR(Number(d.slice(0, 4))) : cal.feriados === 'nenhum' ? [] : cal.feriados;
  return !lista.includes(d);
}

/* dias úteis em [de, ate) */
export function diasUteis(de: string, ate: string, cal: CalendarioOperacao): string[] {
  const r: string[] = [];
  for (let d = de; d < ate; d = somarDias(d, 1)) if (ehDiaUtil(d, cal)) r.push(d);
  return r;
}

/* ciclo mensal que contém a data: [inicio, fim) */
export function cicloDe(data: string, inicioCicloDia = 1): { inicio: string; fim: string } {
  const dia = Math.min(Math.max(inicioCicloDia, 1), 28);
  let ano = Number(data.slice(0, 4)), mes = Number(data.slice(5, 7));
  if (Number(data.slice(8, 10)) < dia) { mes -= 1; if (mes === 0) { mes = 12; ano -= 1; } }
  const mk = (a: number, m: number) => `${a}-${String(m).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  return { inicio: mk(ano, mes), fim: mes === 12 ? mk(ano + 1, 1) : mk(ano, mes + 1) };
}
