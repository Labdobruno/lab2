/* Studio no banco: funil observado, funis salvos e campanhas. Somente o Studio escreve em lab.studio_funil e lab.campanha. */
import type { Sql } from 'postgres';
import { VARIAVEIS, type Contexto } from '@lab/nucleo';
import { relatorio } from '@lab/metricas';
import { somarDias, type Operacao } from '@lab/planejamento';
import { desvios, projetar, realizadoDe, type PremissasCampanha, type Projecao, type Realizado } from './campanha.js';
import { chaveAresta, validarGrafo, type Grafo } from './grafo.js';

export class ErroDeStudio extends Error { constructor(m: string, readonly status = 400) { super(m); } }
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const dataOk = (d: unknown): d is string => typeof d === 'string' && DATA.test(d) && !Number.isNaN(Date.parse(d));

/* funil do histórico: etapas do funil principal e as passagens de fato ocorridas na janela.
   Voltas para etapas anteriores são ignoradas (o modelo é sem ciclos) e contadas à parte. */
export async function grafoObservado(sql: Sql, op: Operacao, ate: string) {
  const de = somarDias(ate, -op.janelaHistoricaDias), fim = somarDias(ate, 1);
  const [funil] = await sql<{ id: string }[]>`select id from lab.funil where operacao_id = ${op.id} and principal limit 1`;
  if (!funil) throw new ErroDeStudio('a operação não tem funil principal', 409);
  const etapas = await sql<{ chave: string; nome: string; papel: string; ordem: number }[]>`select chave, nome, papel, ordem from lab.etapa where funil_id = ${funil.id} and ativa order by ordem`;
  const passagens = await sql<{ de: string; para: string; n: number }[]>`
    select d.chave as de, p.chave as para, count(*)::int as n
    from lab.negocio_transicao t join lab.etapa p on p.id = t.para_etapa_id join lab.etapa d on d.id = t.de_etapa_id
    where t.operacao_id = ${op.id} and p.funil_id = ${funil.id} and d.funil_id = ${funil.id}
      and (t.em at time zone ${op.fuso})::date >= ${de}::date and (t.em at time zone ${op.fuso})::date < ${fim}::date
    group by 1, 2`;
  const ordem = new Map(etapas.map(e => [e.chave, e.ordem]));
  const uteis = passagens.filter(p => (ordem.get(p.para) ?? -1) > (ordem.get(p.de) ?? 1e9));
  const ignoradas = passagens.length - uteis.length;
  const saidas = new Map<string, number>();
  for (const p of uteis) saidas.set(p.de, (saidas.get(p.de) ?? 0) + p.n);
  const grafo: Grafo = {
    entrada: etapas[0]?.chave ?? '',
    nos: etapas.map(e => ({ id: e.chave, nome: e.nome, tipo: e.papel === 'ganho' ? 'ganho' : e.papel === 'perdido' ? 'perdido' : 'etapa' })),
    arestas: uteis.map(p => ({ de: p.de, para: p.para, taxa: Math.round((p.n / saidas.get(p.de)!) * 10000) / 10000 })),
  };
  return { grafo, janela: { de, ate }, passagens: uteis.reduce((s, p) => s + p.n, 0), ignoradas, saidas: Object.fromEntries(saidas) };
}

/* ---------- funis salvos ---------- */
export async function salvarFunil(sql: Sql, op: Operacao, nome: unknown, grafo: unknown) {
  const n = typeof nome === 'string' ? nome.trim() : '';
  if (!n || n.length > 80) throw new ErroDeStudio('informe o nome do funil (até 80 caracteres)');
  const v = validarGrafo(grafo);
  if (!v.ok) throw new ErroDeStudio(`grafo inválido: ${v.erros.join('; ')}`);
  const [{ versao } = { versao: 0 }] = await sql<{ versao: number }[]>`select coalesce(max(versao), 0)::int as versao from lab.studio_funil where operacao_id = ${op.id} and nome = ${n}`;
  const [f] = await sql`insert into lab.studio_funil (operacao_id, nome, versao, grafo) values (${op.id}, ${n}, ${versao + 1}, ${sql.json(v.grafo as never)}) returning id, nome, versao`;
  return { ...f, avisos: v.avisos };
}

export async function funisSalvos(sql: Sql, op: Operacao) {
  return sql`select distinct on (nome) id, nome, versao, grafo, criado_em as "criadoEm" from lab.studio_funil where operacao_id = ${op.id} order by nome, versao desc`;
}

export async function grafoSalvo(sql: Sql, op: Operacao, nome: string): Promise<Grafo> {
  const [f] = await sql<{ grafo: Grafo }[]>`select grafo from lab.studio_funil where operacao_id = ${op.id} and nome = ${nome} order by versao desc limit 1`;
  if (!f) throw new ErroDeStudio(`funil "${nome}" não encontrado`, 404);
  return f.grafo;
}

/* ---------- campanhas ---------- */
interface LinhaCampanha {
  id: string; nome: string; canal: string; funil_nome: string | null; inicio: string; fim: string; orcamento: string; premissas: any; projecao: Projecao;
  status: 'planejada' | 'rodando' | 'encerrada'; resultado: any; encerrada_em: Date | null; criado_em: Date;
}

export async function criarCampanha(sql: Sql, op: Operacao, ctx: Contexto, hoje: string, b: {
  nome?: unknown; canal?: unknown; funil?: unknown; inicio?: unknown; fim?: unknown; orcamento?: unknown; cpl?: unknown; ticketMedio?: unknown; margem?: unknown;
}) {
  const nome = typeof b.nome === 'string' ? b.nome.trim() : '';
  if (!nome || nome.length > 120) throw new ErroDeStudio('informe o nome da campanha');
  const canal = typeof b.canal === 'string' ? b.canal : '';
  const [c] = await sql<{ chave: string }[]>`select chave from lab.canal where operacao_id = ${op.id} and chave = ${canal} and ativo`;
  if (!c) throw new ErroDeStudio('canal não encontrado nesta operação', 404);
  const inicio = dataOk(b.inicio) ? b.inicio : hoje, fim = dataOk(b.fim) ? b.fim : '';
  if (!fim) throw new ErroDeStudio('informe a data final (AAAA-MM-DD)');
  if (fim < inicio) throw new ErroDeStudio('a data final não pode ser anterior à inicial');
  const orcamento = Number(b.orcamento);
  if (!(orcamento > 0)) throw new ErroDeStudio('informe o orçamento (maior que zero)');

  const funilNome = typeof b.funil === 'string' && b.funil ? b.funil : null;
  const grafo = funilNome ? await grafoSalvo(sql, op, funilNome) : (await grafoObservado(sql, op, hoje)).grafo;
  /* CPL padrão: o do próprio canal no histórico; sem ele, o médio da operação */
  const rel = await relatorio(sql, op, { de: somarDias(hoje, -op.janelaHistoricaDias), ate: somarDias(hoje, 1) });
  const cplCanal = rel.canais.find(x => x.canal === canal)?.cpl ?? null;
  const premissas: PremissasCampanha = {
    cpl: typeof b.cpl === 'number' || (typeof b.cpl === 'string' && b.cpl) ? (b.cpl as number | string) : cplCanal ?? 'cpl_medio',
    ticketMedio: typeof b.ticketMedio === 'number' || (typeof b.ticketMedio === 'string' && b.ticketMedio) ? (b.ticketMedio as number | string) : 'ticket_medio',
    margem: typeof b.margem === 'number' || (typeof b.margem === 'string' && b.margem) ? (b.margem as number | string) : 'margem_percentual',
  };
  const projecao = projetar({ grafo, ctx, orcamento, premissas });
  if (!projecao.ok) throw new ErroDeStudio(`não consegui projetar a campanha: ${projecao.avisos.join('; ')}`, 409);
  const [r] = await sql`insert into lab.campanha (operacao_id, nome, canal, funil_nome, inicio, fim, orcamento, premissas, projecao)
    values (${op.id}, ${nome}, ${canal}, ${funilNome}, ${inicio}::date, ${fim}::date, ${orcamento}, ${sql.json({ ...premissas, grafo } as never)}, ${sql.json(JSON.parse(JSON.stringify(projecao)))})
    returning id`;
  return { id: r!.id as string, projecao };
}

async function realizadoDaCampanha(sql: Sql, op: Operacao, c: LinhaCampanha, investimentoReal?: number | null): Promise<Realizado> {
  const [r] = await sql<{ leads: number; vendas: number; receita: string }[]>`
    select count(*)::int as leads, count(*) filter (where n.status = 'ganho')::int as vendas, coalesce(sum(n.valor_fechado) filter (where n.status = 'ganho'), 0) as receita
    from lab.negocio n join lab.canal ca on ca.id = n.canal_id
    where n.operacao_id = ${op.id} and n.tipo = 'novo' and ca.chave = ${c.canal}
      and (n.criado_em at time zone ${op.fuso})::date >= ${c.inicio}::date and (n.criado_em at time zone ${op.fuso})::date <= ${c.fim}::date`;
  let inv = investimentoReal ?? null;
  if (inv == null) {
    const [i] = await sql<{ n: number; total: string | null }[]>`
      select count(*)::int as n, sum(i.valor) as total from lab.investimento_canal i join lab.canal ca on ca.id = i.canal_id
      where i.operacao_id = ${op.id} and ca.chave = ${c.canal} and i.mes >= date_trunc('month', ${c.inicio}::date) and i.mes <= ${c.fim}::date`;
    inv = i && i.n > 0 ? Number(i.total) : null;
  }
  return realizadoDe({ leads: r?.leads ?? 0, vendas: r?.vendas ?? 0, receita: Number(r?.receita ?? 0), investimento: inv });
}

const resumo = (c: LinhaCampanha) => ({ id: c.id, nome: c.nome, canal: c.canal, funil: c.funil_nome, inicio: c.inicio, fim: c.fim, orcamento: Number(c.orcamento), status: c.status, encerradaEm: c.encerrada_em });

export async function campanhas(sql: Sql, op: Operacao) {
  const l = await sql<LinhaCampanha[]>`select id, nome, canal, funil_nome, inicio::text, fim::text, orcamento, premissas, projecao, status, resultado, encerrada_em, criado_em
    from lab.campanha where operacao_id = ${op.id} order by criado_em desc limit 100`;
  return Promise.all(l.map(async c => {
    const plano = { leads: c.projecao.leads, vendas: c.projecao.vendas, receita: c.projecao.receita, cac: c.projecao.cac, roi: c.projecao.roi };
    const realizado = c.status === 'encerrada' ? (c.resultado?.realizado as Realizado) : c.status === 'rodando' ? await realizadoDaCampanha(sql, op, c) : null;
    return { ...resumo(c), plano, realizado, desvios: realizado ? desvios(plano, realizado) : null };
  }));
}

async function campanhaDaOperacao(sql: Sql, op: Operacao, id: string): Promise<LinhaCampanha> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ErroDeStudio('campanha não encontrada', 404);
  const [c] = await sql<LinhaCampanha[]>`select id, nome, canal, funil_nome, inicio::text, fim::text, orcamento, premissas, projecao, status, resultado, encerrada_em, criado_em
    from lab.campanha where id = ${id} and operacao_id = ${op.id}`;
  if (!c) throw new ErroDeStudio('campanha não encontrada', 404);
  return c;
}

export async function iniciarCampanha(sql: Sql, op: Operacao, id: string) {
  const c = await campanhaDaOperacao(sql, op, id);
  if (c.status !== 'planejada') throw new ErroDeStudio(`a campanha já está ${c.status}`, 409);
  await sql`update lab.campanha set status = 'rodando' where id = ${id}`;
  return { id, status: 'rodando' };
}

/* encerrar mede o realizado, guarda a fotografia e escreve plano × realizado na memória comercial */
export async function encerrarCampanha(sql: Sql, op: Operacao, id: string, investimentoReal?: unknown) {
  const c = await campanhaDaOperacao(sql, op, id);
  if (c.status === 'encerrada') throw new ErroDeStudio('esta campanha já foi encerrada e não muda mais', 409);
  const inv = investimentoReal == null || investimentoReal === '' ? null : Number(investimentoReal);
  if (inv != null && !(inv >= 0)) throw new ErroDeStudio('investimento real inválido');
  const realizado = await realizadoDaCampanha(sql, op, c, inv);
  const plano = { leads: c.projecao.leads, vendas: c.projecao.vendas, receita: c.projecao.receita, cac: c.projecao.cac, roi: c.projecao.roi };
  const dv = desvios(plano, realizado);
  const f = (n: number | null) => (n == null ? 'sem dado' : String(Math.round(n * 100) / 100));
  const bateu = c.projecao.vendas != null && realizado.vendas >= c.projecao.vendas;
  const texto = `Campanha "${c.nome}" (${c.canal}): plano de ${f(c.projecao.vendas)} vendas e R$ ${f(c.projecao.receita)}; realizado ${realizado.vendas} vendas e R$ ${f(realizado.receita)} de ${realizado.leads} leads (CAC ${f(realizado.cac)}). ${bateu ? 'Meta de vendas atingida.' : 'Meta de vendas não atingida.'}`.slice(0, 2000);
  await sql.begin(async tx => {
    await tx`update lab.campanha set status = 'encerrada', encerrada_em = now(), resultado = ${tx.json(JSON.parse(JSON.stringify({ realizado, desvios: dv })))} where id = ${id}`;
    await tx`insert into lab.aprendizado (operacao_id, tipo, texto) values (${op.id}, ${bateu ? 'funcionou' : 'nao_funcionou'}, ${texto})`;
  });
  return { id, status: 'encerrada', realizado, desvios: dv, memoria: texto };
}

export { chaveAresta, VARIAVEIS };
