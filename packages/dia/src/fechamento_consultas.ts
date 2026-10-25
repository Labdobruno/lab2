/* Fechamento do dia com os dados da V2: a fotografia (só com o que o plano do dia e o ciclo já calculam), a geração no servidor
   com trava e auditoria, a gravação imutável (original + complementos), as decisões do gestor e a rotina (tique de 15 min). */
import type { Sql } from 'postgres';
import { assinar } from '@lab/ciclos';
import { somarDias, type Operacao } from '@lab/planejamento';
import { cicloDoDia } from './ciclo.js';
import { contextoDoDia, ErroDoDia, montarPessoa, type ContextoDia } from './consultas.js';
import { agoraLocal, decidirTique, diferencas, essenciaDoRelatorio, HORA_FECHAMENTO, relatorioDoDia, VERSAO_FECHAMENTO, type Fotografia, type PessoaFoto, type Relatorio } from './fechamento.js';
import { sistemico } from './motor.js';
import { VERSAO_REGRAS } from './producao.js';
import { NOMES } from './tipos.js';

const PAPEL_AVANCO: Record<string, string> = { agendada: 'agendamento', realizada: 'reuniao_realizada', proposta: 'proposta_enviada', oportunidade: 'oportunidades', ganho: 'vendas' };
const TXT_AVANCO: Record<string, string> = { agendamento: 'Reunião agendada', reuniao_realizada: 'Reunião realizada', proposta_enviada: 'Proposta enviada', oportunidades: 'Oportunidade', vendas: 'Venda' };

/* configuração da rotina: hora local de geração e se está ligada (pack › parametros › fechamento) */
export async function cfgFechamento(sql: Sql, op: Operacao): Promise<{ hora: string; ativo: boolean; fuso: string }> {
  const [o] = await sql<{ pack: any }[]>`select pack from lab.operacao where id = ${op.id}`;
  const f = o?.pack?.parametros?.fechamento ?? {};
  return { hora: typeof f.hora === 'string' && /^\d{2}:\d{2}$/.test(f.hora) ? f.hora : HORA_FECHAMENTO, ativo: f.ativo !== false, fuso: op.fuso };
}

/* a fotografia do dia: operação inteira, leitura de fim do dia (hoje conta inteiro) */
export async function fotografiaDoDia(sql: Sql, op: Operacao, data: string, agora: Date, opts: { historico?: Fotografia['historico']; avisos?: string[]; ctx?: ContextoDia } = {}): Promise<Fotografia> {
  const ctx = opts.ctx ?? (await contextoDoDia(sql, op, data, 'fim', agora));
  const C = await cicloDoDia(sql, op, data, 'fim', agora, ctx);
  const vendedores = ctx.pessoas.filter(p => p.ativa && ['sdr', 'closer', 'ambos'].includes(p.funcao ?? ''));
  const [avL, fotosManha] = await Promise.all([
    sql<any[]>`select coalesce(t.dono_id, n.dono_id) as dono_id, e.papel, n.id as neg, coalesce(c.nome, n.atributos->>'cliente', 'Negócio') as nome, n.valor_fechado
      from lab.negocio_transicao t join lab.etapa e on e.id = t.para_etapa_id join lab.negocio n on n.id = t.negocio_id left join lab.conta c on c.id = n.conta_id
      where t.operacao_id = ${op.id} and (t.em at time zone ${op.fuso})::date = ${data}::date and e.papel in ('agendada', 'realizada', 'proposta', 'oportunidade', 'ganho')`,
    sql<{ pessoa_id: string }[]>`select pessoa_id from lab.dia_foto where operacao_id = ${op.id} and data = ${data}::date and ritual = 'manha' and pessoa_id is not null`,
  ]);
  const registrada = new Set(fotosManha.map(f => f.pessoa_id));
  const pessoas: PessoaFoto[] = vendedores.map(p => {
    const D = montarPessoa(ctx, p), hojeFeito = ctx.feito.get(p.id)?.get(data) ?? {}, pd = D.prod.find(x => x.k === (ctx.diarias[0] ?? 'tentativa'));
    const J = Object.values(D.notas.justificativas);
    return {
      n: p.nome, funcaoNome: D.pessoa.funcaoNome, trabalha: D.ciclo.trabalhaHoje,
      prod: D.prod.filter(x => x.metaTotal > 0 || x.feitoCiclo > 0).map(x => ({ k: x.k, nome: x.nome, metaHoje: x.metaHoje, alvo: x.alvo, feito: x.feito, falta: x.falta, atraso: x.atraso, recup: x.recup, janela: x.janela, diario: x.diario, metaCiclo: x.metaCiclo, feitoCiclo: x.feitoCiclo, metaAmanha: x.metaAmanha })),
      semana: D.prod.filter(x => !x.diario && x.sem && x.sem.alvo > 0).map(x => ({ k: x.k, alvo: x.sem!.alvo, feito: x.sem!.feito })),
      tarefas: { hoje: D.tarefas.hoje, atrasadas: D.tarefas.atrasadas, feitasHoje: D.tarefas.feitasHoje, feitasHojePrazoHoje: D.tarefas.feitasHojePrazoHoje }, reunioes: [],
      avancos: avL.filter(a => a.dono_id === p.id).map(a => { const k = PAPEL_AVANCO[a.papel]!; return { k, neg: a.neg, nome: a.nome, ...(k === 'vendas' ? { valor: Number(a.valor_fechado ?? 0) } : {}), txt: TXT_AVANCO[k] + ': ' + a.nome }; }),
      registrosHoje: Object.values(hojeFeito).reduce((s, v) => s + (v > 0 ? 1 : 0), 0),
      plano: { registrado: registrada.has(p.id), justificadas: J.length, justTerceiro: J.filter(j => j.terceiro).length, feitos: Object.keys(D.notas.feitos).length },
      quad: { tipo: D.quad.tipo, tit: D.quad.tit, txt: D.quad.txt }, viab: D.viab ? { st: D.viab.st, txt: D.viab.txt } : null, capFonte: D.cap.fonte ?? '',
      padrao: { recorrente: D.padrao.recorrente, abaixo: D.padrao.abaixo, n: D.padrao.n, k: D.padrao.k }, garg: D.garg.slice(0, 3).map(g => ({ chave: g.chave, nome: g.nome, real: g.real, ref: g.ref, refTxt: g.refTxt, conf: g.conf, evid: g.evid, causas: g.causas ?? [], falta: g.falta ?? '', teste: g.teste ?? '' })),
      amanha: { iso: D.ciclo.amanha, cap: D.cap.v, tarefas: D.tarefas.amanha, metaContatos: pd?.metaAmanha ?? 0, atrasoContatos: pd ? Math.ceil(((pd.atraso || 0) + (pd.falta || 0)) / Math.max(1, pd.janela || 1)) : 0 },
      cards: D.cards.filter(x => x.classe !== 'normal').slice(0, 8).map(x => ({ id: x.id, nome: x.nome, etapa: x.etapa, classe: x.classe, motivos: x.motivos, valor: x.valor, ve: x.ve })), exposicao: D.exposicao,
    };
  });
  const porP: Record<string, Array<{ chave: string; nome: string }>> = {}; for (const p of vendedores) porP[p.nome] = montarPessoa(ctx, p).garg;
  const temMetas = ctx.metas.length > 0;
  const corte = agora.getTime(), hm = agoraLocal(op.fuso, agora).hm;
  return {
    data, corte, corteHora: hm, fuso: op.fuso, geradoEm: corte, versaoPlano: VERSAO_REGRAS, plano: { status: temMetas ? 'ativo' : 'sem_plano' }, crit: { pctOk: ctx.crit.pctOk, minN: ctx.crit.minN },
    fontes: { avisos: opts.avisos ?? [], indisponiveis: ['Agenda', 'Cadência'] }, pessoas,
    equipe: { sistemicos: sistemico(porP, Math.max(2, Math.ceil(vendedores.length / 2))),
      mes: C.metas.receita != null || C.metas.vendas != null ? { nome: 'ciclo de ' + C.ciclo.inicio, meta: C.metas.receita ?? null, realizado: C.realizado.receita ?? 0, esperado: C.metas.receita != null ? (C.linhas.find(l => l.ind === 'receita')?.esp ?? null) : null, projecao: C.proj.receita.ajust, vendas: { meta: C.metas.vendas ?? null, real: C.realizado.vendas ?? 0, proj: C.proj.vendas.ajust },
        sinais: C.sinais.map(s => ({ origem: s.origem, ind: s.ind ?? '', grav: s.grav, tit: s.tit, oque: s.oque, esperado: s.esperado, desvio: s.desvio })) } : null,
      conting: { nivel: C.contingencia.nivel, st: C.contingencia.st, fim: C.contingencia.fim, receita: { meta: C.contingencia.receita.meta, real: C.contingencia.receita.real, falta: C.contingencia.receita.falta ?? null, nivel: C.contingencia.receita.nivel }, vendas: { meta: C.contingencia.vendas.meta, real: C.contingencia.vendas.real, nivel: C.contingencia.vendas.nivel }, pessoas: C.contingencia.pessoas.map(p => ({ n: p.n, nivel: p.nivel, st: p.st })), versao: C.versao },
      quarter: null },
    historico: opts.historico ?? [],
  };
}

/* ---------- a rotina no servidor ---------- */
export interface TiqueInfo { existe: boolean; rodando: boolean; sem_expediente: boolean; falhas: number; complementado: boolean; cfg: { hora: string; ativo: boolean } }
export async function tiqueInfo(sql: Sql, op: Operacao, data: string): Promise<TiqueInfo> {
  const [[f], ex, cfg] = await Promise.all([
    sql`select 1 from lab.dia_fechamento where operacao_id = ${op.id} and data = ${data}::date`,
    sql<any[]>`select status, origem, inicio from lab.dia_execucao where operacao_id = ${op.id} and data = ${data}::date`,
    cfgFechamento(sql, op),
  ]);
  const agora = Date.now();
  return { existe: !!f, rodando: ex.some(e => e.status === 'rodando' && agora - new Date(e.inicio).getTime() < 10 * 60_000), sem_expediente: ex.some(e => e.status === 'sem_expediente'), falhas: ex.filter(e => e.status === 'falhou').length, complementado: ex.some(e => e.origem === 'complemento' && e.status !== 'rodando'), cfg: { hora: cfg.hora, ativo: cfg.ativo } };
}
/* há expediente hoje? alguém que vende trabalha (dia útil da operação e não está ausente) */
async function expediente(ctx: ContextoDia): Promise<boolean> {
  const hoje = ctx.data; if (!ctx.ciclo.uteis.includes(hoje)) return false;
  return ctx.pessoas.some(p => p.ativa && ['sdr', 'closer', 'ambos'].includes(p.funcao ?? '') && !(ctx.ausencias.get(p.id)?.has(hoje)));
}
export type StatusGeracao = 'ok' | 'complemento' | 'sem_mudanca' | 'sem_expediente' | 'falhou' | 'ignorado';
/* gera e grava o fechamento de hoje (ou da data pedida), com trava contra duas execuções ao mesmo tempo e auditoria */
export async function gerarFechamento(sql: Sql, op: Operacao, agora: Date, origem: 'agendado' | 'manual' | 'complemento', por = '', data?: string): Promise<{ status: StatusGeracao; data: string; erro?: string; assinatura?: string }> {
  const hoje = data ?? agoraLocal(op.fuso, agora).iso, t0 = Date.now();
  /* abre a execução dentro de uma transação com advisory lock: outra execução do mesmo dia em andamento → ignorado */
  const id = await sql.begin(async tx => {
    await tx`select pg_advisory_xact_lock(hashtext(${'lab.dia_fechamento:' + op.id + ':' + hoje}))`;
    const [r] = await tx`select 1 from lab.dia_execucao where operacao_id = ${op.id} and data = ${hoje}::date and status = 'rodando' and inicio > now() - interval '10 minutes'`;
    if (r) { await tx`insert into lab.dia_execucao (operacao_id, data, origem, status, fim, por, erro) values (${op.id}, ${hoje}::date, ${origem}, 'ignorado', now(), ${por}, 'outra execução do mesmo dia em andamento')`; return null; }
    await tx`update lab.dia_execucao set status = 'falhou', fim = now(), erro = coalesce(erro, 'execução interrompida (sem conclusão em 10 minutos)') where operacao_id = ${op.id} and data = ${hoje}::date and status = 'rodando'`;
    const [c] = await tx<{ n: number }[]>`select count(*)::int as n from lab.dia_execucao where operacao_id = ${op.id} and data = ${hoje}::date and origem = ${origem} and status = 'falhou'`;
    const [e] = await tx<{ id: number }[]>`insert into lab.dia_execucao (operacao_id, data, origem, tentativa, por) values (${op.id}, ${hoje}::date, ${origem}, ${(c?.n ?? 0) + 1}, ${por}) returning id`;
    return e!.id;
  });
  if (id == null) return { status: 'ignorado', data: hoje };
  const fim = async (status: StatusGeracao, detalhe: Record<string, unknown>, erro?: string) => { await sql`update lab.dia_execucao set status = ${status}, fim = now(), erro = ${erro ? erro.slice(0, 2000) : null}, detalhe = ${sql.json(detalhe as never)} where id = ${id}`; };
  try {
    const ctx = await contextoDoDia(sql, op, hoje, 'fim', agora);
    if (!(await expediente(ctx)) && origem !== 'manual') { await fim('sem_expediente', { ms: Date.now() - t0 }); return { status: 'sem_expediente', data: hoje }; }
    const histL = await sql<any[]>`select data::text, atual, acoes from lab.dia_fechamento where operacao_id = ${op.id} and data < ${hoje}::date order by data desc limit 10`;
    const historico = histL.map(r => ({ data: r.data, chaves: r.atual?.chaves ?? [], acoes: r.acoes ?? {}, pessoas: Object.fromEntries(((r.atual?.pessoas ?? []) as Array<{ n: string; pct: number | null }>).map(p => [p.n, { pct: p.pct }])) }));
    const F = await fotografiaDoDia(sql, op, hoje, agora, { historico, ctx });
    const R = relatorioDoDia(F), assinatura = await assinar(essenciaDoRelatorio(R));
    /* "meta" é a meta de receita do ciclo em vigor no dia: evidência para as metas históricas (ciclo sem plano nunca vira "configuração de hoje") */
    const ref = { corte: F.corte, versao: R.v, regras: VERSAO_REGRAS, plano: F.plano, pessoas: F.pessoas.map(p => p.n), hash: assinatura, meta: F.equipe?.mes?.meta ?? null, projecao: F.equipe?.mes?.projecao ?? null, realizado: F.equipe?.mes?.realizado ?? null };
    const rel = JSON.parse(JSON.stringify({ ...R, ref }));
    const st = await sql.begin(async tx => {
      const ins = await tx`insert into lab.dia_fechamento (operacao_id, data, original, atual, ref, assinatura) values (${op.id}, ${hoje}::date, ${tx.json(rel)}, ${tx.json(rel)}, ${tx.json(ref)}, ${assinatura}) on conflict (operacao_id, data) do nothing returning id`;
      if (ins.length) return 'ok' as const;
      const [x] = await tx<{ atual: Relatorio; assinatura: string; complementos: unknown[] }[]>`select atual, assinatura, complementos from lab.dia_fechamento where operacao_id = ${op.id} and data = ${hoje}::date for update`;
      if (x!.assinatura === assinatura) return 'sem_mudanca' as const;
      const mudou = diferencas(x!.atual, R), comps = [...(x!.complementos ?? []), { em: new Date().toISOString(), origem, hash: assinatura, mudou }].slice(-30);
      await tx`update lab.dia_fechamento set atual = ${tx.json(rel)}, ref = ${tx.json(ref)}, assinatura = ${assinatura}, complementos = ${tx.json(comps as never)} where operacao_id = ${op.id} and data = ${hoje}::date`;
      return 'complemento' as const;
    });
    await fim(st, { ms: Date.now() - t0, pessoas: R.pessoas.length, alertas: R.alertas.length, hash: assinatura });
    return { status: st, data: hoje, assinatura };
  } catch (e) {
    const msg = String((e as Error)?.stack ?? (e as Error)?.message ?? e).slice(0, 1500);
    await fim('falhou', { ms: Date.now() - t0 }, msg).catch(() => {});
    return { status: 'falhou', data: hoje, erro: msg.split('\n')[0] };
  }
}
/* o tique de 15 minutos: depois do horário gera uma vez; às 23h30 complementa uma vez; falhou → tenta de novo (até 4) */
export async function tiqueFechamento(sql: Sql, op: Operacao, agora: Date) {
  const L = agoraLocal(op.fuso, agora), t = await tiqueInfo(sql, op, L.iso), o = decidirTique(t, L.hm);
  return o ? gerarFechamento(sql, op, agora, o, 'agendamento') : { status: 'nada' as const, data: L.iso, hm: L.hm };
}

/* ---------- leitura e decisões ---------- */
export async function lerFechamento(sql: Sql, op: Operacao, data: string) {
  const [r] = await sql<any[]>`select data::text, original, atual, complementos, acoes, ref, assinatura, gerado_em as "geradoEm", atualizado_em as "atualizadoEm" from lab.dia_fechamento where operacao_id = ${op.id} and data = ${data}::date`;
  if (!r) return null;
  const integro = (await assinar(essenciaDoRelatorio(r.atual))) === r.assinatura;
  return { ...r, integro };
}
export async function listaFechamentos(sql: Sql, op: Operacao, de: string, ate: string) {
  return sql<any[]>`select data::text, atual -> 'resumo' as resumo, jsonb_array_length(complementos) as complementos, gerado_em as "geradoEm" from lab.dia_fechamento where operacao_id = ${op.id} and data between ${de}::date and ${ate}::date order by data desc`;
}
/* situação da rotina: o relatório de hoje existe? a última execução e a última falha (o "não saiu" vira aviso) */
export async function statusRotina(sql: Sql, op: Operacao, agora: Date) {
  const L = agoraLocal(op.fuso, agora), t = await tiqueInfo(sql, op, L.iso), cfg = await cfgFechamento(sql, op);
  const [u] = await sql<any[]>`select inicio, fim, origem, status, tentativa, erro from lab.dia_execucao where operacao_id = ${op.id} and status <> 'ignorado' order by inicio desc limit 1`;
  const [f] = await sql<any[]>`select erro, inicio from lab.dia_execucao where operacao_id = ${op.id} and status = 'falhou' and inicio > now() - interval '2 days' order by inicio desc limit 1`;
  const atrasado = cfg.ativo && !t.existe && !t.sem_expediente && L.hm >= addMin(cfg.hora, 20);
  return { hoje: L.iso, hm: L.hm, existe: t.existe, semExpediente: t.sem_expediente, falhas: t.falhas, cfg, atrasado, ultima: u ?? null, ultimoErro: f ?? null };
}
const addMin = (hm: string, m: number) => { const [h, mi] = hm.split(':').map(Number); const t = (h! * 60 + mi! + m) % 1440; return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); };
const ESTADOS_ACAO = ['analisada', 'decidida', 'encaminhada', 'investigar'] as const;
export async function acaoFechamento(sql: Sql, op: Operacao, b: { data: string; chave: string; estado: string; texto?: string; por?: string | null }) {
  if (!(ESTADOS_ACAO as readonly string[]).includes(b.estado)) throw new ErroDoDia(`estado deve ser: ${ESTADOS_ACAO.join(', ')}`);
  const texto = (b.texto ?? '').trim();
  if (b.estado !== 'analisada' && texto.length < 5) throw new ErroDoDia('descreva a decisão (5 caracteres ou mais)');
  if (!b.chave || b.chave.length > 120) throw new ErroDoDia('sem chave');
  return sql.begin(async tx => {
    const [r] = await tx<{ acoes: Record<string, any> }[]>`select acoes from lab.dia_fechamento where operacao_id = ${op.id} and data = ${b.data}::date for update`;
    if (!r) throw new ErroDoDia('relatório não encontrado', 404);
    const ant = r.acoes[b.chave] ?? {}, reg = { estado: b.estado, texto, em: new Date().toISOString(), por: b.por ?? null }, hist = [...(Array.isArray(ant.hist) ? ant.hist : []), reg].slice(-20);
    const acoes = { ...r.acoes, [b.chave]: { ...reg, hist } };
    await tx`update lab.dia_fechamento set acoes = ${tx.json(acoes as never)} where operacao_id = ${op.id} and data = ${b.data}::date`;
    return { ok: true, acao: acoes[b.chave] };
  });
}

