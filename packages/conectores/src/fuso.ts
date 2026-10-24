/* Datas sem fuso (planilhas: "01/07/2026", "01/07/2026 14:30") valem no fuso da operação, não em UTC.
   Sem isso, meia-noite de 01/07 em UTC vira 30/06 às 21h em São Paulo e o negócio cai no mês errado. */

const CAMPOS_DE_INSTANTE = ['criadoEm', 'fechadoEm', 'etapaDesde', 'atualizadoEm', 'em'] as const;
const SO_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;
const SEM_FUSO = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;

/* quantos ms o fuso está à frente de UTC naquele instante */
function deslocamento(fuso: string, instante: number): number {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: fuso, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' })
    .formatToParts(new Date(instante)).filter(x => x.type !== 'literal').map(x => [x.type, Number(x.value)]));
  return Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!) - Math.floor(instante / 1000) * 1000;
}

/* "2026-07-01" ou "2026-07-01T14:30:00" (sem Z/offset) no fuso → ISO em UTC; qualquer outro texto passa como veio */
export function noFuso(texto: string, fuso: string): string {
  const d = SO_DATA.exec(texto), h = SEM_FUSO.exec(texto);
  const m = d ?? h;
  if (!m) return texto;
  const [a, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const [hh, mi, ss] = h ? [Number(h[4]), Number(h[5]), Number(h[6] ?? 0)] : [0, 0, 0];
  const local = Date.UTC(a, mes - 1, dia, hh, mi, ss);
  let t = local - deslocamento(fuso, local);
  t = local - deslocamento(fuso, t);                      // segunda passada: vira o dia do horário de verão
  return new Date(t).toISOString();
}

export function localizarDatas<T extends object>(comando: T, fuso: string): T {
  const out: Record<string, unknown> = { ...(comando as Record<string, unknown>) };
  for (const k of CAMPOS_DE_INSTANTE) if (typeof out[k] === 'string') out[k] = noFuso(out[k] as string, fuso);
  return out as T;
}
