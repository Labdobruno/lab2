/* Contrato de um conector.
   Um conector só faz duas coisas: (1) trazer dados da fonte como "entradas brutas" e
   (2) traduzir cada entrada bruta em comandos canônicos. Ele nunca escreve no banco:
   quem grava é o aplicador, sempre do mesmo jeito para qualquer fonte. */
import type { z } from 'zod';
import type { Comando } from '@lab/nucleo';

/* Uma coisa que chegou da fonte. "chave" garante idempotência: a mesma chave não entra duas vezes. */
export interface EntradaBruta {
  chave: string;
  tipo: string;
  payload: unknown;
}

/* Tradução de chaves da fonte para as chaves da operação (ex.: etapa "reuniao_ag" → "agendada"). */
export interface Mapa {
  etapas?: Record<string, string>;
  atividades?: Record<string, string>;
  funis?: Record<string, string>;
  motivosPerda?: Record<string, string>;
  condicoes?: Record<string, string>;
}

/* segredos ficam no Worker (variáveis de ambiente), nunca no banco.
   segredo() = o segredo principal; segredo('webhook') = um segredo extra do mesmo conector. */
export type LerSegredo = (nome?: string) => string | undefined;

export interface ContextoConector<C> {
  config: C;
  segredo: LerSegredo;
  fetch: typeof fetch;
  agora: () => Date;
}

export interface RequisicaoWebhook {
  cabecalhos: Headers;
  corpo: string;            // corpo cru, exatamente como chegou (necessário para conferir assinatura)
}

export type Verificacao = { ok: true } | { ok: false; motivo: string };

export interface PaginaSincronizacao {
  entradas: EntradaBruta[];
  cursor: Record<string, unknown>;   // salvo depois que a página é registrada: se cair no meio, recomeça daqui
}

export interface Conector<C extends { mapa?: Mapa } = { mapa?: Mapa }> {
  tipo: string;
  nome: string;
  descricao: string;
  config: z.ZodType<C>;
  webhook?: {
    verificar(req: RequisicaoWebhook, segredo: LerSegredo, agora: Date): Promise<Verificacao>;
    extrair(req: RequisicaoWebhook, ctx: ContextoConector<C>): Promise<EntradaBruta[]>;
  };
  sincronizar?(ctx: ContextoConector<C>, cursor: Record<string, unknown>): AsyncGenerator<PaginaSincronizacao>;
  importar?(arquivo: { nome: string; conteudo: string }, ctx: ContextoConector<C>): Promise<EntradaBruta[]>;
  normalizar(entrada: { tipo: string; payload: unknown }, ctx: ContextoConector<C>): Promise<Comando[]>;
  /* como mostrar uma entrada numa mensagem de erro ("negocios.csv, linha 4") */
  rotulo?(entrada: { tipo: string; payload: unknown }): string;
}

/* Erro de tradução com mensagem para quem opera ("a etapa X não existe: mapeie em config.mapa.etapas"). */
export class ErroDeEntrada extends Error {
  constructor(mensagem: string, readonly recuperavel = false) { super(mensagem); this.name = 'ErroDeEntrada'; }
}
