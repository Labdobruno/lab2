/* "Vamos bater a meta?": a montagem da projeção do ciclo, dos sinais e da contingência com os dados da V2.
   Fonte única do realizado (realizados do planejamento); histórico por coorte com maturação de 30 dias; pipeline por chance × prazo. */
import type { Sql } from 'postgres';
import { degrauAlcancado, ESCADA, negocios } from '@lab/metricas';
import { somarDias, taxasHistoricas, type Operacao } from '@lab/planejamento';
import { acoesContingencia, pessoaContingencia, placar, resumoContingencia, trajetoria, type AcaoContingencia, type PessoaContingencia, type Placar } from './contingencia.js';
import { contextoDoDia, metasDiariasDaPessoa, montarPessoa, type ContextoDia } from './consultas.js';
import { brl } from './objetivos.js';
import { decorridos, forecastPipeline, projecoes, sinais, VERSAO_PROJECAO, type Incidente, type Projecao, type Sinal, type TaxasCadeia } from './projecao.js';
import { FRACAO_DO_DIA, type Ritual } from './producao.js';
import { INDICADORES_DIA, NOMES, type DadosDia } from './tipos.js';

const DIA = 86_400_000;
export interface LinhaCiclo { ind: string; nome: string; alvo: number; esp: number; real: number | null; pct: number | null; status: 'em_dia' | 'atencao' | 'atras' | null }
export interface CicloDoDia {
  data: string; ritual: Ritual; versao: string;
  ciclo: { inicio: string; fim: string; du: number; dd: number; rest: number; diasRestCorridos: number; uteisRest: number; encerrado: boolean; futuro: boolean };
  pergunta: { resposta: 'sim' | 'provavel' | 'risco' | 'nao' | 'sem_meta' | 'sem_dado'; titulo: string; txt: string };
  metas: Record<string, number>; realizado: Record<string, number>; linhas: LinhaCiclo[];
  proj: Projecao; forecast: ReturnType<typeof forecastPipeline>; ticket: { v: number | null; n: number; fonte: string };
  taxas: TaxasCadeia & { fonte: string; n: Record<string, number> }; hist: { ciclosN: number; cicloMediano: number | null; leads90: number; leadVenda: number | null; leadVendaN: number };
  reverso: { vendasNec: number | null; vendasFaltam: number | null; leadsAdicionais: number | null };
  sinais: Sinal[]; incidentes: Incidente[]; veredito: ReturnType<typeof sinais>['veredito']; volOk: boolean | null;
  contingencia: { nivel: number | null; st: string; receita: Placar; vendas: Placar; trajetoria: ReturnType<typeof trajetoria>; pessoas: Array<PessoaContingencia & { pessoaId: string; falta: number | null; pipe: number | null }>; resumo: ReturnType<typeof resumoContingencia>; acoes: AcaoContingencia[]; fim: string };
  pessoas: Array<{ pessoaId: string; nome: string; funcao: string; quad: DadosDia['quad']; viab: DadosDia['viab']; pct: number | null; atraso: number }>;
}

/* meta da operação por indicador: a linha própria (pessoa nula) ou a soma das pessoas */
export function metasDaOperacao(metas: Array<{ indicador: string; pessoaId: string | null; valor: number }>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const ind of [...INDICADORES_DIA, 'receita']) { const propria = metas.find(m => m.indicador === ind && !m.pessoaId); const soma = metas.filter(m => m.indicador === ind && m.pessoaId).reduce((s, m) => s + m.valor, 0);
    if (propria) out[ind] = propria.valor; else if (soma > 0) out[ind] = soma; }
  return out;
}

export async function cicloDoDia(sql: Sql, op: Operacao, data: string, ritual: Ritual, agora: Date, ctx0?: ContextoDia): Promise<CicloDoDia> {
  const ctx = ctx0 ?? (await contextoDoDia(sql, op, data, ritual, agora));
  const { ciclo } = ctx, uteis = ciclo.uteis, du = uteis.length, fracao = FRACAO_DO_DIA[ritual], dd = decorridos(uteis, data, fracao), rest = Math.max(0, du - dd);
  const encerrado = data >= ciclo.fim, futuro = data < ciclo.inicio, amanha = somarDias(data, 1);
  const diasRestCorridos = Math.max(0, (Date.parse(ciclo.fim + 'T00:00:00Z') - Date.parse(data + 'T00:00:00Z')) / DIA - (1 - fracao) * 0 );
  const metas = metasDaOperacao(ctx.metas);
  /* realizado da operação no ciclo até hoje (fonte única), por indicador e por dia */
  const realizado: Record<string, number> = {}, receitaPorDia: Record<string, number> = {};
  for (const [, dias] of ctx.feito) for (const [d, m] of dias) { if (d < ciclo.inicio || d > data) continue; for (const k of Object.keys(m)) { realizado[k] = (realizado[k] ?? 0) + m[k]!; if (k === 'receita') receitaPorDia[d] = (receitaPorDia[d] ?? 0) + m[k]!; } }
  for (const [, dias] of ctx.ajustes) for (const [d, m] of dias) { if (d < ciclo.inicio || d > data) continue; for (const k of Object.keys(m)) realizado[k] = (realizado[k] ?? 0) + m[k]!; }
  /* histórico: taxas por coorte (maturação de 30 dias), ticket, ciclos de venda, leads */
  const fimCoorte = somarDias(data, -30), iniCoorte = somarDias(fimCoorte, -op.janelaHistoricaDias);
  const [hist, coorte, criadosCiclo, criados90, fechados365, etapasL, abertosL, passagens] = await Promise.all([
    taxasHistoricas(sql, op, data),
    negocios(sql, op.id, op.fuso, 'criados', { de: iniCoorte, ate: fimCoorte }),
    negocios(sql, op.id, op.fuso, 'criados', { de: ciclo.inicio, ate: amanha }),
    negocios(sql, op.id, op.fuso, 'criados', { de: somarDias(data, -90), ate: amanha }),
    negocios(sql, op.id, op.fuso, 'fechados', { de: somarDias(data, -365), ate: amanha }),
    sql<any[]>`select e.id, e.chave, e.nome, e.ordem, e.papel from lab.etapa e join lab.funil f on f.id = e.funil_id where e.operacao_id = ${op.id} and f.principal and e.ativa and e.papel not in ('ganho', 'perdido') order by e.ordem`,
    sql<any[]>`select n.id, n.etapa_id, n.dono_id, coalesce(c.nome, n.atributos->>'cliente', 'Negócio') as nome, coalesce(n.valor_estimado, 0) as valor from lab.negocio n join lab.funil f on f.id = n.funil_id left join lab.conta c on c.id = n.conta_id where n.operacao_id = ${op.id} and f.principal and n.status = 'aberto' and n.tipo = 'novo'`,
    sql<any[]>`select e.id as etapa_id, n.id, n.status, n.fechado_em,
        (select min(t.em) from lab.negocio_transicao t join lab.etapa e2 on e2.id = t.para_etapa_id where t.negocio_id = n.id and e2.funil_id = e.funil_id and e2.ordem >= e.ordem) as entrou
      from lab.etapa e join lab.funil f on f.id = e.funil_id join lab.negocio n on n.funil_id = e.funil_id
      where e.operacao_id = ${op.id} and f.principal and e.ativa and e.papel not in ('ganho', 'perdido') and n.status <> 'aberto' and n.tipo = 'novo' and n.fechado_em >= ${somarDias(data, -op.janelaHistoricaDias)}::date`,
  ]);
  const novos = (L: typeof coorte) => L.filter(n => n.tipo === 'novo' && n.funilPrincipal);
  const co = novos(coorte).map(degrauAlcancado), iAg = ESCADA.indexOf('agendada'), iGa = ESCADA.indexOf('ganho'), iRe = ESCADA.indexOf('realizada'), iOp = ESCADA.indexOf('oportunidade');
  const leadVenda = co.length ? co.filter(g => g >= iGa).length / co.length : null, leadAg = co.length ? co.filter(g => g >= iAg).length / co.length : null;
  const ticket = metas.receita && metas.vendas ? { v: metas.receita / metas.vendas, n: hist.base.vendas ?? 0, fonte: 'meta de receita ÷ meta de vendas' } : { v: hist.ticketMedio, n: hist.base.vendas ?? 0, fonte: hist.ticketMedio ? `média de ${hist.base.vendas} vendas dos últimos ${op.janelaHistoricaDias} dias` : 'sem vendas na janela histórica' };
  const taxas: CicloDoDia['taxas'] = { 'leads>agendamento': leadAg, 'agendamento>reuniao_realizada': hist.taxas.agendamento ?? null, 'reuniao_realizada>oportunidades': hist.taxas.reuniao_realizada ?? null, 'oportunidades>vendas': hist.taxas.oportunidades ?? null, fonte: `coorte de ${co.length} negócios criados entre ${iniCoorte} e ${fimCoorte} e atividades da janela histórica`, n: { coorte: co.length } };
  const ciclosVenda = fechados365.filter(n => n.status === 'ganho' && n.tipo === 'novo' && n.fechadoEm).map(n => Math.max(0, (Date.parse(n.fechadoEm!) - Date.parse(n.criadoEm)) / DIA)).sort((a, b) => a - b);
  const cabe = ciclosVenda.length ? ciclosVenda.filter(x => x <= diasRestCorridos).length / ciclosVenda.length : 0;
  /* pipeline: p(venda | etapa) e p(fechar a tempo) do histórico de cada etapa; abertos com valor e dono */
  const porEtapa = new Map<string, { n: number; g: number; dur: number[] }>();
  for (const p of passagens) { if (!p.entrou) continue; const x = porEtapa.get(p.etapa_id) ?? porEtapa.set(p.etapa_id, { n: 0, g: 0, dur: [] }).get(p.etapa_id)!; x.n++; if (p.status === 'ganho') { x.g++; x.dur.push(Math.max(0, (new Date(p.fechado_em).getTime() - new Date(p.entrou).getTime()) / DIA)); } }
  const forecast = forecastPipeline(etapasL.map(e => { const h = porEtapa.get(e.id) ?? { n: 0, g: 0, dur: [] }; return { chave: e.chave, nome: e.nome, n: h.n, g: h.g, duracoes: h.dur, abertos: abertosL.filter(a => a.etapa_id === e.id).map(a => ({ id: a.id, nome: a.nome, valor: Number(a.valor), dono: a.dono_id })) }; }), diasRestCorridos, ticket.v);
  const pipePorDono = new Map<string, number>();
  for (const e of forecast.et) { const def = etapasL.find(x => x.chave === e.chave); for (const a of abertosL.filter(a => a.etapa_id === def?.id && a.dono_id && Number(a.valor) <= (forecast.limite ?? Infinity))) pipePorDono.set(a.dono_id, (pipePorDono.get(a.dono_id) ?? 0) + (e.pv ?? 0) * (e.pt ?? 0)); }
  const leadsCiclo = novos(criadosCiclo).length, leads90 = novos(criados90).length;
  const du90 = (() => { let n = 0; for (let d = somarDias(data, -90); d < data; d = somarDias(d, 1)) { const w = new Date(d + 'T12:00:00Z').getUTCDay(); if (w && w < 6) n++; } return n; })();
  const proj = projecoes({ du, dd, encerrado, futuro, vendasReal: realizado.vendas ?? 0, receitaReal: realizado.receita ?? 0, pipeV: forecast.pipeV, pipeR: forecast.noPrazo, cabe, leadsCiclo, leads90, du90, taxaLeadVenda: leadVenda, ticket: ticket.v, nTicket: ticket.n, minN: ctx.crit.minN, metas: { vendas: metas.vendas ?? null, receita: metas.receita ?? null } });
  /* esperado até hoje: meta × fração dos dias úteis (hoje conta a fração do ritual) */
  const frac = du ? Math.min(1, dd / du) : 0;
  const linhas: LinhaCiclo[] = Object.keys(metas).map(ind => { const alvo = metas[ind]!, esp = alvo * frac, real = realizado[ind] ?? (ind === 'receita' || ind === 'vendas' ? 0 : null), pct = real != null && esp > 0 ? real / esp : null;
    return { ind, nome: NOMES[ind]?.[0] ?? ind, alvo, esp, real, pct, status: pct == null ? null : pct >= 1 ? 'em_dia' : pct >= ctx.crit.pctOk ? 'atencao' : 'atras' }; });
  /* reverso: o que falta gerar a partir de hoje */
  const vendasNec = metas.vendas ?? (metas.receita && ticket.v ? Math.ceil(metas.receita / ticket.v) : null);
  const vendasFaltam = vendasNec != null ? Math.max(0, vendasNec - (realizado.vendas ?? 0) - forecast.pipeV) : null;
  const leadsAdicionais = vendasFaltam != null && leadVenda && cabe > 0 ? (vendasFaltam > 0 ? Math.ceil(vendasFaltam / (leadVenda * cabe)) : 0) : null;
  /* pessoas: plano do dia de cada vendedor (fonte das capacidades, do quadrante e da contingência individual) */
  const vendedores = ctx.pessoas.filter(p => p.ativa && ['sdr', 'closer', 'ambos'].includes(p.funcao ?? ''));
  const Ds = vendedores.map(p => ({ p, D: montarPessoa(ctx, p) }));
  const diaria = ctx.diarias[0] ?? 'tentativa';
  const capacidade = Ds.map(({ p, D }) => { const M = metasDiariasDaPessoa(ctx, p), mt = M.metaCiclo[diaria] ?? 0; if (!(mt > 0) || !(D.cap.v && D.cap.v > 0) || p.funcao === 'closer') return null; return { pessoa: p.nome, campo: NOMES[diaria]?.[2] ?? diaria, cap: D.cap.v, nec: mt / Math.max(1, M.uteis.length) }; }).filter((x): x is NonNullable<typeof x> => !!x);
  /* conversões do ciclo × histórico, por coorte */
  const cc = novos(criadosCiclo).map(degrauAlcancado), coorteTx = (L: number[], a: number, b: number) => { const n = L.filter(g => g >= a).length; return n ? { v: L.filter(g => g >= b).length / n, n } : null; };
  const conversoes = [{ ind: 'reuniao_realizada>oportunidades', nome: 'Reunião realizada → oportunidade', z: 'meio' as const, mes: coorteTx(cc, iRe, iOp), hist: coorteTx(co, iRe, iOp) }, { ind: 'oportunidades>vendas', nome: 'Oportunidade → venda', z: 'fundo' as const, mes: coorteTx(cc, iOp, iGa), hist: coorteTx(co, iOp, iGa) }];
  const S = sinais({ dd, du, proj, metas: { receita: metas.receita ?? null, vendas: metas.vendas ?? null }, ticket: ticket.v, nTicket: ticket.n, cfg: ctx.crit as unknown as Record<string, unknown>, linhas: linhas.map(l => ({ ind: l.ind, alvo: l.alvo, esp: l.esp, real: l.real, semDado: l.real == null })), taxas, extra: { agendamentoPorContato: hist.taxas.contato ?? null, contatoPorTentativa: hist.taxas.tentativa ?? null }, leadsAdicionais, capacidade, conversoes, nomes: Object.fromEntries(Object.entries(NOMES).map(([k, v]) => [k, v[0]])), fmt: (k, v) => (k === 'receita' ? brl(v) : String(Math.round(v))) });
  /* contingência: empresa (receita e vendas), trajetória da receita e cada pessoa */
  const uteisRest = uteis.filter(d => d >= data).length, fimCiclo = somarDias(ciclo.fim, -1);
  const pl = (nome: string, k: 'receita' | 'vendas') => placar({ nome, de: 'da operação', meta: metas[k] ?? null, real: realizado[k] ?? 0, esperado: metas[k] != null ? metas[k]! * frac : null, proj: proj[k].ajust, projFragil: proj.fragil, dd, diasRest: uteisRest, fmt: k === 'receita' ? v => brl(v) : v => String(Math.round(v * 10) / 10) });
  const cR = pl('Receita fechada no ciclo', 'receita'), cV = pl('Vendas fechadas no ciclo', 'vendas');
  const traj = trajetoria({ dias: uteis, hoje: data, meta: metas.receita ?? 0, realPorDia: receitaPorDia });
  const pessoasC = Ds.map(({ p, D }) => { const M = metasDiariasDaPessoa(ctx, p), dias = M.uteis.filter(d => d >= data);
    const etapas = D.prod.filter(x => x.metaTotal > 0).map(x => ({ k: x.k, nome: NOMES[x.k]?.[0] ?? x.k, metaTotal: x.metaTotal, metaCiclo: x.metaCiclo, feitoCiclo: x.feitoCiclo, metaHoje: x.metaHoje, feitoHoje: x.feito }));
    const C = pessoaContingencia({ n: p.nome, hoje: data, etapas, dias, metaDia: Object.fromEntries(dias.map(d => [d, M.porDia[d] ?? {}])), seguidos: D.padrao.seguidos ?? 0, ativK: diaria, resK: 'vendas' }, ctx.crit as never);
    const fv = C.etapas.find(e => e.k === 'vendas'); return { ...C, pessoaId: p.id, falta: fv ? fv.falta : null, pipe: pipePorDono.has(p.id) ? pipePorDono.get(p.id)! : null }; });
  const nivelEmp = Math.max(cR.nivel ?? -1, cV.nivel ?? -1), nivel = nivelEmp < 0 ? null : nivelEmp;
  const contingencia: CicloDoDia['contingencia'] = { nivel, st: nivel == null ? 'sem_dado' : (['no_ritmo', 'atencao', 'contingencia', 'critico'] as const)[nivel]!, receita: cR, vendas: cV, trajetoria: traj, pessoas: pessoasC, resumo: resumoContingencia(pessoasC), acoes: acoesContingencia({ receita: cR, vendas: cV }, pessoasC, fimCiclo), fim: fimCiclo };
  /* a resposta */
  const metaR = metas.receita ?? null, metaV = metas.vendas ?? null, alvoP = metaR != null ? proj.receita.ajust : metaV != null ? proj.vendas.ajust : null, alvoM = metaR ?? metaV;
  let pergunta: CicloDoDia['pergunta'];
  if (alvoM == null) pergunta = { resposta: 'sem_meta', titulo: 'Sem meta de receita ou vendas neste ciclo', txt: 'Cadastre a meta do ciclo (ou trave o quarter) para o LAB projetar o fechamento.' };
  else if (encerrado) pergunta = { resposta: (realizado[metaR != null ? 'receita' : 'vendas'] ?? 0) >= alvoM ? 'sim' : 'nao', titulo: (realizado[metaR != null ? 'receita' : 'vendas'] ?? 0) >= alvoM ? 'Sim: a meta foi batida' : 'Não: o ciclo fechou abaixo da meta', txt: '' };
  else if (futuro) pergunta = { resposta: 'sem_dado', titulo: 'O ciclo ainda não começou', txt: '' };
  else if (alvoP == null || proj.fragil) pergunta = { resposta: 'sem_dado', titulo: 'Cedo para dizer', txt: 'Com menos de 3 dias úteis decorridos a projeção é frágil; a resposta aparece a partir do 3º dia útil.' };
  else { const at = alvoP / alvoM, chance = proj.prob;
    pergunta = at >= 1 ? { resposta: 'sim', titulo: 'Sim, no ritmo atual', txt: 'A projeção ajustada fecha em ' + (metaR != null ? brl(alvoP) : Math.round(alvoP) + ' vendas') + ' contra a meta de ' + (metaR != null ? brl(alvoM) : alvoM + ' vendas') + (chance != null ? ' · chance ' + Math.round(chance * 100) + '%' : '') + '.' }
      : at >= S.limiares.metaRisco ? { resposta: 'provavel', titulo: 'Provavelmente, mas sem folga', txt: 'A projeção ajustada fica em ' + Math.round(at * 100) + '% da meta' + (chance != null ? ' · chance ' + Math.round(chance * 100) + '%' : '') + '.' }
      : at >= 0.75 ? { resposta: 'risco', titulo: 'Em risco', txt: 'A projeção ajustada fica em ' + Math.round(at * 100) + '% da meta' + (chance != null ? ' · chance ' + Math.round(chance * 100) + '%' : '') + '. ' + S.veredito.titulo + '.' }
      : { resposta: 'nao', titulo: 'Não, no ritmo atual', txt: 'A projeção ajustada fica em ' + Math.round(at * 100) + '% da meta' + (chance != null ? ' · chance ' + Math.round(chance * 100) + '%' : '') + '. ' + S.veredito.titulo + '.' }; }
  return { data, ritual, versao: VERSAO_PROJECAO, ciclo: { inicio: ciclo.inicio, fim: ciclo.fim, du, dd, rest, diasRestCorridos, uteisRest, encerrado, futuro }, pergunta, metas, realizado, linhas, proj, forecast, ticket, taxas,
    hist: { ciclosN: ciclosVenda.length, cicloMediano: ciclosVenda.length ? ciclosVenda[Math.floor((ciclosVenda.length - 1) / 2)]! : null, leads90, leadVenda, leadVendaN: co.length }, reverso: { vendasNec, vendasFaltam, leadsAdicionais },
    sinais: S.sinais, incidentes: S.incidentes, veredito: S.veredito, volOk: S.volOk, contingencia,
    pessoas: Ds.map(({ p, D }) => ({ pessoaId: p.id, nome: p.nome, funcao: D.pessoa.funcaoNome, quad: D.quad, viab: D.viab, pct: D.pct, atraso: D.atrasoProd })) };
}
