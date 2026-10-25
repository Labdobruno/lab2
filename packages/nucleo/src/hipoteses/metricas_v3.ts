/* Catálogo das métricas que as CONDIÇÕES ESTRUTURADAS das hipóteses (motor v3) podem medir numa janela [a, b).
   Cada métrica é um contrato: unidade, se é aditiva (soma de fluxo: a linha de base de 90 dias é reduzida à janela antes de comparar),
   se é de coorte (a janela atual termina 30 dias antes de agora: coorte imatura não entra na taxa), se é foto (só existe hoje: sem linha de base),
   se "menor é melhor" e qual fonte a sustenta. O que a operação não tem fica "ausente" e a hipótese diz o que falta, nunca inventa.
   Nas fórmulas de impacto, cada métrica aparece como `id` (valor na janela), `id_base` (na linha de base) e `id_n` (amostra). */
export interface MetricaV3 {
  nome: string; unidade: 'R$' | '%' | 'n' | 'dias';
  base: 'competencia' | 'coorte' | 'foto';
  aditiva?: boolean; coorte?: boolean; foto?: boolean; menorMelhor?: boolean;
  fonte: 'negocios' | 'transicoes' | 'atividades' | 'economia' | 'investimento' | 'pipeline' | 'retencao' | 'pack';
  descricao: string;
}

export const METRICAS_V3: Record<string, MetricaV3> = {
  /* volumes do funil (coorte: negócios novos criados na janela que alcançaram a etapa) */
  leads: { nome: 'Leads', unidade: 'n', base: 'competencia', aditiva: true, fonte: 'negocios', descricao: 'negócios novos criados na janela' },
  contatos: { nome: 'Contatos', unidade: 'n', base: 'competencia', aditiva: true, fonte: 'atividades', descricao: 'contatos efetivos registrados na janela' },
  tentativas: { nome: 'Tentativas de contato', unidade: 'n', base: 'competencia', aditiva: true, fonte: 'atividades', descricao: 'tentativas registradas na janela' },
  agendadas: { nome: 'Reuniões agendadas', unidade: 'n', base: 'competencia', aditiva: true, fonte: 'transicoes', descricao: 'negócios que entraram em reunião agendada na janela' },
  realizadas: { nome: 'Reuniões realizadas', unidade: 'n', base: 'competencia', aditiva: true, fonte: 'transicoes', descricao: 'negócios que entraram em reunião realizada na janela' },
  oport: { nome: 'Oportunidades', unidade: 'n', base: 'competencia', aditiva: true, fonte: 'transicoes', descricao: 'negócios que viraram oportunidade na janela' },
  propostas: { nome: 'Propostas', unidade: 'n', base: 'competencia', aditiva: true, fonte: 'transicoes', descricao: 'negócios que receberam proposta na janela' },
  vendas: { nome: 'Vendas', unidade: 'n', base: 'competencia', aditiva: true, fonte: 'negocios', descricao: 'vendas novas fechadas na janela' },
  perdidos: { nome: 'Perdidos', unidade: 'n', base: 'competencia', aditiva: true, menorMelhor: true, fonte: 'negocios', descricao: 'negócios novos perdidos na janela' },
  perdas_preco: { nome: 'Perdas por preço', unidade: 'n', base: 'competencia', aditiva: true, menorMelhor: true, fonte: 'negocios', descricao: 'perdidos com motivo do grupo preço' },
  receita: { nome: 'Receita', unidade: 'R$', base: 'competencia', aditiva: true, fonte: 'negocios', descricao: 'valor fechado das vendas da janela' },
  ticket: { nome: 'Ticket médio', unidade: 'R$', base: 'competencia', fonte: 'negocios', descricao: 'receita ÷ vendas da janela' },
  ciclo_venda: { nome: 'Ciclo de venda', unidade: 'dias', base: 'competencia', menorMelhor: true, fonte: 'negocios', descricao: 'dias da criação ao ganho, média das vendas da janela' },
  /* taxas de coorte: negócios criados na janela (que termina 30 dias antes de agora) */
  tx_agenda: { nome: 'Taxa de agendamento', unidade: '%', base: 'coorte', coorte: true, fonte: 'negocios', descricao: 'da coorte, quantos chegaram a reunião agendada' },
  tx_compar: { nome: 'Comparecimento', unidade: '%', base: 'coorte', coorte: true, fonte: 'negocios', descricao: 'dos que agendaram, quantos realizaram a reunião' },
  tx_oport: { nome: 'Qualificação', unidade: '%', base: 'coorte', coorte: true, fonte: 'negocios', descricao: 'dos que realizaram a reunião, quantos viraram oportunidade' },
  tx_prop: { nome: 'Oportunidade → proposta', unidade: '%', base: 'coorte', coorte: true, fonte: 'negocios', descricao: 'das oportunidades, quantas receberam proposta' },
  tx_fech: { nome: 'Fechamento', unidade: '%', base: 'coorte', coorte: true, fonte: 'negocios', descricao: 'das oportunidades, quantas viraram venda' },
  tx_lead_venda: { nome: 'Conversão lead → venda', unidade: '%', base: 'coorte', coorte: true, fonte: 'negocios', descricao: 'da coorte, quantos viraram venda' },
  tx_ganho: { nome: 'Taxa de ganho', unidade: '%', base: 'competencia', fonte: 'negocios', descricao: 'ganhos ÷ (ganhos + perdidos) fechados na janela' },
  /* economia da venda (vendas fechadas na janela com preço registrado) */
  desconto_medio: { nome: 'Desconto médio', unidade: '%', base: 'competencia', menorMelhor: true, fonte: 'economia', descricao: 'Σ (preço de referência − fechado) ÷ Σ preço de referência' },
  margem_contrib: { nome: 'Margem de contribuição', unidade: '%', base: 'competencia', fonte: 'economia', descricao: 'Σ MC ÷ Σ receita líquida das vendas com economia' },
  custo_var_venda: { nome: 'Custo variável da venda', unidade: '%', base: 'competencia', menorMelhor: true, fonte: 'economia', descricao: 'Σ custos ÷ Σ receita líquida' },
  comissao_pct: { nome: 'Comissão', unidade: '%', base: 'competencia', menorMelhor: true, fonte: 'economia', descricao: 'Σ comissão ÷ Σ receita bruta' },
  /* aquisição */
  investimento: { nome: 'Investimento em mídia', unidade: 'R$', base: 'competencia', aditiva: true, fonte: 'investimento', descricao: 'investimento lançado por canal nos meses da janela' },
  cpl: { nome: 'CPL', unidade: 'R$', base: 'competencia', menorMelhor: true, fonte: 'investimento', descricao: 'investimento ÷ leads' },
  cac: { nome: 'CAC', unidade: 'R$', base: 'competencia', menorMelhor: true, fonte: 'investimento', descricao: 'investimento ÷ vendas' },
  /* pipeline (foto de hoje) */
  negocios_parados: { nome: 'Negócios parados', unidade: 'n', base: 'foto', foto: true, menorMelhor: true, fonte: 'pipeline', descricao: 'abertos há mais tempo na etapa do que o prazo' },
  valor_parado: { nome: 'Valor parado', unidade: 'R$', base: 'foto', foto: true, menorMelhor: true, fonte: 'pipeline', descricao: 'valor estimado dos negócios parados' },
  valor_aberto: { nome: 'Valor em aberto', unidade: 'R$', base: 'foto', foto: true, fonte: 'pipeline', descricao: 'valor estimado dos negócios abertos' },
  /* retenção */
  churn_receita: { nome: 'Churn de receita', unidade: '%', base: 'competencia', menorMelhor: true, fonte: 'retencao', descricao: 'MRR cancelado ÷ MRR inicial na janela' },
  mrr: { nome: 'MRR', unidade: 'R$', base: 'foto', foto: true, fonte: 'retencao', descricao: 'receita recorrente mensal hoje' },
  /* métricas que dependem de fontes que a operação pode não ter (operação, financeiro de caixa): ficam ausentes até o pack as ligar */
  cancelamentos: { nome: 'Cancelamentos pós-venda', unidade: 'n', base: 'competencia', aditiva: true, menorMelhor: true, fonte: 'pack', descricao: 'vendas canceladas depois do ganho (precisa de fonte)' },
  backlog: { nome: 'Backlog de entrega', unidade: 'n', base: 'foto', foto: true, menorMelhor: true, fonte: 'pack', descricao: 'vendas aguardando entrega (precisa de fonte)' },
  recebiveis: { nome: 'Recebíveis', unidade: 'R$', base: 'foto', foto: true, fonte: 'pack', descricao: 'contas a receber em aberto (precisa de fonte)' },
  prazo_receb: { nome: 'Prazo médio de recebimento', unidade: 'dias', base: 'competencia', menorMelhor: true, fonte: 'pack', descricao: 'dias médios até receber (precisa de fonte)' },
  caixa_oper: { nome: 'Caixa operacional', unidade: 'R$', base: 'competencia', aditiva: true, fonte: 'pack', descricao: 'recebido − pago na janela (precisa de fonte)' },
  exposicao: { nome: 'Exposição de caixa', unidade: 'R$', base: 'foto', foto: true, menorMelhor: true, fonte: 'pack', descricao: 'Σ (pago − recebido) dos projetos deficitários (precisa de fonte)' },
};
export const ADITIVAS_V3 = Object.keys(METRICAS_V3).filter(k => METRICAS_V3[k]!.aditiva);
export const COORTE_V3 = Object.keys(METRICAS_V3).filter(k => METRICAS_V3[k]!.coorte);
export const FOTO_V3 = Object.keys(METRICAS_V3).filter(k => METRICAS_V3[k]!.foto);
export const MENOR_MELHOR_V3 = Object.keys(METRICAS_V3).filter(k => METRICAS_V3[k]!.menorMelhor);
/* variáveis que uma fórmula de impacto v3 pode usar: id, id_base, id_n de cada métrica (mais as do contexto simples) */
export const variavelV3Valida = (v: string, extras: Record<string, unknown> = {}) => {
  if (v in extras) return true;
  const m = /^(.+?)(_base|_n)?$/.exec(v); return !!m && m[1]! in METRICAS_V3;
};
