/* API do LAB V2. Rotas:
   GET  /saude                                  público
   POST /entrada/:conector                      público, mas cada conector confere a própria assinatura/chave
   /admin/*                                     exige Authorization: Bearer <ADMIN_TOKEN>
     GET  /admin/packs                          packs disponíveis e se estão válidos
     GET  /admin/operacoes                      operações
     POST /admin/operacoes                      { slug, nome, packId, ajustes? }
     POST /admin/operacoes/:slug/pack           { ajustes? } reaplica o pack
     GET  /admin/conectores?operacao=<slug>     conectores
     POST /admin/conectores                     { operacao, tipo, nome, config?, segredoRef? }
     POST /admin/conectores/:id/sincronizar
     POST /admin/conectores/:id/importar?nome=<arquivo.csv>   corpo = conteúdo do arquivo
     POST /admin/conectores/:id/processar       reprocessa pendentes e erros
     GET  /admin/conectores/:id/saude           execuções, entradas por status, erros e o que revisar
     GET  /admin/metricas/dicionario            definição de cada número
     GET  /admin/operacoes/:slug/ciclo?data=    ciclo, dias úteis e metas vigentes
     POST /admin/operacoes/:slug/metas          { cicloInicio?, metas: [{ indicador, valor, pessoaId?, nota? }] } só acrescenta
     GET  /admin/operacoes/:slug/buildup?receita=&data=&ticket=   sugestão de metas, de receita até tentativas (não grava)
     GET  /admin/operacoes/:slug/ritmo?data=    esperado até hoje, quem está no ritmo e quem está atrás
     GET  /admin/operacoes/:slug/fechamento-do-dia?data=
     GET  /admin/operacoes/:slug/metricas?de=AAAA-MM-DD&ate=AAAA-MM-DD   canais, coorte, fluxo, vendas e retenção (somente leitura) */
import { resolverPack } from '@lab/nucleo';
import {
  atualizarPackDaOperacao, carregarConector, conectorDoTipo, criarOperacao, iguaisSeguro, importar, processarPendentes,
  receberWebhook, sincronizar, CONECTORES, type Dependencias, type LinhaConector,
} from '@lab/conectores';
import { DICIONARIO, operacaoPorSlug, relatorio, validarPeriodo } from '@lab/metricas';
import {
  acrescentarMetas, cicloDaOperacao, dataValida, fechamento, hojeNoFuso, metasVigentes, operacao as operacaoPlanejamento, ritmo, sugestaoBuildup,
} from '@lab/planejamento';
import type { Sql } from 'postgres';
import { CATALOGO } from './catalogo.js';

export interface Ambiente {
  ADMIN_TOKEN?: string;
  [segredo: string]: unknown;
}

/* conectores só leem variáveis com nome em MAIÚSCULAS e nunca as do próprio LAB */
const RESERVADOS = new Set(['ADMIN_TOKEN', 'DATABASE_URL']);
export function lerSegredo(env: Ambiente) {
  return (ref: string) => (/^[A-Z][A-Z0-9_]*$/.test(ref) && !RESERVADOS.has(ref) && typeof env[ref] === 'string' ? (env[ref] as string) : undefined);
}

const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo, null, 2), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
const erro = (mensagem: string, status = 400) => json({ erro: mensagem }, status);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function corpoJSON(req: Request): Promise<Record<string, unknown>> {
  try { const b = await req.json(); return b && typeof b === 'object' ? (b as Record<string, unknown>) : {}; }
  catch { throw new RespostaErro('corpo JSON inválido', 400); }
}
class RespostaErro extends Error { constructor(m: string, readonly status: number) { super(m); } }

export function criarApp(opts: { sql: Sql; env: Ambiente; fetch?: typeof fetch; agora?: () => Date }) {
  const dep: Dependencias = { sql: opts.sql, segredos: lerSegredo(opts.env), ...(opts.fetch ? { fetch: opts.fetch } : {}), ...(opts.agora ? { agora: opts.agora } : {}) };
  const { sql } = opts;

  async function conectorOu404(id: string): Promise<LinhaConector> {
    if (!UUID.test(id)) throw new RespostaErro('conector não encontrado', 404);
    const c = await carregarConector(sql, id);
    if (!c) throw new RespostaErro('conector não encontrado', 404);
    return c;
  }

  async function admin(req: Request, partes: string[], url: URL): Promise<Response> {
    const [recurso, id, acao] = partes;
    const m = req.method;

    if (recurso === 'packs' && m === 'GET') {
      return json(Object.keys(CATALOGO).map(p => { const r = resolverPack(p, CATALOGO); return { id: p, ok: r.ok, versao: r.pack?.versao, linhagem: r.pack?.linhagem, erros: r.erros, avisos: r.avisos }; }));
    }

    if (recurso === 'metricas' && id === 'dicionario' && m === 'GET') return json(DICIONARIO);

    if (recurso === 'operacoes') {
      if (!id && m === 'GET') return json(await sql`select id, slug, nome, pack_id, pack_versao, ativa, criado_em from lab.operacao order by criado_em`);
      if (!id && m === 'POST') {
        const b = await corpoJSON(req);
        if (typeof b.slug !== 'string' || typeof b.nome !== 'string' || typeof b.packId !== 'string') return erro('informe slug, nome e packId');
        try {
          const r = await criarOperacao(sql, { slug: b.slug, nome: b.nome, packId: b.packId, ...(b.ajustes ? { ajustes: b.ajustes as Record<string, unknown> } : {}) }, CATALOGO);
          return json(r, 201);
        } catch (e) {
          const msg = (e as Error).message;
          return erro(/duplicate key|unique/i.test(msg) ? `já existe uma operação "${b.slug}"` : msg, /unique/i.test(msg) ? 409 : 400);
        }
      }
      if (id && ['ciclo', 'metas', 'buildup', 'ritmo', 'fechamento-do-dia'].includes(acao ?? '')) {
        const op = await operacaoPlanejamento(sql, id);
        if (!op) return erro('operação não encontrada', 404);
        const data = url.searchParams.get('data') ?? hojeNoFuso(op.fuso, (opts.agora ?? (() => new Date()))());
        if (!dataValida(data)) return erro('data deve ser AAAA-MM-DD');
        const ciclo = cicloDaOperacao(op, data);
        if (acao === 'ciclo' && m === 'GET') return json({ ciclo: { inicio: ciclo.inicio, fim: ciclo.fim, diasUteis: ciclo.uteis.length, dias: ciclo.uteis }, metas: await metasVigentes(sql, op.id, ciclo.inicio) });
        if (acao === 'metas' && m === 'POST') {
          const b = await corpoJSON(req);
          if (!Array.isArray(b.metas)) return erro('informe metas: [{ indicador, valor, pessoaId? }]');
          const inicio = typeof b.cicloInicio === 'string' ? b.cicloInicio : ciclo.inicio;
          if (!dataValida(inicio)) return erro('cicloInicio deve ser AAAA-MM-DD');
          try { return json({ cicloInicio: inicio, acrescentadas: await acrescentarMetas(sql, op.id, inicio, b.metas as never) }, 201); }
          catch (e) { return erro((e as Error).message); }
        }
        if (acao === 'buildup' && m === 'GET') {
          const receita = Number(url.searchParams.get('receita'));
          if (!(receita > 0)) return erro('informe receita (> 0)');
          const ticket = url.searchParams.get('ticket');
          return json(await sugestaoBuildup(sql, op, data, receita, ticket ? { ticketMedio: Number(ticket) } : {}));
        }
        if (acao === 'ritmo' && m === 'GET') return json(await ritmo(sql, op, data));
        if (acao === 'fechamento-do-dia' && m === 'GET') return json(await fechamento(sql, op, data));
      }
      if (id && acao === 'metricas' && m === 'GET') {
        const op = await operacaoPorSlug(sql, id);
        if (!op) return erro('operação não encontrada', 404);
        const periodo = { de: url.searchParams.get('de') ?? '', ate: url.searchParams.get('ate') ?? '' };
        const invalido = validarPeriodo(periodo);
        if (invalido) return erro(invalido);
        return json({ operacao: op.slug, ...(await relatorio(sql, op, periodo)) });
      }
      if (id && acao === 'pack' && m === 'POST') {
        const [op] = await sql<{ id: string }[]>`select id from lab.operacao where slug = ${id}`;
        if (!op) return erro('operação não encontrada', 404);
        const b = await corpoJSON(req).catch(() => ({} as Record<string, unknown>));
        try { return json(await atualizarPackDaOperacao(sql, op.id, CATALOGO, b.ajustes as Record<string, unknown> | undefined)); }
        catch (e) { return erro((e as Error).message); }
      }
    }

    if (recurso === 'conectores') {
      if (!id && m === 'GET') {
        const slug = url.searchParams.get('operacao');
        return json(await sql`select c.id, o.slug as operacao, c.tipo, c.nome, c.ativo, c.segredo_ref, c.ultimo_sync_em, c.cursor
          from lab.conector c join lab.operacao o on o.id = c.operacao_id where ${slug ? sql`o.slug = ${slug}` : sql`true`} order by o.slug, c.nome`);
      }
      if (!id && m === 'POST') {
        const b = await corpoJSON(req);
        if (typeof b.operacao !== 'string' || typeof b.tipo !== 'string' || typeof b.nome !== 'string') return erro('informe operacao (slug), tipo e nome');
        if (!CONECTORES[b.tipo]) return erro(`tipo de conector desconhecido; disponíveis: ${Object.keys(CONECTORES).join(', ')}`);
        const cfg = conectorDoTipo(b.tipo).config.safeParse(b.config ?? {});
        if (!cfg.success) return erro(`config inválida: ${cfg.error.issues.map(i => `${i.path.join('.') || 'config'}: ${i.message}`).join('; ')}`);
        if (b.segredoRef != null && (typeof b.segredoRef !== 'string' || !/^[A-Z][A-Z0-9_]*$/.test(b.segredoRef) || RESERVADOS.has(b.segredoRef))) {
          return erro('segredoRef deve ser um nome de variável em MAIÚSCULAS (ex.: AMICTA), diferente de ADMIN_TOKEN e DATABASE_URL');
        }
        const [op] = await sql<{ id: string }[]>`select id from lab.operacao where slug = ${b.operacao}`;
        if (!op) return erro('operação não encontrada', 404);
        try {
          const [c] = await sql`insert into lab.conector (operacao_id, tipo, nome, config, segredo_ref)
            values (${op.id}, ${b.tipo}, ${b.nome}, ${sql.json(cfg.data as never)}, ${(b.segredoRef as string | undefined) ?? null}) returning id, tipo, nome`;
          return json({ ...c, webhook: conectorDoTipo(b.tipo).webhook ? `/entrada/${c!.id}` : null }, 201);
        } catch (e) {
          return /unique/i.test((e as Error).message) ? erro(`já existe um conector "${b.nome}" nesta operação`, 409) : erro((e as Error).message);
        }
      }
      if (id) {
        const c = await conectorOu404(id);
        if (acao === 'sincronizar' && m === 'POST') return json(await sincronizar(dep, c));
        if (acao === 'processar' && m === 'POST') return json(await processarPendentes(dep, c));
        if (acao === 'importar' && m === 'POST') {
          const nome = url.searchParams.get('nome') ?? req.headers.get('x-arquivo-nome');
          if (!nome) return erro('informe o nome do arquivo em ?nome=');
          const r = await importar(dep, c, { nome, conteudo: await req.text() });
          return json(r, r.ok ? 200 : 400);
        }
        if (acao === 'saude' && m === 'GET') {
          const [execucoes, entradas, errosRecentes, revisar] = await Promise.all([
            sql`select tipo, status, inicio, fim, recebidos, novos, aplicados, erros from lab.execucao where conector_id = ${c.id} order by id desc limit 10`,
            sql`select status, count(*)::int as n from lab.entrada_bruta where conector_id = ${c.id} group by status`,
            sql`select id, tipo, erro, tentativas, recebido_em from lab.entrada_bruta where conector_id = ${c.id} and status = 'erro' order by id desc limit 20`,
            sql`select 'canal' as o_que, chave, nome from lab.canal where operacao_id = ${c.operacao_id} and a_revisar
                union all select 'motivo de perda', chave, nome from lab.motivo_perda where operacao_id = ${c.operacao_id} and a_revisar
                union all select 'condição de pagamento', chave, nome from lab.condicao_pagamento where operacao_id = ${c.operacao_id} and a_revisar`,
          ]);
          return json({ conector: { id: c.id, tipo: c.tipo, nome: c.nome, ativo: c.ativo, cursor: c.cursor },
            entradas: Object.fromEntries(entradas.map(e => [e.status, e.n])), execucoes, errosRecentes, revisar });
        }
      }
    }
    return erro('rota não encontrada', 404);
  }

  return async function atender(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const partes = url.pathname.split('/').filter(Boolean);
    try {
      if (partes[0] === 'saude' && req.method === 'GET') {
        let banco = 'ok';
        try { await sql`select 1`; } catch { banco = 'indisponível'; }
        return json({ ok: banco === 'ok', banco, conectores: Object.keys(CONECTORES), packs: Object.keys(CATALOGO) }, banco === 'ok' ? 200 : 503);
      }
      if (partes[0] === 'entrada' && partes[1] && req.method === 'POST') {
        const c = await conectorOu404(partes[1]);
        const r = await receberWebhook(dep, c, { cabecalhos: req.headers, corpo: await req.text() });
        return json(r.corpo, r.http);
      }
      if (partes[0] === 'admin') {
        const token = opts.env.ADMIN_TOKEN;
        const enviado = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
        if (!token || token.length < 24) return erro('ADMIN_TOKEN não configurado (mínimo 24 caracteres)', 503);
        if (!iguaisSeguro(enviado, token)) return erro('não autorizado', 401);
        return await admin(req, partes.slice(1), url);
      }
      return erro('rota não encontrada', 404);
    } catch (e) {
      if (e instanceof RespostaErro) return erro(e.message, e.status);
      console.error(e);
      return erro('erro interno', 500);
    }
  };
}

/* rodada do cron: sincroniza quem sabe sincronizar e reprocessa pendências de todos */
export async function rodadaAgendada(opts: { sql: Sql; env: Ambiente; fetch?: typeof fetch }) {
  const dep: Dependencias = { sql: opts.sql, segredos: lerSegredo(opts.env), ...(opts.fetch ? { fetch: opts.fetch } : {}) };
  const conectores = await opts.sql<LinhaConector[]>`select id, operacao_id, tipo, nome, config, segredo_ref, ativo, cursor from lab.conector where ativo order by id`;
  const resultado: Record<string, unknown> = {};
  for (const c of conectores) {
    try {
      const impl = conectorDoTipo(c.tipo);
      resultado[c.nome] = impl.sincronizar ? await sincronizar(dep, c, { maxPaginas: 200 }) : await processarPendentes(dep, c);
    } catch (e) {
      resultado[c.nome] = { ok: false, falha: (e as Error).message };
    }
  }
  return resultado;
}
