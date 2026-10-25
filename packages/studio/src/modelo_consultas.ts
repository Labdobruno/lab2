/* Studio no banco (Onda 5): modelo em blocos (rascunho versionado), publicações imutáveis com validade, modelo observado por coorte,
   coorte real por vínculo (para o monitor), simulação do modelo e premissas levadas ao plano do quarter.
   Somente o Studio escreve em lab.studio_modelo e lab.studio_publicacao. Taxas observadas são sempre de coorte (quem entrou e chegou),
   nunca o fluxo do período: cada negócio conta uma vez. */
import type { Sql } from 'postgres';
import { negocios, type NegocioLinha } from '@lab/metricas';
import { somarDias, type Operacao } from '@lab/planejamento';
import { salvarEstrategia, TX } from '@lab/estrategia';
import { ErroDeStudio } from './consultas.js';
import {
  comparar, direto, monitorar, parametros, reverso, sensibilidade, TIPOS_NO, temErro, validar,
  type ArestaModelo, type Modelo, type NoModelo, type ObsAresta, type ObsNo, type Observado, type Parametros, type TipoNo,
} from './motor.js';

const DIA = 86_400_000;
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const dataOk = (d: unknown): d is string => typeof d === 'string' && DATA.test(d) && !Number.isNaN(Date.parse(d));
const ID_NO = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,39}$/;
export const LIMITE_BLOCOS = 60, LIMITE_CONEXOES = 200;
const PAPEIS_PERDA = new Set(['perdido', 'churn']);

interface EtapaLinha { id: string; chave: string; nome: string; papel: string; ordem: number; prazo_dias: number | null }
async function etapasDoFunil(sql: Sql, op: Operacao): Promise<EtapaLinha[]> {
  const [funil] = await sql<{ id: string }[]>`select id from lab.funil where operacao_id = ${op.id} and principal limit 1`;
  if (!funil) throw new ErroDeStudio('a operação não tem funil principal', 409);
  return sql<EtapaLinha[]>`select id, chave, nome, papel, ordem, prazo_dias from lab.etapa where funil_id = ${funil.id} and ativa order by ordem`;
}

/* ---------- validação da forma do documento (o motor valida o sentido) ---------- */
export function normalizarModelo(entrada: unknown): Modelo {
  const m = entrada as Partial<Modelo> | null;
  if (!m || typeof m !== 'object') throw new ErroDeStudio('o modelo precisa de nos e arestas');
  const nos: Record<string, NoModelo> = {}, arestas: Record<string, ArestaModelo> = {};
  const nosIn = (m.nos ?? {}) as Record<string, Partial<NoModelo>>, arIn = (m.arestas ?? {}) as Record<string, Partial<ArestaModelo>>;
  if (typeof nosIn !== 'object' || Array.isArray(nosIn) || typeof arIn !== 'object' || Array.isArray(arIn)) throw new ErroDeStudio('nos e arestas devem ser objetos indexados pelo id');
  if (Object.keys(nosIn).length > LIMITE_BLOCOS) throw new ErroDeStudio(`no máximo ${LIMITE_BLOCOS} blocos`);
  if (Object.keys(arIn).length > LIMITE_CONEXOES) throw new ErroDeStudio(`no máximo ${LIMITE_CONEXOES} conexões`);
  const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : NaN);
  const txt = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined);
  for (const [id, n] of Object.entries(nosIn)) {
    if (!ID_NO.test(id)) throw new ErroDeStudio(`bloco com id inválido: ${JSON.stringify(id)}`);
    if (!n || typeof n !== 'object') throw new ErroDeStudio(`bloco ${id} inválido`);
    if (n.apagado) continue;
    if (!(n.tipo! in TIPOS_NO)) throw new ErroDeStudio(`bloco ${id}: tipo deve ser um de ${Object.keys(TIPOS_NO).join(', ')}`);
    const o: NoModelo = { tipo: n.tipo as TipoNo, nome: txt(n.nome, 80) || id };
    for (const k of ['vol', 'limite', 'ticket', 'margem', 'prazo', 'x', 'y'] as const) { const v = num((n as Record<string, unknown>)[k]); if (v != null) { if (Number.isNaN(v)) throw new ErroDeStudio(`bloco ${id}: ${k} deve ser número`); (o as unknown as Record<string, number>)[k] = v; } }
    if (n.un) o.un = txt(n.un, 20);
    if (n.cap && typeof n.cap === 'object') { const v = num(n.cap.v); if (v != null && Number.isNaN(v)) throw new ErroDeStudio(`bloco ${id}: capacidade deve ser número`); o.cap = { v, por: n.cap.por === 'dia' ? 'dia' : 'periodo' }; }
    if (n.bind && typeof n.bind === 'object') o.bind = { tipo: txt(n.bind.tipo, 20) ?? null, etapa: txt(n.bind.etapa, 40) ?? null, canal: txt(n.bind.canal, 40) ?? null, indicador: txt(n.bind.indicador, 40) ?? null };
    if (n.fonte) o.fonte = n.fonte;
    nos[id] = o;
  }
  for (const [id, a] of Object.entries(arIn)) {
    if (!ID_NO.test(id)) throw new ErroDeStudio(`conexão com id inválido: ${JSON.stringify(id)}`);
    if (!a || typeof a !== 'object') throw new ErroDeStudio(`conexão ${id} inválida`);
    if (a.apagado) continue;
    if (typeof a.de !== 'string' || typeof a.para !== 'string' || !nos[a.de] || !nos[a.para]) throw new ErroDeStudio(`conexão ${id}: liga blocos que não existem (${a.de} → ${a.para})`);
    const o: ArestaModelo = { de: a.de, para: a.para };
    for (const k of ['taxa', 'n', 'dias', 'maxVoltas'] as const) { const v = num(a[k]); if (v != null) { if (Number.isNaN(v)) throw new ErroDeStudio(`conexão ${id}: ${k} deve ser número`); o[k] = v; } }
    if (a.retorno) o.retorno = true; if (a.exclusiva) o.exclusiva = true;
    if (a.fonte) o.fonte = a.fonte; if (a.ind) o.ind = txt(a.ind, 40) ?? null;
    arestas[id] = o;
  }
  const cen: Modelo['cenarios'] = {};
  for (const [k, c] of Object.entries((m.cenarios ?? {}) as Record<string, { nome?: unknown; regras?: Record<string, { v?: unknown; fonte?: unknown; n?: unknown; nota?: unknown }> }>)) {
    if (!/^[a-z0-9_-]{1,40}$/.test(k) || k === 'base') throw new ErroDeStudio(`cenário com chave inválida: ${k}`);
    const regras: NonNullable<Modelo['cenarios']>[string]['regras'] = {};
    for (const [rk, r] of Object.entries(c?.regras ?? {})) { const v = num(r?.v); if (v == null || Number.isNaN(v)) continue; regras[rk] = { v, fonte: (r.fonte as never) ?? 'hipotese', n: num(r.n) ?? null, nota: txt(r.nota, 200) ?? '' }; }
    cen[k] = { nome: txt(c?.nome, 60) || k, regras };
  }
  const dias = num(m.diasPeriodo);
  return { nos, arestas, cenarios: cen, dir: m.dir === 'TB' ? 'TB' : 'LR', diasPeriodo: dias != null && !Number.isNaN(dias) && dias > 0 ? dias : 30 };
}

/* ---------- rascunho versionado ---------- */
interface LinhaModelo { id: string; nome: string; doc: Modelo; versao: number; status: string; por: string; criado_em: Date; atualizado_em: Date }
export async function modelos(sql: Sql, op: Operacao) {
  const L = await sql<Array<LinhaModelo & { publicacoes: number; validade_ate: string | null }>>`
    select m.id, m.nome, m.doc, m.versao, m.status, m.por, m.criado_em, m.atualizado_em,
           (select count(*)::int from lab.studio_publicacao p where p.modelo_id = m.id) as publicacoes,
           (select max(p.validade_ate)::text from lab.studio_publicacao p where p.modelo_id = m.id) as validade_ate
    from lab.studio_modelo m where m.operacao_id = ${op.id} and m.status <> 'arquivado' order by m.atualizado_em desc`;
  return L.map(m => { const P = parametros(m.doc), V = validar(P); return { id: m.id, nome: m.nome, versao: m.versao, status: m.status, por: m.por, atualizadoEm: m.atualizado_em, blocos: Object.keys(P.nos).length, conexoes: Object.keys(P.arestas).length, erros: V.filter(x => x.grav === 'erro').length, avisos: V.filter(x => x.grav === 'aviso').length, publicacoes: m.publicacoes, validadeAte: m.validade_ate }; });
}
async function linhaDoModelo(sql: Sql, op: Operacao, nome: string): Promise<LinhaModelo> {
  const [m] = await sql<LinhaModelo[]>`select id, nome, doc, versao, status, por, criado_em, atualizado_em from lab.studio_modelo where operacao_id = ${op.id} and nome = ${nome}`;
  if (!m) throw new ErroDeStudio(`modelo "${nome}" não encontrado`, 404);
  return m;
}
export async function salvarModelo(sql: Sql, op: Operacao, nome: unknown, doc: unknown, por: string | null) {
  const n = typeof nome === 'string' ? nome.trim() : '';
  if (!n || n.length > 80) throw new ErroDeStudio('informe o nome do modelo (até 80 caracteres)');
  const M = normalizarModelo(doc);
  const [r] = await sql<{ id: string; versao: number; status: string }[]>`insert into lab.studio_modelo (operacao_id, nome, doc, por) values (${op.id}, ${n}, ${sql.json(M as never)}, ${por ?? ''})
    on conflict (operacao_id, nome) do update set doc = excluded.doc, versao = lab.studio_modelo.versao + 1, por = excluded.por, status = case when lab.studio_modelo.status = 'arquivado' then 'rascunho' else lab.studio_modelo.status end
    returning id, versao, status`;
  return { ...r!, nome: n, validacao: validar(parametros(M)) };
}
export async function arquivarModelo(sql: Sql, op: Operacao, nome: string) {
  const m = await linhaDoModelo(sql, op, nome);
  await sql`update lab.studio_modelo set status = 'arquivado' where id = ${m.id}`;
  return { id: m.id, status: 'arquivado' };
}

/* ---------- publicações ---------- */
interface LinhaPub { id: string; n: number; snapshot: Modelo; cenario: string; alvo: string | null; meta: string | null; validade_de: string; validade_ate: string; motivo: string; por: string; em: Date }
const pub = (p: LinhaPub) => ({ id: p.id, n: p.n, cenario: p.cenario, alvo: p.alvo, meta: p.meta == null ? null : Number(p.meta), validadeDe: p.validade_de, validadeAte: p.validade_ate, motivo: p.motivo, por: p.por, em: p.em });
async function publicacoesDo(sql: Sql, modeloId: string) {
  return sql<LinhaPub[]>`select id, n, snapshot, cenario, alvo, meta, validade_de::text, validade_ate::text, motivo, por, em from lab.studio_publicacao where modelo_id = ${modeloId} order by n desc`;
}
/* a publicação que vale numa data: a mais recente cuja validade contém a data; sem ela, a mais recente */
export function publicacaoVigente<T extends { validade_de: string; validade_ate: string; n: number }>(L: T[], data: string): T | null {
  const dentro = L.filter(p => p.validade_de <= data && data <= p.validade_ate).sort((a, b) => b.n - a.n);
  return dentro[0] ?? L.sort((a, b) => b.n - a.n)[0] ?? null;
}
export async function publicarModelo(sql: Sql, op: Operacao, nome: string, b: { cenario?: unknown; alvo?: unknown; meta?: unknown; validadeDe?: unknown; validadeAte?: unknown; motivo?: unknown }, por: string | null) {
  const m = await linhaDoModelo(sql, op, nome);
  const cen = typeof b.cenario === 'string' && b.cenario ? b.cenario : 'base';
  if (cen !== 'base' && !m.doc.cenarios?.[cen]) throw new ErroDeStudio(`cenário "${cen}" não existe neste modelo`);
  const P = parametros(m.doc, cen), V = validar(P);
  if (temErro(V)) throw new ErroDeStudio('o modelo tem erros de validação e não pode ser publicado: ' + V.filter(x => x.grav === 'erro').map(x => x.msg).join(' '), 409);
  if (!dataOk(b.validadeDe) || !dataOk(b.validadeAte)) throw new ErroDeStudio('informe a validade (validadeDe e validadeAte em AAAA-MM-DD)');
  if (b.validadeAte < b.validadeDe) throw new ErroDeStudio('a validade termina antes de começar');
  const alvo = typeof b.alvo === 'string' && b.alvo ? b.alvo : Object.keys(P.nos).find(n => P.nos[n]!.tipo === 'resultado') ?? null;
  if (alvo && !P.nos[alvo]) throw new ErroDeStudio(`o bloco "${alvo}" não existe`);
  const meta = b.meta == null || b.meta === '' ? null : Number(b.meta);
  if (meta != null && !(meta > 0)) throw new ErroDeStudio('a meta deve ser maior que zero');
  const motivo = typeof b.motivo === 'string' ? b.motivo.trim().slice(0, 500) : '';
  const [{ n } = { n: 0 }] = await sql<{ n: number }[]>`select coalesce(max(n), 0)::int as n from lab.studio_publicacao where modelo_id = ${m.id}`;
  if (n > 0 && motivo.length < 5) throw new ErroDeStudio('republicar exige o motivo (o que mudou e por quê)');
  const [p] = await sql<LinhaPub[]>`insert into lab.studio_publicacao (operacao_id, modelo_id, n, snapshot, cenario, alvo, meta, validade_de, validade_ate, motivo, por)
    values (${op.id}, ${m.id}, ${n + 1}, ${sql.json(m.doc as never)}, ${cen}, ${alvo}, ${meta}, ${b.validadeDe}::date, ${b.validadeAte}::date, ${motivo}, ${por ?? ''})
    returning id, n, snapshot, cenario, alvo, meta, validade_de::text, validade_ate::text, motivo, por, em`;
  await sql`update lab.studio_modelo set status = 'publicado' where id = ${m.id}`;
  return pub(p!);
}

/* ---------- coorte real: o que o modelo prevê, medido no dado da operação pelo vínculo de cada bloco ---------- */
/* Vínculo: bloco.bind.etapa = papel da etapa (lead, agendada, …, ganho, perdido). A coorte é "negócios criados no período";
   um bloco conta quantos dela alcançaram a sua etapa; uma conexão conta, entre os que alcançaram a origem, quantos alcançaram o destino. */
export async function coorteReal(sql: Sql, op: Operacao, P: Parametros, de: string, ate: string, hoje: string): Promise<Observado> {
  const etapas = await etapasDoFunil(sql, op), ordemPapel = new Map(etapas.map(e => [e.papel, e.ordem])), prazoPapel = new Map(etapas.map(e => [e.papel, e.prazo_dias]));
  const fim = somarDias(ate, 1);
  const pop = (await negocios(sql, op.id, op.fuso, 'criados', { de, ate: fim })).filter(n => n.tipo === 'novo' && n.funilPrincipal);
  const alcancou = (n: NegocioLinha, papel: string) => (papel === 'lead' ? true : papel === 'perdido' ? n.status === 'perdido' : papel === 'ganho' ? n.status === 'ganho' || n.papeisAlcancados.includes('ganho') : n.papeisAlcancados.includes(papel) || (ordemPapel.has(papel) && (ordemPapel.get(n.papelAtual) ?? -1) >= ordemPapel.get(papel)! && n.papelAtual !== 'perdido'));
  const [abertos, perdas, fluxos, canais] = await Promise.all([
    sql<{ papel: string; saldo: number; acima: number; idade: number | null }[]>`
      select e.papel, count(*)::int as saldo,
             count(*) filter (where e.prazo_dias is not null and coalesce(n.etapa_desde, n.criado_em) < ${hoje}::timestamptz - make_interval(days => e.prazo_dias))::int as acima,
             avg(extract(epoch from (${hoje}::timestamptz - coalesce(n.etapa_desde, n.criado_em))) / 86400)::float as idade
      from lab.negocio n join lab.etapa e on e.id = n.etapa_id join lab.funil f on f.id = n.funil_id
      where n.operacao_id = ${op.id} and n.status = 'aberto' and n.tipo = 'novo' and f.principal group by 1`,
    sql<{ papel: string; motivo: string; n: number }[]>`
      select e.papel, coalesce(m.nome, '(sem motivo)') as motivo, count(*)::int as n
      from lab.negocio n join lab.etapa e on e.id = n.etapa_id left join lab.motivo_perda m on m.id = n.motivo_perda_id
      where n.operacao_id = ${op.id} and n.status = 'perdido' and n.tipo = 'novo' and (n.fechado_em at time zone ${op.fuso})::date >= ${de}::date and (n.fechado_em at time zone ${op.fuso})::date < ${fim}::date group by 1, 2`,
    sql<{ papel: string; n: number }[]>`
      select e.papel, count(distinct t.negocio_id)::int as n from lab.negocio_transicao t join lab.etapa e on e.id = t.para_etapa_id
      where t.operacao_id = ${op.id} and (t.em at time zone ${op.fuso})::date >= ${de}::date and (t.em at time zone ${op.fuso})::date < ${fim}::date group by 1`,
    sql<{ chave: string; nome: string }[]>`select chave, nome from lab.canal where operacao_id = ${op.id}`,
  ]);
  const nomeCanal = new Map(canais.map(c => [c.chave, c.nome]));
  const fluxo = new Map(fluxos.map(f => [f.papel, f.n])); fluxo.set('lead', pop.length);
  const nos: Record<string, ObsNo> = {}, arestas: Record<string, ObsAresta> = {};
  const papelDe = (id: string) => P.nos[id]?.bind?.etapa ?? null;
  for (const id of Object.keys(P.nos)) {
    const papel = papelDe(id);
    if (!papel) { nos[id] = { estado: 'semvinculo' }; continue; }
    if (!ordemPapel.has(papel) && !PAPEIS_PERDA.has(papel)) { nos[id] = { estado: 'semdado', nota: `a etapa "${papel}" não existe no funil principal` }; continue; }
    const na = pop.filter(n => alcancou(n, papel)), ab = abertos.find(a => a.papel === papel);
    const motivos: Record<string, number> = {}; for (const p of perdas.filter(p => p.papel === papel)) motivos[p.motivo] = p.n;
    const porCanal: Record<string, number> = {}; if (P.nos[id]!.tipo === 'entrada') for (const n of na) { const c = nomeCanal.get(n.canal ?? '') ?? n.canal ?? '(sem origem)'; porCanal[c] = (porCanal[c] ?? 0) + 1; }
    nos[id] = { estado: 'ok', entradas: na.length, saldo: ab?.saldo ?? 0, acimaPrazo: ab?.acima ?? 0, idadeMed: ab?.idade ?? null, prazo: prazoPapel.get(papel) ?? null, perdas: perdas.filter(p => p.papel === papel).reduce((s, p) => s + p.n, 0), motivos: Object.keys(motivos).length ? motivos : undefined, porCanal: Object.keys(porCanal).length ? porCanal : undefined };
  }
  const hojeMs = Date.parse(hoje + 'T00:00:00Z');
  for (const a of Object.keys(P.arestas)) {
    const e = P.arestas[a]!, pd = papelDe(e.de), pp = papelDe(e.para);
    if (!pd || !pp || nos[e.de]?.estado !== 'ok' || nos[e.para]?.estado !== 'ok') { arestas[a] = { estado: 'semvinculo', nota: !pd || !pp ? 'conexão sem vínculo com o CRM' : 'uma das pontas não tem dado' }; continue; }
    const origem = pop.filter(n => alcancou(n, pd)), k = origem.filter(n => alcancou(n, pp));
    /* coorte imatura: parte relevante da origem entrou há menos tempo do que a passagem costuma levar */
    const janela = Math.max(7, e.dias ?? prazoPapel.get(pd) ?? 7), jovens = origem.filter(n => hojeMs - Date.parse(n.criadoEm) < janela * DIA).length;
    const porCanal: Record<string, { k: number; n: number }> = {};
    for (const n of origem) { const c = nomeCanal.get(n.canal ?? '') ?? n.canal ?? '(sem origem)'; const x = (porCanal[c] ??= { k: 0, n: 0 }); x.n++; if (alcancou(n, pp)) x.k++; }
    const fDe = fluxo.get(pd) ?? 0, fPara = fluxo.get(pp) ?? 0;
    arestas[a] = { estado: 'ok', k: k.length, n: origem.length, imaturo: origem.length > 0 && jovens / origem.length >= 0.3, fluxo: fDe > 0 ? fPara / fDe : null, porCanal: Object.keys(porCanal).length > 1 ? porCanal : undefined };
  }
  return { nos, arestas };
}

/* ---------- modelo observado: o funil principal como modelo linear, com as taxas da coorte da janela ---------- */
export async function modeloObservado(sql: Sql, op: Operacao, ate: string, dias = 30): Promise<{ modelo: Modelo; janela: { de: string; ate: string }; coorte: number }> {
  const etapas = await etapasDoFunil(sql, op), de = somarDias(ate, -op.janelaHistoricaDias);
  const nos: Record<string, NoModelo> = {}, arestas: Record<string, ArestaModelo> = {};
  const comuns = etapas.filter(e => !PAPEIS_PERDA.has(e.papel)), perda = etapas.find(e => e.papel === 'perdido');
  comuns.forEach((e, i) => { nos[e.chave] = { tipo: i === 0 ? 'entrada' : e.papel === 'ganho' ? 'resultado' : 'etapa', nome: e.nome, un: i === 0 ? 'lead' : e.papel === 'ganho' ? 'contrato' : undefined, bind: { tipo: i === 0 ? 'lead' : e.papel === 'ganho' ? 'ganho' : 'etapa', etapa: e.papel }, prazo: e.prazo_dias ?? undefined, x: 40 + i * 230, y: 40 }; });
  if (perda) nos[perda.chave] = { tipo: 'perda', nome: perda.nome, bind: { tipo: 'perda', etapa: 'perdido' }, x: 40 + Math.floor(comuns.length / 2) * 230, y: 200 };
  for (let i = 0; i < comuns.length - 1; i++) arestas['a' + i] = { de: comuns[i]!.chave, para: comuns[i + 1]!.chave, taxa: null, fonte: 'historico' };
  const M: Modelo = { nos, arestas, cenarios: {}, dir: 'LR', diasPeriodo: dias };
  const P = parametros(M), obs = await coorteReal(sql, op, P, de, ate, ate);
  const pop = obs.nos![comuns[0]!.chave]?.entradas ?? 0, janelaDias = Math.max(1, (Date.parse(ate) - Date.parse(de)) / DIA);
  for (const a of Object.keys(arestas)) { const o = obs.arestas![a]; if (o?.estado === 'ok' && o.n) { arestas[a]!.taxa = Math.round((o.k! / o.n) * 10000) / 10000; arestas[a]!.n = o.n; } }
  const ganhos = (await negocios(sql, op.id, op.fuso, 'fechados', { de, ate: somarDias(ate, 1) })).filter(n => n.status === 'ganho' && n.tipo === 'novo');
  const receita = ganhos.reduce((s, g) => s + (g.valorFechado ?? 0), 0);
  nos[comuns[0]!.chave]!.vol = Math.round((pop * dias) / janelaDias); nos[comuns[0]!.chave]!.fonte = 'historico';
  const res = comuns.find(e => e.papel === 'ganho'); if (res && ganhos.length) nos[res.chave]!.ticket = Math.round(receita / ganhos.length);
  return { modelo: M, janela: { de, ate }, coorte: pop };
}
/* preencher pelo histórico: um modelo desenhado à mão ganha as taxas e volumes da coorte onde há vínculo; o resto fica como está */
export async function preencherPeloHistorico(sql: Sql, op: Operacao, doc: Modelo, ate: string) {
  const de = somarDias(ate, -op.janelaHistoricaDias), P = parametros(doc), obs = await coorteReal(sql, op, P, de, ate, ate);
  const M = structuredClone(doc), mudou: string[] = [], janelaDias = Math.max(1, (Date.parse(ate) - Date.parse(de)) / DIA), dias = M.diasPeriodo ?? 30;
  for (const a of Object.keys(M.arestas ?? {})) { const o = obs.arestas![a]; if (o?.estado === 'ok' && o.n) { M.arestas![a] = { ...M.arestas![a]!, taxa: Math.round((o.k! / o.n) * 10000) / 10000, n: o.n, fonte: 'historico' }; mudou.push('a:' + a); } }
  for (const n of Object.keys(M.nos ?? {})) { const o = obs.nos![n]; if (M.nos![n]!.tipo === 'entrada' && o?.estado === 'ok' && o.entradas != null) { M.nos![n] = { ...M.nos![n]!, vol: Math.round((o.entradas * dias) / janelaDias), fonte: 'historico' }; mudou.push('n:' + n); } }
  return { modelo: M, mudou, janela: { de, ate } };
}

/* ---------- simulação do modelo (não grava) ---------- */
export async function simularModelo(sql: Sql, op: Operacao, b: { nome?: unknown; doc?: unknown; cenario?: unknown; cenarios?: unknown; alvo?: unknown; meta?: unknown; medida?: unknown; estoque?: unknown; comPipeline?: unknown }, hoje: string) {
  const doc = typeof b.nome === 'string' && b.nome ? (await linhaDoModelo(sql, op, b.nome)).doc : normalizarModelo(b.doc);
  const cen = typeof b.cenario === 'string' && b.cenario ? b.cenario : 'base';
  const P = parametros(doc, cen), V = validar(P), G = Object.keys(P.nos);
  const alvo = typeof b.alvo === 'string' && b.alvo && P.nos[b.alvo] ? b.alvo : G.find(n => P.nos[n]!.tipo === 'resultado') ?? null;
  const meta = b.meta == null || b.meta === '' ? null : Number(b.meta), medida = b.medida === 'receita' ? 'receita' : 'volume';
  /* estoque: informado, ou o pipeline aberto de cada bloco com vínculo (negócios abertos hoje na etapa) */
  const estoque: Record<string, number> = {};
  if (b.estoque && typeof b.estoque === 'object') { for (const [k, v] of Object.entries(b.estoque as Record<string, unknown>)) if (P.nos[k] && Number.isFinite(Number(v))) estoque[k] = Number(v); }
  else if (b.comPipeline) { const ab = await sql<{ papel: string; n: number }[]>`select e.papel, count(*)::int as n from lab.negocio n join lab.etapa e on e.id = n.etapa_id join lab.funil f on f.id = n.funil_id where n.operacao_id = ${op.id} and n.status = 'aberto' and n.tipo = 'novo' and f.principal group by 1`;
    for (const n of G) { const papel = P.nos[n]!.bind?.etapa; const x = papel ? ab.find(a => a.papel === papel) : null; if (x && P.nos[n]!.tipo !== 'entrada') estoque[n] = x.n; } }
  const d = temErro(V) ? null : direto(P);
  const rev = alvo && meta != null && meta > 0 ? reverso(P, alvo, meta, { medida, estoque }) : null;
  const sens = alvo && d ? sensibilidade(P, alvo) : null;
  const cens = Array.isArray(b.cenarios) ? (b.cenarios as unknown[]).filter((c): c is string => typeof c === 'string' && (c === 'base' || !!doc.cenarios?.[c])) : ['base', ...Object.keys(doc.cenarios ?? {})];
  const cmp = alvo ? comparar(doc, cens, alvo, { meta, medida, estoque }).map(c => ({ cen: c.cen, nome: c.nome, resultado: c.resultado, alterados: c.alterados, lacunas: c.lacunas, viavel: c.viavel, condicoes: c.condicoes, entradas: c.reverso?.ok ? c.reverso.entradas : null, erros: c.validacao.filter(x => x.grav === 'erro').length })) : [];
  return { hoje, cenario: cen, alvo, validacao: V, direto: d, reverso: rev, sensibilidade: sens, comparacao: cmp, estoque, parametros: { nos: P.nos, arestas: P.arestas, alterados: P.alterados, dias: P.dias } };
}

/* ---------- monitor: a publicação vigente contra a coorte real do seu período ---------- */
export async function monitorDoModelo(sql: Sql, op: Operacao, nome: string, hoje: string) {
  const m = await linhaDoModelo(sql, op, nome), pubs = await publicacoesDo(sql, m.id), p = publicacaoVigente(pubs, hoje);
  if (!p) throw new ErroDeStudio('o modelo ainda não foi publicado: publique com a validade para acompanhar o realizado', 409);
  const P = parametros(p.snapshot, p.cenario), plano = direto(P, { diasPeriodo: Math.max(1, (Date.parse(p.validade_ate) - Date.parse(p.validade_de)) / DIA + 1) });
  const D = Math.max(1, (Date.parse(p.validade_ate) - Date.parse(p.validade_de)) / DIA + 1), dec = Math.max(0, Math.min(D, (Date.parse(hoje) - Date.parse(p.validade_de)) / DIA + 1));
  const ate = hoje < p.validade_ate ? hoje : p.validade_ate;
  const obs = await coorteReal(sql, op, P, p.validade_de, ate, hoje);
  const mon = monitorar(P, plano, obs, { diasPeriodo: D, decorridos: dec, alvo: p.alvo ?? undefined, meta: p.meta == null ? null : Number(p.meta), minN: 5 });
  return { modelo: { id: m.id, nome: m.nome, versao: m.versao }, publicacao: pub(p), periodo: { de: p.validade_de, ate: p.validade_ate, decorridos: Math.round(dec), dias: Math.round(D) }, plano, observado: obs, monitor: mon, publicacoes: pubs.map(pub) };
}
export async function modeloDoStudio(sql: Sql, op: Operacao, nome: string, hoje: string) {
  const m = await linhaDoModelo(sql, op, nome), pubs = await publicacoesDo(sql, m.id), P = parametros(m.doc);
  return { id: m.id, nome: m.nome, versao: m.versao, status: m.status, por: m.por, atualizadoEm: m.atualizado_em, doc: m.doc, validacao: validar(P), publicacoes: pubs.map(pub), vigente: publicacaoVigente(pubs, hoje)?.n ?? null };
}

/* ---------- premissas ao plano do quarter: as taxas do modelo publicado viram as premissas do objetivo ---------- */
/* taxa entre dois papéis = o que chega ao bloco B por entidade colocada no bloco A (passa por tudo que há entre eles) */
export function taxasDoModelo(P: Parametros): { ticket: number | null; taxas: Record<string, number | null>; faltam: string[] } {
  const porPapel = (papel: string) => Object.keys(P.nos).find(n => P.nos[n]!.bind?.etapa === papel) ?? null;
  const entre = (a: string, b: string) => { const A = porPapel(a), B = porPapel(b); if (!A || !B) return null; const r = direto(P, { entradas: { [A]: 1 }, semCap: true, semRetorno: false }); return r.ok ? r.v[B] ?? null : null; };
  const pares: Array<[string, string, string]> = [[TX.leadAg, 'lead', 'agendada'], [TX.agReal, 'agendada', 'realizada'], [TX.realOport, 'realizada', 'oportunidade'], [TX.oportVenda, 'oportunidade', 'ganho'], [TX.leadVenda, 'lead', 'ganho'], [TX.contatoAg, 'contato', 'agendada']];
  const taxas: Record<string, number | null> = {}, faltam: string[] = [];
  for (const [k, a, b] of pares) { const v = entre(a, b); taxas[k] = v; if (v == null) faltam.push(k); }
  /* sem bloco de oportunidade, "realizada → oportunidade" e "oportunidade → venda" não existem; a de proposta cobre o trecho */
  if (taxas[TX.realOport] == null && taxas[TX.oportVenda] == null) { const rp = entre('realizada', 'proposta'), pv = entre('proposta', 'ganho'); if (rp != null && pv != null) { taxas[TX.realOport] = rp; taxas[TX.oportVenda] = pv; } }
  const res = Object.keys(P.nos).find(n => P.nos[n]!.tipo === 'resultado' && P.nos[n]!.ticket != null);
  return { ticket: res ? Number(P.nos[res]!.ticket) : null, taxas, faltam: faltam.filter(k => taxas[k] == null) };
}
export async function levarPremissasAoPlano(sql: Sql, op: Operacao, nome: string, data: string, por: string | null) {
  const m = await linhaDoModelo(sql, op, nome), pubs = await publicacoesDo(sql, m.id), p = publicacaoVigente(pubs, data);
  if (!p) throw new ErroDeStudio('publique o modelo antes de levar as premissas ao plano', 409);
  const P = parametros(p.snapshot, p.cenario), T = taxasDoModelo(P);
  const taxas = Object.fromEntries(Object.entries(T.taxas).filter(([, v]) => v != null));
  if (!Object.keys(taxas).length && T.ticket == null) throw new ErroDeStudio('o modelo não tem blocos com vínculo às etapas do funil (lead, agendada, realizada, oportunidade/proposta, ganho): nada para levar ao plano', 409);
  const premissas = { ticket: T.ticket, taxas, origem: { tipo: 'studio', modelo: m.nome, publicacao: p.n, cenario: p.cenario, em: new Date().toISOString() } };
  await salvarEstrategia(sql, op, data, { premissas }, por);
  return { premissas, faltam: T.faltam };
}
