/* Inteligência no banco: mede as métricas v3 sobre os dados da V2 (negócios, transições, atividades, preços, investimento, contratos),
   avalia a biblioteca com histerese persistida, marcas do gestor e diário de contexto, registra observações, e calcula a acurácia do
   forecast pelos fechamentos do dia e o waterfall do ciclo. O banco guarda estado; toda conta está nas funções puras. */
import type { Sql } from 'postgres';
import { economiaDaVenda, politicasDaOperacao, retencao, type ContratoLinha, type EventoCSLinha, type PrecoLinha } from '@lab/metricas';
import { cicloDaOperacao, somarDias, type Operacao } from '@lab/planejamento';
import { ADITIVAS_V3, COORTE_V3, METRICAS_V3, type Contexto } from '@lab/nucleo';
import type { Medida } from './condicao.js';
import { AREAS_CONTEXTO, avaliarV3, orcamentoDeAtencao, type AchadoV3, type Composto, type HipoteseV3, type Intervencao, type Marca, type MedirMetrica, type RegraEstado, type EventoContexto } from './motor.js';
import { acuracia, acuraciaGeral, saude, waterfallMargem, waterfallReceita, type Acuracia, type ObsRegra } from './inteligencia.js';
import type { EstadoHisterese } from './condicao.js';

export class ErroDeInteligencia extends Error { constructor(m: string, readonly status = 400) { super(m); } }
const DIA = 86_400_000, DATA = /^\d{4}-\d{2}-\d{2}$/;
const AUSENTE = (nota: string): Medida => ({ estado: 'ausente', nota });
const SEM_FONTE: Record<string, string> = {
  cancelamentos: 'cancelamentos pós-venda não são lançados nesta operação (contratos/eventos de CS sem registro)',
  backlog: 'fila de operação não é uma fonte do LAB (sem sistema de entrega conectado)', recebiveis: 'recebíveis não são lançados (sem financeiro conectado)',
  prazo_receb: 'prazo de recebimento não é lançado (sem financeiro conectado)', caixa_oper: 'caixa operacional não é lançado (sem financeiro conectado)', exposicao: 'exposição por projeto não é lançada (sem financeiro conectado)',
};

/* ---------- base de dados carregada uma vez por avaliação ---------- */
interface NegBase { id: string; status: 'aberto' | 'ganho' | 'perdido'; criadoEm: number; fechadoEm: number | null; valor: number | null; grupoPerda: string | null; papeis: Array<[string, number]>; etapaDesde: number; prazo: number | null; valorEst: number | null; papelAtual: string }
export interface BaseMedicao {
  agora: number; negocios: NegBase[]; precos: Map<string, PrecoLinha[]>; politicas: Awaited<ReturnType<typeof politicasDaOperacao>>;
  atividades: Array<{ papel: string; em: number; q: number }>; investimentos: Array<{ mes: string; valor: number }>; contratos: ContratoLinha[]; eventos: EventoCSLinha[];
}
export async function carregarBase(sql: Sql, op: Operacao, agora: number, diasHistorico = 400): Promise<BaseMedicao> {
  const desde = new Date(agora - diasHistorico * DIA).toISOString();
  const [N, A, I, C, EV, pol] = await Promise.all([
    sql<any[]>`select n.id, n.status, n.criado_em, n.fechado_em, n.valor_fechado, n.valor_estimado, m.grupo, e.papel, e.prazo_dias, coalesce(n.etapa_desde, n.criado_em) as desde,
        coalesce((select jsonb_agg(jsonb_build_object('p', e2.papel, 'em', t.em)) from lab.negocio_transicao t join lab.etapa e2 on e2.id = t.para_etapa_id where t.negocio_id = n.id), '[]'::jsonb) as trans
      from lab.negocio n join lab.funil f on f.id = n.funil_id join lab.etapa e on e.id = n.etapa_id left join lab.motivo_perda m on m.id = n.motivo_perda_id
      where n.operacao_id = ${op.id} and n.tipo = 'novo' and f.principal and (n.criado_em >= ${desde}::timestamptz or n.fechado_em >= ${desde}::timestamptz or n.status = 'aberto')`,
    sql<any[]>`select t.papel, a.em, a.quantidade as q from lab.atividade a join lab.tipo_atividade t on t.id = a.tipo_id where a.operacao_id = ${op.id} and a.em >= ${desde}::timestamptz and t.papel in ('tentativa', 'contato')`,
    sql<any[]>`select i.mes::text as mes, i.valor from lab.investimento_canal i where i.operacao_id = ${op.id} and i.mes >= ${desde.slice(0, 10)}::date - interval '31 days'`,
    sql<any[]>`select id, conta_id, negocio_origem_id, recorrente, valor_periodo, periodicidade_meses, inicio::text, fim::text, status from lab.contrato where operacao_id = ${op.id}`,
    sql<any[]>`select conta_id, tipo, em, valor from lab.evento_cs where operacao_id = ${op.id} and em >= ${desde}::timestamptz`,
    politicasDaOperacao(sql, op.id),
  ]);
  const ganhos = N.filter(n => n.status === 'ganho').map(n => n.id), precos = new Map<string, PrecoLinha[]>();
  if (ganhos.length) {
    const P = await sql<any[]>`select p.negocio_id, p.momento, p.valor, p.linhas, c.chave as condicao, p.politica_versao, p.comissao_fixa from lab.preco_negocio p left join lab.condicao_pagamento c on c.id = p.condicao_id where p.negocio_id in ${sql(ganhos)} order by p.em, p.id`;
    for (const l of P) { const L = precos.get(l.negocio_id) ?? []; L.push({ negocioId: l.negocio_id, momento: l.momento, valor: Number(l.valor), linhas: (l.linhas ?? []).map((x: any) => ({ chave: String(x.chave), valor: Number(x.valor), ...(x.categoria ? { categoria: x.categoria } : {}) })), condicao: l.condicao ?? null, politicaVersao: l.politica_versao == null ? null : Number(l.politica_versao), comissaoFixa: l.comissao_fixa == null ? null : Number(l.comissao_fixa) }); precos.set(l.negocio_id, L); }
  }
  return {
    agora, precos, politicas: pol,
    negocios: N.map(n => ({ id: n.id, status: n.status, criadoEm: Date.parse(n.criado_em), fechadoEm: n.fechado_em ? Date.parse(n.fechado_em) : null, valor: n.valor_fechado == null ? null : Number(n.valor_fechado), valorEst: n.valor_estimado == null ? null : Number(n.valor_estimado), grupoPerda: n.grupo ?? null, papeis: (n.trans as Array<{ p: string; em: string }>).map(t => [t.p, Date.parse(t.em)] as [string, number]), etapaDesde: Date.parse(n.desde), prazo: n.prazo_dias ?? null, papelAtual: n.papel })),
    atividades: A.map(a => ({ papel: a.papel, em: Date.parse(a.em), q: Number(a.q) })), investimentos: I.map(i => ({ mes: i.mes, valor: Number(i.valor) })),
    contratos: C.map(c => ({ id: c.id, contaId: c.conta_id, negocioOrigemId: c.negocio_origem_id, recorrente: c.recorrente, valorPeriodo: Number(c.valor_periodo), periodicidadeMeses: c.periodicidade_meses, inicio: c.inicio, fim: c.fim, status: c.status })),
    eventos: EV.map(e => ({ contaId: e.conta_id, tipo: e.tipo, em: new Date(e.em).toISOString(), valor: e.valor == null ? null : Number(e.valor) })),
  };
}

/* ---------- o medidor: métrica × janela [a, b) → medida ---------- */
const PAPEL_ETAPA: Record<string, string> = { agendadas: 'agendada', realizadas: 'realizada', oport: 'oportunidade', propostas: 'proposta' };
const ESCADA_TX: Record<string, [string | null, string | null]> = { tx_agenda: [null, 'agendada'], tx_compar: ['agendada', 'realizada'], tx_oport: ['realizada', 'oportunidade'], tx_prop: ['oportunidade', 'proposta'], tx_fech: ['oportunidade', 'ganho'], tx_lead_venda: [null, 'ganho'] };
const ORDEM = ['lead', 'contato', 'qualificado', 'agendada', 'realizada', 'oportunidade', 'proposta', 'negociacao', 'ganho'];
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export function medidorDe(B: BaseMedicao): MedirMetrica {
  const alcancou = (n: NegBase, papel: string) => papel === 'ganho' ? n.status === 'ganho' : n.papeis.some(([p]) => p === papel) || (n.status === 'ganho' && ORDEM.indexOf(papel) >= 0) || ORDEM.indexOf(n.papelAtual) >= ORDEM.indexOf(papel) && ORDEM.indexOf(papel) >= 0;
  const criados = (a: number, b: number) => B.negocios.filter(n => n.criadoEm >= a && n.criadoEm < b);
  const fechados = (a: number, b: number) => B.negocios.filter(n => n.status !== 'aberto' && n.fechadoEm != null && n.fechadoEm >= a && n.fechadoEm < b);
  const ganhos = (a: number, b: number) => fechados(a, b).filter(n => n.status === 'ganho');
  const entraram = (a: number, b: number, papel: string) => B.negocios.filter(n => n.papeis.some(([p, em]) => p === papel && em >= a && em < b)).length;
  const econ = (a: number, b: number) => ganhos(a, b).map(n => economiaDaVenda({ id: n.id, valorFechado: n.valor }, B.precos.get(n.id) ?? [], B.politicas));
  const invest = (a: number, b: number) => { let tot = 0, tem = false; for (const i of B.investimentos) { const m0 = Date.parse(i.mes + 'T00:00:00Z'), m1 = Date.UTC(Number(i.mes.slice(0, 4)), Number(i.mes.slice(5, 7)), 1); const ov = Math.max(0, Math.min(b, m1) - Math.max(a, m0)); if (ov > 0) { tem = true; tot += i.valor * (ov / (m1 - m0)); } } return tem ? tot : null; };
  const soma = (xs: Array<number | null | undefined>) => xs.reduce<number>((s, x) => s + (x ?? 0), 0);
  const med = (v: number | null, n: number): Medida => (v == null || !Number.isFinite(v) ? { estado: 'ausente', nota: 'sem dado na janela' } : { v, n, estado: 'ok' });
  return (id, a, b) => {
    if (SEM_FONTE[id]) return AUSENTE(SEM_FONTE[id]!);
    if (id in PAPEL_ETAPA) { const q = entraram(a, b, PAPEL_ETAPA[id]!); return { v: q, n: q, estado: 'ok' }; }
    if (id in ESCADA_TX) { const [de, para] = ESCADA_TX[id]!; const C = criados(a, b), den = de ? C.filter(n => alcancou(n, de)) : C, num = den.filter(n => alcancou(n, para!)); return den.length ? { v: num.length / den.length, n: den.length, estado: 'ok' } : AUSENTE('nenhum negócio da coorte chegou em ' + (de ?? 'lead')); }
    switch (id) {
      case 'leads': { const q = criados(a, b).length; return { v: q, n: q, estado: 'ok' }; }
      case 'contatos': case 'tentativas': { const p = id === 'contatos' ? 'contato' : 'tentativa', q = soma(B.atividades.filter(x => x.papel === p && x.em >= a && x.em < b).map(x => x.q)); return B.atividades.some(x => x.papel === p) ? { v: q, n: q, estado: 'ok' } : AUSENTE('nenhuma atividade do tipo "' + p + '" registrada nesta operação'); }
      case 'vendas': { const q = ganhos(a, b).length; return { v: q, n: q, estado: 'ok' }; }
      case 'perdidos': { const q = fechados(a, b).filter(n => n.status === 'perdido').length; return { v: q, n: q, estado: 'ok' }; }
      case 'perdas_preco': { const P = fechados(a, b).filter(n => n.status === 'perdido'); if (!P.some(n => n.grupoPerda)) return AUSENTE('perdas sem motivo registrado'); const q = P.filter(n => n.grupoPerda === 'preco').length; return { v: q, n: P.length, estado: 'ok' }; }
      case 'receita': { const G = ganhos(a, b); return { v: soma(G.map(g => g.valor)), n: G.length, estado: 'ok' }; }
      case 'ticket': { const G = ganhos(a, b).filter(g => (g.valor ?? 0) > 0); return med(G.length ? soma(G.map(g => g.valor)) / G.length : null, G.length); }
      case 'ciclo_venda': { const G = ganhos(a, b).map(g => (g.fechadoEm! - g.criadoEm) / DIA).filter(x => x >= 0); return med(G.length ? soma(G) / G.length : null, G.length); }
      case 'tx_ganho': { const F = fechados(a, b); return F.length ? { v: F.filter(n => n.status === 'ganho').length / F.length, n: F.length, estado: 'ok' } : AUSENTE('nenhum negócio encerrado na janela'); }
      case 'desconto_medio': { const D = econ(a, b).map(e => e.descontoSobreReferencia).filter((x): x is number => x != null); return D.length ? { v: soma(D) / D.length, n: D.length, estado: 'ok' } : AUSENTE('vendas sem preço de referência registrado'); }
      case 'margem_contrib': case 'custo_var_venda': case 'comissao_pct': {
        const E = econ(a, b).filter(e => e.economia); if (!E.length) return AUSENTE('vendas sem custo lançado (economia da venda)');
        const RL = soma(E.map(e => e.economia!.receitaLiquida)), P = soma(E.map(e => e.economia!.preco)); if (!(RL > 0)) return AUSENTE('receita líquida zero');
        const v = id === 'margem_contrib' ? soma(E.map(e => e.economia!.mc)) / RL : id === 'custo_var_venda' ? soma(E.map(e => e.economia!.custos)) / RL : soma(E.map(e => e.economia!.comissao)) / P;
        return { v, n: E.length, estado: 'ok' };
      }
      case 'investimento': { const v = invest(a, b); return v == null ? AUSENTE('nenhum investimento lançado nos meses da janela') : { v, n: 1000, estado: 'ok' }; }
      case 'cpl': case 'cac': { const v = invest(a, b); if (v == null) return AUSENTE('nenhum investimento lançado nos meses da janela'); const d = id === 'cpl' ? criados(a, b).length : ganhos(a, b).length; return d ? { v: v / d, n: d, estado: 'ok' } : AUSENTE(id === 'cpl' ? 'sem leads na janela' : 'sem vendas na janela'); }
      case 'negocios_parados': case 'valor_parado': case 'valor_aberto': {
        if (Math.abs(b - B.agora) > 2 * DIA) return AUSENTE('foto do pipeline só existe para hoje: sem linha de base histórica');
        const ab = B.negocios.filter(n => n.status === 'aberto'), par = ab.filter(n => n.prazo != null && B.agora - n.etapaDesde > n.prazo * DIA);
        const v = id === 'negocios_parados' ? par.length : id === 'valor_parado' ? soma(par.map(n => n.valorEst)) : soma(ab.map(n => n.valorEst)); return { v, n: ab.length, estado: 'ok' };
      }
      case 'churn_receita': case 'mrr': {
        if (!B.contratos.some(c => c.recorrente)) return AUSENTE('sem contratos recorrentes nesta operação');
        const R = retencao({ contratos: B.contratos, eventos: B.eventos, periodo: { de: iso(a), ate: iso(b) } });
        return id === 'mrr' ? med(R.mrrInicial, R.contasNoInicio) : med(R.churnReceita, R.contasNoInicio);
      }
      default: return AUSENTE('métrica "' + id + '" não está no catálogo desta operação');
    }
  };
}
export const unidadeV3 = (id: string) => METRICAS_V3[id]?.unidade ?? 'n';

/* ---------- estado: regras, histerese, marcas, contexto ---------- */
export async function regrasDaOperacao(sql: Sql, op: Operacao): Promise<Record<string, RegraEstado>> {
  const L = await sql<any[]>`select codigo, estado, params from lab.inteligencia_regra where operacao_id = ${op.id}`;
  return Object.fromEntries(L.map(r => [r.codigo, { estado: r.estado, params: r.params ?? {} }]));
}
export async function calibrarRegra(sql: Sql, op: Operacao, codigo: unknown, b: { estado?: unknown; params?: unknown; por?: string | null }) {
  if (typeof codigo !== 'string' || !codigo || codigo.length > 80) throw new ErroDeInteligencia('código inválido');
  const estado = b.estado == null ? null : String(b.estado); if (estado && !['rascunho', 'sombra', 'ativa', 'aposentada'].includes(estado)) throw new ErroDeInteligencia('estado deve ser rascunho, sombra, ativa ou aposentada');
  const params = b.params && typeof b.params === 'object' ? b.params : null;
  for (const [met, p] of Object.entries(params ?? {})) { if (!METRICAS_V3[met]) throw new ErroDeInteligencia(`métrica desconhecida nos parâmetros: ${met}`); for (const k of Object.keys(p as object)) if (!['limiar', 'banda', 'amostraMin', 'janela', 'ref'].includes(k)) throw new ErroDeInteligencia(`parâmetro desconhecido em ${met}: ${k}`); }
  const [r] = await sql<any[]>`insert into lab.inteligencia_regra (operacao_id, codigo, estado, params, por) values (${op.id}, ${codigo}, ${estado ?? 'ativa'}, ${sql.json((params ?? {}) as never)}, ${b.por ?? ''})
    on conflict (operacao_id, codigo) do update set estado = coalesce(${estado}, lab.inteligencia_regra.estado), params = case when ${params != null} then ${sql.json((params ?? {}) as never)} else lab.inteligencia_regra.params end, por = ${b.por ?? ''}, atualizado_em = now()
    returning codigo, estado, params`;
  return r;
}
export async function marcasDaOperacao(sql: Sql, op: Operacao): Promise<Record<string, Marca>> {
  const L = await sql<any[]>`select distinct on (codigo) codigo, estado, motivo, ref, por, em from lab.achado_marca where operacao_id = ${op.id} order by codigo, em desc`;
  return Object.fromEntries(L.filter(m => m.estado !== 'limpa').map(m => [m.codigo, { estado: m.estado, motivo: m.motivo, ref: m.ref == null ? null : Number(m.ref), por: m.por, em: new Date(m.em).toISOString() } as Marca]));
}
export async function marcarAchado(sql: Sql, op: Operacao, b: { codigo: unknown; estado: unknown; motivo?: unknown; ref?: unknown; por?: string | null }) {
  const codigo = typeof b.codigo === 'string' ? b.codigo.trim() : ''; if (!codigo || codigo.length > 80) throw new ErroDeInteligencia('informe o código do achado');
  const estado = String(b.estado ?? ''); if (!['tratamento', 'aceito', 'naoprocede', 'limpa'].includes(estado)) throw new ErroDeInteligencia('estado deve ser tratamento, aceito, naoprocede ou limpa');
  const motivo = typeof b.motivo === 'string' ? b.motivo.trim().slice(0, 1000) : null; const ref = b.ref == null || b.ref === '' ? null : Number(b.ref);
  if (ref != null && !Number.isFinite(ref)) throw new ErroDeInteligencia('ref deve ser um número');
  const [m] = await sql<any[]>`insert into lab.achado_marca (operacao_id, codigo, estado, motivo, ref, por) values (${op.id}, ${codigo}, ${estado}, ${motivo}, ${ref}, ${b.por ?? ''}) returning codigo, estado, motivo, ref, por, em`;
  return { ...m, ref: m.ref == null ? null : Number(m.ref) };
}
export async function contextoEventos(sql: Sql, op: Operacao, de: string, ate: string): Promise<Array<EventoContexto & { id: string; por: string }>> {
  const L = await sql<any[]>`select id, data::text as data, to_jsonb(areas) as areas, descricao, por from lab.contexto_evento where operacao_id = ${op.id} and apagado_em is null and data >= ${de}::date and data <= ${ate}::date order by data desc, criado_em desc`;
  return L.map(e => ({ id: e.id, ts: Date.parse(e.data + 'T12:00:00Z'), data: e.data, areas: e.areas ?? [], desc: e.descricao, por: e.por }));
}
export async function registrarContexto(sql: Sql, op: Operacao, b: { data: unknown; areas?: unknown; descricao: unknown; por?: string | null }) {
  const data = typeof b.data === 'string' && DATA.test(b.data) && !Number.isNaN(Date.parse(b.data)) ? b.data : null; if (!data) throw new ErroDeInteligencia('data deve ser AAAA-MM-DD');
  const desc = typeof b.descricao === 'string' ? b.descricao.trim() : ''; if (!desc || desc.length > 500) throw new ErroDeInteligencia('descreva o que aconteceu (até 500 caracteres)');
  const areas = Array.isArray(b.areas) ? b.areas.filter((a): a is string => typeof a === 'string' && (AREAS_CONTEXTO as readonly string[]).includes(a)) : [];
  const [e] = await sql<any[]>`insert into lab.contexto_evento (operacao_id, data, areas, descricao, por) values (${op.id}, ${data}::date, array(select jsonb_array_elements_text(${sql.json(areas as never)}::jsonb)), ${desc}, ${b.por ?? ''}) returning id, data::text as data, to_jsonb(areas) as areas, descricao, por`;
  return e;
}
export async function apagarContexto(sql: Sql, op: Operacao, id: string) {
  const r = await sql`update lab.contexto_evento set apagado_em = now() where operacao_id = ${op.id} and id = ${id} and apagado_em is null`; if (!r.count) throw new ErroDeInteligencia('evento não encontrado', 404); return { ok: true };
}

/* ---------- a avaliação: biblioteca × medidor × estado, com persistência ---------- */
export interface Biblioteca { hipoteses: HipoteseV3[]; intervencoes?: Intervencao[]; compostos?: Composto[]; orcamento?: number }
export interface AvaliacaoOperacao { data: string; achados: AchadoV3[]; orcamento: ReturnType<typeof orcamentoDeAtencao>; contexto: EventoContexto[]; marcas: Record<string, Marca>; regras: Record<string, RegraEstado>; margemRef: number | null; avisos: string[] }
export async function avaliarOperacao(sql: Sql, op: Operacao, bib: Biblioteca, agora: number, ctx?: Contexto, opts: { persistir?: boolean; base?: BaseMedicao } = {}): Promise<AvaliacaoOperacao> {
  const B = opts.base ?? (await carregarBase(sql, op, agora)), medir = medidorDe(B);
  const [regras, marcas, histL, obsL, ctxEv] = await Promise.all([
    regrasDaOperacao(sql, op), marcasDaOperacao(sql, op),
    sql<any[]>`select codigo, hist, ultimo_estado from lab.inteligencia_estado where operacao_id = ${op.id}`,
    sql<any[]>`select codigo from lab.achado_marca where operacao_id = ${op.id} and estado in ('tratamento', 'aceito') group by codigo`,
    contextoEventos(sql, op, somarDias(iso(agora), -120), iso(agora)),
  ]);
  const hist: Record<string, EstadoHisterese> = Object.fromEntries(histL.map(h => [h.codigo, h.hist ?? { ligada: false }])), ultimo = Object.fromEntries(histL.map(h => [h.codigo, h.ultimo_estado]));
  const mPol = B.politicas.vigente?.margemAlvo ?? null, m90 = medir('margem_contrib', agora - 90 * DIA, agora), margemRef = m90?.estado === 'ok' && m90.v != null ? m90.v : mPol;
  const achados = avaliarV3(bib.hipoteses, medir, unidadeV3, {
    agora, regras, hist, historico: obsL.map(o => o.codigo), contexto: ctxEv, intervencoes: bib.intervencoes ?? [], compostos: bib.compostos ?? [], ctx, nSimples: ctx?.amostra_coorte ?? undefined,
    margemRef: margemRef ?? undefined, aditivas: ADITIVAS_V3, coorte: COORTE_V3,
  });
  const avisos: string[] = [];
  if (!bib.hipoteses.length) avisos.push('a biblioteca da operação não tem hipóteses');
  if (margemRef == null) avisos.push('sem margem conhecida: impactos em receita não viram contribuição (use a política de preço ou lance custos nas vendas)');
  if (opts.persistir !== false) {
    await sql.begin(async tx => {
      for (const a of achados.filter(x => !x.composto)) {
        await tx`insert into lab.inteligencia_estado (operacao_id, codigo, hist, ultimo_estado, ultimo_impacto) values (${op.id}, ${a.codigo}, ${tx.json(a.hist as never)}, ${a.estado}, ${a.impacto?.valor ?? null})
          on conflict (operacao_id, codigo) do update set hist = excluded.hist, ultimo_estado = excluded.ultimo_estado, ultimo_impacto = excluded.ultimo_impacto, atualizado_em = now()`;
        if (ultimo[a.codigo] !== a.estado) await tx`insert into lab.inteligencia_obs (operacao_id, codigo, estado, impacto, confianca, aderencia) values (${op.id}, ${a.codigo}, ${a.estado}, ${a.impacto?.valor ?? null}, ${a.confianca.nivel}, ${a.aderencia})`;
      }
    });
  }
  return { data: iso(agora), achados, orcamento: orcamentoDeAtencao(achados, marcas, bib.orcamento ?? 5), contexto: ctxEv, marcas, regras, margemRef, avisos };
}

/* ---------- saúde da inteligência ---------- */
export async function saudeDaOperacao(sql: Sql, op: Operacao, achados: AchadoV3[]) {
  const [O, M, X] = await Promise.all([
    sql<any[]>`select codigo, count(*) filter (where estado = 'ativo')::int as disparos, max(em) as ultimo from lab.inteligencia_obs where operacao_id = ${op.id} group by codigo`,
    sql<any[]>`select codigo, count(*) filter (where estado in ('tratamento', 'aceito'))::int as uteis, count(*) filter (where estado = 'naoprocede')::int as nao from lab.achado_marca where operacao_id = ${op.id} group by codigo`,
    sql<any[]>`select hipotese_id, status, resultado, alvo, baseline from lab.experimento where operacao_id = ${op.id}`,
  ]);
  const obs: Record<string, ObsRegra> = {};
  for (const o of O) obs[o.codigo] = { ...(obs[o.codigo] ?? {}), disparos: o.disparos, ultimo: o.ultimo ? new Date(o.ultimo).toISOString() : null };
  for (const m of M) obs[m.codigo] = { ...(obs[m.codigo] ?? {}), uteis: m.uteis, naoProcede: m.nao };
  for (const x of X) if (x.hipotese_id) obs[x.hipotese_id] = { ...(obs[x.hipotese_id] ?? {}), intervencoes: (obs[x.hipotese_id]?.intervencoes ?? 0) + 1 };
  const hips = X.map(x => ({ final: x.status === 'concluido' ? (x.resultado != null && (Number(x.alvo) >= Number(x.baseline ?? 0) ? Number(x.resultado) >= Number(x.alvo) : Number(x.resultado) <= Number(x.alvo)) ? 'sucesso' : 'insucesso') : null, aval: x.status === 'concluido' ? {} : undefined }));
  return saude(obs, achados.map(a => ({ codigo: a.codigo, estado: a.estado, composto: a.composto })), hips);
}

/* ---------- acurácia do forecast pelos fechamentos do dia ---------- */
export async function acuraciaDaOperacao(sql: Sql, op: Operacao, hoje: string, nCiclos = 6) {
  const atual = cicloDaOperacao(op, hoje); const ciclos: Array<{ inicio: string; fim: string }> = []; let c = cicloDaOperacao(op, somarDias(atual.inicio, -1));
  for (let i = 0; i < nCiclos; i++) { ciclos.push({ inicio: c.inicio, fim: c.fim }); c = cicloDaOperacao(op, somarDias(c.inicio, -1)); }
  const desde = ciclos[ciclos.length - 1]!.inicio;
  const [F, G] = await Promise.all([
    sql<any[]>`select data::text as data, ref from lab.dia_fechamento where operacao_id = ${op.id} and data >= ${desde}::date and data < ${atual.inicio}::date order by data`,
    sql<any[]>`select (fechado_em at time zone ${op.fuso})::date::text as dia, coalesce(sum(valor_fechado), 0) as r from lab.negocio n join lab.funil f on f.id = n.funil_id where n.operacao_id = ${op.id} and n.tipo = 'novo' and f.principal and n.status = 'ganho' and n.fechado_em >= ${desde}::date group by 1`,
  ]);
  const porCiclo = ciclos.map(ci => {
    const fotos: Record<string, { receita: { ajust: number | null } }> = {}; for (const f of F) if (f.data >= ci.inicio && f.data < ci.fim && f.ref?.projecao != null) fotos[f.data] = { receita: { ajust: Number(f.ref.projecao) } };
    const real = G.filter(g => g.dia >= ci.inicio && g.dia < ci.fim).reduce((s, g) => s + Number(g.r), 0);
    const A: Acuracia = acuracia(fotos, real, somarDias(ci.fim, -1));
    return { ciclo: ci, real, fotos: Object.keys(fotos).length, acuracia: A };
  }).filter(x => x.fotos > 0 || x.real > 0);
  const geral = acuraciaGeral(porCiclo.map(x => x.acuracia));
  return { ciclos: porCiclo, geral, nota: porCiclo.some(x => x.fotos) ? null : 'ainda não há fechamentos do dia com projeção em ciclos encerrados: a acurácia aparece a partir do próximo ciclo' };
}

/* ---------- waterfall do ciclo: este ciclo contra o anterior ---------- */
export async function waterfallDoCiclo(sql: Sql, op: Operacao, data: string, base?: BaseMedicao) {
  const C1 = cicloDaOperacao(op, data), C0 = cicloDaOperacao(op, somarDias(C1.inicio, -1));
  const B = base ?? (await carregarBase(sql, op, Date.parse(C1.fim + 'T12:00:00Z')));
  const janela = (ci: { inicio: string; fim: string }) => [Date.parse(ci.inicio + 'T00:00:00Z'), Date.parse(ci.fim + 'T00:00:00Z')] as const;
  const agreg = (ci: { inicio: string; fim: string }) => {
    const [a, b] = janela(ci), G = B.negocios.filter(n => n.status === 'ganho' && n.fechadoEm != null && n.fechadoEm >= a && n.fechadoEm < b);
    const E = G.map(n => economiaDaVenda({ id: n.id, valorFechado: n.valor }, B.precos.get(n.id) ?? [], B.politicas)), com = E.filter(e => e.economia);
    const receita = G.reduce((s, g) => s + (g.valor ?? 0), 0);
    return { vendas: G.length, receita, ticket: G.length ? receita / G.length : 0, comEconomia: com.length,
      margem: com.length ? { receita: com.reduce((s, e) => s + e.economia!.preco, 0), impostos: com.reduce((s, e) => s + e.economia!.deducoesTotal, 0), taxa: com.reduce((s, e) => s + e.economia!.taxa + e.economia!.antecipacao, 0), custo: com.reduce((s, e) => s + e.economia!.custos, 0), comissao: com.reduce((s, e) => s + e.economia!.comissao, 0), desconto: E.reduce((s, e) => s + (e.referencia != null && e.fechado != null ? Math.max(0, e.referencia - e.fechado) : 0), 0) } : null };
  };
  const A = agreg(C0), Z = agreg(C1);
  return { anterior: { ciclo: C0, ...A }, atual: { ciclo: C1, ...Z }, receita: waterfallReceita(A.vendas, A.ticket, Z.vendas, Z.ticket), margem: A.margem && Z.margem ? waterfallMargem(A.margem, Z.margem) : null,
    nota: A.margem && Z.margem ? null : 'o waterfall de margem precisa de vendas com custo lançado nos dois ciclos' };
}
