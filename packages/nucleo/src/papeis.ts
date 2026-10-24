/* Vocabulário canônico do LAB V2.
   Cada operação tem etapas, atividades e canais com nomes próprios; o pack (ou a operação)
   mapeia cada um para um papel daqui. Todo cálculo do LAB fala só destes papéis,
   e é isso que deixa o mesmo motor servir a uma operação solar B2C e a uma assessoria B2B. */

/* Funil borboleta: o lado esquerdo conquista o cliente, o direito o mantém e expande. */
export const LADOS = ['aquisicao', 'pos_venda'] as const;
export type Lado = (typeof LADOS)[number];

/* Papéis de etapa. A ordem dentro de cada lado é a ordem natural do funil. */
export const PAPEIS_ETAPA = [
  // aquisição
  'lead',          // entrou na base
  'contato',       // houve conversa com a pessoa
  'qualificado',   // passou na qualificação (MQL/SQL de entrada)
  'agendada',      // reunião ou diagnóstico marcado
  'realizada',     // reunião aconteceu
  'oportunidade',  // há uma oportunidade real (SQL)
  'proposta',      // proposta apresentada
  'negociacao',    // em negociação
  'ganho',
  'perdido',
  // pós-venda
  'onboarding',    // implantação / entrega inicial
  'ativo',         // cliente em uso, gerando valor
  'renovacao',     // em ciclo de renovação
  'expansao',      // em negociação de expansão (upsell, cross-sell, revenda)
  'churn',         // cancelou / não renovou
  // etapa própria da operação que não tem equivalente canônico (ex.: visita técnica)
  'intermediaria',
] as const;
export type PapelEtapa = (typeof PAPEIS_ETAPA)[number];

export const PAPEIS_TERMINAIS: readonly PapelEtapa[] = ['ganho', 'perdido', 'churn'];

/* Tipos de negócio: o mesmo funil pode carregar venda nova e vendas para a base. */
export const TIPOS_NEGOCIO = ['novo', 'expansao', 'renovacao', 'revenda', 'cross_sell'] as const;
export type TipoNegocio = (typeof TIPOS_NEGOCIO)[number];

/* Atividades: o "esforço" da relação esforço × eficiência. */
export const PAPEIS_ATIVIDADE = [
  'tentativa',          // ligação, mensagem ou e-mail sem resposta ainda
  'contato',            // conversa efetiva
  'agendamento',        // marcou reunião
  'reuniao_realizada',
  'no_show',
  'proposta_enviada',
  'follow_up',
  'visita',
  'reuniao_cs',         // check-in, QBR, revisão de conta
  'indicacao_pedida',
  'nota',               // registro sem peso de produtividade
  'outro',
] as const;
export type PapelAtividade = (typeof PAPEIS_ATIVIDADE)[number];

export const TIPOS_CANAL = ['pago', 'organico', 'indicacao', 'outbound', 'parceiro', 'evento', 'base', 'outro'] as const;
export type TipoCanal = (typeof TIPOS_CANAL)[number];

export const GRUPOS_MOTIVO_PERDA = ['preco', 'credito', 'timing', 'concorrencia', 'fit', 'sem_resposta', 'interno', 'outro'] as const;
export type GrupoMotivoPerda = (typeof GRUPOS_MOTIVO_PERDA)[number];

export const FUNCOES_PESSOA = ['sdr', 'closer', 'ambos', 'cs', 'gestor', 'outro'] as const;
export type FuncaoPessoa = (typeof FUNCOES_PESSOA)[number];

/* Eventos do lado direito da borboleta. */
export const TIPOS_EVENTO_CS = [
  'onboarding_iniciado', 'onboarding_concluido', 'saude', 'nps', 'risco',
  'renovado', 'expandido', 'reduzido', 'cancelado', 'indicacao', 'outro',
] as const;
export type TipoEventoCS = (typeof TIPOS_EVENTO_CS)[number];

export const STATUS_RECEBIMENTO = ['previsto', 'pago', 'parcial', 'atrasado', 'cancelado', 'estornado'] as const;
export type StatusRecebimento = (typeof STATUS_RECEBIMENTO)[number];

export const STATUS_CONTRATO = ['ativo', 'cancelado', 'encerrado', 'renovado', 'suspenso'] as const;
export type StatusContrato = (typeof STATUS_CONTRATO)[number];

/* Linhas da composição de preço de uma venda (precificação). */
export const GRUPOS_LINHA_PRECO = ['deducao', 'custo_variavel', 'comissao'] as const;
export type GrupoLinhaPreco = (typeof GRUPOS_LINHA_PRECO)[number];
export const BASES_LINHA_PRECO = ['percentual_preco', 'percentual_liquido', 'fixo', 'informado'] as const;
export type BaseLinhaPreco = (typeof BASES_LINHA_PRECO)[number];
