/* O quarter de verdade no banco: documento da estratégia (objetivo, resultados-chave, prioridades, iniciativas, meses, cenários, riscos, gatilhos,
   capacidade, decisões), revisão automática do quarter anterior, diagnóstico, meta × cenários, bottom-up, aprovação com bloqueios, publicação
   com versões, programa de ciclos (original × vigente), acompanhamento, fechamento do mês, encerramento e aprendizados. Nada reescreve o passado. */
import type { Sql } from 'postgres';
import { limitesDoQuarter, quarterAnterior, quarterDe, ROTULO_QUARTER } from '@lab/ciclos';
import { acrescentarMetas, diasUteis, hojeNoFuso, metasVigentes, somarDias, taxasHistoricas, type Operacao } from '@lab/planejamento';
import { medirPeriodo, somarMedicoes, type Medicao } from './medidas.js';
import { chaveCiclo, metaOficialDoCiclo, nomeCiclo } from './metas_consultas.js';
import { ErroDeEstrategia } from './plano_consultas.js';
import { cenarios as cenariosPorPremissa, programa as programaDeCiclos, type Programa, type Regras } from './plano_ciclo.js';
import {
  aprendizadoDe, aprovacao, avaliarIniciativa, avisos, bottomUp, capacidade, diagnostico, encadeamento, encerramento, fechamentoMes, gatilhos, lacunasIniciativa, lacunasKR, lista, metaVsCenarios, niveis, num,
  perguntas, pesosDoPrograma, priorizar, publicar, repartir, reprevisao, resumoDiario, revisao, sequencia, trimestre, TX, type DocQuarter, type Iniciativa, type Medida, type TaxaComFonte, type Versao, marcosDaSemana,
} from './quarter.js';

export const NOME_IND: Record<string, string> = {
  receita: 'Receita', vendas: 'Vendas', ticket: 'Ticket médio', leads: 'Leads (negócios criados)', agendamento: 'Reuniões agendadas', reuniao_realizada: 'Reuniões realizadas', oportunidades: 'Oportunidades', proposta_enviada: 'Propostas enviadas', contato: 'Contatos', tentativa: 'Tentativas',
  [TX.leadAg]: 'Lead → reunião agendada', [TX.agReal]: 'Agendada → realizada', [TX.realOport]: 'Realizada → oportunidade', [TX.oportVenda]: 'Oportunidade → venda', [TX.leadVenda]: 'Lead → venda', margem: 'Margem de contribuição', t_contato: 'Tempo até o 1º contato',
};
const CAMPOS_DOC = ['objetivo', 'krs', 'prioridades', 'iniciativas', 'meses', 'cenarios', 'riscos', 'gatilhos', 'capacidade', 'decisoes', 'respostas', 'premissas'] as const;
const PADRAO_REGRAS: Regras = {
  conservador: { ticket: -0.1, ['taxas.' + TX.oportVenda]: -0.15, leadsRestantes: -0.2 }, otimista: { ticket: 0.05, ['taxas.' + TX.oportVenda]: 0.1, leadsRestantes: 0.15 },
  notas: { ticket: 'padrão do LAB: ajuste o que a sua operação justifica', ['taxas.' + TX.oportVenda]: 'padrão do LAB: ajuste o que a sua operação justifica', leadsRestantes: 'padrão do LAB: ajuste o que a sua operação justifica' },
};
const fmtInd = (k: string, v: number | null | undefined) => (v == null ? '—' : k === 'receita' || k === 'ticket' ? 'R$ ' + Math.round(v).toLocaleString('pt-BR') : k.includes('>') || k === 'margem' ? (Math.round(v * 1000) / 10).toLocaleString('pt-BR') + '%' : String(Math.round(v * 10) / 10));

interface LinhaQ { id: string; inicio: string; fim: string; status: 'rascunho' | 'publicado' | 'encerrado'; versao: number; doc: DocQuarter; publicadoEm: string | null; encerradoEm: string | null }
async function linhaDoQuarter(sql: Sql, op: Operacao, inicio: string): Promise<LinhaQ | null> {
  const [q] = await sql<any[]>`select id, inicio::text, fim::text, status, versao, doc, publicado_em, encerrado_em from lab.quarter_estrategia where operacao_id = ${op.id} and inicio = ${inicio}::date`;
  if (!q) return null;
  const vs = await sql<any[]>`select n, snapshot from lab.quarter_versao where operacao_id = ${op.id} and quarter_inicio = ${inicio}::date order by n`;
  const doc: DocQuarter = { ...(q.doc ?? {}), status: q.status, versao: Number(q.versao) || 0, versoes: Object.fromEntries(vs.map(v => ['v' + v.n, v.snapshot as Versao])) };
  return { id: q.id, inicio: q.inicio, fim: q.fim, status: q.status, versao: Number(q.versao) || 0, doc, publicadoEm: q.publicado_em ? new Date(q.publicado_em).toISOString() : null, encerradoEm: q.encerrado_em ? new Date(q.encerrado_em).toISOString() : null };
}
const metaDaOperacao = (metas: Array<{ indicador: string; pessoaId: string | null; valor: number }>, ind: string) => { const p = metas.find(m => m.indicador === ind && !m.pessoaId); if (p) return p.valor; const s = metas.filter(m => m.indicador === ind && m.pessoaId).reduce((a, m) => a + m.valor, 0); return s > 0 ? s : null; };
const metasEmpresa = (metas: Array<{ indicador: string; pessoaId: string | null; valor: number }>) => Object.fromEntries([...new Set(metas.map(m => m.indicador))].map(k => [k, metaDaOperacao(metas, k)]));

/* ---------- a leitura completa: documento + camadas calculadas (a tela mostra uma fase por vez) ---------- */
export async function estrategiaDoQuarter(sql: Sql, op: Operacao, data: string, agora = new Date()) {
  const hoje = hojeNoFuso(op.fuso, agora), lim = limitesDoQuarter(op, data), key = chaveCiclo(lim.inicio), T = trimestre(key, op.mesInicioAno)!;
  const ant = quarterAnterior(lim.inicio, op.mesInicioAno, op.calendario.inicioCicloDia), antAnt = quarterAnterior(ant.inicio, op.mesInicioAno, op.calendario.inicioCicloDia), prox = quarterDe(lim.fim, op.mesInicioAno, op.calendario.inicioCicloDia);
  const ateHoje = hoje < lim.fim ? somarDias(hoje, 1) : lim.fim, comecou = hoje >= lim.inicio;
  const [L, antL, proxL, medAntC, medRef, medAtuC, metasAnt, metasAtu, hist, fechs, pessoas, pack, abertos] = await Promise.all([
    linhaDoQuarter(sql, op, lim.inicio), linhaDoQuarter(sql, op, ant.inicio), linhaDoQuarter(sql, op, prox.inicio),
    Promise.all(ant.ciclos.map((c, i) => medirPeriodo(sql, op, c.inicio, c.fim, { comMargem: i === 0 }))),
    medirPeriodo(sql, op, antAnt.inicio, antAnt.fim, { comMargem: true }),
    Promise.all(lim.ciclos.map(c => (comecou && c.inicio < ateHoje ? medirPeriodo(sql, op, c.inicio, c.fim < ateHoje ? c.fim : ateHoje) : Promise.resolve(null)))),
    Promise.all(ant.ciclos.map(c => metaOficialDoCiclo(sql, op, c.inicio, hoje))),
    Promise.all(lim.ciclos.map(c => metasVigentes(sql, op.id, c.inicio))),
    taxasHistoricas(sql, op, hoje),
    comecou ? sql<any[]>`select data::text, atual -> 'resumo' as resumo from lab.dia_fechamento where operacao_id = ${op.id} and data >= ${lim.inicio}::date and data < ${lim.fim}::date order by data` : Promise.resolve([] as any[]),
    sql<any[]>`select id, nome, funcao, capacidade_dia from lab.pessoa where operacao_id = ${op.id} and ativa order by nome`,
    sql<{ p: any }[]>`select pack -> 'parametros' as p from lab.operacao where id = ${op.id}`,
    sql<{ n: number }[]>`select count(*)::int as n from lab.negocio n join lab.etapa e on e.id = n.etapa_id join lab.funil f on f.id = n.funil_id where n.operacao_id = ${op.id} and f.principal and n.status = 'aberto' and n.tipo = 'novo' and e.papel in ('oportunidade', 'proposta', 'negociacao')`,
  ]);
  const minN = Number(pack[0]?.p?.amostraMinima ?? pack[0]?.p?.diario?.minN) || 10;
  const doc: DocQuarter = L?.doc ?? { status: 'rascunho', versao: 0, versoes: {} };
  const medAnt = somarMedicoes(medAntC), medAtuL = medAtuC.filter((m): m is Medicao => !!m), medAtu = medAtuL.length ? somarMedicoes(medAtuL) : null;
  /* 1 · revisão do quarter anterior: meta oficial de cada mês (original × final), realizado e tendência contra o quarter antes dele */
  const rev = revisao({
    ciclos: ant.ciclos.map((c, i) => { const M = metasAnt[i]!, o = M.oficial, orig = M.plano?.original ? metaDaOperacao(M.plano.original.metas, 'receita') : null, origV = M.plano?.original ? metaDaOperacao(M.plano.original.metas, 'vendas') : null;
      const vig = metasEmpresa((M.plano ? [] : []).concat([]));   /* metas da empresa no plano do mês: as vigentes do ciclo */
      return { key: M.chave, nome: M.nome, encerrado: M.encerrado, meta: { receita: { original: orig ?? (o.estado === 'conhecida' ? o.receita : null), final: o.estado === 'conhecida' ? o.receita : null, estado: o.estado, fonte: o.fonte }, vendas: { original: origV ?? (o.metas?.vendas as number | undefined) ?? null, final: (o.metas?.vendas as number | undefined) ?? null } }, metas: { ...vig, ...(o.metas as Record<string, number>) }, real: medAntC[i]!.med }; }),
    total: medAnt.med, anterior: medRef.vazio ? null : medRef.med, minN,
  });
  const inisAnt = lista(antL?.doc.iniciativas).filter(i => i.st !== 'cancelada');
  const avalsAnt = inisAnt.map(i => ({ id: i.id, nome: i.nome ?? '', ind: i.ind, aval: avaliarIniciativa(i, i.ind ? medAnt.med[i.ind] : null, minN) }));
  const pergs = perguntas(rev, avalsAnt, { nome: k => NOME_IND[k] ?? k });
  /* 2 · diagnóstico do quarter anterior (o que restringe a receita), contra o quarter antes dele */
  const metaRecAnt = rev.resumo.metaFinal, lvRef = medRef.taxas[TX.leadVenda]?.v ?? null, tkRef = medRef.ticket ?? hist.ticketMedio;
  const jus = (k: string) => { const ordem = [TX.leadAg, TX.agReal, TX.realOport, TX.oportVenda], i = ordem.indexOf(k as never); const vs = ordem.slice(i + 1).map(x => medRef.taxas[x]?.v); return vs.every(v => v != null) ? vs.reduce((a, v) => a * v!, 1) : null; };
  const diag = diagnostico({
    minN, ticket: tkRef, leads: { real: medAnt.vazio ? null : medAnt.leads, necessario: metaRecAnt != null && tkRef && lvRef ? metaRecAnt / tkRef / lvRef : null, leadVenda: medAnt.taxas[TX.leadVenda]?.v ?? lvRef },
    conv: [TX.leadAg, TX.agReal, TX.realOport, TX.oportVenda].map(k => ({ k, nome: (NOME_IND[k] ?? k).toLowerCase(), atual: medAnt.taxas[k], ref: medRef.taxas[k], entradas: medAnt.taxas[k]?.n ?? null, jusante: jus(k) })),
    ticketQ: { atual: medAnt.ticket, ref: medRef.ticket, n: medAnt.ganhos, nRef: medRef.ganhos, vendas: medAnt.ganhos }, margem: { atual: medAnt.margem?.v ?? null, ref: medRef.margem?.v ?? null, n: medAnt.margem?.n ?? 0, receita: medAnt.receita },
    ciclo: { atual: medAnt.cicloMediano, ref: medRef.cicloMediano, n: medAnt.ganhos, receitaMes: medAnt.receita / 3 }, capacidade: null, canais: medAnt.canais, perdas: medAnt.perdas,
    faltam: medAnt.vazio ? [{ falta: 'nenhum registro no quarter anterior', efeito: 'a revisão e o diagnóstico não dizem nada sobre ele' }] : medAnt.temAtividades ? [] : [{ falta: 'atividades não lançadas', efeito: 'as taxas de contato → agendamento não são calculáveis' }],
  });
  const prios = priorizar(lista(doc.prioridades)), ligadas = new Set(prios.map(p => p.diag).filter(Boolean));
  const sugeridas = diag.filter(d => (d.estado === 'comprovado' || d.estado === 'hipotese') && !ligadas.has(d.k)).map(d => ({ id: 'd:' + d.k, titulo: d.dim, st: 'sugerida' as const, diag: d.k, estado: d.estado, evidencia: d.evidencia, impacto: d.impacto }));
  /* 3 · objetivo: meta × cenários por premissa (base = o que já entrou + pipeline + leads que ainda vêm) */
  const uteisQ = lim.ciclos.flatMap(c => diasUteis(c.inicio, c.fim, op.calendario)), duQ = uteisQ.length, ddQ = uteisQ.filter(d => d < hoje).length, uteisRest = Math.max(0, duQ - ddQ);
  const diasRestCorridos = Math.max(0, (Date.parse(lim.fim + 'T00:00:00Z') - Date.parse((hoje > lim.inicio ? hoje : lim.inicio) + 'T00:00:00Z')) / 86_400_000);
  const txBase: Record<string, number | null> = { [TX.leadAg]: medRef.taxas[TX.leadAg]?.v ?? medAnt.taxas[TX.leadAg]?.v ?? null, [TX.agReal]: medRef.taxas[TX.agReal]?.v ?? hist.taxas.agendamento ?? null, [TX.realOport]: medRef.taxas[TX.realOport]?.v ?? hist.taxas.reuniao_realizada ?? null, [TX.oportVenda]: medRef.taxas[TX.oportVenda]?.v ?? hist.taxas.oportunidades ?? null };
  const prem = (doc.premissas ?? {}) as { ticket?: number | null; taxas?: Record<string, number | null> };
  const txUsada = Object.fromEntries(Object.keys(txBase).map(k => [k, prem.taxas?.[k] ?? txBase[k] ?? null]));
  const ticketUsado = prem.ticket ?? tkRef ?? null, ticketFonte = prem.ticket != null ? 'manual' : medRef.ticket != null ? `média de ${medRef.ganhos} vendas no quarter de referência` : hist.ticketMedio != null ? `média de ${hist.base.vendas} vendas na janela histórica` : 'sem vendas para medir';
  const leadsDia = medAtu && ddQ >= 5 ? medAtu.leads / ddQ : medRef.vazio ? 0 : medRef.leads / Math.max(1, antAnt.ciclos.reduce((s, c) => s + diasUteis(c.inicio, c.fim, op.calendario).length, 0));
  const cabe = medRef.ciclosVenda.length ? medRef.ciclosVenda.filter(x => x <= diasRestCorridos).length / medRef.ciclosVenda.length : 1;
  const alvo = num(doc.objetivo?.alvo);
  const base = { metas: { receita: alvo, vendas: null, margem: null }, vendasReal: medAtu?.ganhos ?? 0, receitaReal: medAtu?.receita ?? 0, pipeVendas: (abertos[0]?.n ?? 0) * (txUsada[TX.oportVenda] ?? 0), leadsRestantes: leadsDia * uteisRest, cabe, ticket: ticketUsado, margem: medAnt.margem?.v ?? null, taxas: txUsada };
  const regras = ((doc.cenarios as { regras?: Regras } | undefined)?.regras) ?? PADRAO_REGRAS;
  const cen = cenariosPorPremissa(base, regras), modeloBase = cen.neutro.modelo;
  const metaVs = alvo == null ? null : metaVsCenarios(alvo, { continuidade: medAnt.vazio ? null : medAnt.receita, conservador: cen.conservador.resultado.receita, base: cen.neutro.resultado.receita, otimista: cen.otimista.resultado.receita },
    { fixo: (modeloBase.receita ?? 0) - ((modeloBase.novas ?? 0) * (modeloBase.ticket ?? 0)), novo: (modeloBase.novas ?? 0) * (modeloBase.ticket ?? 0) }, (doc.cenarios as { dependencias?: string[] } | undefined)?.dependencias ?? []);
  /* 5 · os três meses: meta sugerida pelos dias úteis, bottom-up com a origem de cada taxa, meta já cadastrada no ciclo */
  const du = lim.ciclos.map(c => c.diasUteis), sugerido = repartir(alvo, du), txComFonte: Record<string, TaxaComFonte> = Object.fromEntries(Object.keys(txUsada).map(k => [k, { v: txUsada[k], fonte: prem.taxas?.[k] != null ? 'manual' : 'hist', n: medRef.taxas[k]?.n }]));
  txComFonte[TX.contatoAg] = { v: hist.taxas.contato ?? null, fonte: 'hist' };
  const meses = lim.ciclos.map((c, m) => { const d = doc.meses?.[m] ?? doc.meses?.[String(m)] ?? {}, meta = num(d.meta) ?? sugerido[m] ?? null, vig = metaDaOperacao(metasAtu[m]!, 'receita');
    return { m, key: chaveCiclo(c.inicio), nome: nomeCiclo(c.inicio), inicio: c.inicio, fim: c.fim, du: c.diasUteis, meta, metaDefinida: num(d.meta) != null, sugerida: sugerido[m] ?? null, resultado: d.resultado ?? '', criterio: d.criterio ?? '', metaNoCiclo: vig,
      bottomUp: meta != null ? bottomUp(meta, txComFonte, { v: ticketUsado, fonte: ticketFonte }, { cicloDias: medRef.cicloMediano ?? medAnt.cicloMediano, diasMes: 30 }) : null, real: medAtuC[m]?.med.receita?.estado === 'ok' ? medAtuC[m]!.receita : null, status: hoje >= c.fim ? 'fechado' : hoje >= c.inicio ? 'atual' : 'futuro' }; });
  /* 4 · iniciativas: lacunas, níveis, capacidade e sequência */
  const inis = lista(doc.iniciativas), ativas = inis.filter(i => i.st !== 'cancelada'), cicloDias = medRef.cicloMediano ?? medAnt.cicloMediano;
  const iniciativas = inis.map(i => ({ ...i, lacunas: lacunasIniciativa(i), niveis: niveis(i, i.ind && medAtu ? medAtu.med[i.ind] : null, hoje, minN) }));
  const cap = capacidade(ativas, (doc.capacidade as never) ?? { pessoas: {} }), seq = sequencia(ativas, { cicloDias });
  const krs = lista(doc.krs).map(k => ({ ...k, lacunas: lacunasKR(k), obs: k.ind && medAtu ? medAtu.med[k.ind] ?? null : null }));
  /* 6 · acompanhamento: gatilhos, programa, reprevisão, avisos, diário, encadeamento, marcos */
  const gats = gatilhos(lista(doc.gatilhos), medAtu?.med ?? {}, minN);
  const estadoProg = Object.fromEntries(lim.ciclos.map((c, i) => [chaveCiclo(c.inicio), { status: (hoje >= c.fim ? 'fechado' : hoje >= c.inicio ? 'atual' : 'futuro') as 'fechado' | 'atual' | 'futuro', du: c.diasUteis, real: medAtuC[i] && !medAtuC[i]!.vazio ? { receita: medAtuC[i]!.receita, vendas: medAtuC[i]!.ganhos } : {} }]));
  const prog = doc.programa ? programaDeCiclos(doc.programa as Programa, estadoProg) : null;
  const realQ = medAtu?.receita ?? 0, projQ = medAtu && ddQ >= 3 && duQ ? (realQ / ddQ) * duQ : null;
  const v1 = doc.versoes?.v1 as DocQuarter | undefined, metaOriginal = num(v1?.objetivo?.alvo) ?? alvo;
  const reprev = reprevisao({ original: metaOriginal, vigente: alvo }, medAtu ? realQ : null, projQ, []);
  const marcosAtrasados = marcosDaSemana(doc, hoje).itens.filter(x => x.situacao === 'atrasado');
  const avs = avisos({
    hoje, T: { key, curto: lim.rotulo }, q: doc, mesKey: chaveCiclo((hoje >= lim.inicio && hoje < lim.fim ? lim.ciclos.find(c => hoje >= c.inicio && hoje < c.fim) : null)?.inicio ?? lim.inicio), semana: somarDias(hoje, -((new Date(hoje + 'T12:00:00Z').getUTCDay() + 6) % 7)),
    prox: { key: chaveCiclo(prox.inicio), curto: ROTULO_QUARTER(prox.inicio, op.mesInicioAno), ini: prox.inicio }, proxDoc: proxL ? { status: proxL.status } : null, ant: { key: chaveCiclo(ant.inicio), curto: ROTULO_QUARTER(ant.inicio, op.mesInicioAno), fimISO: somarDias(ant.fim, -1) }, antDoc: antL ? { status: antL.status } : null,
    gatilhos: gats.map(g => ({ id: g.id, ind: g.ind, nome: g.nome ?? NOME_IND[g.ind] ?? g.ind, estado: g.estado, v: g.v, vTxt: fmtInd(g.ind, g.v), limiteTxt: (g.op === 'acima' ? 'acima de ' : 'abaixo de ') + fmtInd(g.ind, num(g.limite)), acao: g.acao })),
    proj: alvo != null && medAtu ? { metaVigente: alvo, projecao: projQ, realizado: realQ, diasDecorridos: ddQ } : null,
    meses: lim.ciclos.map((c, m) => ({ m, nome: nomeCiclo(c.inicio), fim: somarDias(c.fim, -1), iniciou: hoje >= c.inicio })), inis: ativas.map(i => ({ id: i.id, nome: i.nome ?? '', marcos: lista(i.marcos).map(m => ({ id: m.id, txt: m.txt ?? '', prazo: m.prazo ?? null, st: m.st })) })),
  });
  const diario = resumoDiario(fechs.map(f => ({ data: f.data, resumo: f.resumo })), lim.inicio, hoje < lim.fim ? hoje : somarDias(lim.fim, -1), lim.rotulo);
  const enc = encadeamento(doc, diag, { objetivo: medAtu ? realQ : null, krs: Object.fromEntries(krs.map(k => [k.id, k.obs?.estado === 'ok' ? k.obs.v ?? null : null])), inis: medAtu ? Object.fromEntries(ativas.map(i => [i.id, i.ind ? medAtu.med[i.ind] ?? { estado: 'ausente' } : { estado: 'ausente' }])) : {}, meses: lim.ciclos.map((c, i) => (medAtuC[i] && !medAtuC[i]!.vazio ? medAtuC[i]!.receita : null)) });
  const terminou = hoje >= lim.fim;
  const encerr = doc.status === 'publicado' || doc.status === 'encerrado' ? encerramento(doc, { real: medAtu ? realQ : null, inis: medAtu ? Object.fromEntries(ativas.map(i => [i.id, i.ind ? medAtu.med[i.ind] ?? { estado: 'ausente' } : { estado: 'ausente' }])) : {}, minN }) : null;
  const aprendizadosSugeridos = encerr ? encerr.avs.filter(a => a.st !== 'cancelada').map(a => { const i = inis.find(x => x.id === a.id)!; return { iniId: a.id, ...aprendizadoDe(i, a.aval, k => NOME_IND[k] ?? k, v => fmtInd(i.ind ?? '', v)) }; }) : [];
  /* sem capacidade declarada não há sobrecarga comprovada: a aprovação avisa em vez de bloquear */
  const aprov = aprovacao(doc, { capacidade: cap.semCapacidade ? null : cap, metaVs: metaVs && !('erro' in metaVs) ? metaVs : null, conflitoPrograma: null });
  if (cap.semCapacidade && ativas.some(i => (num(i.horas) ?? 0) > 0)) aprov.avisos.push('Capacidade da equipe não declarada (fase 5): a carga das iniciativas não foi verificada.');
  const fase = doc.status === 'encerrado' ? 'publicar' : !L ? 'visao' : doc.status === 'publicado' ? 'publicar' : !doc.respostas && !lista(doc.prioridades).length ? 'revisao' : !lista(doc.prioridades).some(p => ['aceita', 'modificada', 'propria'].includes(p.st ?? '')) ? 'diagnostico' : alvo == null || !lista(doc.krs).length ? 'objetivo' : !ativas.length || ativas.some(i => lacunasIniciativa(i).length) ? 'iniciativas' : meses.some(m => !m.metaDefinida || !m.resultado || !m.criterio) ? 'meses' : 'publicar';
  return {
    quarter: { key, inicio: lim.inicio, fim: lim.fim, rotulo: lim.rotulo, nome: T.nome, ciclos: lim.ciclos, duQ, ddQ, uteisRest, comecou, terminou, hoje },
    doc: { ...doc, id: L?.id ?? null, publicadoEm: L?.publicadoEm ?? null, encerradoEm: L?.encerradoEm ?? null, existe: !!L }, faseSugerida: fase, minN,
    anterior: { key: chaveCiclo(ant.inicio), rotulo: ROTULO_QUARTER(ant.inicio, op.mesInicioAno), inicio: ant.inicio, fim: ant.fim, doc: antL ? { status: antL.status, versao: antL.versao, objetivo: antL.doc.objetivo ?? null, encerramento: (antL.doc as { encerramento?: unknown }).encerramento ?? null } : null, vazio: medAnt.vazio },
    proximo: { key: chaveCiclo(prox.inicio), rotulo: ROTULO_QUARTER(prox.inicio, op.mesInicioAno), inicio: prox.inicio, status: proxL?.status ?? null },
    revisao: rev, iniciativasAnteriores: avalsAnt, perguntas: pergs, diagnostico: diag, prioridades: prios, sugeridas,
    objetivo: { alvo, metaOriginal, cenarios: cen, metaVs, premissas: { ticket: { v: ticketUsado, fonte: ticketFonte }, taxas: txComFonte, leadsPorDiaUtil: leadsDia, cabe, pipelineOportunidades: abertos[0]?.n ?? 0 } },
    krs, iniciativas, capacidade: cap, sequencia: seq, meses, gatilhos: gats, programa: prog && !('erro' in prog) ? prog : null, programaErro: prog && 'erro' in prog ? prog.erro : null,
    reprevisao: reprev, avisos: avs, diario, encadeamento: enc, marcosAtrasados, encerramento: encerr, aprendizadosSugeridos, aprovacao: aprov,
    medidas: { quarterAtual: medAtu ? medAtu.med : null, quarterAnterior: medAnt.med, referencia: medRef.med },
  };
}
export type EstrategiaDoQuarter = Awaited<ReturnType<typeof estrategiaDoQuarter>>;

/* ---------- gravações ---------- */
async function garantirLinha(sql: Sql, op: Operacao, data: string) {
  const lim = limitesDoQuarter(op, data);
  await sql`insert into lab.quarter_estrategia (operacao_id, inicio, fim) values (${op.id}, ${lim.inicio}::date, ${lim.fim}::date) on conflict (operacao_id, inicio) do nothing`;
  const L = (await linhaDoQuarter(sql, op, lim.inicio))!; return { L, lim };
}
const historico = (sql: Sql, op: Operacao, inicio: string, por: string | null, acao: string, detalhe: unknown = {}) => sql`insert into lab.quarter_historico (operacao_id, quarter_inicio, por, acao, detalhe) values (${op.id}, ${inicio}::date, ${por ?? ''}, ${acao}, ${sql.json(detalhe as never)})`;
const idNovo = () => Math.random().toString(36).slice(2, 10);

/* editar o documento (rascunho ou publicado): só os campos do plano; ids são gerados quando faltam */
export async function salvarEstrategia(sql: Sql, op: Operacao, data: string, patch: Record<string, unknown>, por: string | null) {
  const { L, lim } = await garantirLinha(sql, op, data);
  if (L.status === 'encerrado') throw new ErroDeEstrategia('quarter encerrado: não recebe mudanças', 409);
  const campos = Object.keys(patch ?? {}).filter(k => (CAMPOS_DOC as readonly string[]).includes(k));
  if (!campos.length) throw new ErroDeEstrategia(`informe ao menos um campo: ${CAMPOS_DOC.join(', ')}`);
  const novo: Record<string, unknown> = {};
  for (const k of campos) {
    const v = patch[k]; if (v != null && typeof v !== 'object') throw new ErroDeEstrategia(`${k} deve ser um objeto`);
    if (['krs', 'prioridades', 'iniciativas', 'riscos', 'gatilhos', 'decisoes'].includes(k) && v) { const o = v as Record<string, Record<string, unknown>>; for (const id of Object.keys(o)) if (o[id] && typeof o[id] === 'object' && 'marcos' in o[id]! && o[id]!.marcos && typeof o[id]!.marcos === 'object') { const M = o[id]!.marcos as Record<string, unknown>; for (const mk of Object.keys(M)) if (/^novo/.test(mk)) { M[idNovo()] = M[mk]; delete M[mk]; } } for (const id of Object.keys(o)) if (/^novo/.test(id)) { o[idNovo()] = o[id]!; delete o[id]; } }
    novo[k] = v;
  }
  await sql`update lab.quarter_estrategia set doc = doc || ${sql.json(novo as never)} where id = ${L.id}`;
  await historico(sql, op, lim.inicio, por, 'editou ' + campos.join(', '));
  return { ok: true, campos };
}
/* publicar: só com a aprovação sem bloqueios; cada publicação é uma versão imutável; revisar exige motivo */
export async function publicarEstrategia(sql: Sql, op: Operacao, data: string, motivo: string | null, por: string | null, agora = new Date()) {
  const E = await estrategiaDoQuarter(sql, op, data, agora);
  if (!E.doc.existe) throw new ErroDeEstrategia('o quarter ainda não tem plano', 404);
  if (!E.aprovacao.ok) throw new ErroDeEstrategia('o plano ainda não pode ser publicado: ' + E.aprovacao.bloqueios.join(' '), 409);
  const P = publicar(E.doc, motivo, { agora: agora.toISOString(), autor: por ?? '', premissas: E.objetivo.premissas, revisao: { resumo: E.revisao.resumo, lacunas: E.revisao.lacunas.length } });
  if ('erro' in P) throw new ErroDeEstrategia(String(P.erro), 409);
  await sql.begin(async tx => {
    const t = tx as unknown as Sql;
    await t`insert into lab.quarter_versao (operacao_id, quarter_inicio, n, snapshot, motivo, por, em) values (${op.id}, ${E.quarter.inicio}::date, ${P.versao}, ${t.json(P.patch.versoes['v' + P.versao] as never)}, ${P.patch.versoes['v' + P.versao]!.motivo}, ${por ?? ''}, ${agora})`;
    await t`update lab.quarter_estrategia set status = 'publicado', versao = ${P.versao}, publicado_em = ${agora} where id = ${E.doc.id}`;
    await historico(t, op, E.quarter.inicio, por, P.hist.acao, { motivo: P.hist.para, avisos: E.aprovacao.avisos });
  });
  return { versao: P.versao, hist: P.hist, avisos: E.aprovacao.avisos };
}
/* levar as metas dos meses para os ciclos (ação explícita do gestor): acrescenta a meta de receita de cada ciclo e congela o programa (original × vigente) */
export async function levarMetasAosCiclos(sql: Sql, op: Operacao, data: string, por: string | null, agora = new Date()) {
  const E = await estrategiaDoQuarter(sql, op, data, agora);
  if (E.doc.status !== 'publicado') throw new ErroDeEstrategia('publique o plano do quarter antes de levar as metas aos ciclos', 409);
  if (E.meses.some(m => !m.metaDefinida)) throw new ErroDeEstrategia('defina a meta de receita dos três meses (fase 5)', 409);
  const gravadas: string[] = [];
  await sql.begin(async tx => {
    const t = tx as unknown as Sql;
    for (const m of E.meses) { if (m.status === 'fechado') continue; if (m.metaNoCiclo != null && Math.abs(m.metaNoCiclo - m.meta!) < 0.5) continue; await acrescentarMetas(t, op.id, m.inicio, [{ indicador: 'receita', pessoaId: null, valor: m.meta!, nota: `Quarter ${E.quarter.rotulo} v${E.doc.versao}: meta do mês ${m.m + 1}` }]); gravadas.push(m.key); }
    const original = (E.doc.programa as Programa | undefined)?.original ?? Object.fromEntries(E.meses.map(m => [m.key, { receita: m.meta }]));
    const programa: Programa & { levadoEm: string; por: string } = { meta: { receita: E.objetivo.alvo }, ciclos: E.meses.map(m => m.key), pesos: Object.fromEntries(E.meses.map((m, i) => [m.key, pesosDoPrograma(E.meses.map(x => x.meta), E.meses.map(x => x.du))[i]!])), original, levadoEm: agora.toISOString(), por: por ?? '' };
    await t`update lab.quarter_estrategia set doc = doc || ${t.json({ programa } as never)} where id = ${E.doc.id}`;
    await historico(t, op, E.quarter.inicio, por, 'levou as metas dos meses para os ciclos', { gravadas });
  });
  return { gravadas };
}
/* fechamento do mês: classificar cada marco do mês; só completo fecha */
export async function fecharMesDoQuarter(sql: Sql, op: Operacao, data: string, b: { m: number; classif: Record<string, string>; nota?: string }, por: string | null, agora = new Date()) {
  const { L, lim } = await garantirLinha(sql, op, data);
  if (L.status !== 'publicado') throw new ErroDeEstrategia('só um quarter publicado fecha o mês', 409);
  const m = Number(b.m); if (!(m >= 0 && m <= 2)) throw new ErroDeEstrategia('mês deve ser 0, 1 ou 2');
  if (L.doc.fechMes?.[m]?.em) throw new ErroDeEstrategia(`o mês ${m + 1} já foi fechado`, 409);
  const itens = lista(L.doc.iniciativas).filter(i => i.st !== 'cancelada').flatMap(i => lista(i.marcos).filter(x => (x.mes ?? 0) === m).map(x => ({ id: x.id, ini: i.nome ?? '', txt: x.txt ?? '' })));
  const F = fechamentoMes(itens, b.classif ?? {});
  if (!F.completo) throw new ErroDeEstrategia('classifique todos os compromissos do mês: faltam ' + F.semClassificar.map(x => `"${x.txt}"`).join(', '), 409);
  const fech = { em: agora.toISOString(), por: por ?? '', classif: b.classif ?? {}, por_classe: F.por, total: F.total, seguem: F.seguem.map(x => x.id), nota: String(b.nota ?? '').trim() };
  await sql`update lab.quarter_estrategia set doc = jsonb_set(doc, '{fechMes}', coalesce(doc -> 'fechMes', '{}'::jsonb) || ${sql.json({ [String(m)]: fech } as never)}) where id = ${L.id}`;
  await historico(sql, op, lim.inicio, por, `fechou o mês ${m + 1}`, { total: F.total, por: F.por });
  return { m, fechamento: fech };
}
/* encerrar o quarter: compara com o plano original (v1), avalia cada iniciativa e congela */
export async function encerrarQuarter(sql: Sql, op: Operacao, data: string, por: string | null, agora = new Date()) {
  const E = await estrategiaDoQuarter(sql, op, data, agora);
  if (E.doc.status !== 'publicado') throw new ErroDeEstrategia(E.doc.status === 'encerrado' ? 'este quarter já foi encerrado' : 'só um quarter publicado pode ser encerrado', 409);
  if (!E.quarter.terminou) throw new ErroDeEstrategia(`o quarter termina em ${somarDias(E.quarter.fim, -1)}: encerre depois do último dia`, 409);
  const enc = { em: agora.toISOString(), por: por ?? '', resultado: E.encerramento, aprendizadosSugeridos: E.aprendizadosSugeridos, revisaoDoDiario: E.diario };
  await sql.begin(async tx => {
    const t = tx as unknown as Sql;
    await t`update lab.quarter_estrategia set doc = doc || ${t.json({ encerramento: enc } as never)}, status = 'encerrado', encerrado_em = ${agora} where id = ${E.doc.id}`;
    await historico(t, op, E.quarter.inicio, por, 'encerrou o quarter', { metaOriginal: E.encerramento?.metaOriginal, real: E.encerramento?.real });
  });
  return enc;
}
/* aprendizado estruturado ligado ao quarter (o texto é o resumo; os dados guardam contexto, evidência, conclusão, confiança, implicação e decisão) */
export const TIPOS_APRENDIZADO = ['funcionou', 'nao_funcionou', 'hipotese', 'decisao'] as const;
export async function registrarAprendizadoDoQuarter(sql: Sql, op: Operacao, data: string, b: { tipo: string; texto: string; dados?: Record<string, unknown>; cicloInicio?: string | null }) {
  const lim = limitesDoQuarter(op, data), texto = String(b.texto ?? '').trim();
  if (!(TIPOS_APRENDIZADO as readonly string[]).includes(b.tipo)) throw new ErroDeEstrategia(`tipo deve ser: ${TIPOS_APRENDIZADO.join(', ')}`);
  if (!texto || texto.length > 2000) throw new ErroDeEstrategia('escreva o aprendizado (até 2000 caracteres)');
  const [a] = await sql`insert into lab.aprendizado (operacao_id, ciclo_inicio, quarter_inicio, tipo, texto, dados) values (${op.id}, ${b.cicloInicio ?? null}, ${lim.inicio}::date, ${b.tipo}, ${texto}, ${b.dados ? sql.json(b.dados as never) : null}) returning id, tipo, texto, ciclo_inicio::text as "cicloInicio", quarter_inicio::text as "quarterInicio", dados, criado_em as "criadoEm"`;
  return a;
}
export async function historicoDoQuarter(sql: Sql, op: Operacao, data: string) {
  const lim = limitesDoQuarter(op, data);
  return sql`select em, por, acao, detalhe from lab.quarter_historico where operacao_id = ${op.id} and quarter_inicio = ${lim.inicio}::date order by em desc, id desc limit 200`;
}
/* entregáveis do quarter para o Plano do dia: atrasados e os que vencem nos próximos 7 dias, da pessoa ou da equipe */
export async function marcosParaODia(sql: Sql, op: Operacao, hoje: string, pessoa?: string | null) {
  const lim = limitesDoQuarter(op, hoje), L = await linhaDoQuarter(sql, op, lim.inicio);
  if (!L || L.status !== 'publicado') return { ate: null, itens: [], rotulo: lim.rotulo };
  return { ...marcosDaSemana(L.doc, hoje, pessoa), rotulo: lim.rotulo };
}
export type { Iniciativa, Medida };
