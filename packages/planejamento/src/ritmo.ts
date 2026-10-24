/* Esperado até hoje, acumulado, ritmo, contingência, plano do dia e Fechamento do dia. Tudo no servidor. */
export interface Realizado { pessoaId: string | null; indicador: string; dia: string; quantidade: number }
export type StatusRitmo = 'no_ritmo' | 'atencao' | 'atras' | null;

export const LIMITE_NO_RITMO = 1, LIMITE_ATENCAO = 0.85;

/* meta inteira do k-ésimo dia útil (0-based) de um ciclo com du dias úteis: floor(T(k+1)/du) − floor(Tk/du).
   As parcelas somam exatamente T e nunca diferem em mais de 1 (22 em 5 dias = 4, 4, 5, 4, 5; "ceil" daria 5 todo dia e 25 no ciclo). */
export function metaDiaInteira(T: number, k: number, du: number): number {
  T = Math.round(Number(T) || 0);
  if (!(du > 0) || k < 0 || k >= du) return 0;
  return Math.floor((T * (k + 1)) / du) - Math.floor((T * k) / du);
}

/* linear pelos dias úteis: meta × (dias úteis até hoje, inclusive ÷ dias úteis do ciclo) */
export function esperadoAteHoje(meta: number, uteisDoCiclo: string[], hoje: string): number {
  if (!uteisDoCiclo.length) return 0;
  return meta * (uteisDoCiclo.filter(d => d <= hoje).length / uteisDoCiclo.length);
}

export function statusDoRitmo(realizado: number, esperado: number): StatusRitmo {
  if (!(esperado > 0)) return null;
  const r = realizado / esperado;
  return r >= LIMITE_NO_RITMO ? 'no_ritmo' : r >= LIMITE_ATENCAO ? 'atencao' : 'atras';
}

export const acumulado = (rs: Realizado[], f: { pessoaId: string | null; indicador: string }, ate: string, de?: string) =>
  rs.filter(r => r.pessoaId === f.pessoaId && r.indicador === f.indicador && r.dia <= ate && (!de || r.dia >= de)).reduce((s, r) => s + r.quantidade, 0);

export interface Contingencia { falta: number; diasRestantes: number; necessarioPorDia: number | null; fatorSobreMetaDiaria: number | null; viavel: boolean | null }

/* quanto precisa por dia, a partir de hoje, para ainda bater a meta; "inviável" passando de 1,5× a meta diária */
export function contingencia(meta: number, realizadoAntesDeHoje: number, uteisDoCiclo: string[], hoje: string): Contingencia {
  const restantes = uteisDoCiclo.filter(d => d >= hoje).length;
  const falta = Math.max(meta - realizadoAntesDeHoje, 0);
  const base = uteisDoCiclo.length ? meta / uteisDoCiclo.length : 0;
  const necessario = restantes ? Math.ceil(falta / restantes) : null;
  const fator = necessario != null && base > 0 ? necessario / base : null;
  return { falta, diasRestantes: restantes, necessarioPorDia: necessario, fatorSobreMetaDiaria: fator, viavel: fator == null ? null : fator <= 1.5 };
}

export interface MetaVigente { pessoaId: string | null; indicador: string; valor: number }
export interface LinhaFechamento {
  pessoaId: string | null; indicador: string; metaDoCiclo: number; metaDoDia: number; realizadoNoDia: number;
  realizadoNoCiclo: number; esperadoAteHoje: number; status: StatusRitmo; planoAmanha: number | null;
}

export function fechamentoDoDia(args: { dia: string; ciclo: { inicio: string; fim: string }; uteis: string[]; metas: MetaVigente[]; realizados: Realizado[] }): LinhaFechamento[] {
  const { dia, ciclo, uteis, realizados } = args;
  const amanha = uteis.find(d => d > dia);
  return args.metas.map(m => {
    const chave = { pessoaId: m.pessoaId, indicador: m.indicador };
    const noCiclo = acumulado(realizados, chave, dia, ciclo.inicio);
    const esperado = esperadoAteHoje(m.valor, uteis, dia);
    return {
      ...chave, metaDoCiclo: m.valor, metaDoDia: metaDiaInteira(m.valor, uteis.indexOf(dia), uteis.length),
      realizadoNoDia: realizados.filter(r => r.pessoaId === m.pessoaId && r.indicador === m.indicador && r.dia === dia).reduce((s, r) => s + r.quantidade, 0),
      realizadoNoCiclo: noCiclo, esperadoAteHoje: Math.round(esperado * 100) / 100, status: statusDoRitmo(noCiclo, esperado),
      planoAmanha: amanha ? contingencia(m.valor, noCiclo, uteis, amanha).necessarioPorDia : null,
    };
  });
}
