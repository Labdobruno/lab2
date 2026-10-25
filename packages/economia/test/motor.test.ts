/* Contrato: testes da V1 (receita_liquida, comissao, fonte_verdade §1–2, correcoes_negocio 6.1) e as regras do briefing (break-even, previsto × real). */
import { describe, expect, it } from 'vitest';
import { alcada, breakEvenDesconto, comissaoDaMargem, contribuicaoNecessaria, economiaDaVenda, margemAgregada, mcPerdida, politicaDe, precoFormula, precoParaMargem, precoRecomendado, previstoRealEfetiva, type Politica } from '../src/index.js';

const P = { alvo: 0.02, minima: 0.01, margemAlvo: 0.24, margemMinima: 0.2 };
describe('comissão atrelada à margem (V1: sem teto)', () => {
  it('alvo, mínima, proporcional, piso, sem teto, fixa', () => {
    expect(comissaoDaMargem(0.24, P)).toBeCloseTo(0.02, 9); expect(comissaoDaMargem(0.2, P)).toBeCloseTo(0.01, 9); expect(comissaoDaMargem(0.22, P)).toBeCloseTo(0.015, 9);
    expect(comissaoDaMargem(0.1, P)).toBeCloseTo(0.01, 9); expect(comissaoDaMargem(0.28, P)).toBeCloseTo(0.03, 9); expect(comissaoDaMargem(0.32, P)).toBeCloseTo(0.04, 9);
    expect(comissaoDaMargem(0.4, { ...P, fixa: true })).toBeCloseTo(0.02, 9);
  });
});

/* política: imposto 10% sobre o preço, taxa do cartão 2%, comissão fixa 2% do líquido */
const pol: Politica = politicaDe({ margemAlvo: 0.24, margemMinima: 0.2, descontoMaximo: 0.1, comissao: { tipo: 'fixa', alvo: 0.02 },
  linhas: [{ chave: 'imposto', nome: 'Imposto', grupo: 'deducao', base: 'percentual_preco', valor: 0.1 }, { chave: 'kit', nome: 'Kit', grupo: 'custo_variavel', base: 'informado', categoria: 'cpv' }, { chave: 'marketing', nome: 'Marketing', grupo: 'custo_variavel', base: 'informado', categoria: 'servico' }],
  condicoes: [{ chave: 'vista', nome: 'À vista', taxa: 0 }, { chave: 'cartao', nome: 'Cartão', taxa: 0.02 }] }, 3);
describe('receita líquida (V1, decisão de 09/10/2026)', () => {
  it('100.000 − 10.000 − 2.000 − 1.760 = 86.240; lucro 45.240; MC % sobre a RL e sobre o preço nomeadas', () => {
    const e = economiaDaVenda({ preco: 100000, custos: [{ chave: 'kit', valor: 40000 }, { chave: 'marketing', valor: 1000 }], condicao: 'cartao' }, pol);
    expect(e.deducoes[0]!.valor).toBe(10000); expect(e.taxa).toBe(2000); expect(e.liquidoAntesComissao).toBe(88000); expect(e.comissao).toBeCloseTo(1760); expect(e.receitaLiquida).toBeCloseTo(86240);
    expect(e.mc).toBeCloseTo(45240); expect(e.mcPct).toBeCloseTo(45240 / 86240); expect(e.mcPctPreco).toBeCloseTo(0.4524); expect(e.custosPorCategoria).toEqual({ cpv: 40000, servico: 1000 });
    expect(e.deducoesTotal).toBeCloseTo(13760); expect(e.politicaVersao).toBe(3); expect(e.custoFinanceiro).toBe(0);
  });
  it('sem política: MC = preço − custos (o que a V2 fazia); comissão nenhuma', () => {
    const e = economiaDaVenda({ preco: 10000, custos: [{ chave: 'imposto', valor: 600 }, { chave: 'comissao', valor: 400 }] }, politicaDe({}));
    expect(e.receitaLiquida).toBe(10000); expect(e.mc).toBe(9000); expect(e.mcPct).toBeCloseTo(0.9); expect(e.comissaoOrigem).toBe('nenhuma');
  });
  it('RL ≤ 0: MC % nula, nunca inventada', () => {
    const e = economiaDaVenda({ preco: 0, custos: [{ chave: 'kit', valor: 100 }] }, pol); expect(e.mcPct).toBeNull(); expect(e.mc).toBe(-100);
  });
});

describe('fórmula de preço e ida e volta (V1 fonte_verdade §1–2)', () => {
  const solar: Politica = politicaDe({ margemAlvo: 0.24, margemMinima: 0.2, comissao: { tipo: 'fixa', alvo: 0.02 },
    linhas: [{ chave: 'imposto', nome: 'Simples', grupo: 'deducao', base: 'percentual_preco', valor: 0.1, excluir: ['kit'] }, { chave: 'kit', nome: 'Kit', grupo: 'custo_variavel', base: 'informado', categoria: 'cpv' }, { chave: 'obra', nome: 'Obra', grupo: 'custo_variavel', base: 'informado', categoria: 'servico' }] });
  const custos = [{ chave: 'kit', valor: 10000 }, { chave: 'obra', valor: 10000 }];
  it('o preço recomendado bate com a fórmula fechada e devolve a margem alvo sobre a RL', () => {
    const esperado = precoFormula(20000, 10000, 0.24, 0.1, 0.02), rec = precoRecomendado(custos, solar);
    expect(rec.recomendado).toBeCloseTo(esperado, 1);
    const e = economiaDaVenda({ preco: rec.recomendado!, custos }, solar);
    expect(e.mcBrutaPct).toBeCloseTo(0.24, 5); expect(e.deducoes[0]!.base).toBeCloseTo(rec.recomendado! - 10000, 1);
    expect(rec.piso).toBeLessThan(rec.recomendado!); expect(economiaDaVenda({ preco: rec.piso!, custos }, solar).mcBrutaPct).toBeCloseTo(0.2, 5);
  });
  it('comissão por margem: converge e a comissão segue a margem (margem alvo → comissão alvo)', () => {
    const pm: Politica = { ...solar, comissao: { tipo: 'por_margem', alvo: 0.02, minima: 0.01 } };
    const rec = precoRecomendado(custos, pm), e = economiaDaVenda({ preco: rec.recomendado!, custos }, pm);
    expect(e.comissaoOrigem).toBe('por_margem'); expect(e.comissaoIteracoes).toBeGreaterThan(0); expect(e.mcBrutaPct).toBeCloseTo(0.24, 4); expect(e.comissaoPct).toBeCloseTo(0.02, 4);
    const baixo = economiaDaVenda({ preco: rec.piso! * 0.9, custos }, pm); expect(baixo.comissaoPct).toBeCloseTo(0.01, 6);
    const alto = economiaDaVenda({ preco: rec.recomendado! * 1.3, custos }, pm); expect(alto.comissaoPct).toBeGreaterThan(0.02);
  });
  it('sem custos ou margem ≥ 100%: sem preço (não inventa)', () => {
    expect(precoParaMargem([], solar, 0.24)).toBeNull(); expect(precoParaMargem(custos, solar, 1)).toBeNull();
  });
});

describe('condição de pagamento e custo do dinheiro (V1 correcoes_negocio 6.1)', () => {
  const pc: Politica = politicaDe({ custoCapitalMes: 0.02, condicoes: [{ chave: 'vista', nome: 'À vista' }, { chave: 'c6040', nome: '60/40', taxa: 0.1, antecipacao: 0.02, partes: [{ fracao: 0.6, dias: 0 }, { fracao: 0.4, dias: 30 }] }, { chave: 'etapas', nome: 'Em etapas', partes: [{ fracao: 0.6, dias: 0 }, { fracao: 0.2, dias: 30 }, { fracao: 0.2, dias: 60 }] }] });
  it('60/40: taxa + antecipação sobre o preço = 1.200 em 10.000; dias médios ponderados; custo financeiro = custos × 2% × dias/30,4375', () => {
    const e = economiaDaVenda({ preco: 10000, custos: [{ chave: 'c', valor: 6000 }], condicao: 'c6040' }, pc);
    expect(e.taxa + e.antecipacao).toBeCloseTo(1200); expect(e.diasMedioRecebimento).toBeCloseTo(12); expect(e.custoFinanceiro).toBeCloseTo(6000 * 0.02 * (12 / 30.4375)); expect(e.capitalExposto).toBe(6000);
    expect(e.mc).toBeCloseTo(e.mcBruta - e.custoFinanceiro); expect(economiaDaVenda({ preco: 10000, custos: [{ chave: 'c', valor: 6000 }], condicao: 'vista' }, pc).custoFinanceiro).toBe(0);
    expect(economiaDaVenda({ preco: 10000, custos: [{ chave: 'c', valor: 6000 }], condicao: 'etapas' }, pc).diasMedioRecebimento).toBeCloseTo(18);
  });
  it('condição desconhecida cai na à vista', () => { expect(economiaDaVenda({ preco: 100, custos: [], condicao: 'x' }, pc).condicao).toBe('vista'); });
});

describe('alçada, desconto e MC perdida, margem agregada', () => {
  it('abaixo do piso ou desconto acima do máximo exige motivo, com o impacto na MC', () => {
    const custos = [{ chave: 'kit', valor: 40000 }], rec = precoRecomendado(custos, pol), piso = rec.piso!;
    const ok = alcada({ preco: piso + 10, piso, aprovado: piso + 100, descontoMaximo: 0.1 }); expect(ok.exige).toBe(false);
    const ex = alcada({ preco: piso - 1000, piso, aprovado: piso + 100, descontoMaximo: 0.1, mcNoPiso: economiaDaVenda({ preco: piso, custos }, pol).mc, mcNoPreco: economiaDaVenda({ preco: piso - 1000, custos }, pol).mc });
    expect(ex.exige).toBe(true); expect(ex.abaixoDoPiso).toBe(true); expect(ex.impactoMc).toBeCloseTo(1000 * (1 - 0.1) * (1 - 0.02)); expect(ex.texto).toMatch(/abaixo do piso/);
    expect(alcada({ preco: 85, piso: 50, aprovado: 100, descontoMaximo: 0.1 }).acimaDoDesconto).toBe(true);
  });
  it('MC perdida no desconto e margem agregada (Σ MC ÷ Σ RL, não média)', () => {
    const custos = [{ chave: 'kit', valor: 40000 }], a = economiaDaVenda({ preco: 100000, custos }, pol), f = economiaDaVenda({ preco: 90000, custos }, pol);
    const p = mcPerdida(a, f); expect(p.desconto).toBeCloseTo(0.1); expect(p.mcPerdida).toBeCloseTo(10000 * 0.9 * 0.98);
    expect(mcPerdida(null, f).mcPerdida).toBeNull();
    const ag = margemAgregada([a, f]); expect(ag.pct).toBeCloseTo((a.mc + f.mc) / (a.receitaLiquida + f.receitaLiquida)); expect(ag.n).toBe(2);
  });
});

describe('contribuição necessária, break-even do desconto, previsto × real × efetiva', () => {
  it('contribuição do mês em R$ e em vendas; sem custo fixo não inventa', () => {
    const c = contribuicaoNecessaria({ custosFixosMes: 50000, lucroDesejadoMes: 20000, mcAcumulada: 30000, mcMediaPorVenda: 8000 });
    expect(c.estado).toBe('abaixo'); if (c.estado === 'sem_fixo') throw new Error('x');
    expect(c.faltaEmpatar).toBe(20000); expect(c.vendasParaEmpatar).toBe(3); expect(c.faltaLucro).toBe(40000); expect(c.vendasParaLucro).toBe(5);
    expect(contribuicaoNecessaria({ custosFixosMes: 50000, lucroDesejadoMes: null, mcAcumulada: 60000, mcMediaPorVenda: null }).estado).toBe('lucro');
    expect(contribuicaoNecessaria({ custosFixosMes: null, lucroDesejadoMes: null, mcAcumulada: 1, mcMediaPorVenda: null }).estado).toBe('sem_fixo');
  });
  it('break-even: 10% de desconto numa venda de 100 mil com 40 mil de custo exige +… de volume (volEq = MC atual ÷ MC nova)', () => {
    const b = breakEvenDesconto({ preco: 100000, custos: [{ chave: 'kit', valor: 40000 }] }, pol, 0.1);
    expect(b.mcAtual).toBeCloseTo(100000 * 0.9 * 0.98 - 40000); expect(b.mcNova).toBeCloseTo(90000 * 0.9 * 0.98 - 40000); expect(b.volEq).toBeCloseTo(b.mcAtual / b.mcNova); expect(b.volumeExtra!).toBeGreaterThan(0.18);
    expect(breakEvenDesconto({ preco: 50000, custos: [{ chave: 'kit', valor: 45000 }] }, pol, 0.2).volEq).toBeNull();
  });
  it('efetiva = real só quando tudo foi lançado; antes vale a prevista', () => {
    const custos = [{ chave: 'kit', valor: 40000 }], prev = economiaDaVenda({ preco: 100000, custos }, pol), real = economiaDaVenda({ preco: 100000, custos: [{ chave: 'kit', valor: 43000 }] }, pol);
    const parcial = previstoRealEfetiva(prev, real, false); expect(parcial.fonte).toBe('prevista'); expect(parcial.parcial).toBe(true); expect(parcial.efetiva).toBe(prev);
    const cheio = previstoRealEfetiva(prev, real, true); expect(cheio.fonte).toBe('real'); expect(cheio.erroOrcamento).toBe(3000); expect(previstoRealEfetiva(prev, null, false).fonte).toBe('prevista');
  });
  it('política congelada: a mesma venda com outra versão da política dá outra conta, e a versão fica gravada na economia', () => {
    const nova = { ...pol, versao: 4, linhas: pol.linhas.map(l => (l.chave === 'imposto' ? { ...l, valor: 0.15 } : l)) };
    const a = economiaDaVenda({ preco: 100000, custos: [{ chave: 'kit', valor: 40000 }] }, pol), b = economiaDaVenda({ preco: 100000, custos: [{ chave: 'kit', valor: 40000 }] }, nova);
    expect(a.politicaVersao).toBe(3); expect(b.politicaVersao).toBe(4); expect(b.mc).toBeLessThan(a.mc);
  });
});
