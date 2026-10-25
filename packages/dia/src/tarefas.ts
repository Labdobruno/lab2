/* Tarefas: a ação com responsável e prazo. Nasce de um achado, de um sinal do Fechamento, de uma pendência ou à mão; nunca sozinha.
   Adiar conta e guarda o prazo original (reagendar não apaga o desvio); concluir e cancelar são finais. Só SELECT/INSERT/UPDATE de status. */
import type { Sql } from 'postgres';
import { somarDias, type Operacao } from '@lab/planejamento';
import type { TarefaFoto } from './fechamento.js';

export class ErroDeTarefa extends Error { constructor(m: string, readonly status = 400) { super(m); } }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, DATA = /^\d{4}-\d{2}-\d{2}$/;
const dataOk = (d: unknown): d is string => typeof d === 'string' && DATA.test(d) && !Number.isNaN(Date.parse(d));
export const ORIGENS_TAREFA = ['achado', 'sinal', 'fechamento', 'pendencia', 'manual'] as const;

export interface Tarefa { id: string; titulo: string; descricao: string | null; responsavelId: string | null; responsavel: string; negocioId: string | null; negocioNome: string | null; negocioFechado: boolean; prazo: string; prazoOriginal: string; prioridade: 'alta' | 'normal' | 'baixa'; origem: { tipo: string; chave?: string; data?: string }; status: 'aberta' | 'feita' | 'cancelada'; adiamentos: number; terceiro: boolean; ultimoMotivo: string | null; feitaEm: string | null; por: string; criadoEm: string }
const COLS = (sql: Sql) => sql`t.id, t.titulo, t.descricao, t.responsavel_id, coalesce(p.nome, 'Gestor') as responsavel, t.negocio_id, coalesce(c.nome, n.atributos->>'cliente') as negocio_nome, (n.status is not null and n.status <> 'aberto') as negocio_fechado,
  t.prazo::text as prazo, t.prazo_original::text as prazo_original, t.prioridade, t.origem, t.status, t.adiamentos, t.terceiro, t.ultimo_motivo, t.feita_em, t.por, t.criado_em`;
const DE = (sql: Sql) => sql`from lab.tarefa t left join lab.pessoa p on p.id = t.responsavel_id left join lab.negocio n on n.id = t.negocio_id left join lab.conta c on c.id = n.conta_id`;
const linha = (r: any): Tarefa => ({ id: r.id, titulo: r.titulo, descricao: r.descricao, responsavelId: r.responsavel_id, responsavel: r.responsavel, negocioId: r.negocio_id, negocioNome: r.negocio_nome, negocioFechado: !!r.negocio_fechado, prazo: r.prazo, prazoOriginal: r.prazo_original, prioridade: r.prioridade, origem: r.origem ?? {}, status: r.status, adiamentos: Number(r.adiamentos), terceiro: !!r.terceiro, ultimoMotivo: r.ultimo_motivo, feitaEm: r.feita_em ? new Date(r.feita_em).toISOString() : null, por: r.por, criadoEm: new Date(r.criado_em).toISOString() });

export interface EntradaTarefa { titulo: unknown; descricao?: unknown; responsavelId?: unknown; negocioId?: unknown; prazo: unknown; prioridade?: unknown; origem?: unknown; por?: string | null }
export async function criarTarefa(sql: Sql, op: Operacao, b: EntradaTarefa): Promise<Tarefa> {
  const titulo = typeof b.titulo === 'string' ? b.titulo.trim() : ''; if (titulo.length < 3 || titulo.length > 200) throw new ErroDeTarefa('informe o título (3 a 200 caracteres)');
  if (!dataOk(b.prazo)) throw new ErroDeTarefa('prazo deve ser AAAA-MM-DD'); const prazo: string = b.prazo;
  const resp = b.responsavelId == null || b.responsavelId === '' ? null : String(b.responsavelId); if (resp && !UUID.test(resp)) throw new ErroDeTarefa('responsavelId inválido');
  if (resp) { const [p] = await sql`select 1 from lab.pessoa where id = ${resp} and operacao_id = ${op.id}`; if (!p) throw new ErroDeTarefa('pessoa não encontrada', 404); }
  const neg = b.negocioId == null || b.negocioId === '' ? null : String(b.negocioId); if (neg && !UUID.test(neg)) throw new ErroDeTarefa('negocioId inválido');
  if (neg) { const [n] = await sql`select 1 from lab.negocio where id = ${neg} and operacao_id = ${op.id}`; if (!n) throw new ErroDeTarefa('negócio não encontrado', 404); }
  const prio = b.prioridade == null ? 'normal' : String(b.prioridade); if (!['alta', 'normal', 'baixa'].includes(prio)) throw new ErroDeTarefa('prioridade deve ser alta, normal ou baixa');
  const o = b.origem && typeof b.origem === 'object' ? (b.origem as Record<string, unknown>) : {}; const tipo = typeof o.tipo === 'string' && (ORIGENS_TAREFA as readonly string[]).includes(o.tipo) ? o.tipo : 'manual';
  const origem = { tipo, ...(typeof o.chave === 'string' ? { chave: o.chave.slice(0, 120) } : {}), ...(dataOk(o.data) ? { data: o.data } : {}) };
  const desc = typeof b.descricao === 'string' && b.descricao.trim() ? b.descricao.trim().slice(0, 2000) : null;
  const t = await sql.begin(async tx => {
    const [r] = await tx<{ id: string }[]>`insert into lab.tarefa (operacao_id, titulo, descricao, responsavel_id, negocio_id, prazo, prazo_original, prioridade, origem, por) values (${op.id}, ${titulo}, ${desc}, ${resp}, ${neg}, ${prazo}::date, ${prazo}::date, ${prio}, ${tx.json(origem as never)}, ${b.por ?? ''}) returning id`;
    await tx`insert into lab.tarefa_evento (operacao_id, tarefa_id, tipo, para, por) values (${op.id}, ${r!.id}, 'criada', ${prazo}::date, ${b.por ?? ''})`;
    return r!.id;
  });
  return (await tarefaPorId(sql, op, t))!;
}
export async function tarefaPorId(sql: Sql, op: Operacao, id: string): Promise<Tarefa | null> {
  if (!UUID.test(id)) return null; const [r] = await sql<any[]>`select ${COLS(sql)} ${DE(sql)} where t.id = ${id} and t.operacao_id = ${op.id}`; return r ? linha(r) : null;
}
export async function tarefas(sql: Sql, op: Operacao, f: { status?: string | null; responsavelId?: string | null; ate?: string | null; limite?: number } = {}): Promise<Tarefa[]> {
  const st = f.status && ['aberta', 'feita', 'cancelada'].includes(f.status) ? f.status : null;
  const L = await sql<any[]>`select ${COLS(sql)} ${DE(sql)} where t.operacao_id = ${op.id} ${st ? sql`and t.status = ${st}` : sql``} ${f.responsavelId ? (f.responsavelId === 'gestor' ? sql`and t.responsavel_id is null` : sql`and t.responsavel_id = ${f.responsavelId}`) : sql``} ${f.ate ? sql`and t.prazo <= ${f.ate}::date` : sql``}
    order by case t.status when 'aberta' then 0 else 1 end, t.prazo, t.prioridade = 'alta' desc, t.criado_em limit ${Math.min(500, f.limite ?? 200)}`;
  return L.map(linha);
}
async function aberta(sql: Sql, op: Operacao, id: string) { const t = await tarefaPorId(sql, op, id); if (!t) throw new ErroDeTarefa('tarefa não encontrada', 404); if (t.status !== 'aberta') throw new ErroDeTarefa('esta tarefa já foi ' + (t.status === 'feita' ? 'concluída' : 'cancelada'), 409); return t; }
export async function concluirTarefa(sql: Sql, op: Operacao, id: string, por?: string | null) {
  await aberta(sql, op, id);
  await sql.begin(async tx => { await tx`update lab.tarefa set status = 'feita', feita_em = now() where id = ${id}`; await tx`insert into lab.tarefa_evento (operacao_id, tarefa_id, tipo, por) values (${op.id}, ${id}, 'feita', ${por ?? ''})`; });
  return (await tarefaPorId(sql, op, id))!;
}
export async function cancelarTarefa(sql: Sql, op: Operacao, id: string, motivo: unknown, por?: string | null) {
  await aberta(sql, op, id); const m = typeof motivo === 'string' ? motivo.trim().slice(0, 500) : ''; if (!m) throw new ErroDeTarefa('informe o motivo do cancelamento');
  await sql.begin(async tx => { await tx`update lab.tarefa set status = 'cancelada', ultimo_motivo = ${m} where id = ${id}`; await tx`insert into lab.tarefa_evento (operacao_id, tarefa_id, tipo, motivo, por) values (${op.id}, ${id}, 'cancelada', ${m}, ${por ?? ''})`; });
  return (await tarefaPorId(sql, op, id))!;
}
/* adiar conta e exige motivo; "terceiro" marca que o atraso depende de alguém de fora (vira bloqueio, não falta de execução) */
export async function adiarTarefa(sql: Sql, op: Operacao, id: string, b: { prazo: unknown; motivo: unknown; terceiro?: unknown; por?: string | null }) {
  const t = await aberta(sql, op, id); if (!dataOk(b.prazo)) throw new ErroDeTarefa('prazo deve ser AAAA-MM-DD'); const prazo: string = b.prazo; if (prazo <= t.prazo) throw new ErroDeTarefa('o novo prazo precisa ser depois do atual');
  const m = typeof b.motivo === 'string' ? b.motivo.trim().slice(0, 500) : ''; if (m.length < 3) throw new ErroDeTarefa('informe o motivo do adiamento');
  const terc = b.terceiro === true;
  await sql.begin(async tx => { await tx`update lab.tarefa set prazo = ${prazo}::date, adiamentos = adiamentos + 1, terceiro = ${terc}, ultimo_motivo = ${m} where id = ${id}`; await tx`insert into lab.tarefa_evento (operacao_id, tarefa_id, tipo, de, para, motivo, terceiro, por) values (${op.id}, ${id}, 'adiada', ${t.prazo}::date, ${prazo}::date, ${m}, ${terc}, ${b.por ?? ''})`; });
  return (await tarefaPorId(sql, op, id))!;
}
export const eventosDaTarefa = (sql: Sql, op: Operacao, id: string) => sql<any[]>`select tipo, de::text as de, para::text as para, motivo, terceiro, por, em from lab.tarefa_evento where operacao_id = ${op.id} and tarefa_id = ${id} order by em`;

/* o que o plano do dia e o Fechamento precisam: as tarefas abertas por pessoa no dia (hoje, atrasadas, feitas hoje) na forma TarefaFoto */
export interface TarefasDoDia { hoje: TarefaFoto[]; atrasadas: TarefaFoto[]; amanha: number; feitasHoje: number; feitasHojePrazoHoje: number }
export async function tarefasPorPessoa(sql: Sql, op: Operacao, data: string, amanha: string | null): Promise<Map<string, TarefasDoDia>> {
  const L = await sql<any[]>`select ${COLS(sql)} ${DE(sql)} where t.operacao_id = ${op.id} and (t.status = 'aberta' or (t.status = 'feita' and (t.feita_em at time zone ${op.fuso})::date = ${data}::date)) and t.prazo <= ${amanha ?? somarDias(data, 1)}::date`;
  const out = new Map<string, TarefasDoDia>(), get = (k: string) => out.get(k) ?? out.set(k, { hoje: [], atrasadas: [], amanha: 0, feitasHoje: 0, feitasHojePrazoHoje: 0 }).get(k)!;
  for (const r of L.map(linha)) {
    const d = get(r.responsavelId ?? 'gestor');
    if (r.status === 'feita') { d.feitasHoje++; if (r.prazo === data) d.feitasHojePrazoHoje++; continue; }
    const f: TarefaFoto = { id: r.id, titulo: r.titulo, prazo: r.prazo, prioridade: r.prioridade, neg: r.negocioId, negNome: r.negocioNome ?? '', negFechado: r.negocioFechado, adiamentos: r.adiamentos, terceiro: r.terceiro, ultimoMotivo: r.ultimoMotivo ?? '', prazoOriginal: r.prazoOriginal, diasAtraso: Math.max(0, Math.round((Date.parse(data) - Date.parse(r.prazo)) / 86_400_000)) };
    if (r.prazo < data) d.atrasadas.push(f); else if (r.prazo === data) d.hoje.push(f); else if (amanha && r.prazo === amanha) d.amanha++;
  }
  return out;
}
