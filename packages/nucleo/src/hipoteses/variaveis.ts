/* Variáveis que as fórmulas das hipóteses podem usar. Quem monta o contexto (packages/hipoteses) preenche todas;
   o que não puder ser calculado fica null. Um teste garante que o catálogo e o contexto andam juntos. */
export interface DefVariavel { nome: string; unidade: 'R$' | '%' | 'n' | 'meses' | 'dias'; descricao: string }

export const VARIAVEIS: Record<string, DefVariavel> = {
  /* aquisição (janela histórica da operação) */
  leads: { nome: 'Leads', unidade: 'n', descricao: 'negócios novos criados na janela' },
  vendas: { nome: 'Vendas', unidade: 'n', descricao: 'vendas novas fechadas na janela' },
  fechados: { nome: 'Negócios fechados', unidade: 'n', descricao: 'ganhos mais perdidos (novos) na janela' },
  receita: { nome: 'Receita fechada', unidade: 'R$', descricao: 'soma do valor fechado das vendas da janela' },
  ticket_medio: { nome: 'Ticket médio', unidade: 'R$', descricao: 'receita ÷ vendas' },
  taxa_ganho: { nome: 'Taxa de ganho', unidade: '%', descricao: 'ganhos ÷ (ganhos + perdidos)' },
  conv_contato: { nome: 'Conversão até contato', unidade: '%', descricao: 'da coorte, quantos chegaram a contato (ou além)' },
  conv_qualificado: { nome: 'Conversão até qualificado', unidade: '%', descricao: 'da coorte, quantos chegaram a qualificado' },
  conv_agendada: { nome: 'Conversão até reunião agendada', unidade: '%', descricao: 'da coorte, quantos agendaram' },
  conv_realizada: { nome: 'Conversão até reunião realizada', unidade: '%', descricao: 'da coorte, quantos tiveram a reunião' },
  conv_oportunidade: { nome: 'Conversão até oportunidade', unidade: '%', descricao: 'da coorte, quantos viraram oportunidade' },
  conv_proposta: { nome: 'Conversão até proposta', unidade: '%', descricao: 'da coorte, quantos receberam proposta' },
  conv_ganho: { nome: 'Conversão até ganho', unidade: '%', descricao: 'da coorte, quantos fecharam' },
  passo_agendada: { nome: 'Passo: qualificado → agendada', unidade: '%', descricao: 'quem estava no degrau anterior e passou para agendada' },
  passo_realizada: { nome: 'Passo: agendada → realizada', unidade: '%', descricao: 'comparecimento às reuniões agendadas' },
  passo_proposta: { nome: 'Passo: oportunidade → proposta', unidade: '%', descricao: 'oportunidades que chegaram à proposta' },
  passo_ganho: { nome: 'Passo: negociação → ganho', unidade: '%', descricao: 'quem estava em negociação e fechou' },
  amostra_coorte: { nome: 'Tamanho da coorte', unidade: 'n', descricao: 'negócios novos do funil principal criados na janela' },
  amostra_minima: { nome: 'Amostra mínima', unidade: 'n', descricao: 'parâmetro do pack: abaixo disso a taxa é frágil' },
  /* preço, margem e custo de aquisição */
  desconto_medio: { nome: 'Desconto médio', unidade: '%', descricao: 'desconto médio sobre o preço de referência nas vendas da janela' },
  margem_percentual: { nome: 'Margem de contribuição', unidade: '%', descricao: 'MC ÷ receita das vendas com custos informados' },
  investimento_total: { nome: 'Investimento em aquisição', unidade: 'R$', descricao: 'soma do investimento por canal na janela' },
  cac_medio: { nome: 'CAC médio', unidade: 'R$', descricao: 'investimento total ÷ vendas' },
  cpl_medio: { nome: 'CPL médio', unidade: 'R$', descricao: 'investimento total ÷ leads' },
  roi_aquisicao: { nome: 'ROI da aquisição', unidade: '%', descricao: '(receita − investimento) ÷ investimento' },
  /* pipeline e perdas */
  negocios_abertos: { nome: 'Negócios abertos', unidade: 'n', descricao: 'negócios novos em aberto hoje' },
  valor_aberto: { nome: 'Valor em aberto', unidade: 'R$', descricao: 'valor estimado dos negócios abertos' },
  negocios_parados: { nome: 'Negócios parados', unidade: 'n', descricao: 'abertos há mais tempo na etapa do que o prazo do pack' },
  valor_parado: { nome: 'Valor parado', unidade: 'R$', descricao: 'valor estimado dos negócios parados' },
  perdidos: { nome: 'Negócios perdidos', unidade: 'n', descricao: 'perdas (novos) na janela' },
  valor_perdido: { nome: 'Valor perdido', unidade: 'R$', descricao: 'valor estimado dos perdidos na janela' },
  valor_perdido_preco: { nome: 'Valor perdido por preço', unidade: 'R$', descricao: 'valor estimado dos perdidos com motivo do grupo preço' },
  /* retenção */
  mrr_inicial: { nome: 'MRR inicial', unidade: 'R$', descricao: 'receita recorrente mensal no início da janela' },
  churn_receita: { nome: 'Churn de receita', unidade: '%', descricao: 'MRR cancelado ÷ MRR inicial na janela' },
  churn_logos: { nome: 'Churn de clientes', unidade: '%', descricao: 'contas perdidas ÷ contas no início' },
  retencao_liquida: { nome: 'Retenção líquida (NRR)', unidade: '%', descricao: 'inclui a expansão' },
  ltv: { nome: 'LTV', unidade: 'R$', descricao: 'ARPA × margem ÷ churn mensal' },
  /* ritmo do ciclo em andamento */
  pessoas_com_meta: { nome: 'Pessoas com meta', unidade: 'n', descricao: 'pessoas com alguma meta no ciclo' },
  pessoas_atras: { nome: 'Pessoas atrás do ritmo', unidade: 'n', descricao: 'pessoas cujo pior indicador está atrás' },
  pct_atras: { nome: 'Parcela atrás do ritmo', unidade: '%', descricao: 'pessoas atrás ÷ pessoas com meta' },
  meta_receita_ciclo: { nome: 'Meta de receita do ciclo', unidade: 'R$', descricao: 'meta da operação inteira no ciclo' },
  receita_ate_hoje: { nome: 'Receita até hoje no ciclo', unidade: 'R$', descricao: 'vendas fechadas no ciclo até hoje' },
  receita_esperada_ate_hoje: { nome: 'Receita esperada até hoje', unidade: 'R$', descricao: 'meta do ciclo distribuída pelos dias úteis' },
  dias_uteis_restantes: { nome: 'Dias úteis restantes', unidade: 'dias', descricao: 'de hoje ao fim do ciclo, hoje incluído' },
};
