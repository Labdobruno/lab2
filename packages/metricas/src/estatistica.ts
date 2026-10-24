/* Estatística básica das métricas. Ausência de dado é null, nunca zero. */

export const AMOSTRA_MINIMA = 30;

export const razao = (a: number, b: number): number | null => (b > 0 ? a / b : null);

/* Intervalo de Wilson (95% por padrão) para uma proporção: confiável mesmo com amostra pequena. */
export function wilson(sucessos: number, total: number, z = 1.96): { baixo: number; alto: number } | null {
  if (total <= 0) return null;
  const p = sucessos / total, z2 = z * z;
  const centro = (p + z2 / (2 * total)) / (1 + z2 / total);
  const margem = (z * Math.sqrt((p * (1 - p)) / total + z2 / (4 * total * total))) / (1 + z2 / total);
  return { baixo: Math.max(0, centro - margem), alto: Math.min(1, centro + margem) };
}

export interface Proporcao { sucessos: number; total: number; taxa: number | null; ic: { baixo: number; alto: number } | null; amostraSuficiente: boolean }

export function proporcao(sucessos: number, total: number, minimo = AMOSTRA_MINIMA): Proporcao {
  return { sucessos, total, taxa: razao(sucessos, total), ic: wilson(sucessos, total), amostraSuficiente: total >= minimo };
}

export const soma = (xs: Array<number | null | undefined>) => xs.reduce<number>((s, x) => s + (x ?? 0), 0);
export const arredondar = (n: number | null, casas = 2): number | null => (n == null ? null : Math.round(n * 10 ** casas) / 10 ** casas);
