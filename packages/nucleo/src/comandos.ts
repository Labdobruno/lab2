/* Comandos canônicos: a única linguagem que entra no banco do LAB.
   Todo conector (API de um CRM, planilha, n8n, digitação) traduz o que recebe para esta lista.
   Os comandos nunca carregam ids internos: apontam para as coisas pelo id externo da fonte
   ("ref"). Quem resolve ref → id interno é o aplicador, pela tabela de vínculos. */
import { z } from 'zod';
import {
  FUNCOES_PESSOA, STATUS_CONTRATO, STATUS_RECEBIMENTO, TIPOS_CANAL, TIPOS_EVENTO_CS, TIPOS_NEGOCIO,
} from './papeis.js';

const texto = z.string().trim().min(1);
const ref = texto.max(200);
/* datas: ISO completo (2026-10-15T14:03:12Z) ou só o dia (2026-10-15) */
const data = z.string().refine(s => /^\d{4}-\d{2}-\d{2}/.test(s) && !Number.isNaN(Date.parse(s)), 'data inválida: use AAAA-MM-DD ou ISO 8601');
const valor = z.number().finite();
const valorPositivo = z.number().finite().nonnegative();
const atributos = z.record(z.string(), z.unknown()).optional();

export const PessoaUpsert = z.object({
  tipo: z.literal('pessoa.upsert'),
  ref,
  nome: texto,
  email: z.string().email().optional(),
  funcao: z.enum(FUNCOES_PESSOA).optional(),
  ativa: z.boolean().optional(),
});

export const CanalUpsert = z.object({
  tipo: z.literal('canal.upsert'),
  ref,
  nome: texto,
  tipoCanal: z.enum(TIPOS_CANAL).optional(),
  origemDeLead: z.boolean().optional(),
});

export const ContaUpsert = z.object({
  tipo: z.literal('conta.upsert'),
  ref,
  nome: texto,
  tipoPessoa: z.enum(['pf', 'pj']).optional(),
  segmento: z.string().optional(),
  cidade: z.string().optional(),
  uf: z.string().max(2).optional(),
  criadoEm: data.optional(),
  donoCsRef: ref.optional(),
  atributos,
});

export const NegocioUpsert = z.object({
  tipo: z.literal('negocio.upsert'),
  ref,
  contaRef: ref.optional(),
  funil: z.string().optional(),            // chave do funil na operação; padrão: o funil principal
  tipoNegocio: z.enum(TIPOS_NEGOCIO).optional(),
  canalRef: ref.optional(),
  donoRef: ref.optional(),
  etapa: z.string().optional(),            // chave da etapa na fonte (o conector pode mapear)
  etapaDesde: data.optional(),
  valorEstimado: valorPositivo.nullable().optional(),
  valorFechado: valorPositivo.nullable().optional(),
  criadoEm: data,
  fechadoEm: data.nullable().optional(),
  motivoPerda: z.string().nullable().optional(),
  atualizadoEm: data.optional(),
  atributos,
});

export const NegocioTransicao = z.object({
  tipo: z.literal('negocio.transicao'),
  negocioRef: ref,
  para: texto,
  de: z.string().optional(),
  em: data,
  donoRef: ref.optional(),
});

export const AtividadeRegistrar = z.object({
  tipo: z.literal('atividade.registrar'),
  ref,                                      // id da atividade na fonte: garante que não conta duas vezes
  atividade: texto,                         // chave do tipo de atividade na operação
  em: data,
  pessoaRef: ref.optional(),
  negocioRef: ref.optional(),
  contaRef: ref.optional(),
  quantidade: z.number().int().positive().optional(),
  resultado: z.string().optional(),
  atributos,
});

export const PrecoRegistrar = z.object({
  tipo: z.literal('preco.registrar'),
  negocioRef: ref,
  momento: z.enum(['referencia', 'aprovado', 'fechado']),
  valor: valorPositivo,
  em: data,
  condicao: z.string().optional(),          // condição de pagamento (chave da operação)
  limite: valorPositivo.optional(),         // piso de negociação aprovado, quando houver
  linhas: z.array(z.object({ chave: texto, valor })).optional(),  // custos e deduções informados
});

export const RecebimentoUpsert = z.object({
  tipo: z.literal('recebimento.upsert'),
  ref,
  negocioRef: ref.optional(),
  contaRef: ref.optional(),
  valorPrevisto: valorPositivo.optional(),
  previstoEm: data.optional(),
  valorRecebido: valorPositivo.optional(),
  recebidoEm: data.optional(),
  status: z.enum(STATUS_RECEBIMENTO),
  descricao: z.string().optional(),
});

export const ContratoUpsert = z.object({
  tipo: z.literal('contrato.upsert'),
  ref,
  contaRef: ref,
  negocioOrigemRef: ref.optional(),
  recorrente: z.boolean(),
  valorPeriodo: valorPositivo,              // valor por período (mensal, anual…) ou total, se não recorrente
  periodicidadeMeses: z.number().int().positive().optional(),
  inicio: data,
  fim: data.nullable().optional(),
  renovacaoEm: data.nullable().optional(),
  status: z.enum(STATUS_CONTRATO),
  motivoCancelamento: z.string().nullable().optional(),
});

export const EventoCSRegistrar = z.object({
  tipo: z.literal('evento_cs.registrar'),
  ref,
  contaRef: ref,
  evento: z.enum(TIPOS_EVENTO_CS),
  em: data,
  valor: valor.optional(),                  // nota de saúde, NPS, delta de receita…
  pessoaRef: ref.optional(),
  atributos,
});

export const InvestimentoUpsert = z.object({
  tipo: z.literal('investimento.upsert'),
  canalRef: ref,
  mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'mês no formato AAAA-MM'),
  valor: valorPositivo,
  impressoes: z.number().int().nonnegative().optional(),
  cliques: z.number().int().nonnegative().optional(),
  leadsPlataforma: z.number().int().nonnegative().optional(),
});

export const Comando = z.discriminatedUnion('tipo', [
  PessoaUpsert, CanalUpsert, ContaUpsert, NegocioUpsert, NegocioTransicao, AtividadeRegistrar,
  PrecoRegistrar, RecebimentoUpsert, ContratoUpsert, EventoCSRegistrar, InvestimentoUpsert,
]);
export type Comando = z.infer<typeof Comando>;
export type TipoComando = Comando['tipo'];
export type ComandoDe<T extends TipoComando> = Extract<Comando, { tipo: T }>;

/* Ordem de aplicação dentro de um lote: quem é referenciado entra antes de quem referencia. */
export const ORDEM_COMANDOS: readonly TipoComando[] = [
  'pessoa.upsert', 'canal.upsert', 'conta.upsert', 'negocio.upsert', 'negocio.transicao',
  'atividade.registrar', 'preco.registrar', 'recebimento.upsert', 'contrato.upsert',
  'evento_cs.registrar', 'investimento.upsert',
];

export function ordenarComandos(cmds: readonly Comando[]): Comando[] {
  const pos = (c: Comando) => ORDEM_COMANDOS.indexOf(c.tipo);
  return cmds.map((c, i) => [c, i] as const).sort((a, b) => pos(a[0]) - pos(b[0]) || a[1] - b[1]).map(x => x[0]);
}

/* Validação com mensagem legível: devolve os comandos válidos e os erros por posição. */
export function validarComandos(entrada: unknown[]): { validos: Comando[]; erros: { indice: number; erro: string }[] } {
  const validos: Comando[] = [], erros: { indice: number; erro: string }[] = [];
  entrada.forEach((c, indice) => {
    const r = Comando.safeParse(c);
    if (r.success) validos.push(r.data);
    else erros.push({ indice, erro: r.error.issues.map(i => `${i.path.join('.') || 'comando'}: ${i.message}`).join('; ') });
  });
  return { validos, erros };
}
