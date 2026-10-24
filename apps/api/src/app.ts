/* API do LAB V2. Rotas:
   GET  /app                                     tela (página sem dados; pede o ADMIN_TOKEN para buscar na API)
   GET  /auth/config                             { login: true|false }
   POST /auth/entrar  { email, senha }           login do administrador pelo Supabase
   POST /auth/renovar { refreshToken }
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
     GET  /admin/operacoes/:slug/pessoas        equipe
     POST /admin/operacoes/:slug/pessoas        { nome, funcao }
     POST /admin/operacoes/:slug/pessoas/:id    { nome?, funcao?, ativa? }
     GET  /admin/operacoes/:slug/ciclo?data=    ciclo, dias úteis e metas vigentes
     POST /admin/operacoes/:slug/metas          { cicloInicio?, metas: [{ indicador, valor, pessoaId?, nota? }] } só acrescenta
     GET  /admin/operacoes/:slug/buildup?receita=&data=&ticket=   sugestão de metas, de receita até tentativas (não grava)
     GET  /admin/operacoes/:slug/ritmo?data=    esperado até hoje, quem está no ritmo e quem está atrás
     GET  /admin/operacoes/:slug/fechamento-do-dia?data=
     GET  /admin/hipoteses/variaveis            variáveis que as fórmulas das hipóteses podem usar
     GET  /admin/operacoes/:slug/hipoteses      biblioteca de hipóteses do pack (fórmulas em texto)
     GET  /admin/operacoes/:slug/achados?data=  achados dentro do orçamento de atenção, em espera e sem dados
     GET  /admin/operacoes/:slug/qualidade?data=  checagens de qualidade de dados
     GET|POST /admin/operacoes/:slug/decisoes   canvas de decisão { pergunta, opcoes[], escolha, porque?, criterioSucesso?, revisarEm?, hipoteseId?, contexto? }
     GET|POST /admin/operacoes/:slug/experimentos            { titulo, metrica, alvo, fimPrevisto?, hipoteseId?, decisaoId? }
     POST /admin/operacoes/:slug/experimentos/:id/concluir   { descartar?, conclusao? }
     GET  /admin/operacoes/:slug/quarter?data=  plano do quarter: passos, cenários e programa de ciclos
     POST /admin/operacoes/:slug/quarter        inicia o quarter (passo 1)        ?data=
     GET  /admin/operacoes/:slug/quarter/diagnostico                              passo 1: o quarter anterior
     POST /admin/operacoes/:slug/quarter/meta   { receita, ticketMedio?, taxas? } passo 2
     POST /admin/operacoes/:slug/quarter/cenario { cenario }                      passo 3
     POST /admin/operacoes/:slug/quarter/confirmar                                passo 4
     POST /admin/operacoes/:slug/quarter/programa { pesos? }                      passo 5
     POST /admin/operacoes/:slug/quarter/travar                                   passo 6: grava as metas dos ciclos
     POST /admin/operacoes/:slug/fechar-ciclo?data=   retrato imutável e assinado do ciclo
     GET  /admin/operacoes/:slug/retratos
     GET|POST /admin/operacoes/:slug/aprendizados     { tipo, texto, cicloInicio? }
     GET  /admin/operacoes/:slug/metricas?de=AAAA-MM-DD&ate=AAAA-MM-DD   canais, coorte, fluxo, vendas e retenção (somente leitura) */
import { FUNCOES_PESSOA, resolverPack, VARIAVEIS, type PackResolvido } from '@lab/nucleo';
import {
  atualizarPackDaOperacao, carregarConector, packDaOperacao, conectorDoTipo, criarOperacao, iguaisSeguro, importar, processarPendentes,
  receberWebhook, sincronizar, CONECTORES, type Dependencias, type LinhaConector,
} from '@lab/conectores';
import { DICIONARIO, operacaoPorSlug, relatorio, validarPeriodo } from '@lab/metricas';
import {
  acrescentarMetas, cicloDaOperacao, dataValida, fechamento, hojeNoFuso, metasVigentes, operacao as operacaoPlanejamento, ritmo, sugestaoBuildup,
} from '@lab/planejamento';
import {
  aprendizados, confirmarEsforco, criarQuarter, definirMeta, definirPrograma, diagnostico, ErroDeRegra, escolherCenario, fecharCiclo,
  quarterDaOperacao, registrarAprendizado, retratos, travarQuarter,
} from '@lab/ciclos';
import {
  avaliarHipoteses, checarQualidade, concluirExperimento, decisoes, ErroDeMemoria, experimentos, iniciarExperimento, montarContexto, registrarDecisao,
} from '@lab/hipoteses';
import { garantirMigracoes } from './migracoes.js';
import { MIGRACOES } from './migracoes.gen.js';
import type { Sql } from 'postgres';
import { CATALOGO } from './catalogo.js';
import { CSP, PAGINA } from './tela.js';
import { entrar, loginAtivo, renovar, tokenDoAdmin, type AmbienteAuth } from './auth.js';

export interface Ambiente extends AmbienteAuth {
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

export function criarApp(opts: { sql: Sql; env: Ambiente; fetch?: typeof fetch; agora?: () => Date; migrarAoIniciar?: boolean }) {
  const dep: Dependencias = { sql: opts.sql, segredos: lerSegredo(opts.env), ...(opts.fetch ? { fetch: opts.fetch } : {}), ...(opts.agora ? { agora: opts.agora } : {}) };
  const { sql } = opts;

  async function conectorOu404(id: string): Promise<LinhaConector> {
    if (!UUID.test(id)) throw new RespostaErro('conector não encontrado', 404);
    const c = await carregarConector(sql, id);
    if (!c) throw new RespostaErro('conector não encontrado', 404);
    return c;
  }

  async function admin(req: Request, partes: string[], url: URL): Promise<Response> {
    const [recurso, id, acao, sub] = partes;
    const m = req.method;

    if (recurso === 'packs' && m === 'GET') {
      return json(Object.keys(CATALOGO).map(p => { const r = resolverPack(p, CATALOGO); return { id: p, ok: r.ok, versao: r.pack?.versao, linhagem: r.pack?.linhagem, erros: r.erros, avisos: r.avisos }; }));
    }

    if (recurso === 'metricas' && id === 'dicionario' && m === 'GET') return json(DICIONARIO);
    if (recurso === 'hipoteses' && id === 'variaveis' && m === 'GET') return json(VARIAVEIS);

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
      if (id && ['hipoteses', 'achados', 'qualidade', 'decisoes', 'experimentos'].includes(acao ?? '')) {
        const op = await operacaoPlanejamento(sql, id);
        if (!op) return erro('operação não encontrada', 404);
        const hoje = hojeNoFuso(op.fuso, (opts.agora ?? (() => new Date()))());
        const data = url.searchParams.get('data') ?? hoje;
        if (!dataValida(data)) return erro('data deve ser AAAA-MM-DD');
        try {
          const biblioteca = async () => {
            const [o] = await sql<{ pack: PackResolvido | null; pack_id: string; ajustes: Record<string, unknown> }[]>`select pack, pack_id, ajustes from lab.operacao where id = ${op.id}`;
            const guardado = o?.pack?.hipoteses;
            /* operações criadas antes da fase 6 não têm a biblioteca guardada: resolve de novo pelo pack e pelos ajustes */
            const pack = guardado ? o!.pack! : packDaOperacao(o!.pack_id, o!.ajustes, CATALOGO).pack;
            return { hipoteses: pack?.hipoteses ?? [], orcamento: pack?.parametros?.orcamentoAtencao ?? 3, amostraMinima: pack?.parametros?.amostraMinima ?? 10 };
          };
          if (acao === 'hipoteses' && m === 'GET') return json((await biblioteca()).hipoteses);
          if (acao === 'qualidade' && m === 'GET') return json(await checarQualidade(sql, op, data));
          if (acao === 'achados' && m === 'GET') {
            const b = await biblioteca();
            const ctx = await montarContexto(sql, op, data, { amostraMinima: b.amostraMinima });
            return json({ data, ...avaliarHipoteses(b.hipoteses, ctx, b.orcamento), contexto: ctx });
          }
          if (acao === 'decisoes' && m === 'GET') return json(await decisoes(sql, op));
          if (acao === 'decisoes' && m === 'POST') return json(await registrarDecisao(sql, op, await corpoJSON(req) as never), 201);
          if (acao === 'experimentos' && m === 'GET') {
            const b = await biblioteca();
            return json(await experimentos(sql, op, await montarContexto(sql, op, data, { amostraMinima: b.amostraMinima })));
          }
          if (acao === 'experimentos' && !sub && m === 'POST') {
            const b = await biblioteca();
            return json(await iniciarExperimento(sql, op, await montarContexto(sql, op, data, { amostraMinima: b.amostraMinima }), data, await corpoJSON(req) as never), 201);
          }
          if (acao === 'experimentos' && sub && partes[4] === 'concluir' && m === 'POST') {
            const b = await biblioteca(); const corpo = await corpoJSON(req);
            return json(await concluirExperimento(sql, op, sub, await montarContexto(sql, op, data, { amostraMinima: b.amostraMinima }), { descartar: corpo.descartar === true, conclusao: corpo.conclusao }));
          }
        } catch (e) {
          if (e instanceof ErroDeMemoria) return erro(e.message, e.status);
          throw e;
        }
      }
      if (id && ['quarter', 'fechar-ciclo', 'retratos', 'aprendizados'].includes(acao ?? '')) {
        const op = await operacaoPlanejamento(sql, id);
        if (!op) return erro('operação não encontrada', 404);
        const data = url.searchParams.get('data') ?? hojeNoFuso(op.fuso, (opts.agora ?? (() => new Date()))());
        if (!dataValida(data)) return erro('data deve ser AAAA-MM-DD');
        try {
          if (acao === 'quarter') {
            if (!sub && m === 'GET') return json(await quarterDaOperacao(sql, op, data));
            if (!sub && m === 'POST') return json(await criarQuarter(sql, op, data), 201);
            if (sub === 'diagnostico' && m === 'GET') return json(await diagnostico(sql, op, data));
            if (m === 'POST') {
              const b = await corpoJSON(req).catch(() => ({} as Record<string, unknown>));
              if (sub === 'meta') return json(await definirMeta(sql, op, data, { receita: Number(b.receita), ...(b.ticketMedio != null ? { ticketMedio: Number(b.ticketMedio) } : {}), ...(b.taxas ? { taxas: b.taxas as never } : {}) }));
              if (sub === 'cenario') return json(await escolherCenario(sql, op, data, String(b.cenario)));
              if (sub === 'confirmar') return json(await confirmarEsforco(sql, op, data));
              if (sub === 'programa') return json(await definirPrograma(sql, op, data, Array.isArray(b.pesos) ? b.pesos.map(Number) : undefined));
              if (sub === 'travar') return json(await travarQuarter(sql, op, data));
            }
          }
          if (acao === 'fechar-ciclo' && m === 'POST') return json(await fecharCiclo(sql, op, data, hojeNoFuso(op.fuso, (opts.agora ?? (() => new Date()))())), 201);
          if (acao === 'retratos' && m === 'GET') return json(await retratos(sql, op));
          if (acao === 'aprendizados' && m === 'GET') return json(await aprendizados(sql, op));
          if (acao === 'aprendizados' && m === 'POST') {
            const b = await corpoJSON(req);
            return json(await registrarAprendizado(sql, op, { tipo: String(b.tipo), texto: String(b.texto ?? ''), cicloInicio: typeof b.cicloInicio === 'string' && dataValida(b.cicloInicio) ? b.cicloInicio : null }), 201);
          }
        } catch (e) {
          if (e instanceof ErroDeRegra) return erro(e.message, e.status);
          throw e;
        }
      }
      if (id && acao === 'pessoas') {
        const [op] = await sql<{ id: string }[]>`select id from lab.operacao where slug = ${id}`;
        if (!op) return erro('operação não encontrada', 404);
        if (!sub && m === 'GET') return json(await sql`select id, nome, funcao, ativa from lab.pessoa where operacao_id = ${op.id} order by ativa desc, nome`);
        if (!sub && m === 'POST') {
          const b = await corpoJSON(req);
          const nome = typeof b.nome === 'string' ? b.nome.trim() : '';
          if (!nome || nome.length > 120) return erro('informe o nome');
          if (typeof b.funcao !== 'string' || !(FUNCOES_PESSOA as readonly string[]).includes(b.funcao)) return erro(`funcao deve ser: ${FUNCOES_PESSOA.join(', ')}`);
          const [p] = await sql`insert into lab.pessoa (operacao_id, nome, funcao) values (${op.id}, ${nome}, ${b.funcao}) returning id, nome, funcao, ativa`;
          return json(p, 201);
        }
        if (sub && UUID.test(sub) && m === 'POST') {
          const b = await corpoJSON(req);
          const nome = typeof b.nome === 'string' ? b.nome.trim() : null;
          if (nome !== null && (!nome || nome.length > 120)) return erro('nome inválido');
          if (b.funcao != null && (typeof b.funcao !== 'string' || !(FUNCOES_PESSOA as readonly string[]).includes(b.funcao))) return erro(`funcao deve ser: ${FUNCOES_PESSOA.join(', ')}`);
          if (b.ativa != null && typeof b.ativa !== 'boolean') return erro('ativa deve ser verdadeiro ou falso');
          const [p] = await sql`update lab.pessoa set nome = coalesce(${nome}, nome), funcao = coalesce(${(b.funcao as string | undefined) ?? null}, funcao), ativa = coalesce(${(b.ativa as boolean | undefined) ?? null}, ativa)
            where id = ${sub} and operacao_id = ${op.id} returning id, nome, funcao, ativa`;
          return p ? json(p) : erro('pessoa não encontrada', 404);
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
      if ((partes[0] === 'app' || partes.length === 0) && partes.length <= 1 && req.method === 'GET') {
        return new Response(PAGINA, { headers: { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': CSP, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' } });
      }
      if (partes[0] === 'saude' && req.method === 'GET') {
        let banco = 'ok';
        let migracoes = 'não verificado';
        try {
          await sql`select 1`;
          const feitas = await sql<{ nome: string }[]>`select nome from lab.migracao`.catch(() => [] as { nome: string }[]);
          const faltam = MIGRACOES.filter(m => !feitas.some(f => f.nome === m.nome)).length;
          migracoes = faltam ? `${faltam} pendente(s): serão aplicadas na próxima rodada (até 15 min)` : 'em dia';
        } catch { banco = 'indisponível'; }
        return json({ ok: banco === 'ok', banco, migracoes, conectores: Object.keys(CONECTORES), packs: Object.keys(CATALOGO) }, banco === 'ok' ? 200 : 503);
      }
      if (partes[0] === 'entrada' && partes[1] && req.method === 'POST') {
        const c = await conectorOu404(partes[1]);
        const r = await receberWebhook(dep, c, { cabecalhos: req.headers, corpo: await req.text() });
        return json(r.corpo, r.http);
      }
      if (partes[0] === 'auth') {
        const f = opts.fetch ?? fetch;
        if (partes[1] === 'config' && req.method === 'GET') return json({ login: loginAtivo(opts.env) });
        if (!loginAtivo(opts.env)) return erro('login por e-mail não está configurado', 404);
        if (partes[1] === 'entrar' && req.method === 'POST') {
          const b = await corpoJSON(req);
          const sessao = typeof b.email === 'string' && typeof b.senha === 'string' ? await entrar(opts.env, f, b.email, b.senha) : null;
          return sessao ? json(sessao) : erro('e-mail ou senha incorretos', 401);
        }
        if (partes[1] === 'renovar' && req.method === 'POST') {
          const b = await corpoJSON(req);
          const sessao = typeof b.refreshToken === 'string' ? await renovar(opts.env, f, b.refreshToken) : null;
          return sessao ? json(sessao) : erro('sessão expirada', 401);
        }
      }
      if (partes[0] === 'admin') {
        const token = opts.env.ADMIN_TOKEN;
        const tokenOk = !!token && token.length >= 24;
        if (!tokenOk && !loginAtivo(opts.env)) return erro('ADMIN_TOKEN não configurado (mínimo 24 caracteres)', 503);
        const enviado = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
        const autorizado = (tokenOk && iguaisSeguro(enviado, token!)) || await tokenDoAdmin(opts.env, opts.fetch ?? fetch, enviado);
        if (!autorizado) return erro('não autorizado', 401);
        if (opts.migrarAoIniciar) await garantirMigracoes(sql);
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
