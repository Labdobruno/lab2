/* Catálogo de conectores disponíveis. Conector novo = um arquivo em fontes/ + uma linha aqui. */
import { conectorAmicta } from './fontes/amicta.js';
import { conectorCanonico } from './fontes/canonico.js';
import { conectorPlanilha } from './fontes/planilha.js';
import type { Conector } from './tipos.js';

export const CONECTORES: Record<string, Conector<any>> = {
  [conectorCanonico.tipo]: conectorCanonico,
  [conectorPlanilha.tipo]: conectorPlanilha,
  [conectorAmicta.tipo]: conectorAmicta,
};

export function conectorDoTipo(tipo: string): Conector<any> {
  const c = CONECTORES[tipo];
  if (!c) throw new Error(`conector desconhecido: "${tipo}" (disponíveis: ${Object.keys(CONECTORES).join(', ')})`);
  return c;
}
