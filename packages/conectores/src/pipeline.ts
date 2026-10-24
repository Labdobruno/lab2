/* Fluxo de dados de um conector: receber → guardar bruto → traduzir → aplicar → registrar execução.
   O bruto é gravado ANTES de qualquer tradução: se a tradução falhar (etapa não mapeada, negócio que
   ainda não chegou), nada se perde; a entrada fica "erro" e é reprocessada depois. */
import { validarComandos } from '@lab/nucleo';
import type { Sql } from 'postgres';
import { Aplicador } from './aplicador.js';
import { conectorDoTipo } from './registro.js';
import { ErroDeEntrada, type Conector, type ContextoConector, type EntradaBruta, type RequisicaoWebhook } from './tipos.js';

export interface LinhaConector {
  id: string;
  operacao_id: string;
  tipo: string;
  nome: string;
  config: Record<string, unknown>;
  segredo_ref: string | null;
  ativo: boolean;
  cursor: Record<string, unknown>;
}

export interface Dependencias {
  sql: Sql;
  segredos: (ref: string) => string | undefined;   // no Worker: env[ref]
  fetch?: typeof fetch;
  agora?: () => Date;
}

export const MAX_TENTATIVAS = 8;

export async function carregarConector(sql: Sql, id: string): Promise<LinhaConector | null> {
  const [c] = await sql<LinhaConector[]>`select id, operacao_id, tipo, nome, config, segredo_ref, ativo, cursor from lab.conector where id = ${id}`;
  return c ?? null;
}

export function preparar(dep: Dependencias, linha: LinhaConector): { impl: Conector; ctx: ContextoConector<Record<string, unknown>> } {
  const impl = conectorDoTipo(linha.tipo);
  const cfg = impl.config.safeParse(linha.config);
  if (!cfg.success) throw new Error(`configuração inválida do conector "${linha.nome}": ${cfg.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  return {
    impl,
    ctx: {
      config: cfg.data as Record<string, unknown>,
      /* segredo_ref "AMICTA" → variável AMICTA; segredo('webhook') → AMICTA_WEBHOOK */
      segredo: (nome?: string) => (linha.segredo_ref ? dep.segredos(nome ? `${linha.segredo_ref}_${nome.toUpperCase()}` : linha.segredo_ref) : undefined),
      fetch: dep.fetch ?? fetch,
      agora: dep.agora ?? (() => new Date()),
    },
  };
}

export async function registrarEntradas(sql: Sql, linha: LinhaConector, entradas: EntradaBruta[]): Promise<{ recebidos: number; novos: number; ids: number[] }> {
  if (!entradas.length) return { recebidos: 0, novos: 0, ids: [] };
  const vistas = new Map<string, EntradaBruta>();
  for (const e of entradas) vistas.set(e.chave, e);           // a mesma chave duas vezes no mesmo lote: vale a última
  const linhas = [...vistas.values()].map(e => ({
    operacao_id: linha.operacao_id, conector_id: linha.id, chave_idem: e.chave, tipo: e.tipo, payload: sql.json(e.payload as never),
  }));
  const ids: number[] = [];
  for (let i = 0; i < linhas.length; i += 500) {
    const r = await sql<{ id: number }[]>`insert into lab.entrada_bruta ${sql(linhas.slice(i, i + 500) as never)} on conflict (conector_id, chave_idem) do nothing returning id`;
    ids.push(...r.map(x => Number(x.id)));
  }
  return { recebidos: entradas.length, novos: ids.length, ids };
}

export interface ResultadoProcessamento { aplicados: number; ignorados: number; erros: number; mensagens: string[] }

export async function processarPendentes(dep: Dependencias, linha: LinhaConector, opts: { limite?: number; ids?: number[] } = {}): Promise<ResultadoProcessamento> {
  const { sql } = dep;
  const { impl, ctx } = preparar(dep, linha);
  const limite = opts.limite ?? 1000;
  const fila = opts.ids
    ? await sql<{ id: number; tipo: string; payload: unknown }[]>`select id, tipo, payload from lab.entrada_bruta where id in (select jsonb_array_elements_text(${sql.json(opts.ids as never)})::bigint) and status in ('pendente','erro') order by id`
    : await sql<{ id: number; tipo: string; payload: unknown }[]>`
        select id, tipo, payload from lab.entrada_bruta
        where conector_id = ${linha.id} and status in ('pendente','erro') and tentativas < ${MAX_TENTATIVAS}
        order by id limit ${limite}`;
  const out: ResultadoProcessamento = { aplicados: 0, ignorados: 0, erros: 0, mensagens: [] };
  for (const e of fila) {
    try {
      const traduzidos = await impl.normalizar({ tipo: e.tipo, payload: e.payload }, ctx);
      const { validos, erros } = validarComandos(traduzidos);
      if (erros.length) throw new ErroDeEntrada(`o conector gerou comandos inválidos: ${erros.map(x => `#${x.indice} ${x.erro}`).join(' | ')}`);
      if (!validos.length) {
        await sql`update lab.entrada_bruta set status = 'ignorado', aplicado_em = now(), erro = null where id = ${e.id}`;
        out.ignorados++; continue;
      }
      await sql.begin(async tx => {
        await new Aplicador(tx, { operacaoId: linha.operacao_id, conectorId: linha.id, mapa: ctx.config.mapa as never }).aplicar(validos);
        await tx`update lab.entrada_bruta set status = 'aplicado', aplicado_em = now(), erro = null, tentativas = tentativas + 1 where id = ${e.id}`;
      });
      out.aplicados++;
    } catch (err) {
      const rot = impl.rotulo?.({ tipo: e.tipo, payload: e.payload });
      const msg = (rot ? `${rot}: ` : '') + (err instanceof Error ? err.message : String(err));
      await sql`update lab.entrada_bruta set status = 'erro', erro = ${msg}, tentativas = tentativas + 1 where id = ${e.id}`;
      out.erros++;
      if (out.mensagens.length < 20) out.mensagens.push(`#${e.id} (${e.tipo}): ${msg}`);
    }
  }
  /* entradas que falharam porque algo ainda não tinha chegado (ex.: transição antes do negócio) podem
     passar agora que o lote inteiro foi aplicado: uma segunda volta resolve a ordem de chegada */
  if (out.aplicados && out.erros && !opts.ids) {
    const segunda = await processarPendentes(dep, linha, { ids: (await sql<{ id: number }[]>`
      select id from lab.entrada_bruta where conector_id = ${linha.id} and status = 'erro' and erro like '%ainda não chegou%' and tentativas < ${MAX_TENTATIVAS}`).map(x => Number(x.id)) });
    out.aplicados += segunda.aplicados; out.ignorados += segunda.ignorados;
    out.erros = out.erros - segunda.aplicados - segunda.ignorados;
  }
  return out;
}

async function iniciarExecucao(sql: Sql, conectorId: string, tipo: 'webhook' | 'sincronizacao' | 'importacao' | 'processamento') {
  const [x] = await sql<{ id: number }[]>`insert into lab.execucao (conector_id, tipo) values (${conectorId}, ${tipo}) returning id`;
  return Number(x!.id);
}
async function encerrarExecucao(sql: Sql, id: number, r: { recebidos?: number; novos?: number } & Partial<ResultadoProcessamento>, falha?: string) {
  const status = falha ? 'falhou' : (r.erros ?? 0) > 0 ? 'parcial' : 'ok';
  await sql`update lab.execucao set fim = now(), status = ${status}, recebidos = ${r.recebidos ?? 0}, novos = ${r.novos ?? 0},
    aplicados = ${r.aplicados ?? 0}, erros = ${r.erros ?? 0}, detalhe = ${sql.json({ mensagens: r.mensagens ?? [], ...(falha ? { falha } : {}) })} where id = ${id}`;
  return status;
}

export async function receberWebhook(dep: Dependencias, linha: LinhaConector, req: RequisicaoWebhook) {
  const { impl, ctx } = preparar(dep, linha);
  if (!impl.webhook) return { http: 404, corpo: { erro: 'este conector não recebe webhook' } };
  if (!linha.ativo) return { http: 409, corpo: { erro: 'conector desativado' } };
  const v = await impl.webhook.verificar(req, ctx.segredo, ctx.agora());
  if (!v.ok) return { http: 401, corpo: { erro: v.motivo } };
  let entradas: EntradaBruta[];
  try { entradas = await impl.webhook.extrair(req, ctx); }
  catch (e) { return { http: 400, corpo: { erro: e instanceof Error ? e.message : String(e) } }; }
  const ex = await iniciarExecucao(dep.sql, linha.id, 'webhook');
  const reg = await registrarEntradas(dep.sql, linha, entradas);
  /* responde rápido: aplica só o que acabou de chegar; o resto o cron reprocessa */
  const proc = await processarPendentes(dep, linha, { ids: reg.ids });
  await encerrarExecucao(dep.sql, ex, { ...reg, ...proc });
  return { http: 200, corpo: { recebidos: reg.recebidos, novos: reg.novos, aplicados: proc.aplicados, erros: proc.erros } };
}

export async function sincronizar(dep: Dependencias, linha: LinhaConector, opts: { maxPaginas?: number } = {}) {
  const { impl, ctx } = preparar(dep, linha);
  if (!impl.sincronizar) throw new Error(`o conector "${linha.tipo}" não sincroniza`);
  const ex = await iniciarExecucao(dep.sql, linha.id, 'sincronizacao');
  const tot = { recebidos: 0, novos: 0 };
  let cursor = linha.cursor ?? {};
  try {
    let paginas = 0;
    for await (const pag of impl.sincronizar(ctx, cursor)) {
      const r = await registrarEntradas(dep.sql, linha, pag.entradas);
      tot.recebidos += r.recebidos; tot.novos += r.novos;
      cursor = pag.cursor;
      await dep.sql`update lab.conector set cursor = ${dep.sql.json(cursor as never)}, ultimo_sync_em = now() where id = ${linha.id}`;
      if (opts.maxPaginas && ++paginas >= opts.maxPaginas) break;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const proc = await processarPendentes(dep, { ...linha, cursor });
    await encerrarExecucao(dep.sql, ex, { ...tot, ...proc }, msg);
    return { ok: false as const, falha: msg, ...tot, ...proc };
  }
  const proc = await processarPendentes(dep, { ...linha, cursor });
  const status = await encerrarExecucao(dep.sql, ex, { ...tot, ...proc });
  return { ok: true as const, status, ...tot, ...proc };
}

export async function importar(dep: Dependencias, linha: LinhaConector, arquivo: { nome: string; conteudo: string }) {
  const { impl, ctx } = preparar(dep, linha);
  if (!impl.importar) throw new Error(`o conector "${linha.tipo}" não importa arquivos`);
  const ex = await iniciarExecucao(dep.sql, linha.id, 'importacao');
  try {
    const entradas = await impl.importar(arquivo, ctx);
    const reg = await registrarEntradas(dep.sql, linha, entradas);
    const proc = await processarPendentes(dep, linha);
    const status = await encerrarExecucao(dep.sql, ex, { ...reg, ...proc });
    return { ok: true as const, status, ...reg, ...proc };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await encerrarExecucao(dep.sql, ex, {}, msg);
    return { ok: false as const, falha: msg };
  }
}
