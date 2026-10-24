/* Semana: o relatório da semana passada (o que deu certo e errado, por que, o que testar) e a projeção desta semana (onde vai fechar,
   bate a meta da semana, o que precisa acontecer até domingo). Regras puras portadas do LAB V1 (lab_semana.js, lab_projsemana.js). */
export const VERSAO_SEMANA = '2026-10-29.1';
export type Unidade = 'n' | 'R$' | '%' | 'h' | 'd';
export interface DefIndicador { k: string; nome: string; un: Unidade; aditiva: boolean; menorMelhor?: boolean }

/* variação entre o valor da semana e a base: em pontos percentuais para taxas, relativa (%) para o resto */
export function variacao(atual: number, base: number, un: Unidade): { d: number; pp: boolean } | null {
  if (un === '%') return { d: (atual - base) * 100, pp: true };
  if (!(base !== 0) || !isFinite(base)) return null;
  return { d: (atual / base - 1) * 100, pp: false };
}
export const variacaoTxt = (V: { d: number; pp: boolean } | null | undefined) => (V ? (V.d > 0 ? '+' : '') + (Math.round(V.d * 10) / 10).toLocaleString('pt-BR') + (V.pp ? ' p.p.' : '%') : '');

/* julgamento de um indicador da semana: meta (quando há) pesa primeiro; sem meta, a variação contra a média das 4 semanas anteriores */
export interface Julgamento { st: 'bom' | 'ruim' | 'neutro' | 'sem'; motivo: string; at?: number; V?: { d: number; pp: boolean } | null; meta?: number | null }
export function julgarSemana(o: { atual: number | null; base: number | null; meta?: number | null; un: Unidade; menorMelhor?: boolean; aditiva: boolean; n?: number | null; minN?: number }): Julgamento {
  const { atual, base, meta, un, menorMelhor, aditiva, n, minN } = o;
  if (atual == null || !isFinite(atual)) return { st: 'sem', motivo: 'sem dado na semana' };
  if (meta != null && meta > 0 && !menorMelhor) { const at = atual / meta; if (at >= 1) return { st: 'bom', at, motivo: 'bateu a meta da semana' }; if (at < 0.85) return { st: 'ruim', at, motivo: 'abaixo de 85% da meta da semana' }; }
  if (base == null || !isFinite(base)) return { st: 'neutro', motivo: 'sem base de comparação' };
  if (aditiva && Math.max(Math.abs(atual), Math.abs(base)) < 3 && un !== 'R$') return { st: 'neutro', motivo: 'volume pequeno para concluir' };
  if (un === '%' && n != null && n < (minN ?? 5)) return { st: 'neutro', motivo: 'amostra pequena (n=' + n + ')' };
  const V = variacao(atual, base, un); if (!V) return { st: 'neutro', motivo: 'variação indefinida' };
  const lim = un === '%' ? 5 : un === 'h' || un === 'd' ? 20 : 15;
  if (Math.abs(V.d) < lim) return { st: 'neutro', V, motivo: 'dentro do normal (±' + lim + (un === '%' ? ' p.p.' : '%') + ')' };
  const melhor = V.d > 0 !== !!menorMelhor; return { st: melhor ? 'bom' : 'ruim', V, motivo: (melhor ? 'melhor' : 'pior') + ' que a média das 4 semanas anteriores' };
}

/* elo anterior no funil (o que costuma explicar o indicador) */
export const ELO: Record<string, string[]> = { receita: ['vendas', 'ticket'], vendas: ['oportunidades', 'f:vop'], oportunidades: ['reuniao_realizada', 'f:opr'], reuniao_realizada: ['agendamento'], agendamento: ['leads', 'contato', 'f:agl'], 'f:agl': ['contato', 'tentativa'], contato: ['tentativa'], ticket: ['vendas'], 'f:vop': ['proposta_enviada'] };
/* taxas de FLUXO da semana (não coorte: a coorte de uma semana ainda não amadureceu) */
export const FLUXO: Record<string, { nome: string; a: string; b: string }> = { 'f:agl': { nome: 'Agendadas por lead (na semana)', a: 'agendamento', b: 'leads' }, 'f:opr': { nome: 'Oportunidades por reunião realizada', a: 'oportunidades', b: 'reuniao_realizada' }, 'f:vop': { nome: 'Vendas por oportunidade', a: 'vendas', b: 'oportunidades' } };
/* roteiro de hipóteses de solução por indicador que piorou: ação, por que pode funcionar, como testar e como saber se funcionou (texto fixo, como na V1) */
export const ROTEIRO: Record<string, [string, string, string, string]> = {
  leads: ['Reforçar os canais que caíram (verba, criativo, frequência) e reativar indicações da base', 'menos entrada derruba tudo o que vem depois no funil, com atraso', 'compare a origem que mais caiu com a semana anterior antes de mexer nas outras', 'leads da origem voltam à média das 4 semanas em 1 a 2 semanas'],
  tentativa: ['Blocos fixos de prospecção na agenda (ex.: 2 × 90 min por dia) e cadência revisada', 'tentativa é o insumo do contato; costuma cair por agenda tomada por outras tarefas', 'meça tentativas por dia útil por pessoa nos próximos 5 dias', 'tentativas/dia voltam à média e contatos acompanham'],
  contato: ['Horários de maior atendimento e segundo canal (mensagem + ligação) para quem não atende', 'contato é o insumo do agendamento; cai quando a tentativa não encontra o lead', 'meça contatos por tentativa por pessoa nos próximos 5 dias', 'contatos/dia voltam à média e agendadas acompanham'],
  agendamento: ['Rever o roteiro de qualificação e a oferta de horário (duas opções fechadas)', 'se o volume de lead e de contato se manteve, o problema está na conversa', 'ouça 5 ligações sem agendamento e marque a objeção mais comum', 'agendadas por lead volta à média em 1 semana'],
  'f:agl': ['Roteiro de qualificação antes da reunião e oferta de horário mais direta', 'mesma entrada, menos reuniões: a conversa não está convertendo', 'teste o roteiro novo com metade do time por uma semana', 'agendadas por lead do grupo do teste acima do grupo de controle'],
  reuniao_realizada: ['Encaixe de reuniões no mesmo dia/dia seguinte do agendamento e confirmação ativa', 'reunião marcada longe tem mais desistência', 'veja quantos dias entre agendar e a reunião nas que caíram', 'realizadas acompanham as agendadas'],
  'f:opr': ['Diagnóstico antes da reunião para chegar com a proposta certa', 'reunião sem qualificação não vira oportunidade', 'marque nas reuniões da semana o motivo de não virar oportunidade', 'oportunidades por reunião voltam à média'],
  oportunidades: ['Revisar as reuniões da semana que não avançaram e agendar o próximo passo de cada uma', 'oportunidade represada em reunião realizada', 'liste as reuniões realizadas sem próximo passo marcado', 'oportunidades da semana seguinte acima da média'],
  proposta_enviada: ['Prazo máximo de 48 h entre a reunião e a proposta pronta', 'proposta atrasada esfria o cliente', 'meça o tempo entre a oportunidade e a proposta pronta', 'propostas da semana acompanham as oportunidades'],
  'f:vop': ['Follow-up estruturado das propostas (D+1, D+3, D+7) e treino de fechamento', 'mesma quantidade de oportunidades, menos vendas: o problema é o fechamento', 'separe as oportunidades da semana por motivo de perda', 'vendas por oportunidade volta à média em 2 semanas'],
  vendas: ['Força-tarefa nas oportunidades quentes (negociação e proposta enviada) com condição de fechamento até o fim da semana', 'as vendas da próxima semana já estão no funil hoje', 'liste as 10 oportunidades mais avançadas e o próximo passo de cada', 'vendas da semana seguinte acima da média das 4 semanas'],
  receita: ['Ver se a queda é volume (menos vendas) ou ticket (vendas menores) antes de agir', 'remédios diferentes: volume pede funil, ticket pede oferta e desconto', 'use a decomposição volume × ticket', 'receita volta à média; o componente atacado melhora primeiro'],
  ticket: ['Teto de desconto por faixa de ticket e oferta de upgrade', 'ticket cai com desconto ou mix de vendas menores', 'compare o desconto médio e o mix da semana com as anteriores', 'ticket volta à média sem queda de conversão'],
  perdidos: ['Ler os motivos de perda da semana e atacar o mais frequente', 'perda concentrada num motivo costuma ter uma causa só', 'agrupe os perdidos por motivo e por vendedor', 'perdidos voltam à média; o motivo atacado some do topo'],
};
/* decomposição da receita: volume × ticket (mesma conta de labWaterfallReceita) */
export function cascataReceita(vendasBase: number, ticketBase: number, vendas: number, ticket: number) {
  return { volume: (vendas - vendasBase) * ticketBase, ticket: (ticket - ticketBase) * vendas, total: vendas * ticket - vendasBase * ticketBase };
}

/* ---------- projeção da semana ---------- */
export const PESO_HIST = 5;   // o histórico pesa como uma semana de dias úteis
/* ritmo diário projetado: o desta semana encolhido para o histórico das 4 semanas anteriores */
export function ritmoSemana(feito: number, decorridos: number, ritmoHist: number | null, pesoHist = PESO_HIST): number | null {
  const h = ritmoHist == null || !isFinite(ritmoHist) ? null : ritmoHist;
  if (!(decorridos > 0)) return h; if (h == null) return feito / decorridos; return (feito + h * pesoHist) / (decorridos + pesoHist);
}
export type SituacaoSemana = 'batida' | 'bate' | 'risco' | 'nao' | 'sem';
export const NOME_SITUACAO_SEMANA: Record<SituacaoSemana, [string, string]> = { batida: ['Meta batida', 'bom'], bate: ['Vai bater', 'bom'], risco: ['Em risco', 'risco'], nao: ['Não bate no ritmo atual', 'ruim'], sem: ['Sem meta da semana', 'neutro'] };
/* projeção e situação contra a meta; a faixa usa o pior e o melhor ritmo semanal das 4 semanas anteriores, com o mesmo encolhimento */
export function projetarSemana(o: { feito: number; decorridos: number; restantes: number; ritmoHist: number | null; ritmos?: Array<number | null>; meta?: number | null }) {
  const feito = o.feito || 0, r = ritmoSemana(feito, o.decorridos, o.ritmoHist), proj = r == null ? null : feito + r * Math.max(0, o.restantes);
  const rs = (o.ritmos ?? []).filter((x): x is number => x != null && isFinite(x)), faixa = (q: number) => feito + ritmoSemana(feito, o.decorridos, q)! * Math.max(0, o.restantes);
  const lo = rs.length ? faixa(Math.min(...rs)) : null, hi = rs.length ? faixa(Math.max(...rs)) : null;
  let st: SituacaoSemana = 'sem', at: number | null = null, precisa: number | null = null;
  if (o.meta != null && o.meta > 0 && proj != null) { at = proj / o.meta; st = feito >= o.meta ? 'batida' : at >= 1 ? 'bate' : at >= 0.85 ? 'risco' : 'nao'; precisa = o.restantes > 0 ? Math.max(0, o.meta - feito) / o.restantes : null; }
  return { ritmo: r, proj, lo, hi, st, at, precisa };
}
/* fração do dia útil já passada (8h às 18h, linear) */
export function fracaoDoDia(h: number, m = 0): number { const t = h + m / 60; return Math.max(0, Math.min(1, (t - 8) / 10)); }
/* meta da semana: meta do ciclo × dias úteis da semana ÷ dias úteis do ciclo (da vigência) */
export function metaDaSemana(metaCiclo: number | null, duCiclo: number, duSemana: number): number | null {
  if (metaCiclo == null || !(metaCiclo > 0) || !duCiclo || !duSemana) return null; return (metaCiclo * duSemana) / duCiclo;
}
