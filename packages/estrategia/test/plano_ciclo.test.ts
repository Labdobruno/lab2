/* Contrato: testes/lab_objetivos.test.js da V1 (casos A–G), com as chaves de indicador da V2. A parte já portada na Onda 2 vive em packages/dia. */
import { describe, expect, it } from 'vitest';
import { cenarios, consistencia, fallback, modelo, programa, replanejar, responsaveis, sugestoes, TIPO_INDICADOR, TX, viabilidade, type PlanoDoc } from '../src/index.js';

const tipos = (r: ReturnType<typeof consistencia>) => r.achados.map(a => a.tipo + ':' + a.kpis.join('+'));

describe('Caso A: consistência das metas', () => {
  const objsA = [{ ind: 'receita', alvo: 300000 }, { ind: 'ticket', op: 'min', alvo: 22000 }, { ind: TX.oportVenda, op: 'min', alvo: 0.3 }, { ind: 'margem', op: 'min', alvo: 0.22 }];
  it('ticket mínimo manda; melhorias assumidas rotuladas; coerente', () => {
    const rA = consistencia(objsA, { ticket: 18000, margem: 0.19, taxas: { [TX.oportVenda]: 0.25, [TX.realOport]: 0.6 }, n: { ticket: 12 } });
    expect(rA.vendasNec).toBe(14); expect(rA.tkUsado).toBe(22000);
    expect(tipos(rA)).toContain('exige_melhoria:ticket'); expect(rA.achados.some(a => a.tipo === 'incompativel')).toBe(false);
    expect(tipos(rA)).toContain('exige_melhoria:' + TX.oportVenda); expect(tipos(rA)).toContain('exige_melhoria:margem'); expect(rA.ok).toBe(true);
  });
  it('capacidade: 14 vendas ÷ 25% = 56 oport ÷ 60% = 94 realizadas > 80 → incompatível', () => {
    const rA = consistencia(objsA, { ticket: 18000, margem: 0.19, taxas: { [TX.oportVenda]: 0.25, [TX.realOport]: 0.6 }, capacidade: { reuniao_realizada: 80 } });
    expect(tipos(rA)).toContain('incompativel:vendas+cap_reunioes'); expect(rA.ok).toBe(false);
  });
  it('definição, receita × vendas × ticket, sem ticket, não altera metas', () => {
    expect(tipos(consistencia([{ ind: 'x>y', alvo: 0.3 }], {}))).toContain('sem_definicao:x>y');
    expect(tipos(consistencia([{ ind: 'receita', alvo: 300000 }, { ind: 'vendas', alvo: 20 }, { ind: 'ticket', op: 'min', alvo: 22000 }], {}))).toContain('incompativel:receita+vendas+ticket');
    expect(tipos(consistencia([{ ind: 'receita', alvo: 300000 }], {}))).toContain('sem_dado:receita+ticket');
    expect(JSON.stringify(objsA)).toBe(JSON.stringify([{ ind: 'receita', alvo: 300000 }, { ind: 'ticket', op: 'min', alvo: 22000 }, { ind: TX.oportVenda, op: 'min', alvo: 0.3 }, { ind: 'margem', op: 'min', alvo: 0.22 }]));
  });
});

const base = { metas: { receita: 300000, vendas: 14, margem: 0.22 }, vendasReal: 4, receitaReal: 88000, pipeVendas: 3, leadsRestantes: 100, cabe: 0.6, ticket: 22000, margem: 0.24, taxas: { [TX.leadAg]: 0.3, [TX.agReal]: 0.7, [TX.realOport]: 0.5, [TX.oportVenda]: 0.3 } };
describe('Caso E: modelo direto e cenários por premissa', () => {
  const N = modelo(base);
  it('modelo', () => {
    expect(N.novas).toBeCloseTo(1.89); expect(N.vendas).toBeCloseTo(8.89); expect(N.receita).toBeCloseTo(88000 + 4.89 * 22000, 1);
    const m = modelo({ ...base, ticket: null }); expect(m.receita).toBeNull(); expect(m.falta).toContain('ticket');
  });
  it('cenários', () => {
    const C = cenarios(base, { conservador: { ['taxas.' + TX.oportVenda]: -0.2, leadsRestantes: -0.25 }, otimista: { ['taxas.' + TX.agReal]: 0.1, ticket: 0.05 }, notas: { ['taxas.' + TX.oportVenda]: 'pior trimestre do histórico' } });
    expect(C.neutro.premissas.length).toBe(0); expect(C.neutro.resultado.receita).toBeCloseTo(N.receita!);
    expect(C.conservador.premissas.length).toBe(2); expect(C.conservador.premissas[0]!.nota).toBe('pior trimestre do histórico');
    expect(C.conservador.resultado.receita!).toBeLessThan(C.neutro.resultado.receita!); expect(C.neutro.resultado.receita!).toBeLessThan(C.otimista.resultado.receita!);
    const x = cenarios({ ...base, taxas: { [TX.leadAg]: 0.95, [TX.agReal]: 0.7, [TX.realOport]: 0.5, [TX.oportVenda]: 0.3 } }, { otimista: { ['taxas.' + TX.leadAg]: 0.5 } }); expect(x.otimista.premissas[0]!.para).toBe(1);
    const l = C.comparacao.find(x => x.kpi === 'receita')!; expect(l.meta).toBe(300000); expect(l.real).toBe(88000); expect(l.cenarios.neutro!.gap).toBeCloseTo(N.receita! - 300000);
    expect(C.sensibilidade.length).toBeGreaterThan(3); expect(Math.abs(C.sensibilidade[0]!.mais10)).toBeGreaterThanOrEqual(Math.abs(C.sensibilidade[1]!.mais10));
    const v = cenarios({ ...base, var: { ['taxas.' + TX.oportVenda]: { p25: 0.24, p75: 0.36 } } }, {}); expect(v.conservador.auto).toBe(true); expect(v.conservador.premissas[0]!.premissa).toBe('taxas.' + TX.oportVenda); expect(v.conservador.premissas[0]!.para).toBeCloseTo(0.24);
    expect(cenarios(base, {}).conservador.igualAoNeutro).toBe(true);
    const Cm = cenarios({ ...base, leadsRestantes: 2000, margem: 0.18 }, {}); expect(Cm.conflitos.some(c => c.cenario === 'neutro')).toBe(true); expect(Cm.neutro.resultado.receita!).toBeGreaterThanOrEqual(300000);
    expect(JSON.stringify(cenarios(base, { otimista: { ticket: 0.1 } }))).toBe(JSON.stringify(cenarios(base, { otimista: { ticket: 0.1 } })));
  });
});

describe('Caso C: fallback de taxa', () => {
  it('nível explícito e confiança', () => {
    const fb = fallback([{ v: null, n: 0, nivel: 'hist_pessoa' }, { v: 0.28, n: 3, nivel: 'hist_pessoa_ampliado' }, { v: 0.31, n: 40, nivel: 'pares' }, { v: 0.3, n: 200, nivel: 'empresa' }], 5);
    expect(fb.nivel).toBe('pares'); expect(fb.confianca).toBe('alta'); expect(fb.v).toBe(0.31);
    const r = fallback([{ v: 0.5, n: 2, nivel: 'hist_pessoa' }, { v: 0.3, n: 4, nivel: 'empresa' }], 5); expect(r.semAmostra).toBe(true); expect(r.confianca).toBe('baixa'); expect(r.v).toBe(0.3);
    expect(fallback([], 5).v).toBeNull();
  });
});

describe('Caso G: replanejamento com data de corte', () => {
  const plano: PlanoDoc = { status: 'ativo', versao: 1, metas: { m1: { ind: 'receita', alvo: 300000, escopo: 'empresa' }, m2: { ind: 'vendas', alvo: 14, escopo: 'empresa' }, m3: { ind: TX.oportVenda, alvo: 0.3, escopo: 'empresa' } }, premissas: { ticket: { v: 22000 } }, reverso: { tipo: 'receita', alvo: 300000 }, pessoas: { Ana: { funcao: 'closer' } }, original: { em: 1, metas: { m1: { ind: 'receita', alvo: 300000 } } } };
  const R = replanejar(plano, '2026-10-13', { receita: 120000, vendas: 5 }, { motivo: 'Pedro saiu em 10/10', premissas: { ticket: { v: 21000 } }, pessoas: { Ana: { funcao: 'closer' }, Bia: { funcao: 'sdr' } } }, { agora: 2, autor: 'Bruno' });
  it('nova versão guarda a anterior inteira; original intocado; restante no corte', () => {
    if ('erro' in R) throw new Error(R.erro);
    expect(R.versao).toBe(2); expect(R.patch.versoes.v1!.n).toBe(1); expect(R.patch.versoes.v1!.metas.m1!.alvo).toBe(300000); expect((R.patch.versoes.v1!.premissas.ticket as { v: number }).v).toBe(22000);
    expect(R.patch.corte).toBe('2026-10-13'); expect(R.patch.versoes.v1!.motivo).toBe('Pedro saiu em 10/10'); expect(R.patch.versoes.v1!.realizadoNoCorte.receita).toBe(120000);
    expect(R.patch.original).toBeUndefined(); expect(R.patch.metas).toBeUndefined(); expect(plano.metas!.m1!.alvo).toBe(300000);
    expect((R.patch.premissas!.ticket as { v: number }).v).toBe(21000); expect((R.patch.pessoas!.Bia as { funcao: string }).funcao).toBe('sdr');
    expect(R.patch.restanteNoCorte.receita).toBe(180000); expect(R.patch.restanteNoCorte.vendas).toBe(9); expect(R.patch.restanteNoCorte[TX.oportVenda]).toBeUndefined();
    expect(R.hist.de).toBe('v1'); expect(R.hist.para).toBe('v2');
  });
  it('recusas e segunda reprojeção', () => {
    expect('erro' in replanejar(plano, '2026-10-13', {}, {})).toBe(true);
    expect('erro' in replanejar({ status: 'fechado' }, '2026-10-13', {}, { motivo: 'x' })).toBe(true);
    expect('erro' in replanejar(plano, '13/10/2026', {}, { motivo: 'x' })).toBe(true);
    if ('erro' in R) throw new Error(R.erro);
    const p2 = { ...plano, ...R.patch }; const R2 = replanejar(p2, '2026-10-20', {}, { motivo: 'feriado' }); if ('erro' in R2) throw new Error(R2.erro);
    expect(R2.versao).toBe(3); expect(R2.patch.versoes.v2!.n).toBe(2);
  });
});

describe('Caso B: sugestão com evidência e responsabilidade', () => {
  it('sugestões', () => {
    const SG = sugestoes([{ nome: 'Murilo', taxa: { v: 0.05, n: 40, fonte: 'hist. pessoa' } }, { nome: 'Pedro', taxa: { v: 0.04, n: 30, fonte: 'hist. pessoa' } }, { nome: 'Nova', taxa: { v: 0.02, n: 3, fonte: 'hist. canal' } }], 5);
    expect(SG.ref).toBe('Murilo');
    const p = SG.itens.find(i => i.nome === 'Pedro')!; expect(p.extra).toBeCloseTo(0.25); expect(p.relevante).toBe(true); expect(p.texto).toMatch(/25%/); expect(p.texto).toMatch(/n=30 × 40/);
    const n = SG.itens.find(i => i.nome === 'Nova')!; expect(n.amostra).toBe('pequena'); expect(n.relevante).toBe(false);
    expect(sugestoes([{ nome: 'A', taxa: { v: 0.1, n: 2 } }], 5).ref).toBeNull();
    expect(sugestoes([{ nome: 'A', taxa: { v: 0.1, n: 50 } }, { nome: 'B', taxa: { v: 0.095, n: 50 } }], 5).itens[0]!.relevante).toBe(false);
  });
  it('responsáveis', () => {
    const RS = responsaveis({ Ana: { resp: { vendas: 'primario', leads: 'influencia' } }, Bia: { resp: { vendas: 'primario', contato: 'primario' } }, Gil: { resp: { vendas: 'aprova' } } });
    expect(RS.avisos.some(a => a.tipo === 'varios_responsaveis' && a.ind === 'vendas' && a.pessoas!.join() === 'Ana,Bia' && /conta uma vez/.test(a.texto))).toBe(true);
    expect(RS.avisos.some(a => a.tipo === 'sem_responsavel' && a.ind === 'leads')).toBe(true);
    expect(RS.avisos.some(a => a.ind === 'contato')).toBe(false); expect(RS.por.contato!.primario[0]).toBe('Bia');
  });
});

describe('necessário × viável × déficit', () => {
  it('déficit sem reduzir a meta, alternativas', () => {
    const VB = viabilidade({ reuniao_realizada: 160, contato: 900 }, { reuniao_realizada: 120, contato: 1000 }, { ticket: 22000, taxas: { [TX.realOport]: 0.5, [TX.oportVenda]: 0.3 }, metaReceita: 300000, pessoasCloser: 3, duMedio: 20 });
    const r = VB.itens.find(i => i.etapa === 'reuniao_realizada')!; expect(r.deficit).toBe(40); expect(r.viavel).toBe(120); expect(r.necessario).toBe(160); expect(VB.deficit).toBe(true);
    expect(VB.itens.find(i => i.etapa === 'contato')!.estado).toBe('ok');
    expect(['capacidade', 'equipe', 'conversao', 'objetivo'].every(k => VB.alternativas.some(a => a.k === k))).toBe(true);
    const a = VB.alternativas.find(x => x.k === 'objetivo')!; expect(a.vendasViaveis).toBeCloseTo(18); expect(a.receitaViavel).toBeCloseTo(396000);
    const v = viabilidade({ reuniao_realizada: 100 }, {}, {}); expect(v.itens[0]!.estado).toBe('sem_capacidade'); expect(v.deficit).toBe(false);
    const s = viabilidade({ agendamento: 100 }, { agendamento: 80 }, {}); expect(s.itens.find(i => i.etapa === 'agendamento')!.deficit).toBe(20); expect(s.deficit).toBe(true); expect(s.alternativas.some(x => x.k === 'agendamento')).toBe(true);
    const z = viabilidade({ agendamento: 100 }, {}, {}); expect(z.itens.length).toBe(0); expect(z.deficit).toBe(false);
  });
});

describe('D8: programa de ciclos', () => {
  const PG = { meta: { receita: 300000 }, ciclos: ['2026-10', '2026-11', '2026-12'] };
  const ok = <T,>(r: T | { erro: string }): Exclude<T, { erro: string }> => { if ((r as { erro?: string }).erro) throw new Error((r as { erro: string }).erro); return r as Exclude<T, { erro: string }>; };
  it('original por dias úteis; vigente redistribui o que falta; histórico intacto', () => {
    let RP = ok(programa(PG, { '2026-10': { status: 'atual', du: 20, real: { receita: 30000 } }, '2026-11': { status: 'futuro', du: 22 }, '2026-12': { status: 'futuro', du: 18 } }));
    expect(RP.ciclos[0]!.original.receita).toBeCloseTo(100000); expect(RP.ciclos[1]!.original.receita).toBeCloseTo(110000); expect(RP.ciclos[2]!.original.receita).toBeCloseTo(90000);
    expect(RP.ciclos[0]!.vigente.receita).toBeCloseTo(100000); expect(RP.ciclos[2]!.vigente.receita).toBeCloseTo(90000);
    expect(RP.falta.receita).toBeCloseTo(270000); expect(RP.realizado.receita).toBeCloseTo(30000);
    RP = ok(programa({ ...PG, original: { '2026-10': { receita: 100000 }, '2026-11': { receita: 110000 }, '2026-12': { receita: 90000 } } }, { '2026-10': { status: 'fechado', du: 20, real: { receita: 80000 } }, '2026-11': { status: 'atual', du: 22, real: { receita: 10000 } }, '2026-12': { status: 'futuro', du: 18 } }));
    expect(RP.ciclos[1]!.vigente.receita).toBeCloseTo(121000); expect(RP.ciclos[2]!.vigente.receita).toBeCloseTo(99000);
    expect(RP.ciclos[0]!.original.receita).toBeCloseTo(100000); expect(RP.ciclos[0]!.vigente.receita).toBeNull();
    expect(RP.ciclos[1]!.saldoAnterior.receita).toBeCloseTo(-20000); expect(RP.falta.receita).toBeCloseTo(210000);
    RP = ok(programa(PG, { '2026-10': { status: 'fechado', du: 20, real: { receita: 130000 } }, '2026-11': { status: 'atual', du: 22 }, '2026-12': { status: 'futuro', du: 18 } }));
    expect(RP.ciclos[1]!.vigente.receita).toBeCloseTo(93500); expect(RP.ciclos[2]!.vigente.receita).toBeCloseTo(76500);
    RP = ok(programa(PG, { '2026-10': { status: 'fechado', du: 20, real: { receita: 320000 } }, '2026-11': { status: 'atual', du: 22 }, '2026-12': { status: 'futuro', du: 18 } }));
    expect(RP.ciclos[1]!.vigente.receita).toBe(0); expect(RP.falta.receita).toBe(0);
  });
  it('recusas e pesos', () => {
    expect('erro' in programa({ meta: { receita: 1 }, ciclos: ['2026-10', '2026-10'] }, {})).toBe(true);
    expect('erro' in programa({ meta: { receita: 1 }, ciclos: ['2026-10', '2026-12'] }, {})).toBe(true);
    expect('erro' in programa({ meta: { receita: 1 }, ciclos: ['2026-12', '2027-01'] }, {})).toBe(false);
    expect('erro' in programa({ meta: { receita: 1 }, ciclos: ['2026-10'] }, {})).toBe(true);
    const r = ok(programa({ ...PG, pesos: { '2026-12': 2 } }, { '2026-10': { du: 20 }, '2026-11': { du: 22 }, '2026-12': { du: 18 } })); expect(r.ciclos[2]!.original.receita).toBeCloseTo((300000 * 36) / 78);
  });
  it('tipos do catálogo', () => {
    expect(TIPO_INDICADOR.receita).toBe('resultado'); expect(TIPO_INDICADOR.leads).toBe('direcionador'); expect(TIPO_INDICADOR[TX.oportVenda]).toBe('eficiencia'); expect(TIPO_INDICADOR.margem).toBe('restricao');
  });
});
