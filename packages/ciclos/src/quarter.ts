/* Quarter = 3 ciclos seguidos, alinhados ao início do ano da operação (calendário do pack). */
import { cicloDe } from '@lab/planejamento';

export interface Ciclo { inicio: string; fim: string }

const mk = (ano: number, mes: number, dia: number) => {
  const a = ano + Math.floor((mes - 1) / 12), m = ((((mes - 1) % 12) + 12) % 12) + 1;
  return `${a}-${String(m).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
};

export function quarterDe(data: string, mesInicioAno = 1, inicioCicloDia = 1): { inicio: string; fim: string; ciclos: Ciclo[] } {
  const dia = Math.min(Math.max(inicioCicloDia, 1), 28);
  const c = cicloDe(data, dia);
  const ano = Number(c.inicio.slice(0, 4)), mes = Number(c.inicio.slice(5, 7));
  const desvio = (((mes - mesInicioAno) % 12) + 12) % 12;
  const mesInicio = mes - (desvio % 3);
  const ciclos = [0, 1, 2].map(i => ({ inicio: mk(ano, mesInicio + i, dia), fim: mk(ano, mesInicio + i + 1, dia) }));
  return { inicio: ciclos[0]!.inicio, fim: ciclos[2]!.fim, ciclos };
}

export const quarterAnterior = (inicio: string, mesInicioAno = 1, inicioCicloDia = 1) => {
  const ano = Number(inicio.slice(0, 4)), mes = Number(inicio.slice(5, 7));
  return quarterDe(mk(ano, mes - 3, Math.min(Math.max(inicioCicloDia, 1), 28)), mesInicioAno, inicioCicloDia);
};

export const ROTULO_QUARTER = (inicio: string, mesInicioAno = 1) => {
  const ano = Number(inicio.slice(0, 4)), mes = Number(inicio.slice(5, 7));
  const desvio = (((mes - mesInicioAno) % 12) + 12) % 12;
  return `Q${Math.floor(desvio / 3) + 1} ${ano}`;
};

export const PASSOS = [
  { n: 1, chave: 'diagnostico', nome: 'Diagnóstico', pergunta: 'Como foi o quarter anterior?' },
  { n: 2, chave: 'meta', nome: 'Meta', pergunta: 'Quanto de receita este quarter precisa gerar?' },
  { n: 3, chave: 'cenarios', nome: 'Cenários', pergunta: 'Qual cenário você assume: conservador, base ou otimista?' },
  { n: 4, chave: 'buildup', nome: 'Esforço necessário', pergunta: 'O esforço que isso exige cabe no time?' },
  { n: 5, chave: 'programa', nome: 'Programa de ciclos', pergunta: 'Como a meta se divide nos 3 ciclos?' },
  { n: 6, chave: 'compromisso', nome: 'Compromisso', pergunta: 'Travar o plano e gerar as metas de cada ciclo?' },
] as const;
