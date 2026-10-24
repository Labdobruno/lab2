/* Canvas de decisão, experimentos e memória comercial. Decisão só acrescenta; experimento encerrado não muda. */
import type { Sql } from 'postgres';
import { VARIAVEIS, type Contexto } from '@lab/nucleo';
import type { Operacao } from '@lab/planejamento';

export class ErroDeMemoria extends Error { constructor(m: string, readonly status = 400) { super(m); } }
const texto = (v: unknown, max: number, campo: string, obrigatorio = true): string | null => {
  const t = typeof v === 'string' ? v.trim() : '';
  if (!t) { if (obrigatorio) throw new ErroDeMemoria(`informe ${campo}`); return null; }
  if (t.length > max) throw new ErroDeMemoria(`${campo}: máximo de ${max} caracteres`);
  return t;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

export interface EntradaDecisao { hipoteseId?: string; pergunta: unknown; contexto?: unknown; opcoes?: unknown; escolha: unknown; porque?: unknown; criterioSucesso?: unknown; revisarEm?: unknown }

export async function registrarDecisao(sql: Sql, op: Operacao, b: EntradaDecisao) {
  const pergunta = texto(b.pergunta, 300, 'a pergunta')!, escolha = texto(b.escolha, 500, 'o que foi escolhido')!;
  const opcoes = Array.isArray(b.opcoes) ? b.opcoes.slice(0, 8).map((o: any) => ({ nome: texto(o?.nome ?? o, 200, 'o nome da opção')! })) : [];
  if (opcoes.length && !opcoes.some(o => o.nome.toLowerCase() === escolha.toLowerCase())) opcoes.push({ nome: escolha });
  const revisar = typeof b.revisarEm === 'string' && b.revisarEm ? b.revisarEm : null;
  if (revisar && (!DATA.test(revisar) || Number.isNaN(Date.parse(revisar)))) throw new ErroDeMemoria('revisarEm deve ser AAAA-MM-DD');
  const ctx = b.contexto && typeof b.contexto === 'object' ? b.contexto : {};
  const [d] = await sql`insert into lab.decisao (operacao_id, hipotese_id, pergunta, contexto, opcoes, escolha, porque, criterio_sucesso, revisar_em)
    values (${op.id}, ${b.hipoteseId ?? null}, ${pergunta}, ${sql.json(ctx as never)}, ${sql.json(opcoes as never)}, ${escolha}, ${texto(b.porque, 2000, 'o porquê', false)}, ${texto(b.criterioSucesso, 1000, 'o critério de sucesso', false)}, ${revisar})
    returning id, pergunta, escolha, revisar_em::text as "revisarEm", criado_em as "criadoEm"`;
  return d;
}

export const decisoes = (sql: Sql, op: Operacao) =>
  sql`select id, hipotese_id as "hipoteseId", pergunta, opcoes, escolha, porque, criterio_sucesso as "criterioSucesso", revisar_em::text as "revisarEm", criado_em as "criadoEm"
      from lab.decisao where operacao_id = ${op.id} order by criado_em desc limit 100`;

export interface EntradaExperimento { titulo: unknown; metrica: unknown; alvo: unknown; fimPrevisto?: unknown; hipoteseId?: string; decisaoId?: unknown }

export interface ExperimentoIniciado { id: string; titulo: string; metrica: string; baseline: number | null; alvo: number; inicio: string; fimPrevisto: string | null; status: string }

export async function iniciarExperimento(sql: Sql, op: Operacao, ctx: Contexto, hoje: string, b: EntradaExperimento): Promise<ExperimentoIniciado> {
  const titulo = texto(b.titulo, 200, 'o título')!;
  const metrica = typeof b.metrica === 'string' ? b.metrica : '';
  if (!(metrica in VARIAVEIS)) throw new ErroDeMemoria('metrica deve ser uma variável do dicionário (veja /admin/hipoteses/variaveis)');
  const alvo = Number(b.alvo);
  if (b.alvo === '' || b.alvo == null || !Number.isFinite(alvo)) throw new ErroDeMemoria('informe o alvo (número)');
  const fim = typeof b.fimPrevisto === 'string' && b.fimPrevisto ? b.fimPrevisto : null;
  if (fim && (!DATA.test(fim) || Number.isNaN(Date.parse(fim)))) throw new ErroDeMemoria('fimPrevisto deve ser AAAA-MM-DD');
  const decisaoId = typeof b.decisaoId === 'string' && b.decisaoId ? b.decisaoId : null;
  if (decisaoId) {
    if (!UUID.test(decisaoId)) throw new ErroDeMemoria('decisaoId inválido');
    const [d] = await sql`select 1 from lab.decisao where id = ${decisaoId} and operacao_id = ${op.id}`;
    if (!d) throw new ErroDeMemoria('decisão não encontrada', 404);
  }
  const baseline = ctx[metrica] ?? null;
  const [e] = await sql`insert into lab.experimento (operacao_id, decisao_id, hipotese_id, titulo, metrica, baseline, alvo, inicio, fim_previsto)
    values (${op.id}, ${decisaoId}, ${b.hipoteseId ?? null}, ${titulo}, ${metrica}, ${baseline}, ${alvo}, ${hoje}::date, ${fim})
    returning id, titulo, metrica, baseline, alvo, inicio::text, fim_previsto::text as "fimPrevisto", status`;
  const x = e as unknown as ExperimentoIniciado;
  return { ...x, baseline: x.baseline == null ? null : Number(x.baseline), alvo: Number(x.alvo) };
}

export const experimentos = async (sql: Sql, op: Operacao, ctx?: Contexto) => {
  const l = await sql<any[]>`select id, decisao_id as "decisaoId", hipotese_id as "hipoteseId", titulo, metrica, baseline, alvo, inicio::text, fim_previsto::text as "fimPrevisto",
      status, resultado, conclusao, concluido_em as "concluidoEm" from lab.experimento where operacao_id = ${op.id} order by criado_em desc limit 100`;
  return l.map(e => ({ ...e, baseline: e.baseline == null ? null : Number(e.baseline), alvo: Number(e.alvo), resultado: e.resultado == null ? null : Number(e.resultado),
    nome: VARIAVEIS[e.metrica]?.nome ?? e.metrica, unidade: VARIAVEIS[e.metrica]?.unidade ?? 'n',
    atual: e.status === 'rodando' && ctx ? ctx[e.metrica] ?? null : null }));
};

const fmt = (n: number | null, unidade: string) => n == null ? 'sem dado' : unidade === '%' ? `${Math.round(n * 1000) / 10}%` : unidade === 'R$' ? `R$ ${Math.round(n).toLocaleString('pt-BR')}` : String(Math.round(n * 100) / 100);

/* concluir mede o valor de hoje contra o alvo e escreve o resultado na memória comercial */
export async function concluirExperimento(sql: Sql, op: Operacao, id: string, ctx: Contexto, b: { descartar?: boolean; conclusao?: unknown }) {
  if (!UUID.test(id)) throw new ErroDeMemoria('experimento não encontrado', 404);
  const [e] = await sql<any[]>`select id, titulo, metrica, baseline, alvo, status from lab.experimento where id = ${id} and operacao_id = ${op.id}`;
  if (!e) throw new ErroDeMemoria('experimento não encontrado', 404);
  if (e.status !== 'rodando') throw new ErroDeMemoria('este experimento já foi encerrado e não muda mais', 409);
  const conclusao = texto(b.conclusao, 1500, 'a conclusão', false);
  const unidade = VARIAVEIS[e.metrica]?.unidade ?? 'n', nome = VARIAVEIS[e.metrica]?.nome ?? e.metrica;
  const baseline = e.baseline == null ? null : Number(e.baseline), alvo = Number(e.alvo);
  const resultado = b.descartar ? null : ctx[e.metrica] ?? null;
  const subiu = baseline == null ? alvo >= 0 : alvo >= baseline;
  const bateu = resultado != null && (subiu ? resultado >= alvo : resultado <= alvo);
  const status = b.descartar ? 'descartado' : 'concluido';
  const linha = b.descartar
    ? `Experimento descartado: "${e.titulo}".`
    : `Experimento "${e.titulo}": ${nome} foi de ${fmt(baseline, unidade)} para ${fmt(resultado, unidade)} (alvo ${fmt(alvo, unidade)}). ${resultado == null ? 'Sem dado para medir o resultado.' : bateu ? 'Alvo atingido.' : 'Alvo não atingido.'}`;
  const textoMemoria = `${linha}${conclusao ? ' ' + conclusao : ''}`.slice(0, 2000);
  await sql.begin(async tx => {
    await tx`update lab.experimento set status = ${status}, resultado = ${resultado}, conclusao = ${conclusao}, concluido_em = now() where id = ${id}`;
    await tx`insert into lab.aprendizado (operacao_id, tipo, texto) values (${op.id}, ${b.descartar ? 'decisao' : bateu ? 'funcionou' : 'nao_funcionou'}, ${textoMemoria})`;
  });
  return { id, status, baseline, alvo, resultado, atingiu: b.descartar ? null : bateu, memoria: textoMemoria };
}
