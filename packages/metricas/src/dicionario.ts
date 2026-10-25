/* Dicionário canônico: cada número do LAB tem uma definição e uma função dona. */
export interface DefinicaoMetrica { chave: string; nome: string; formula: string; unidade: 'R$' | '%' | 'n' | 'meses'; dona: string }

export const DICIONARIO: readonly DefinicaoMetrica[] = [
  { chave: 'cpl', nome: 'Custo por lead', formula: 'investimento do canal ÷ negócios novos criados no período', unidade: 'R$', dona: 'canais.eficienciaPorCanal' },
  { chave: 'cac', nome: 'Custo de aquisição', formula: 'investimento do canal ÷ vendas novas fechadas no período', unidade: 'R$', dona: 'canais.eficienciaPorCanal' },
  { chave: 'roi', nome: 'ROI do canal', formula: '(receita fechada − investimento) ÷ investimento; nulo quando falta investimento lançado em algum mês do período (D21)', unidade: '%', dona: 'canais.eficienciaPorCanal' },
  { chave: 'retorno', nome: 'Retorno do canal', formula: 'margem de contribuição das vendas − investimento (receita não é lucro)', unidade: 'R$', dona: 'canais.eficienciaPorCanal' },
  { chave: 'payback', nome: 'Payback do CAC', formula: 'CAC ÷ margem mensal por venda (valor do contrato ÷ periodicidade × margem %), só vendas com contrato recorrente', unidade: 'meses', dona: 'canais.eficienciaPorCanal' },
  { chave: 'mc', nome: 'Margem de contribuição', formula: 'receita líquida (preço − deduções da política − taxa da condição − antecipação − comissão) − custos − custo financeiro do prazo; MC % sobre a receita líquida', unidade: 'R$', dona: '@lab/economia.economiaDaVenda (via canais.economiaDaVenda)' },
  { chave: 'mc_menos_cac', nome: 'MC menos CAC', formula: 'soma da MC das vendas do canal − investimento do canal', unidade: 'R$', dona: 'canais.eficienciaPorCanal' },
  { chave: 'desconto', nome: 'Desconto', formula: '1 − valor fechado ÷ preço de referência (ou aprovado)', unidade: '%', dona: 'canais.economiaDaVenda' },
  { chave: 'conversao_coorte', nome: 'Conversão da coorte', formula: 'negócios novos criados no período que alcançaram o degrau (ou um posterior) ÷ tamanho da coorte; com intervalo de Wilson 95%', unidade: '%', dona: 'funil.conversaoPorCoorte' },
  { chave: 'fluxo', nome: 'Fluxo por papel', formula: 'negócios distintos que entraram no papel durante o período', unidade: 'n', dona: 'funil.fluxoPorPapel' },
  { chave: 'taxa_de_ganho', nome: 'Taxa de ganho', formula: 'ganhos ÷ (ganhos + perdidos) entre os novos fechados no período', unidade: '%', dona: 'funil.taxaDeGanho' },
  { chave: 'churn_logos', nome: 'Churn de clientes', formula: 'contas com contrato recorrente cancelado no período ÷ contas ativas no início', unidade: '%', dona: 'retencao.retencao' },
  { chave: 'churn_receita', nome: 'Churn de receita', formula: 'MRR cancelado ÷ MRR no início', unidade: '%', dona: 'retencao.retencao' },
  { chave: 'retencao_bruta', nome: 'Receita retida (GRR)', formula: '(MRR inicial − cancelado − reduzido) ÷ MRR inicial', unidade: '%', dona: 'retencao.retencao' },
  { chave: 'retencao_liquida', nome: 'Retenção líquida (NRR)', formula: '(MRR inicial − cancelado − reduzido + expansão) ÷ MRR inicial', unidade: '%', dona: 'retencao.retencao' },
  { chave: 'ltv', nome: 'LTV', formula: 'ARPA × margem % ÷ churn mensal de receita', unidade: 'R$', dona: 'retencao.retencao' },
] as const;
