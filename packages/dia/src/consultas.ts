/* Montagem do plano do dia com os dados da V2. Um contexto por operação e dia (carregado uma vez) e a montagem por pessoa.
   Fonte única do "feito": realizados() do planejamento (atividades, negócios ganhos, transições) + lançamentos do administrador.
   O que a V2 ainda não modela (tarefas, agenda, cadência, próximo passo) aparece em `fontes` como false: "sem fonte", nunca zero. */
import type { Sql } from 'postgres';
import { tarefasPorPessoa, type TarefasDoDia } from './tarefas.js';
import { assinar } from '@lab/ciclos';
import { cicloDaOperacao, diaDaSemana, realizados, metasVigentes, somarDias, type Operacao } from '@lab/planejamento';
import { acoesDoDia, compromissos, etapaCenario } from './acoes.js';
import { capacidadeObservada, cenarios, criterios, gargalo, negligencia, padrao as padraoDe, quadrante, rank, sistemico, viabilidade, type Criterios, type Gargalo } from './motor.js';
import { FRACAO_DO_DIA, VERSAO_REGRAS, esperadoAteAgora, linhaEsforco, metasDiarias, minimoDiario, objetivoSemana, producaoDoCiclo, type DiaProducao, type DiaSemana, type Mapa, type Ritual } from './producao.js';
import { INDICADORES_DIA, NOMES, type DadosDia, type LeadNovo, type NegocioAtencao, type ProducaoIndicador, type Taxa } from './tipos.js';

export class ErroDoDia extends Error { constructor(m: string, readonly status = 400) { super(m); } }
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const FUNCAO_NOME: Record<string, string> = { sdr: 'Pré-vendas', closer: 'Vendas', ambos: 'Pré-vendas e vendas', cs: 'Sucesso do cliente', gestor: 'Gestão', outro: '' };
/* etapa principal por função (mínimo de 1 por dia trabalhado, regra da V1): SDR agenda, closer realiza reunião. Vale só para atividade;
   nunca para resultado (oportunidades, vendas), que não cabe "1 por dia" quando a meta do ciclo é menor que os dias úteis */
const PRINCIPAL: Record<string, string[]> = { sdr: ['agendamento'], closer: ['reuniao_realizada'], ambos: ['agendamento', 'reuniao_realizada'] };

export interface Pessoa { id: string; nome: string; funcao: string | null; capacidadeDia: number | null; ativa: boolean }
interface NegocioAberto { id: string; nome: string; dono_id: string | null; etapa_chave: string; etapa_nome: string; papel: string; ordem: number; prazo_dias: number | null; primeira: boolean; etapa_desde: string | null; criado_em: string; valor: number; ultima_atividade: string | null; canal: string | null }
interface Foto { pessoa_id: string | null; data: string; ritual: Ritual; dados: any }

export interface ContextoDia {
  op: Operacao; data: string; ritual: Ritual; agora: Date; fracao: number; crit: Criterios; diarias: string[];
  ciclo: { inicio: string; fim: string; uteis: string[] };
  pessoas: Pessoa[]; ausencias: Map<string, Set<string>>;
  metas: Array<{ indicador: string; pessoaId: string | null; valor: number }>;
  feito: Map<string, Map<string, Mapa>>;          // pessoaId → dia → indicador → quantidade
  ajustes: Map<string, Map<string, Mapa>>;        // lançamentos do administrador
  negocios: NegocioAberto[]; pv: Map<string, { pv: number; n: number }>;
  notas: Map<string, { justificativas: DadosDia['notas']['justificativas']; feitos: DadosDia['notas']['feitos'] }>;
  fotos: Foto[];
  ticket: { v: number | null; fonte: string };
  tarefas: Map<string, TarefasDoDia>;   // por pessoa ('gestor' para as sem responsável)
}

export async function contextoDoDia(sql: Sql, op: Operacao, data: string, ritual: Ritual, agora: Date): Promise<ContextoDia> {
  if (!DATA.test(data)) throw new ErroDoDia('data deve ser AAAA-MM-DD');
  const [o] = await sql<{ pack: any }[]>`select pack from lab.operacao where id = ${op.id}`;
  const pack = o?.pack ?? {};
  const diarias: string[] = (pack.atividades ?? []).filter((a: any) => a.metaDiaria).map((a: any) => a.papel).filter((p: string) => (INDICADORES_DIA as readonly string[]).includes(p));
  const crit = criterios({ ...(pack.parametros?.amostraMinima ? { minN: pack.parametros.amostraMinima } : {}), ...(pack.parametros?.diario ?? {}) });
  const ciclo = cicloDaOperacao(op, data);
  const de = somarDias(ciclo.inicio, -90), ate = somarDias(data, 1);
  const [pessoasL, ausL, metas, reals, lancs, negs, pvL, notasL, fotosL, vendas12] = await Promise.all([
    sql<any[]>`select id, nome, funcao, capacidade_dia, ativa from lab.pessoa where operacao_id = ${op.id} order by nome`,
    sql<any[]>`select pessoa_id, data::text from lab.pessoa_ausencia where operacao_id = ${op.id} and data >= ${de}::date and data < ${ciclo.fim}::date`,
    metasVigentes(sql, op.id, ciclo.inicio),
    realizados(sql, op, de, ate),
    sql<any[]>`select pessoa_id, data::text, indicador, delta from lab.lancamento where operacao_id = ${op.id} and data >= ${de}::date and data <= ${data}::date`,
    sql<any[]>`select n.id, coalesce(c.nome, n.atributos->>'cliente', 'Negócio') as nome, n.dono_id, e.chave as etapa_chave, e.nome as etapa_nome, e.papel, e.ordem, e.prazo_dias,
        e.ordem = (select min(e2.ordem) from lab.etapa e2 where e2.funil_id = e.funil_id and e2.ativa) as primeira,
        n.etapa_desde, n.criado_em, coalesce(n.valor_estimado, 0) as valor, ca.chave as canal,
        (select max(a.em) from lab.atividade a where a.negocio_id = n.id) as ultima_atividade
      from lab.negocio n join lab.etapa e on e.id = n.etapa_id left join lab.conta c on c.id = n.conta_id left join lab.canal ca on ca.id = n.canal_id
      where n.operacao_id = ${op.id} and n.status = 'aberto'`,
    sql<any[]>`select e.chave, count(distinct t.negocio_id)::int as n, count(distinct t.negocio_id) filter (where n.status = 'ganho')::int as ganhos
      from lab.negocio_transicao t join lab.etapa e on e.id = t.para_etapa_id join lab.negocio n on n.id = t.negocio_id
      where t.operacao_id = ${op.id} and n.status <> 'aberto' and n.fechado_em >= ${somarDias(data, -op.janelaHistoricaDias)}::date group by e.chave`,
    sql<any[]>`select pessoa_id, tipo, chave, texto, terceiro, por, criado_em from lab.dia_nota where operacao_id = ${op.id} and data = ${data}::date order by id`,
    sql<any[]>`select pessoa_id, data::text, ritual, dados from lab.dia_foto where operacao_id = ${op.id} and data >= ${somarDias(data, -30)}::date and data <= ${data}::date order by data, id`,
    sql<any[]>`select count(*)::int as n, coalesce(avg(valor_fechado), 0) as media from lab.negocio where operacao_id = ${op.id} and status = 'ganho' and tipo = 'novo' and valor_fechado > 0 and fechado_em >= ${somarDias(data, -365)}::date`,
  ]);
  const pessoas: Pessoa[] = pessoasL.map(p => ({ id: p.id, nome: p.nome, funcao: p.funcao, capacidadeDia: p.capacidade_dia, ativa: p.ativa }));
  const ausencias = new Map<string, Set<string>>();
  for (const a of ausL) (ausencias.get(a.pessoa_id) ?? ausencias.set(a.pessoa_id, new Set()).get(a.pessoa_id)!).add(a.data);
  const feito = new Map<string, Map<string, Mapa>>(), ajustes = new Map<string, Map<string, Mapa>>();
  const por = (m: Map<string, Map<string, Mapa>>, p: string, d: string) => { const x = m.get(p) ?? m.set(p, new Map()).get(p)!; return x.get(d) ?? x.set(d, {}).get(d)!; };
  for (const r of reals) if (r.pessoaId) { const o2 = por(feito, r.pessoaId, r.dia); o2[r.indicador] = (o2[r.indicador] ?? 0) + r.quantidade; }
  for (const l of lancs) { const o2 = por(ajustes, l.pessoa_id, l.data); o2[l.indicador] = (o2[l.indicador] ?? 0) + Number(l.delta); }
  const pv = new Map(pvL.map(x => [x.chave, { pv: x.n ? x.ganhos / x.n : 0, n: x.n }]));
  const notas = new Map<string, { justificativas: DadosDia['notas']['justificativas']; feitos: DadosDia['notas']['feitos'] }>();
  for (const n of notasL) {
    const x = notas.get(n.pessoa_id) ?? notas.set(n.pessoa_id, { justificativas: {}, feitos: {} }).get(n.pessoa_id)!;
    const em = new Date(n.criado_em).toISOString();
    if (n.tipo === 'justificativa') x.justificativas[n.chave] = { motivo: n.texto ?? '', terceiro: !!n.terceiro, por: n.por, em };
    else if (n.tipo === 'feito') x.feitos[n.chave] = { por: n.por, em };
    else delete x.feitos[n.chave];
  }
  const mr = metas.find(m => !m.pessoaId && m.indicador === 'receita')?.valor, mv = metas.find(m => !m.pessoaId && m.indicador === 'vendas')?.valor;
  const ticket = mr && mv ? { v: mr / mv, fonte: 'meta de receita ÷ meta de vendas do ciclo' } : vendas12[0]?.n ? { v: Number(vendas12[0].media), fonte: `média das ${vendas12[0].n} vendas dos últimos 12 meses` } : { v: null, fonte: 'sem vendas nos últimos 12 meses' };
  const tarefas = await tarefasPorPessoa(sql, op, data, ciclo.uteis.find(d => d > data) ?? null);
  return { op, data, ritual, agora, fracao: FRACAO_DO_DIA[ritual], crit, diarias: diarias.length ? diarias : ['tentativa'], ciclo, pessoas, ausencias, metas, feito, ajustes,
    negocios: negs.map(n => ({ ...n, valor: Number(n.valor), criado_em: new Date(n.criado_em).toISOString(), etapa_desde: n.etapa_desde ? new Date(n.etapa_desde).toISOString() : null, ultima_atividade: n.ultima_atividade ? new Date(n.ultima_atividade).toISOString() : null })),
    pv, notas, fotos: fotosL.map(f => ({ pessoa_id: f.pessoa_id, data: f.data, ritual: f.ritual, dados: f.dados })), ticket, tarefas };
}

const segunda = (iso: string) => somarDias(iso, -((diaDaSemana(iso) + 6) % 7));
const somaMapa = (xs: Mapa[]) => { const o: Mapa = {}; for (const x of xs) for (const k of Object.keys(x)) o[k] = (o[k] ?? 0) + x[k]!; return o; };

/* metas diárias da pessoa no ciclo: só de acréscimo (vale a vigente), distribuídas nos dias úteis dela, inteiras, com mínimo diário na etapa principal */
export function metasDiariasDaPessoa(ctx: ContextoDia, p: Pessoa): { uteis: string[]; porDia: Record<string, Mapa>; metaCiclo: Mapa; extra: Mapa } {
  const aus = ctx.ausencias.get(p.id) ?? new Set<string>();
  const uteis = ctx.ciclo.uteis.filter(d => !aus.has(d));
  const porDia: Record<string, Mapa> = Object.fromEntries(uteis.map(d => [d, {}]));
  const metaCiclo: Mapa = {}, extra: Mapa = {};
  const principais = PRINCIPAL[p.funcao ?? ''] ?? [];
  for (const m of ctx.metas) {
    if (m.pessoaId !== p.id || !(INDICADORES_DIA as readonly string[]).includes(m.indicador)) continue;
    let dias = metasDiarias(m.valor, uteis);
    if (principais.includes(m.indicador) && m.valor > 0) { const r = minimoDiario(dias); dias = r.porDia; if (r.extra) extra[m.indicador] = r.extra; }
    for (const d of uteis) porDia[d]![m.indicador] = dias[d] ?? 0;
    metaCiclo[m.indicador] = Object.values(dias).reduce((s, x) => s + x, 0);
  }
  return { uteis, porDia, metaCiclo, extra };
}

export function montarPessoa(ctx: ContextoDia, p: Pessoa): DadosDia {
  const { data, crit } = ctx, hoje = data;
  const M = metasDiariasDaPessoa(ctx, p), uteis = M.uteis, feitoP = ctx.feito.get(p.id) ?? new Map<string, Mapa>(), ajP = ctx.ajustes.get(p.id) ?? new Map<string, Mapa>();
  const trabalhaHoje = uteis.includes(hoje), futuros = uteis.filter(d => d > hoje), amanha = futuros[0] ?? null, ontem = [...uteis].reverse().find(d => d < hoje) ?? null;
  const semIni = segunda(hoje), semFim = somarDias(semIni, 6);
  const janela = Math.max(1, Math.min(crit.janelaRecup, futuros.length + (trabalhaHoje ? 1 : 0) || 1));
  /* produção do ciclo até hoje (regra oficial da recuperação distribuída) */
  const dias: DiaProducao[] = [];
  for (let d = ctx.ciclo.inicio; d <= hoje; d = somarDias(d, 1)) dias.push({ iso: d, meta: M.porDia[d] ?? {}, feito: feitoP.get(d) ?? {}, ...(ajP.get(d) ? { ajuste: ajP.get(d) } : {}) });
  const R = producaoDoCiclo({ dias, futuros: futuros.map(d => ({ iso: d, meta: M.porDia[d] ?? {} })), hoje, semana: [semIni, semFim], janela, semRecup: !trabalhaHoje });
  const mRest = somaMapa(futuros.map(d => M.porDia[d] ?? {})), mAm = amanha ? M.porDia[amanha] ?? {} : {};
  /* semana (cortada no ciclo): objetivos semanais com o atraso proporcional aos dias úteis dela */
  const wIni = semIni < ctx.ciclo.inicio ? ctx.ciclo.inicio : semIni, wFim = semFim >= ctx.ciclo.fim ? somarDias(ctx.ciclo.fim, -1) : semFim;
  const diasSem: DiaSemana[] = []; for (let d = wIni; d <= wFim; d = somarDias(d, 1)) diasSem.push({ iso: d, meta: M.porDia[d] ?? {}, feito: { ...(feitoP.get(d) ?? {}), ...Object.fromEntries(Object.entries(ajP.get(d) ?? {}).map(([k, v]) => [k, (feitoP.get(d)?.[k] ?? 0) + v])) }, util: uteis.includes(d) });
  const antes: Mapa = {}; for (let d = ctx.ciclo.inicio; d < wIni; d = somarDias(d, 1)) for (const k of INDICADORES_DIA) antes[k] = (antes[k] ?? 0) + ((M.porDia[d]?.[k] ?? 0) - ((feitoP.get(d)?.[k] ?? 0) + (ajP.get(d)?.[k] ?? 0)));
  const W = objetivoSemana({ dias: diasSem, antes, janela: crit.janelaRecup, hoje, indicadores: [...INDICADORES_DIA], diarias: ctx.diarias });
  const prod: ProducaoIndicador[] = INDICADORES_DIA.filter(k => R[k] && (R[k]!.temMeta || (mRest[k] ?? 0) > 0 || R[k]!.feitoCiclo > 0)).map(k => { const x = R[k]!; return {
    k, nome: NOMES[k]![0], diario: ctx.diarias.includes(k), alvo: x.alvoHoje, feito: x.feitoHoje, falta: x.aFazerHoje, recup: x.recupHoje, janela: x.janela, metaHoje: x.metaHoje, adiantado: x.adiantado,
    atraso: x.atraso, atrasoTotal: x.atrasoTotal, metaCiclo: x.metaCiclo, feitoCiclo: x.feitoCiclo, metaAmanha: mAm[k] ?? 0, metaRestante: mRest[k] ?? 0, metaTotal: x.metaCiclo + (mRest[k] ?? 0), sem: W[k] ?? null }; });
  const P = (k: string) => prod.find(x => x.k === k) ?? null;
  /* volumes: ciclo (fluxo) e 90 dias antes do ciclo */
  const somaEntre = (a: string, b: string) => { const o: Mapa = {}; for (const [d, m] of feitoP) if (d >= a && d < b) for (const k of Object.keys(m)) o[k] = (o[k] ?? 0) + m[k]!; for (const [d, m] of ajP) if (d >= a && d < b) for (const k of Object.keys(m)) o[k] = (o[k] ?? 0) + m[k]!; return o; };
  const vol = somaEntre(ctx.ciclo.inicio, somarDias(hoje, 1)), volH = somaEntre(somarDias(ctx.ciclo.inicio, -90), ctx.ciclo.inicio);
  const txPlano: Record<string, number> = {};
  const PASSOS: Array<[string, string, string]> = [['tentativa', 'contato', 'Tentativa → contato efetivo'], ['contato', 'agendamento', 'Contato efetivo → reunião agendada'], ['tentativa', 'agendamento', 'Tentativa → reunião agendada'], ['agendamento', 'reuniao_realizada', 'Agendada → realizada (comparecimento)'], ['reuniao_realizada', 'oportunidades', 'Realizada → oportunidade'], ['oportunidades', 'vendas', 'Oportunidade → venda']];
  for (const [a, b] of PASSOS) { const x = P(a), y = P(b); if (x && y && x.metaTotal > 0 && y.metaTotal > 0) txPlano[`${a}>${b}`] = y.metaTotal / x.metaTotal; }
  const eq = equipeTx(ctx);
  const tx: Taxa[] = PASSOS.map(([a, b, nome]) => { const k = `${a}>${b}`, va = vol[a] ?? 0, vb = vol[b] ?? 0, ha = volH[a] ?? 0, e = eq[k] ?? { k: 0, n: 0 };
    return { chave: k, de: a, para: b, nome, real: va >= 1 ? vb / va : null, n: va, k: vb, plano: txPlano[k] ?? null, hist: ha >= crit.minN ? (volH[b] ?? 0) / ha : null, nh: ha, equipe: e.n >= crit.minN ? e.k / e.n : null }; })
    .filter(t => t.real != null || t.plano != null);
  /* situação (§4), viabilidade (§3.3) */
  const at = P('tentativa') && P('tentativa')!.metaCiclo > 0 ? P('tentativa') : P('agendamento');
  const rs = ['vendas', 'oportunidades', 'reuniao_realizada'].map(P).find(x => x && x.metaCiclo > 0 && x !== at) ?? null;
  const quad = quadrante(at ? { meta: at.metaCiclo, feito: at.feitoCiclo } : null, rs ? { meta: rs.metaCiclo, feito: rs.feitoCiclo } : null, crit);
  const capObs = capacidadeObservadaDe(ctx, p, uteis), cap = p.capacidadeDia && p.capacidadeDia > 0 ? { v: p.capacidadeDia, fonte: 'apontada' as const, obs: capObs } : { v: capObs.v, fonte: capObs.v ? ('observada' as const) : null, obs: capObs };
  const pd = P(ctx.diarias[0] ?? 'tentativa');
  const viab = pd ? viabilidade({ falta: pd.falta, metaHoje: pd.metaHoje, atraso: pd.atraso, cap: cap.v, metaRestante: pd.metaRestante, diasRest: futuros.length }, crit) : null;
  /* negócios que exigem atenção (§6) e leads novos sem contato */
  const agora = ctx.agora.getTime(), DIA = 86_400_000;
  const cards: NegocioAtencao[] = [], leadsNovos: LeadNovo[] = [];
  for (const n of ctx.negocios.filter(x => x.dono_id === p.id)) {
    const ult = Math.max(n.ultima_atividade ? Date.parse(n.ultima_atividade) : 0, n.etapa_desde ? Date.parse(n.etapa_desde) : 0, Date.parse(n.criado_em));
    if (n.primeira) { if (!n.ultima_atividade) leadsNovos.push({ id: n.id, nome: n.nome, horas: (agora - Date.parse(n.criado_em)) / 3_600_000, canal: n.canal }); continue; }
    const desde = n.etapa_desde ?? n.criado_em, diasNaEtapa = ctx.ciclo.uteis.length ? diasUteisEntre(ctx, desde.slice(0, 10), hoje) : 0;
    const proposta = n.papel === 'proposta' || n.papel === 'negociacao', chance = ctx.pv.get(n.etapa_chave);
    const c = { etapaIdx: n.ordem, diasSemAtiv: (agora - ult) / DIA, diasNaEtapa, refEtapa: n.prazo_dias, valor: n.valor, pv: chance && chance.n >= crit.minN ? chance.pv : null, proposta, semProximo: false };
    const A = negligencia(c, crit);
    if (A.alerta) cards.push({ id: n.id, nome: n.nome, etapa: n.etapa_nome, valor: n.valor, pv: c.pv, diasSemAtiv: c.diasSemAtiv, diasNaEtapa, refEtapa: n.prazo_dias, classe: A.classe!, motivos: A.motivos, acao: A.acao!, prazo: A.prazo!, ve: A.ve!, score: A.score!, proposta, semProximo: false });
  }
  cards.sort((a, b) => rank(a.classe) - rank(b.classe) || b.score - a.score);
  leadsNovos.sort((a, b) => b.horas - a.horas);
  const exposicao = cards.filter(x => x.classe !== 'normal').reduce((a, x) => a + x.ve, 0);
  /* padrões (§10.6) e fechamento de ontem (§11.1) */
  const kPad = at ? at.k : 'tentativa';
  const dHist = uteis.filter(d => d < hoje && d >= somarDias(hoje, -21)).slice(-crit.diasPadrao);
  const serie = dHist.map(iso => ({ iso, meta: M.porDia[iso]?.[kPad] ?? 0, feito: (feitoP.get(iso)?.[kPad] ?? 0) + (ajP.get(iso)?.[kPad] ?? 0) }));
  const padrao = { ...padraoDe(serie, crit), k: kPad };
  const ontemProd = ontem ? INDICADORES_DIA.map(k => ({ k, meta: M.porDia[ontem]?.[k] ?? 0, feito: (feitoP.get(ontem)?.[k] ?? 0) + (ajP.get(ontem)?.[k] ?? 0) })).filter(x => x.meta > 0 || x.feito > 0) : [];
  /* gargalos (§8) */
  const garg: Gargalo[] = gargalo(vol, volH, txPlano, eq, at ? { meta: at.metaCiclo, feito: at.feitoCiclo } : null, crit);
  /* resumo do dia e da semana */
  const dP = prod.filter(x => x.diario), alvoT = dP.reduce((a, x) => a + x.alvo, 0), feitoT = dP.reduce((a, x) => a + Math.min(x.feito, x.alvo), 0);
  const wP = prod.map(x => x.sem).filter((w): w is NonNullable<typeof w> => !!w && w.alvo > 0), wa = wP.reduce((a, w) => a + w.alvo, 0);
  const esperadoAgora = prod.filter(x => x.metaTotal > 0).map(x => { const esp = esperadoAteAgora(x.metaTotal, uteis, hoje, ctx.fracao), r = esp > 0 ? x.feitoCiclo / esp : null;
    return { k: x.k, esperado: Math.round(esp * 100) / 100, feito: x.feitoCiclo, status: r == null ? null : r >= 1 ? ('em_dia' as const) : r >= crit.pctOk ? ('atencao' as const) : ('atras' as const) }; });
  const notasP = ctx.notas.get(p.id) ?? { justificativas: {}, feitos: {} };
  const T: TarefasDoDia = ctx.tarefas.get(p.id) ?? { hoje: [], atrasadas: [], amanha: 0, feitasHoje: 0, feitasHojePrazoHoje: 0 };
  const base = {
    pessoa: { id: p.id, nome: p.nome, funcao: p.funcao, funcaoNome: FUNCAO_NOME[p.funcao ?? ''] ?? '' },
    data, ritual: ctx.ritual, fracaoHoje: ctx.fracao, versaoRegras: VERSAO_REGRAS,
    ciclo: { inicio: ctx.ciclo.inicio, fim: ctx.ciclo.fim, uteisOperacao: ctx.ciclo.uteis.length, uteisPessoa: uteis, diasRest: futuros.length, amanha, ontem, trabalhaHoje },
    semana: { ini: semIni, fim: semFim, restantes: W[ctx.diarias[0] ?? 'tentativa']?.restantes ?? uteis.filter(d => d >= hoje && d <= semFim).length },
    cap, prod, quad, quadAt: at, quadRs: rs, viab, tx, txPlano, vol, volH, cards, exposicao, leadsNovos, padrao, serie, ontem: { prod: ontemProd }, garg, ticket: ctx.ticket,
    pct: alvoT > 0 ? feitoT / alvoT : null, pctSem: wa > 0 ? wP.reduce((a, w) => a + Math.min(w.feito, w.alvo), 0) / wa : null, atrasoProd: prod.reduce((a, x) => a + x.atraso, 0),
    esperadoAgora, fontes: { tarefas: true, agenda: false, cadencia: false, proximoPasso: false, pipeline: false },
    notas: notasP, tarefas: T,
  };
  const acoes = acoesDoDia(base, 'você'), sucesso = compromissos(base);
  const cen = cenarios({ etapas: prod.filter(x => x.diario).map(x => etapaCenario(base, x)), pend: { semProximo: 0, tarefasVencidas: T.atrasadas.length, tarefasHoje: T.hoje.length }, amanha: { tarefas: T.amanha }, cap: cap.v });
  const memoria = memoriaDe(ctx, p.id, kPad);
  return { ...base, acoes, sucesso, cenario: { exec: cen.exec, nao: cen.nao, cap: cen.cap }, memoria };
}

function diasUteisEntre(ctx: ContextoDia, de: string, ate: string): number { let n = 0; for (const d of ctx.ciclo.uteis) if (d > de && d <= ate) n++; if (de < ctx.ciclo.inicio) { let d = de; while (d < ctx.ciclo.inicio) { const w = diaDaSemana(d); if (w >= 1 && w <= 5) n++; d = somarDias(d, 1); } } return n; }

/* capacidade observada: toques (tentativa + contato) por dia útil nos últimos 20 dias trabalhados antes de hoje (até 45 dias), percentil 80 */
function capacidadeObservadaDe(ctx: ContextoDia, p: Pessoa, uteisCiclo: string[]) {
  const feitoP = ctx.feito.get(p.id) ?? new Map<string, Mapa>(), aus = ctx.ausencias.get(p.id) ?? new Set<string>();
  const dias: string[] = []; for (let d = somarDias(ctx.data, -45); d < ctx.data; d = somarDias(d, 1)) { const w = diaDaSemana(d); if (ctx.op.calendario.diasUteis.includes(w) && !aus.has(d) && (d < ctx.ciclo.inicio || uteisCiclo.includes(d))) dias.push(d); }
  const ult = dias.slice(-20);
  return capacidadeObservada(ult.map(d => { const m = feitoP.get(d) ?? {}; return (m.tentativa ?? 0) + (m.contato ?? 0); }));
}

/* taxas da equipe no ciclo (soma de todos, para comparar quando a amostra permite) */
function equipeTx(ctx: ContextoDia): Record<string, { k: number; n: number }> {
  const out: Record<string, { k: number; n: number }> = {};
  const PASSOS = [['tentativa', 'contato'], ['contato', 'agendamento'], ['tentativa', 'agendamento'], ['agendamento', 'reuniao_realizada'], ['reuniao_realizada', 'oportunidades'], ['oportunidades', 'vendas']];
  for (const p of ctx.pessoas) { const f = ctx.feito.get(p.id); if (!f) continue; const v: Mapa = {}; for (const [d, m] of f) if (d >= ctx.ciclo.inicio && d <= ctx.data) for (const k of Object.keys(m)) v[k] = (v[k] ?? 0) + m[k]!;
    for (const [a, b] of PASSOS) { const k = `${a}>${b}`, o = (out[k] = out[k] ?? { k: 0, n: 0 }); o.n += v[a!] ?? 0; o.k += v[b!] ?? 0; } }
  return out;
}

/* memória: plano (foto da manhã) × executado (foto do fim do dia) dos últimos 10 dias registrados */
function memoriaDe(ctx: ContextoDia, pessoaId: string, k: string): DadosDia['memoria'] {
  const porDia = new Map<string, { manha?: any; fim?: any }>();
  for (const f of ctx.fotos) { if (f.pessoa_id !== pessoaId || f.data >= ctx.data) continue; const x = porDia.get(f.data) ?? porDia.set(f.data, {}).get(f.data)!; if (f.ritual === 'manha') x.manha = f.dados; if (f.ritual === 'fim') x.fim = f.dados; }
  return [...porDia].filter(([, x]) => x.manha || x.fim).slice(-10).map(([data, x]) => { const alvo = Number(x.manha?.alvo?.[k] ?? x.fim?.alvo?.[k] ?? 0), feito = x.fim ? Number(x.fim.feito?.[k] ?? 0) : null, ac = x.manha?.acoes ?? [];
    return { data, ritual: (x.fim ? 'fim' : 'manha') as Ritual, alvo, feito, pct: alvo > 0 && feito != null ? feito / alvo : null, acoes: ac.length, criticas: ac.filter((a: any) => a.classe === 'critica').length, justificativas: Object.keys(x.fim?.justificativas ?? {}).length }; });
}

export async function dadosDoDia(sql: Sql, op: Operacao, pessoaId: string, data: string, ritual: Ritual, agora: Date): Promise<DadosDia> {
  const ctx = await contextoDoDia(sql, op, data, ritual, agora);
  const p = ctx.pessoas.find(x => x.id === pessoaId);
  if (!p) throw new ErroDoDia('pessoa não encontrada', 404);
  return montarPessoa(ctx, p);
}

/* ---------- a equipe (visão do gestor) ---------- */
export interface Intervencao { g: number; pessoaId: string; pessoa: string; t: string; por: string; med: string; imp: string }
export async function equipeDoDia(sql: Sql, op: Operacao, data: string, ritual: Ritual, agora: Date) {
  const ctx = await contextoDoDia(sql, op, data, ritual, agora);
  const pessoas = ctx.pessoas.filter(p => p.ativa && ['sdr', 'closer', 'ambos'].includes(p.funcao ?? ''));
  const Ds = pessoas.map(p => montarPessoa(ctx, p));
  const inter: Intervencao[] = [];
  const n1 = (k: string) => NOMES[k]?.[2] ?? k;
  for (const D of Ds) { const nm = D.pessoa.nome, Q = D.quad, g = D.garg[0];
    if (D.viab && D.viab.st === 'inviavel') inter.push({ g: 4, pessoaId: D.pessoa.id, pessoa: nm, t: `Decidir a recuperação de ${nm}`, por: D.viab.txt, med: 'tentativas/dia × capacidade', imp: '' });
    if ((Q.tipo === 'operacional' || Q.tipo === 'ambos') && D.quadAt) {
      let imp = ''; { const x = D.quadAt; let v = x.metaCiclo - x.feitoCiclo, k = x.k; for (let i = 0; i < 4; i++) { const t = D.tx.find(y => y.de === k && ((y.plano ?? 0) > 0 || (y.hist ?? 0) > 0)); if (!t) break; v *= (t.plano ?? t.hist) as number; k = t.para; } if (k === 'vendas' && ctx.ticket.v) imp = `déficit ≈ ${v.toFixed(1).replace('.', ',')} vendas (R$ ${Math.round(v * ctx.ticket.v).toLocaleString('pt-BR')})`; }
      inter.push({ g: Q.tipo === 'ambos' ? 3 : 2, pessoaId: D.pessoa.id, pessoa: nm, t: `Recuperar o volume de atividade de ${nm}`, por: `${Q.tit}: ${n1(D.quadAt.k)} em ${Math.round((Q.pa ?? 0) * 100)}% do plano até hoje.${D.padrao.recorrente ? ` Padrão recorrente (${D.padrao.abaixo} de ${D.padrao.n} dias).` : ''}`, med: `${n1(D.quadAt.k)} por dia na próxima semana`, imp }); }
    else if (Q.tipo === 'resultado' && g) inter.push({ g: 2, pessoaId: D.pessoa.id, pessoa: nm, t: `${g.chave === 'oportunidades>vendas' || g.chave === 'reuniao_realizada>oportunidades' ? 'Auditar 2 reuniões de ' : 'Acompanhar 2 ligações de '}${nm}`, por: `Insuficiência de resultado com atividade em dia: ${g.nome.toLowerCase()} em ${Math.round(g.real * 100)}% (${g.refTxt} ${Math.round(g.ref * 100)}%). É eficiência, não volume. Confiança ${g.conf}.`, med: g.ind ?? '', imp: '' });
    const pend = D.leadsNovos.length + D.cards.filter(x => x.proposta && x.classe === 'critica').length;
    if (pend) inter.push({ g: 3, pessoaId: D.pessoa.id, pessoa: nm, t: `Cobrar de ${nm} os leads e propostas parados`, por: [D.leadsNovos.length ? `${D.leadsNovos.length} lead(s) sem contato` : '', D.cards.filter(x => x.proposta && x.classe === 'critica').length ? `${D.cards.filter(x => x.proposta && x.classe === 'critica').length} proposta(s)/negociação(ões) parada(s)` : ''].filter(Boolean).join(', ') + '.', med: 'zerados até o fim do dia', imp: D.exposicao > 0 ? `exposição R$ ${Math.round(D.exposicao).toLocaleString('pt-BR')}` : '' });
  }
  inter.sort((a, b) => b.g - a.g);
  const sis = sistemico(Object.fromEntries(Ds.map(D => [D.pessoa.nome, D.garg])), Math.max(2, Math.ceil(Ds.length / 2)));
  const ops = Ds.flatMap(D => D.cards.filter(x => x.classe !== 'normal').map(x => ({ ...x, pessoa: D.pessoa.nome, pessoaId: D.pessoa.id }))).sort((a, b) => rank(a.classe) - rank(b.classe) || b.score - a.score);
  const leadsCiclo = ctx.negocios.filter(n => n.criado_em.slice(0, 10) >= ctx.ciclo.inicio), semDono = leadsCiclo.filter(n => !n.dono_id).length;
  const metaT = Ds.map(D => D.prod.find(x => x.k === (ctx.diarias[0] ?? 'tentativa'))?.metaTotal ?? 0), totMeta = metaT.reduce((a, b) => a + b, 0);
  const quadro = Ds.map((D, i) => { const L = leadsCiclo.filter(n => n.dono_id === D.pessoa.id).length, pl = leadsCiclo.length ? L / leadsCiclo.length : null, pm = totMeta ? metaT[i]! / totMeta : null, v = D.viab;
    const cumpr = D.memoria.filter(m => m.pct != null); const c = cumpr.length ? { m: cumpr.reduce((a, m) => a + Math.min(1.5, m.pct!), 0) / cumpr.length, n: cumpr.length, just: cumpr.reduce((a, m) => a + m.justificativas, 0) } : null;
    return { pessoaId: D.pessoa.id, pessoa: D.pessoa.nome, funcao: D.pessoa.funcaoNome, situacao: D.quad, pctSem: D.pctSem, pct: D.pct,
      faltaHoje: D.prod.filter(x => x.falta > 0).map(x => ({ k: x.k, n: x.falta })), atraso: D.prod.filter(x => x.atraso >= 1).map(x => ({ k: x.k, n: x.atraso })),
      leadsNovos: D.leadsNovos.length, criticos: D.cards.filter(x => x.classe === 'critica').length, alertas: D.cards.filter(x => x.classe !== 'normal').length,
      leads: L, pctLeads: pl, pctMeta: pm, necessarioDia: v ? Math.ceil(v.ritmoFim) : null, cap: D.cap.v, viab: v?.st ?? null, desproporcional: pl != null && pm != null && pm > 0 && (pl / pm > 1.5 || pl / pm < 0.5), cumprimento: c, esperadoAgora: D.esperadoAgora }; });
  const decisoes = Ds.filter(D => D.viab && D.viab.st === 'inviavel').map(D => ({ pessoaId: D.pessoa.id, pessoa: D.pessoa.nome, t: `Recuperação de ${D.pessoa.nome} não cabe na capacidade: redistribuir, ampliar capacidade, melhorar conversão ou rever a meta.` }));
  return { data, ritual, versaoRegras: VERSAO_REGRAS, ciclo: { inicio: ctx.ciclo.inicio, fim: ctx.ciclo.fim, uteis: ctx.ciclo.uteis.length }, pessoas: Ds.length, quadro, intervencoes: inter.slice(0, 14), sistemico: sis, oportunidades: ops.slice(0, 12), exposicao: ops.reduce((a, x) => a + x.ve, 0), semDono, decisoes, fontes: { tarefas: false, agenda: false, cadencia: false } };
}

/* ---------- rituais: a foto imutável de cada momento do dia ---------- */
export function fotoDe(D: DadosDia) {
  return {
    versao: D.versaoRegras, ritual: D.ritual, fracaoHoje: D.fracaoHoje, cap: D.cap.v, capFonte: D.cap.fonte, quad: D.quad.tipo, viab: D.viab?.st ?? null,
    alvo: Object.fromEntries(D.prod.map(x => [x.k, x.alvo])), feito: Object.fromEntries(D.prod.map(x => [x.k, x.feito])), feitoCiclo: Object.fromEntries(D.prod.map(x => [x.k, x.feitoCiclo])),
    sucesso: D.sucesso.map(s => ({ k: s.k, ok: s.ok, t: s.t })), acoes: D.acoes.map(a => ({ chave: a.chave, classe: a.classe, tit: a.tit, justificada: !!a.justificativa })),
    esperadoAgora: D.esperadoAgora, amanha: D.cenario.exec.etapas.map(e => ({ k: e.k, amanha: e.amanha, adicional: e.adicional })), justificativas: D.notas.justificativas, pct: D.pct, pctSem: D.pctSem,
  };
}
export async function gravarFoto(sql: Sql, op: Operacao, D: DadosDia): Promise<{ gravada: boolean; assinatura: string }> {
  const dados = JSON.parse(JSON.stringify(fotoDe(D))), assinatura = await assinar(dados);
  const r = await sql`insert into lab.dia_foto (operacao_id, pessoa_id, data, ritual, dados, assinatura, versao_regras) values (${op.id}, ${D.pessoa.id}, ${D.data}::date, ${D.ritual}, ${sql.json(dados)}, ${assinatura}, ${D.versaoRegras})
    on conflict do nothing returning id`;
  return { gravada: r.length > 0, assinatura };
}
export async function fotosDoDia(sql: Sql, op: Operacao, pessoaId: string, data: string) {
  return sql<{ ritual: Ritual; assinatura: string; criado_em: Date }[]>`select ritual, assinatura, criado_em from lab.dia_foto where operacao_id = ${op.id} and pessoa_id = ${pessoaId} and data = ${data}::date order by id`;
}

/* ---------- notas do dia, lançamentos, ausências, capacidade ---------- */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function pessoaDe(sql: Sql, op: Operacao, pessoaId: string) {
  if (!UUID.test(pessoaId)) throw new ErroDoDia('pessoa não encontrada', 404);
  const [p] = await sql`select id from lab.pessoa where id = ${pessoaId} and operacao_id = ${op.id}`;
  if (!p) throw new ErroDoDia('pessoa não encontrada', 404);
}
export async function justificar(sql: Sql, op: Operacao, b: { pessoaId: string; data: string; chave: string; motivo: string; terceiro?: boolean; por?: string | null }) {
  await pessoaDe(sql, op, b.pessoaId);
  if (!DATA.test(b.data)) throw new ErroDoDia('data deve ser AAAA-MM-DD');
  const motivo = (b.motivo ?? '').trim(); if (motivo.length < 5 || motivo.length > 1000) throw new ErroDoDia('escreva a justificativa (5 a 1000 caracteres)');
  if (!b.chave || b.chave.length > 80) throw new ErroDoDia('chave inválida');
  await sql`insert into lab.dia_nota (operacao_id, pessoa_id, data, tipo, chave, texto, terceiro, por) values (${op.id}, ${b.pessoaId}, ${b.data}::date, 'justificativa', ${b.chave}, ${motivo}, ${!!b.terceiro}, ${b.por ?? null})`;
  return { ok: true };
}
export async function marcarFeito(sql: Sql, op: Operacao, b: { pessoaId: string; data: string; chave: string; feito: boolean; por?: string | null }) {
  await pessoaDe(sql, op, b.pessoaId);
  if (!DATA.test(b.data)) throw new ErroDoDia('data deve ser AAAA-MM-DD');
  if (!b.chave || b.chave.length > 80) throw new ErroDoDia('chave inválida');
  await sql`insert into lab.dia_nota (operacao_id, pessoa_id, data, tipo, chave, por) values (${op.id}, ${b.pessoaId}, ${b.data}::date, ${b.feito ? 'feito' : 'desfeito'}, ${b.chave}, ${b.por ?? null})`;
  return { ok: true };
}
export async function lancar(sql: Sql, op: Operacao, b: { pessoaId: string; data: string; indicador: string; delta: number; motivo: string; por?: string | null }) {
  await pessoaDe(sql, op, b.pessoaId);
  if (!DATA.test(b.data)) throw new ErroDoDia('data deve ser AAAA-MM-DD');
  if (!(INDICADORES_DIA as readonly string[]).includes(b.indicador)) throw new ErroDoDia(`indicador deve ser: ${INDICADORES_DIA.join(', ')}`);
  const delta = Number(b.delta); if (!Number.isFinite(delta) || delta === 0 || Math.abs(delta) > 100000) throw new ErroDoDia('informe a quantidade (diferente de zero)');
  const motivo = (b.motivo ?? '').trim(); if (motivo.length < 5 || motivo.length > 500) throw new ErroDoDia('escreva o motivo (5 a 500 caracteres)');
  const [r] = await sql`insert into lab.lancamento (operacao_id, pessoa_id, data, indicador, delta, motivo, por) values (${op.id}, ${b.pessoaId}, ${b.data}::date, ${b.indicador}, ${delta}, ${motivo}, ${b.por ?? null}) returning id`;
  return { id: r!.id as number };
}
export async function desfazerLancamento(sql: Sql, op: Operacao, id: number, por?: string | null) {
  const [l] = await sql<any[]>`select id, pessoa_id, data::text, indicador, delta, motivo from lab.lancamento where id = ${id} and operacao_id = ${op.id}`;
  if (!l) throw new ErroDoDia('lançamento não encontrado', 404);
  const [ja] = await sql`select 1 from lab.lancamento where desfaz_id = ${id}`;
  if (ja) throw new ErroDoDia('este lançamento já foi desfeito', 409);
  await sql`insert into lab.lancamento (operacao_id, pessoa_id, data, indicador, delta, motivo, desfaz_id, por) values (${op.id}, ${l.pessoa_id}, ${l.data}::date, ${l.indicador}, ${-Number(l.delta)}, ${`desfez o lançamento #${id} (${l.motivo})`.slice(0, 500)}, ${id}, ${por ?? null})`;
  return { ok: true };
}
export async function lancamentos(sql: Sql, op: Operacao, pessoaId: string, de: string, ate: string) {
  return sql`select l.id, l.data::text, l.indicador, l.delta, l.motivo, l.desfaz_id as "desfazId", l.por, l.criado_em as "criadoEm", exists(select 1 from lab.lancamento d where d.desfaz_id = l.id) as desfeito
    from lab.lancamento l where l.operacao_id = ${op.id} and l.pessoa_id = ${pessoaId} and l.data >= ${de}::date and l.data <= ${ate}::date order by l.id desc limit 100`;
}
export async function ausencias(sql: Sql, op: Operacao, de: string, ate: string) {
  return sql`select a.id, a.pessoa_id as "pessoaId", p.nome as pessoa, a.data::text, a.motivo from lab.pessoa_ausencia a join lab.pessoa p on p.id = a.pessoa_id where a.operacao_id = ${op.id} and a.data >= ${de}::date and a.data <= ${ate}::date order by a.data, p.nome`;
}
export async function marcarAusencia(sql: Sql, op: Operacao, b: { pessoaId: string; data: string; motivo?: string | null; remover?: boolean }) {
  await pessoaDe(sql, op, b.pessoaId);
  if (!DATA.test(b.data)) throw new ErroDoDia('data deve ser AAAA-MM-DD');
  if (b.remover) { await sql`delete from lab.pessoa_ausencia where pessoa_id = ${b.pessoaId} and data = ${b.data}::date`; return { ok: true }; }
  const motivo = typeof b.motivo === 'string' ? b.motivo.trim().slice(0, 120) : null;
  await sql`insert into lab.pessoa_ausencia (operacao_id, pessoa_id, data, motivo) values (${op.id}, ${b.pessoaId}, ${b.data}::date, ${motivo || null}) on conflict (pessoa_id, data) do update set motivo = excluded.motivo`;
  return { ok: true };
}
export async function definirCapacidade(sql: Sql, op: Operacao, pessoaId: string, capacidade: number | null) {
  await pessoaDe(sql, op, pessoaId);
  if (capacidade != null && !(capacidade > 0 && capacidade <= 10000)) throw new ErroDoDia('capacidade deve ser um número maior que zero (ou vazio para usar a observada)');
  await sql`update lab.pessoa set capacidade_dia = ${capacidade == null ? null : Math.round(capacidade)} where id = ${pessoaId}`;
  return { ok: true };
}
export { linhaEsforco };
