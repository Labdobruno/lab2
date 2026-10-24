/* Contrato: lab_objetivos.test.js da V1 (operadores, classes de desvio, critérios, veredito, ponte) e as regras de lpProjecoes/lpSinais/labForecast. */
import { describe, expect, it } from 'vitest';
import { avaliarObjetivo, classeDesvio, criterio, DESVIOS, limiares, ponte, veredito } from '../src/objetivos.js';
import { decorridos, forecastPipeline, impactoVendas, poissonPeloMenos, projecoes, ritmoDeLeads, sinais } from '../src/projecao.js';

const perto = (a: number | null | undefined, b: number, e = 1e-6) => a != null && Math.abs(a - b) <= e;

describe('objetivos: operadores', () => {
  it('atingir, min, max, faixa, maximizar, sem valor', () => {
    expect(avaliarObjetivo({ op: 'atingir', alvo: 100 }, 90)).toMatchObject({ ok: false, gap: 10, direcao: 'subir' });
    expect(avaliarObjetivo({ op: 'min', alvo: 22000 }, 22000).ok).toBe(true);
    const mx = avaliarObjetivo({ op: 'max', alvo: 0.1 }, 0.12); expect(mx.ok).toBe(false); expect(perto(mx.gap, 0.02)).toBe(true); expect(mx.direcao).toBe('descer');
    const fx = avaliarObjetivo({ op: 'faixa', alvo: 0.2, alvo2: 0.25 }, 0.27); expect(fx.ok).toBe(false); expect(perto(fx.gap, 0.02)).toBe(true);
    expect(avaliarObjetivo({ op: 'faixa', alvo: 0.2, alvo2: 0.25 }, 0.22).ok).toBe(true);
    expect(avaliarObjetivo({ op: 'atingir', alvo: 100 }, null).estado).toBe('sem_dado');
    expect(avaliarObjetivo({ op: 'maximizar' }, 5)).toMatchObject({ ok: null, direcao: 'subir' });
    expect(avaliarObjetivo({ alvo: 10 }, 10).ok).toBe(true);
  });
});

describe('objetivos: classes de desvio, critérios, veredito e ponte', () => {
  it('classes de desvio', () => {
    expect(classeDesvio({ origem: 'conversao', ind: 'oportunidades>vendas', volOk: true })!.k).toBe('d2');
    expect(classeDesvio({ origem: 'conversao', ind: 'oportunidades>vendas', volOk: false })!.k).toBe('d5');
    expect(classeDesvio({ origem: 'trajetoria', ind: 'contato' })!.k).toBe('d1');
    expect(classeDesvio({ origem: 'trajetoria', ind: 'oportunidades' })!.k).toBe('d5');
    expect(['capacidade', 'comparecimento', 'ticket', 'margem', 'dados'].map(o => classeDesvio({ origem: o })!.k)).toEqual(['d8', 'd4', 'd9', 'd10', 'd11']);
    expect(classeDesvio({ origem: 'meta', maturacao: true })!.k).toBe('d7'); expect(classeDesvio({ origem: 'meta' })!.k).toBe('d6');
    expect(classeDesvio({ origem: 'protecao', ind: 'leads>agendamento' })!.k).toBe('d3');
    expect(classeDesvio({ origem: 'hip' })).toBeNull(); expect(classeDesvio({ origem: 'padrao', padrao: 'oport' })).toBeNull();
    expect(Object.keys(DESVIOS)).toHaveLength(11); expect(Object.values(DESVIOS).every(c => c.nome && c.verificar)).toBe(true);
  });
  it('critérios: padrão × configurado, limiares em fração', () => {
    expect(criterio({}, 'metaRisco')).toMatchObject({ valor: 95, fonte: 'padrão' });
    expect(criterio({ metaRisco: 92 }, 'metaRisco')).toMatchObject({ valor: 92, fonte: 'configurado', padrao: 95 });
    const L = limiares({ metaRisco: 92 }); expect(perto(L.metaRisco, 0.92) && L.minN === 10 && perto(L.conversao, 0.7)).toBe(true);
    expect(criterio({ conversao: 'abc' }, 'conversao')!.fonte).toBe('padrão');
  });
  it('veredito conjunto: sem alertas contraditórios', () => {
    expect(veredito({ metaRisco: true, volOk: true }).k).toBe('resultado');
    expect(veredito({ metaRisco: true, volOk: false }).k).toBe('atividade');
    expect(veredito({ metaRisco: false, volOk: true, convBaixa: true }).k).toBe('conversao');
    expect(veredito({ metaRisco: true, volOk: true, confBaixa: true }).texto).toMatch(/confiança baixa/);
    expect(veredito({ dadosFaltam: true }).k).toBe('sem_dados');
    expect(veredito({ metaRisco: false, volOk: true, convBaixa: false }).k).toBe('ok');
  });
  it('ponte: +44 mil fechamentos, −20 mil pipeline, −12 mil leads = +12 mil; resto vira "Outros"', () => {
    const P = ponte({ receita: 250000, componentes: { real: 88000, pipe: 100000, novas: 62000 } }, { receita: 262000, componentes: { real: 132000, pipe: 80000, novas: 50000 } }, { fechados: ['n1', 'n2'] });
    expect([P.total, P.passos[0]!.valor, P.passos[1]!.valor, P.passos[2]!.valor, P.passos[0]!.itens.length]).toEqual([12000, 44000, -20000, -12000, 2]);
    const q = ponte({ receita: 100, componentes: { real: 50, pipe: 50 } }, { receita: 130, componentes: { real: 60, pipe: 50 } });
    expect(q.passos.some(x => /Outros/.test(x.nome) && x.valor === 20)).toBe(true);
  });
});

describe('projeção do ciclo', () => {
  const uteis = ['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-13', '2026-10-14', '2026-10-15'];
  it('dias decorridos: hoje conta a fração do ritual (V1: meio dia)', () => {
    expect(decorridos(uteis, '2026-10-07')).toBe(4.5); expect(decorridos(uteis, '2026-10-07', 0)).toBe(4); expect(decorridos(uteis, '2026-10-07', 1)).toBe(5);
    expect(decorridos(uteis, '2026-10-10')).toBe(7);   // sábado: não é dia útil, não conta meio dia
  });
  it('Poisson: chance de ao menos k com média λ', () => {
    expect(poissonPeloMenos(0, 2)).toBe(1); expect(poissonPeloMenos(3, 0)).toBe(0);
    expect(perto(poissonPeloMenos(3, 2), 1 - 5 * Math.exp(-2), 1e-9)).toBe(true);   // 1 − e^−2(1 + 2 + 2)
  });
  it('ritmo de leads: mistura com o histórico até o 5º dia útil', () => {
    expect(ritmoDeLeads(2, 20, 300, 60)).toMatchObject({ rAtual: 10, rHist: 5, pesoAt: 0.4 });
    expect(perto(ritmoDeLeads(2, 20, 300, 60).ritmo, 0.4 * 10 + 0.6 * 5)).toBe(true);
    expect(ritmoDeLeads(8, 40, 300, 60).ritmo).toBe(5);
    expect(ritmoDeLeads(0.5, 0, 300, 60).ritmo).toBe(5);     // primeiro meio dia: só o histórico
    expect(ritmoDeLeads(0, 0, 0, 0).ritmo).toBeNull();
  });
  it('as quatro projeções e a chance de bater', () => {
    /* 20 dias úteis, 10 decorridos; 5 vendas (R$ 100 mil); pipeline vale 2 vendas e R$ 40 mil; leads 3/dia × 10 × 5% × cabe 0,6 = 0,9 venda */
    const r = projecoes({ du: 20, dd: 10, vendasReal: 5, receitaReal: 100000, pipeV: 2, pipeR: 40000, cabe: 0.6, leadsCiclo: 30, leads90: 180, du90: 60, taxaLeadVenda: 0.05, ticket: 20000, nTicket: 12, metas: { vendas: 10, receita: 200000 } });
    expect(r.rest).toBe(10); expect(r.fragil).toBe(false);
    expect(r.vendas).toMatchObject({ real: 5, plan: 10, ritmo: 10, hist: 7 }); expect(perto(r.vendas.ajust, 7.9)).toBe(true);
    expect(r.receita).toMatchObject({ real: 100000, plan: 200000, ritmo: 200000, hist: 140000 }); expect(perto(r.receita.ajust, 158000)).toBe(true);
    expect(r.comp).toMatchObject({ real: 100000, pipe: 40000 }); expect(perto(r.comp!.novas, 18000)).toBe(true);
    expect(perto(r.prob, poissonPeloMenos(5, 2.9), 1e-9)).toBe(true);
    expect(projecoes({ du: 20, dd: 10, vendasReal: 5, receitaReal: 0, pipeV: 0, pipeR: 0, cabe: 1, leadsCiclo: 0, leads90: 0, du90: 0, taxaLeadVenda: null, ticket: null, nTicket: 3, metas: { vendas: 10 } })).toMatchObject({ prob: null, probMotivo: expect.stringMatching(/poucas vendas/) });
    expect(projecoes({ du: 20, dd: 1, vendasReal: 1, receitaReal: 0, pipeV: 0, pipeR: 0, cabe: 1, leadsCiclo: 0, leads90: 0, du90: 0, taxaLeadVenda: null, ticket: null, nTicket: 20, metas: {} })).toMatchObject({ fragil: true, probMotivo: 'sem meta de vendas' });
    expect(projecoes({ du: 20, dd: 20, encerrado: true, vendasReal: 9, receitaReal: 1, pipeV: 5, pipeR: 5, cabe: 1, leadsCiclo: 0, leads90: 0, du90: 0, taxaLeadVenda: null, ticket: null, nTicket: 20, metas: { vendas: 10 } }).vendas).toMatchObject({ ritmo: 9, hist: 9, ajust: 9 });
    expect(projecoes({ du: 20, dd: 0, futuro: true, vendasReal: 0, receitaReal: 0, pipeV: 0, pipeR: 0, cabe: 1, leadsCiclo: 0, leads90: 0, du90: 0, taxaLeadVenda: null, ticket: null, nTicket: 20, metas: { vendas: 10 } }).vendas.ajust).toBeNull();
    expect(projecoes({ du: 20, dd: 10, vendasReal: 5, receitaReal: 0, pipeV: 0, pipeR: 0, cabe: 1, leadsCiclo: 0, leads90: 0, du90: 0, taxaLeadVenda: null, ticket: 20000, nTicket: 20, metas: { vendas: 10 } }).receita.plan).toBe(200000);
  });
  it('forecast do pipeline: fora da curva (> 5× o ticket) fica à parte', () => {
    const F = forecastPipeline([
      { chave: 'proposta', nome: 'Proposta', n: 20, g: 8, duracoes: [5, 10, 20, 40], abertos: [{ id: 'a', nome: 'Normal', valor: 20000 }, { id: 'b', nome: 'Rádio Grande SA', valor: 1000000 }] },
      { chave: 'negociacao', nome: 'Negociação', n: 10, g: 6, duracoes: [], abertos: [{ id: 'c', nome: 'Outro', valor: 30000 }] },
    ], 15, 20000);
    expect(F.limite).toBe(100000);
    expect(F.fora).toHaveLength(1); expect(F.fora[0]).toMatchObject({ nome: 'Rádio Grande SA', pv: 0.4, pt: 0.5, esperado: 200000 });
    expect(F.et[0]).toMatchObject({ abertos: 2, foraN: 1, valor: 1020000, pond: 8000, noPrazo: 4000 }); expect(perto(F.et[0]!.vendas, 0.2)).toBe(true);
    expect(F.et[1]).toMatchObject({ pt: null, noPrazo: 0, vendas: 0 });   // sem duração histórica: não afirma que fecha a tempo
    expect(F.noPrazo).toBe(4000); expect(perto(F.pipeV, 0.2)).toBe(true); expect(F.foraV).toBe(200000);
    expect(forecastPipeline([], 10, null).limite).toBeNull();
  });
  it('impacto de um déficit pela cadeia de taxas', () => {
    const taxas = { 'leads>agendamento': 0.2, 'agendamento>reuniao_realizada': 0.8, 'reuniao_realizada>oportunidades': 0.5, 'oportunidades>vendas': 0.3 };
    const I = impactoVendas('agendamento', 10, taxas, 20000);
    expect(perto(I.vendas, 1.2) && perto(I.receita, 24000)).toBe(true); expect(I.txt).toMatch(/≈ 1,2 vendas a menos \(80% × 50% × 30%\)/);
    expect(impactoVendas('agendamento', 10, { ...taxas, 'oportunidades>vendas': null }, 20000)).toMatchObject({ receita: null, txt: 'sem taxa histórica para estimar' });
    expect(perto(impactoVendas('contato', 10, taxas, 20000, { agendamentoPorContato: 0.1 }).vendas, 0.12)).toBe(true);
    expect(impactoVendas('contato', 10, taxas, 20000).receita).toBeNull();
    expect(impactoVendas('vendas', 2, taxas, 20000)).toMatchObject({ vendas: 2, receita: 40000 });
  });
});

describe('sinais com veredito', () => {
  const nomes = { leads: 'Leads', tentativa: 'Tentativas', contato: 'Contatos', agendamento: 'Reuniões agendadas', reuniao_realizada: 'Reuniões realizadas', oportunidades: 'Oportunidades', vendas: 'Vendas', receita: 'Receita' };
  const fmt = (k: string, v: number) => (k === 'receita' ? 'R$ ' + Math.round(v) : String(Math.round(v)));
  const base = (over: Partial<Parameters<typeof projecoes>[0]> = {}) => projecoes({ du: 20, dd: 10, vendasReal: 5, receitaReal: 100000, pipeV: 2, pipeR: 40000, cabe: 0.6, leadsCiclo: 30, leads90: 180, du90: 60, taxaLeadVenda: 0.05, ticket: 20000, nTicket: 12, metas: { vendas: 10, receita: 200000 }, ...over });
  const taxas = { 'leads>agendamento': 0.2, 'agendamento>reuniao_realizada': 0.8, 'reuniao_realizada>oportunidades': 0.5, 'oportunidades>vendas': 0.3 };
  it('meta em risco (receita 158 mil < 95% de 200 mil, gap > 25% → gravidade 3) e trajetória', () => {
    const S = sinais({ dd: 10, du: 20, proj: base(), metas: { vendas: 10, receita: 200000 }, ticket: 20000, nTicket: 12, taxas, nomes, fmt,
      linhas: [{ ind: 'tentativa', alvo: 400, esp: 200, real: 100 }, { ind: 'agendamento', alvo: 40, esp: 20, real: 19 }, { ind: 'receita', alvo: 200000, esp: 100000, real: 100000 }] });
    const meta = S.sinais.find(s => s.origem === 'meta')!; expect(meta).toMatchObject({ grav: 2, ind: 'receita', impacto: 42000 });
    const tr = S.sinais.find(s => s.origem === 'trajetoria')!; expect(tr).toMatchObject({ ind: 'tentativa', grav: 3 }); expect(tr.classe!.k).toBe('d1');
    expect(S.volOk).toBe(false); expect(S.veredito.k).toBe('atividade');
    expect(S.incidentes[0]!.z).toBe('topo'); expect(S.incidentes.map(i => i.z)).toEqual(['topo', 'fundo']);
  });
  it('atividade em dia, resultado abaixo; conversão com amostra pequena; dados ausentes; classe d2', () => {
    const S = sinais({ dd: 10, du: 20, proj: base({ receitaReal: 60000, pipeR: 20000 }), metas: { receita: 200000 }, ticket: 20000, nTicket: 12, taxas, nomes, fmt,
      linhas: [{ ind: 'tentativa', alvo: 400, esp: 200, real: 210 }, { ind: 'agendamento', alvo: 40, esp: 20, real: 19 }, { ind: 'receita', alvo: 200000, esp: 100000, real: 60000 }, { ind: 'contato', alvo: 100, esp: 50, real: null, semDado: true }],
      conversoes: [{ ind: 'oportunidades>vendas', nome: 'Oportunidade → venda', z: 'fundo', mes: { v: 0.1, n: 4 }, hist: { v: 0.3, n: 40 } }] });
    expect(S.volOk).toBe(true);
    expect(S.sinais.some(s => s.origem === 'resultado')).toBe(true);
    const cv = S.sinais.find(s => s.origem === 'conversao')!; expect(cv.amostraPequena).toBe(true); expect(cv.conf).toMatch(/amostra abaixo da mínima/); expect(cv.classe!.k).toBe('d2');
    expect(S.sinais.some(s => s.origem === 'dados' && /Contatos/.test(s.oque))).toBe(true);
    expect(S.veredito.k).toBe('resultado'); expect(S.veredito.texto).toMatch(/confiança baixa/);
  });
  it('capacidade e demanda; nada no início do ciclo (dd < 2); ciclo futuro vazio', () => {
    const S = sinais({ dd: 10, du: 20, proj: base(), metas: {}, ticket: 20000, nTicket: 12, taxas, nomes, fmt, linhas: [], leadsAdicionais: 100, capacidade: [{ pessoa: 'Sara', campo: 'tentativas', cap: 40, nec: 60 }] });
    expect(S.sinais.find(s => s.origem === 'capacidade')).toMatchObject({ grav: 3, pessoa: 'Sara' });
    expect(S.sinais.find(s => s.origem === 'demanda')).toMatchObject({ grav: 2 });   // ritmo 3/dia × 10 = 30 < 90
    expect(S.veredito.k).toBe('ok');
    expect(sinais({ dd: 1, du: 20, proj: base({ dd: 1 }), metas: { receita: 200000 }, ticket: 20000, nTicket: 12, taxas, nomes, fmt, linhas: [{ ind: 'tentativa', alvo: 400, esp: 20, real: 0 }] }).sinais).toHaveLength(0);
    expect(sinais({ dd: 0, du: 20, proj: base({ dd: 0, futuro: true }), metas: {}, ticket: null, nTicket: 0, taxas: {}, nomes, fmt, linhas: [] }).sinais).toHaveLength(0);
  });
});
