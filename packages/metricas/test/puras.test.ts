import { describe, expect, it } from 'vitest';
import { conversaoPorCoorte, degrauAlcancado, economiaDaVenda, eficienciaPorCanal, fluxoPorPapel, mrrDe, proporcao, retencao, taxaDeGanho, wilson } from '../src/index.js';
import type { NegocioLinha } from '../src/index.js';

const neg = (o: Partial<NegocioLinha> & { id: string }): NegocioLinha => ({
  tipo: 'novo', canal: 'ads', status: 'aberto', papelAtual: 'lead', papeisAlcancados: [], valorFechado: null,
  criadoEm: '2026-10-05T12:00:00Z', fechadoEm: null, funilPrincipal: true, ...o,
});

describe('estatística', () => {
  it('Wilson conhecido: 8/10 ≈ [0,49; 0,94]', () => {
    const w = wilson(8, 10)!;
    expect(w.baixo).toBeCloseTo(0.4902, 3);
    expect(w.alto).toBeCloseTo(0.9433, 3);
  });
  it('sem amostra não vira zero', () => {
    expect(proporcao(0, 0)).toMatchObject({ taxa: null, ic: null, amostraSuficiente: false });
    expect(proporcao(5, 40).amostraSuficiente).toBe(true);
  });
});

describe('funil', () => {
  it('quem ganhou conta em todos os degraus, mesmo sem passar por eles no histórico', () => {
    expect(degrauAlcancado({ papelAtual: 'ganho', papeisAlcancados: [], status: 'ganho' })).toBe(8);
    expect(degrauAlcancado({ papelAtual: 'perdido', papeisAlcancados: ['lead', 'agendada'], status: 'perdido' })).toBe(3);
  });
  it('coorte: conversão acumulada e passo a passo', () => {
    const c = conversaoPorCoorte([
      neg({ id: '1' }),
      neg({ id: '2', papeisAlcancados: ['contato'], papelAtual: 'contato' }),
      neg({ id: '3', status: 'ganho', papelAtual: 'ganho', papeisAlcancados: ['contato', 'ganho'] }),
      neg({ id: '4', tipo: 'expansao', status: 'ganho', papelAtual: 'ganho' }),
    ]);
    expect(c.coorte).toBe(3);
    expect(c.etapas.find(e => e.papel === 'contato')).toMatchObject({ sucessos: 2, total: 3 });
    expect(c.etapas.find(e => e.papel === 'ganho')).toMatchObject({ sucessos: 1, total: 3 });
    expect(c.passoAPasso[0]).toMatchObject({ de: 'lead', para: 'contato', sucessos: 2, total: 3 });
    expect(c.etapas[0]!.amostraSuficiente).toBe(false);
  });
  it('fluxo conta negócios distintos', () => {
    expect(fluxoPorPapel([{ negocioId: 'a', papel: 'agendada' }, { negocioId: 'a', papel: 'agendada' }, { negocioId: 'b', papel: 'agendada' }])).toEqual({ agendada: 2 });
  });
  it('taxa de ganho ignora abertos e expansões', () => {
    const t = taxaDeGanho([neg({ id: '1', status: 'ganho' }), neg({ id: '2', status: 'perdido' }), neg({ id: '3' }), neg({ id: '4', tipo: 'expansao', status: 'ganho' })]);
    expect(t).toMatchObject({ sucessos: 1, total: 2, taxa: 0.5 });
  });
});

describe('economia e canais', () => {
  const precos = [
    { negocioId: 'v', momento: 'referencia' as const, valor: 12000, linhas: [] },
    { negocioId: 'v', momento: 'aprovado' as const, valor: 11000, linhas: [] },
    { negocioId: 'v', momento: 'fechado' as const, valor: 10000, linhas: [{ chave: 'imposto', valor: 600 }, { chave: 'comissao', valor: 400 }] },
  ];
  it('desconto e margem de contribuição da venda', () => {
    const e = economiaDaVenda({ id: 'v', valorFechado: 10000 }, precos);
    expect(e.descontoSobreReferencia).toBeCloseTo(1 / 6);
    expect(e.descontoSobreAprovado).toBeCloseTo(1 / 11);
    expect(e.margemContribuicao).toBe(9000);
    expect(e.margemPercentual).toBeCloseTo(0.9);
  });
  it('sem preço fechado registrado, MC é nula (não zero)', () => {
    expect(economiaDaVenda({ id: 'x', valorFechado: 5000 }, []).margemContribuicao).toBeNull();
  });
  it('CPL, CAC, ROI, MC−CAC e payback', () => {
    const ganho = neg({ id: 'v', status: 'ganho', valorFechado: 10000, fechadoEm: '2026-10-20T12:00:00Z' });
    const r = eficienciaPorCanal({
      negociosCriados: [neg({ id: 'v' }), neg({ id: 'b' }), neg({ id: 'c' }), neg({ id: 'd' })], negociosGanhos: [ganho],
      investimentos: [{ canal: 'ads', valor: 2000, leadsPlataforma: null }], precosPorNegocio: new Map([['v', precos]]),
      contratos: [{ id: 'k', contaId: 'c', negocioOrigemId: 'v', recorrente: true, valorPeriodo: 1200, periodicidadeMeses: 1, inicio: '2026-10-21', fim: null, status: 'ativo' }],
    });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ canal: 'ads', leads: 4, vendas: 1, receita: 10000, cpl: 500, cac: 2000, roi: 4, margemContribuicao: 9000, mcMenosCac: 7000 });
    expect(r[0]!.paybackMeses).toBeCloseTo(2000 / (1200 * 0.9), 1);
  });
  it('canal sem investimento não inventa CPL/CAC', () => {
    const r = eficienciaPorCanal({ negociosCriados: [neg({ id: 'a', canal: 'indicacao' })], negociosGanhos: [], investimentos: [], precosPorNegocio: new Map(), contratos: [] });
    expect(r[0]).toMatchObject({ canal: 'indicacao', investimento: null, cpl: null, cac: null, roi: null });
  });
});

describe('retenção', () => {
  const ct = (id: string, conta: string, extra = {}) => ({ id, contaId: conta, negocioOrigemId: null, recorrente: true, valorPeriodo: 1000, periodicidadeMeses: 1, inicio: '2026-01-01', fim: null, status: 'ativo', ...extra });
  const periodo = { de: '2026-10-01', ate: '2026-11-01' };
  it('churn, GRR, NRR e LTV', () => {
    const r = retencao({
      periodo, margem: 0.5,
      contratos: [ct('1', 'a'), ct('2', 'b'), ct('3', 'c', { status: 'cancelado', fim: '2026-10-15' }), ct('4', 'd', { inicio: '2026-10-10' })],
      eventos: [{ contaId: 'a', tipo: 'expandido', em: '2026-10-12T00:00:00Z', valor: 300 }, { contaId: 'b', tipo: 'reduzido', em: '2026-10-12T00:00:00Z', valor: -100 }],
    });
    expect(r).toMatchObject({ contasNoInicio: 3, mrrInicial: 3000, mrrCancelado: 1000, mrrExpansao: 300, mrrReduzido: 100, churnLogos: 0.3333, churnReceita: 0.3333 });
    expect(r.retencaoBruta).toBeCloseTo(0.6333, 3);
    expect(r.retencaoLiquida).toBeCloseTo(0.7333, 3);
    expect(r.ltv).toBeCloseTo((1000 * 0.5) / r.churnMensal!, 0);
  });
  it('sem contratos no início, nada vira zero', () => {
    const r = retencao({ periodo, contratos: [], eventos: [] });
    expect(r).toMatchObject({ mrrInicial: null, churnLogos: null, churnReceita: null, retencaoLiquida: null, ltv: null });
  });
  it('MRR anualizado vira mensal', () => expect(mrrDe({ valorPeriodo: 12000, periodicidadeMeses: 12 })).toBe(1000));
});
