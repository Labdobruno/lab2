import { describe, expect, it } from 'vitest';
import { avaliarHipoteses, type Hipotese } from '../src/index.js';

const H = (chave: string, quando: string, impacto?: string, severidade?: 'alta' | 'media' | 'baixa'): Hipotese =>
  ({ chave, titulo: chave.toUpperCase(), quando, ...(impacto ? { impacto } : {}), acao: 'agir', ...(severidade ? { severidade } : {}) });

describe('motor de hipóteses', () => {
  const ctx = { vendas: 20, receita: 200000, desconto_medio: 0.15, taxa_ganho: 0.2, fechados: 50, ticket_medio: 10000, churn_receita: null };
  it('dispara só o que é verdadeiro, ordena por impacto em R$ e mostra a evidência', () => {
    const r = avaliarHipoteses([
      H('desconto', 'desconto_medio > 0.10', 'receita * desconto_medio / (1 - desconto_medio)'),
      H('ganho', 'taxa_ganho < 0.25', '(0.25 - taxa_ganho) * fechados * ticket_medio'),
      H('nada', 'vendas > 1000', 'receita'),
    ], ctx, 5);
    expect(r.achados.map(a => a.chave)).toEqual(['desconto', 'ganho']);
    expect(r.achados[0]!.impacto).toBe(35294.12);
    expect(r.achados[1]!.impacto).toBe(25000);
    expect(r.achados[0]!.evidencias).toEqual([
      { variavel: 'desconto_medio', nome: 'Desconto médio', unidade: '%', valor: 0.15 },
      { variavel: 'receita', nome: 'Receita fechada', unidade: 'R$', valor: 200000 },
    ]);
    expect(r.naoDisparam).toBe(1);
  });
  it('orçamento de atenção: o resto fica em espera', () => {
    const r = avaliarHipoteses([H('a', 'vendas > 0', '1000'), H('b', 'vendas > 0', '3000'), H('c', 'vendas > 0', '2000'), H('d', 'vendas > 0', '500')], ctx, 2);
    expect(r.achados.map(a => a.chave)).toEqual(['b', 'c']);
    expect(r.emEspera.map(a => a.chave)).toEqual(['a', 'd']);
  });
  it('sem impacto calculável vai para o fim; empate decide por severidade', () => {
    const r = avaliarHipoteses([H('sem', 'vendas > 0'), H('nulo', 'vendas > 0', 'churn_receita * 100'), H('m', 'vendas > 0', '10', 'media'), H('a', 'vendas > 0', '10', 'alta')], ctx, 10);
    expect(r.achados.map(a => a.chave)).toEqual(['a', 'm', 'nulo', 'sem']);
    expect(r.achados.find(a => a.chave === 'nulo')!.impacto).toBeNull();
  });
  it('dado faltando não dispara nem some: vai para "sem dados" dizendo o que falta', () => {
    const r = avaliarHipoteses([H('churn', 'churn_receita > 0.05', 'receita'), H('misto', 'churn_receita > 0.05 && vendas > 1000'), H('ou', 'churn_receita > 0.05 || vendas > 1')], ctx);
    expect(r.semDados).toEqual([{ chave: 'churn', titulo: 'CHURN', faltam: ['churn_receita'] }]);
    expect(r.naoDisparam).toBe(1);                          // falso decide mesmo com dado faltando
    expect(r.achados.map(a => a.chave)).toEqual(['ou']);    // verdadeiro também
  });
  it('fórmula quebrada é reportada sem derrubar as outras', () => {
    const r = avaliarHipoteses([H('ruim', 'vendas >'), H('bom', 'vendas > 0', '1')], ctx);
    expect(r.achados.map(a => a.chave)).toEqual(['bom']);
    expect(r.errosDeFormula[0]!.chave).toBe('ruim');
  });
  it('é determinístico', () => {
    const hs = [H('a', 'vendas > 0', 'receita'), H('b', 'taxa_ganho < 1', 'receita')];
    expect(JSON.stringify(avaliarHipoteses(hs, ctx))).toBe(JSON.stringify(avaliarHipoteses(hs, ctx)));
  });
});
