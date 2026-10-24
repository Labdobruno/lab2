/* Conector do CRM Amicta (API v1), somente leitura.
   - Webhook: recebe os eventos do CRM (assinatura HMAC-SHA256 de "timestamp.corpo", janela de 5 min).
   - Sincronização: usuários, negócios alterados (atualizado_desde) e a fila de eventos (desde/proximo_desde).
     O CRM guarda eventos por 30 dias; o LAB guarda o bruto para sempre (lab.entrada_bruta).
   Dados pessoais do cliente: telefone, e-mail, endereço e conta de luz NUNCA são gravados.
   O telefone/e-mail só servem para gerar um identificador da conta (hash), para juntar negócios do mesmo cliente.
   Segredos (variáveis do Worker, a partir de segredo_ref, ex.: "AMICTA"):
     AMICTA_CHAVE   → chave de API (amk_…) com negocios:ler (e, se quiser, propostas:ler, financeiro:ler)
     AMICTA_WEBHOOK → segredo do webhook (whsec_…) */
import { chaveDe, type Comando } from '@lab/nucleo';
import { z } from 'zod';
import { hmacSha256, iguaisSeguro, sha256 } from '../cripto.js';
import { MapaSchema } from '../mapa.js';
import { ErroDeEntrada, type Conector, type ContextoConector, type EntradaBruta, type PaginaSincronizacao } from '../tipos.js';

const Config = z.object({
  baseUrl: z.string().url().default('https://crm-amicta.bruno-be2.workers.dev/api/v1'),
  /* "minimos": guarda nome do cliente, cidade e UF. "nenhum": nem o nome (vira "Cliente 3fa2c1"). */
  dadosPessoais: z.enum(['minimos', 'nenhum']).default('minimos'),
  incluirProposta: z.boolean().default(false),           // exige propostas:ler
  notas: z.string().nullable().default('nota'),          // atividade usada para as notas do CRM; null = ignorar notas
  inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),   // primeira sincronização: negócios alterados desde esta data
  pausaMs: z.number().int().min(0).max(5000).default(150),      // pausa entre páginas, para não pesar no CRM
  mapa: MapaSchema.optional(),
}).strict();
type Config = z.infer<typeof Config>;

const JANELA_ASSINATURA_S = 300;
const LIMITE = 200;

/* ------------------------------------------------------------------ tradução */
interface NegocioAmicta {
  id: string;
  cliente?: { nome?: string; telefone?: string; email?: string; pessoa?: string };
  endereco?: { cidade?: string; uf?: string };
  consultor?: string | null;
  canal?: string | null;
  pipeline?: string;
  etapa?: string;
  etapa_desde?: string;
  valor_estimado?: number | null;
  valor_fechado?: number | null;
  fechado_em?: string | null;
  perda?: { motivo?: string } | null;
  forma_pagamento?: { tipo?: string } | null;
  externo_id?: string | null;
  origem_integracao?: string | null;
  proposta_status?: string;
  orcamento?: { status?: string; preco_aprovado?: number; limite?: number; aprovado_em?: string } | null;
  proposta?: { valor_a_vista?: number; investimento?: number; forma_escolhida?: string } | null;
  criado_em: string;
  atualizado_em?: string;
}

const refUsuario = (nome: string) => `usuario:${chaveDe(nome)}`;

async function refConta(n: NegocioAmicta): Promise<string> {
  const tel = (n.cliente?.telefone ?? '').replace(/\D/g, '');
  if (tel.length >= 10) return `conta:tel:${(await sha256(tel)).slice(0, 20)}`;
  const email = (n.cliente?.email ?? '').trim().toLowerCase();
  if (email) return `conta:email:${(await sha256(email)).slice(0, 20)}`;
  return `conta:negocio:${n.id}`;
}

export async function comandosDoNegocio(n: NegocioAmicta, cfg: Config): Promise<Comando[]> {
  if (!n?.id || !n.criado_em) throw new ErroDeEntrada('negócio sem id ou sem criado_em');
  const ref = `negocio:${n.id}`;
  const contaRef = await refConta(n);
  const nomeCliente = cfg.dadosPessoais === 'nenhum' || !n.cliente?.nome?.trim()
    ? `Cliente ${contaRef.slice(-6)}` : n.cliente.nome.trim();
  const out: Comando[] = [];
  out.push({
    tipo: 'conta.upsert', ref: contaRef, nome: nomeCliente, criadoEm: n.criado_em,
    ...(n.cliente?.pessoa === 'pf' || n.cliente?.pessoa === 'pj' ? { tipoPessoa: n.cliente.pessoa } : {}),
    ...(cfg.dadosPessoais === 'minimos' && n.endereco?.cidade ? { cidade: n.endereco.cidade } : {}),
    ...(cfg.dadosPessoais === 'minimos' && n.endereco?.uf ? { uf: n.endereco.uf.toUpperCase().slice(0, 2) } : {}),
  });
  if (n.consultor) out.push({ tipo: 'pessoa.upsert', ref: refUsuario(n.consultor), nome: n.consultor });
  out.push({
    tipo: 'negocio.upsert', ref, contaRef, criadoEm: n.criado_em, tipoNegocio: 'novo',
    ...(n.canal ? { canalRef: n.canal } : {}),
    donoRef: n.consultor ? refUsuario(n.consultor) : undefined,
    ...(n.etapa ? { etapa: n.etapa } : {}),
    ...(n.etapa_desde ? { etapaDesde: n.etapa_desde } : {}),
    ...(n.valor_estimado !== undefined ? { valorEstimado: n.valor_estimado } : {}),
    ...(n.valor_fechado !== undefined ? { valorFechado: n.valor_fechado } : {}),
    ...(n.fechado_em !== undefined ? { fechadoEm: n.fechado_em } : {}),
    motivoPerda: n.perda?.motivo ?? null,
    ...(n.atualizado_em ? { atualizadoEm: n.atualizado_em } : {}),
    atributos: {
      pipeline: n.pipeline ?? null, externo_id: n.externo_id ?? null, origem_integracao: n.origem_integracao ?? null,
      proposta_status: n.proposta_status ?? null, forma_pagamento: n.forma_pagamento?.tipo ?? null,
    },
  } as Comando);
  /* preços: data estável por momento, para a mesma informação não virar várias linhas */
  if (n.proposta && (n.proposta.valor_a_vista ?? n.proposta.investimento)) {
    out.push({ tipo: 'preco.registrar', negocioRef: ref, momento: 'referencia', valor: (n.proposta.valor_a_vista ?? n.proposta.investimento)!, em: n.criado_em,
      ...(n.proposta.forma_escolhida ? { condicao: n.proposta.forma_escolhida } : {}) });
  }
  if (n.orcamento?.preco_aprovado) {
    out.push({ tipo: 'preco.registrar', negocioRef: ref, momento: 'aprovado', valor: n.orcamento.preco_aprovado, em: n.orcamento.aprovado_em ?? n.criado_em,
      ...(typeof n.orcamento.limite === 'number' ? { limite: n.orcamento.limite } : {}) });
  }
  if (n.etapa === 'ganho' && typeof n.valor_fechado === 'number' && n.fechado_em) {
    out.push({ tipo: 'preco.registrar', negocioRef: ref, momento: 'fechado', valor: n.valor_fechado, em: n.fechado_em,
      ...(n.forma_pagamento?.tipo ? { condicao: n.forma_pagamento.tipo } : {}) });
  }
  return out;
}

interface EventoAmicta { id: string; evento: string; criado_em: string; dados?: Record<string, unknown> }
interface TituloAmicta { id: string; tipo: string; status: string; valor?: number; valor_previsto?: number; vencimento?: string; negocio_id?: string | null; baixa?: { data?: string; valor?: number } | null }

const STATUS_TITULO: Record<string, string> = { aberto: 'previsto', vencido: 'atrasado', pago: 'pago', cancelado: 'cancelado' };

export async function comandosDoEvento(e: EventoAmicta, cfg: Config): Promise<Comando[]> {
  const d = e.dados ?? {};
  const neg = d.negocio as NegocioAmicta | undefined;
  if (e.evento.startsWith('negocio.') || e.evento.startsWith('orcamento.') || e.evento.startsWith('proposta.')) {
    if (!neg) return [];
    const out = await comandosDoNegocio(neg, cfg);
    if (e.evento === 'negocio.etapa_alterada' && typeof d.para === 'string') {
      out.push({ tipo: 'negocio.transicao', negocioRef: `negocio:${neg.id}`, para: d.para, em: e.criado_em,
        ...(typeof d.de === 'string' ? { de: d.de } : {}), ...(neg.consultor ? { donoRef: refUsuario(neg.consultor) } : {}) });
    }
    if (e.evento === 'proposta.pronta') {
      out.push({ tipo: 'atividade.registrar', ref: `evento:${e.id}`, atividade: 'proposta', em: e.criado_em, negocioRef: `negocio:${neg.id}`,
        ...(neg.consultor ? { pessoaRef: refUsuario(neg.consultor) } : {}) });
    }
    return out;
  }
  if (e.evento === 'atividade.registrada') {
    const a = d.atividade as { id?: string; autor?: string; em?: string } | undefined;
    if (!cfg.notas || !a?.id || typeof d.negocio_id !== 'string') return [];
    /* o texto da nota não é guardado (pode ter dado pessoal); só que houve uma nota, quando e de quem */
    return [{ tipo: 'atividade.registrar', ref: `nota:${a.id}`, atividade: cfg.notas, em: a.em ?? e.criado_em,
      negocioRef: `negocio:${d.negocio_id}`, atributos: { autor: a.autor ?? null } }];
  }
  if (e.evento.startsWith('financeiro.titulo')) {
    const t = d.titulo as TituloAmicta | undefined;
    if (!t || t.tipo !== 'receber') return [];             // contas a pagar ficam fora do LAB
    let status = STATUS_TITULO[t.status] ?? 'previsto';
    if (status === 'pago' && t.baixa?.valor != null && t.valor != null && t.baixa.valor < t.valor) status = 'parcial';
    return [{ tipo: 'recebimento.upsert', ref: `titulo:${t.id}`, status: status as never,
      ...(t.negocio_id ? { negocioRef: `negocio:${t.negocio_id}` } : {}),
      ...((t.valor_previsto ?? t.valor) != null ? { valorPrevisto: (t.valor_previsto ?? t.valor)! } : {}),
      ...(t.vencimento ? { previstoEm: t.vencimento } : {}),
      ...(t.baixa?.valor != null ? { valorRecebido: t.baixa.valor } : {}),
      ...(t.baixa?.data ? { recebidoEm: t.baixa.data } : {}) }];
  }
  return [];                                                 // "teste" e eventos futuros desconhecidos
}

const FUNCAO_USUARIO: Record<string, 'sdr' | 'closer' | 'gestor' | 'cs' | 'outro'> = {
  sdr: 'sdr', bdr: 'sdr', pre_vendas: 'sdr', vendedor: 'closer', consultor: 'closer', closer: 'closer',
  admin: 'gestor', administrador: 'gestor', gestor: 'gestor', gestao: 'gestor', cs: 'cs',
};
function comandosDoUsuario(u: { nome?: string; email?: string; papel?: string; ativo?: boolean }): Comando[] {
  if (!u?.nome) return [];
  return [{ tipo: 'pessoa.upsert', ref: refUsuario(u.nome), nome: u.nome,
    ...(u.email ? { email: u.email } : {}), ...(u.papel ? { funcao: FUNCAO_USUARIO[chaveDe(u.papel)] ?? 'outro' } : {}),
    ...(typeof u.ativo === 'boolean' ? { ativa: u.ativo } : {}) }];
}

/* ------------------------------------------------------------------ API */
const esperar = (ms: number) => new Promise(r => setTimeout(r, ms));

async function chamar(ctx: ContextoConector<Config>, caminho: string, params: Record<string, string | number | boolean | undefined> = {}): Promise<any> {
  const chave = ctx.segredo('chave');
  if (!chave) throw new Error('falta a chave de API do CRM (variável <segredo_ref>_CHAVE)');
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]));
  const url = `${ctx.config.baseUrl.replace(/\/$/, '')}${caminho}${qs.size ? `?${qs}` : ''}`;
  for (let tentativa = 1; ; tentativa++) {
    const r = await ctx.fetch(url, { headers: { Authorization: `Bearer ${chave}`, Accept: 'application/json' } });
    if (r.ok) return r.json();
    if ((r.status === 429 || r.status >= 500) && tentativa < 4) { await esperar(2 ** tentativa * 500); continue; }
    let erro = '';
    try { erro = ((await r.json()) as { erro?: string }).erro ?? ''; } catch { /* sem corpo */ }
    throw new Error(`CRM ${caminho}: HTTP ${r.status}${erro ? ` — ${erro}` : ''}`);
  }
}

const lista = (r: any): any[] => (Array.isArray(r) ? r : Array.isArray(r?.dados) ? r.dados : []);

async function* sincronizarAmicta(ctx: ContextoConector<Config>, cursorInicial: Record<string, unknown>): AsyncGenerator<PaginaSincronizacao> {
  let cursor = { ...cursorInicial };
  const inicioRodada = ctx.agora().toISOString();

  // 1. equipe
  const usuarios = lista(await chamar(ctx, '/usuarios'));
  const eu: EntradaBruta[] = [];
  for (const u of usuarios) if (u?.nome) eu.push({ chave: `usuario:${chaveDe(u.nome)}:${(await sha256(JSON.stringify(u))).slice(0, 16)}`, tipo: 'usuario', payload: u });
  yield { entradas: eu, cursor };

  // 2. negócios alterados desde a última rodada (a data tem folga de 1 dia; repetidos são descartados pela chave)
  const desde = typeof cursor.negociosDesde === 'string' ? cursor.negociosDesde : ctx.config.inicio ?? '2000-01-01';
  const dia = new Date(Date.parse(desde.length === 10 ? `${desde}T00:00:00Z` : desde) - 86_400_000).toISOString().slice(0, 10);
  for (let pagina = 1; ; pagina++) {
    const r = await chamar(ctx, '/negocios', { atualizado_desde: dia, limite: LIMITE, pagina, incluir_proposta: ctx.config.incluirProposta || undefined });
    const dados = lista(r) as NegocioAmicta[];
    yield { entradas: dados.map(n => ({ chave: `negocio:${n.id}:${n.atualizado_em ?? n.criado_em}`, tipo: 'negocio', payload: n })), cursor };
    if (!r?.tem_mais || !dados.length) break;
    if (ctx.config.pausaMs) await esperar(ctx.config.pausaMs);
  }
  cursor = { ...cursor, negociosDesde: inicioRodada };
  yield { entradas: [], cursor };

  // 3. eventos (histórico de etapas, propostas, recebimentos). O CRM só guarda 30 dias.
  let desdeEv = typeof cursor.eventosDesde === 'string' ? cursor.eventosDesde : new Date(ctx.agora().getTime() - 29 * 86_400_000).toISOString();
  for (let volta = 0; volta < 500; volta++) {
    const r = await chamar(ctx, '/eventos', { desde: desdeEv, limite: LIMITE });
    const dados = lista(r) as EventoAmicta[];
    const proximo = typeof r?.proximo_desde === 'string' ? r.proximo_desde : desdeEv;
    cursor = { ...cursor, eventosDesde: proximo };
    yield { entradas: dados.map(e => ({ chave: `evento:${e.id}`, tipo: 'evento', payload: e })), cursor };
    if (dados.length < LIMITE || proximo === desdeEv) break;
    desdeEv = proximo;
    if (ctx.config.pausaMs) await esperar(ctx.config.pausaMs);
  }
}

export const conectorAmicta: Conector<Config> = {
  tipo: 'amicta-crm-v1',
  nome: 'CRM Amicta (API v1)',
  descricao: 'Lê negócios, equipe, eventos de etapa, propostas e recebimentos do CRM Amicta. Nunca escreve no CRM.',
  config: Config,
  webhook: {
    async verificar(req, segredo, agora) {
      const whsec = segredo('webhook');
      if (!whsec) return { ok: false, motivo: 'falta o segredo do webhook (variável <segredo_ref>_WEBHOOK)' };
      const ts = req.cabecalhos.get('x-amicta-timestamp') ?? '';
      const recebida = (req.cabecalhos.get('x-amicta-assinatura') ?? '').replace(/^sha256=/, '');
      if (!/^\d+$/.test(ts) || !recebida) return { ok: false, motivo: 'assinatura ausente' };
      if (Math.abs(agora.getTime() / 1000 - Number(ts)) > JANELA_ASSINATURA_S) return { ok: false, motivo: 'timestamp fora da janela de 5 minutos' };
      const esperada = await hmacSha256(whsec, `${ts}.${req.corpo}`);
      return iguaisSeguro(recebida, esperada) ? { ok: true } : { ok: false, motivo: 'assinatura não confere' };
    },
    async extrair(req) {
      let e: EventoAmicta;
      try { e = JSON.parse(req.corpo); } catch { throw new ErroDeEntrada('JSON inválido'); }
      if (!e?.id || !e.evento) throw new ErroDeEntrada('evento sem id');
      return [{ chave: `evento:${e.id}`, tipo: 'evento', payload: e }];
    },
  },
  sincronizar: sincronizarAmicta,
  async normalizar(entrada, ctx) {
    if (entrada.tipo === 'negocio') return comandosDoNegocio(entrada.payload as NegocioAmicta, ctx.config);
    if (entrada.tipo === 'evento') return comandosDoEvento(entrada.payload as EventoAmicta, ctx.config);
    if (entrada.tipo === 'usuario') return comandosDoUsuario(entrada.payload as never);
    return [];
  },
};
