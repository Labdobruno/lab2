import { describe, expect, it } from 'vitest';
import { analisar, calcular, ErroExpressao, variaveisUsadas, VARIAVEIS, resolverPack } from '../src/index.js';

describe('fórmulas das hipóteses', () => {
  const ctx = { a: 10, b: 4, zero: 0, falta: null };
  it('aritmética com precedência e parênteses', () => {
    expect(calcular('1 + 2 * 3', ctx)).toBe(7);
    expect(calcular('(1 + 2) * 3', ctx)).toBe(9);
    expect(calcular('a - b - 1', ctx)).toBe(5);        // associa à esquerda
    expect(calcular('-a + 15', ctx)).toBe(5);
    expect(calcular('a / b', ctx)).toBe(2.5);
    expect(calcular('0.10 * 50', ctx)).toBeCloseTo(5);
  });
  it('comparações e lógica', () => {
    expect(calcular('a > b && b >= 4', ctx)).toBe(true);
    expect(calcular('a < b || b == 4', ctx)).toBe(true);
    expect(calcular('!(a > b)', ctx)).toBe(false);
    expect(calcular('a != 10', ctx)).toBe(false);
  });
  it('funções', () => {
    expect(calcular('min(a, b, 7)', ctx)).toBe(4);
    expect(calcular('max(a - 20, 0)', ctx)).toBe(0);
    expect(calcular('abs(b - a)', ctx)).toBe(6);
    expect(calcular('se(a > b, 1, 2)', ctx)).toBe(1);
  });
  it('ausência de dado contamina e nunca vira zero', () => {
    expect(calcular('falta + 1', ctx)).toBeNull();
    expect(calcular('falta > 0', ctx)).toBeNull();
    expect(calcular('inexistente * 2', ctx)).toBeNull();
    expect(calcular('a / zero', ctx)).toBeNull();
    expect(calcular('max(falta, 1)', ctx)).toBeNull();
    expect(calcular('se(falta > 0, 1, 2)', ctx)).toBeNull();
  });
  it('lógica de três valores: falso ou verdadeiro decide mesmo com dado faltando', () => {
    expect(calcular('falta > 0 && a < 0', ctx)).toBe(false);
    expect(calcular('falta > 0 || a > 0', ctx)).toBe(true);
    expect(calcular('falta > 0 && a > 0', ctx)).toBeNull();
    expect(calcular('falta > 0 || a < 0', ctx)).toBeNull();
  });
  it('erros em português, com posição', () => {
    for (const [f, trecho] of [['1 +', 'termina'], ['1 $ 2', 'caractere'], ['(1 + 2', 'esperava'], ['foo(1)', 'desconhecida'], ['min(1)', 'pelo menos 2'], ['abs(1, 2)', '1 argumento'], ['1 2', 'sobrou'], ['', 'vazia']] as const) {
      expect(() => analisar(f), f).toThrow(ErroExpressao);
      expect(() => analisar(f), f).toThrow(new RegExp(trecho));
    }
  });
  it('não executa código: só o que a gramática aceita', () => {
    for (const f of ['process.exit()', 'constructor', 'a.b', '__proto__ + 1', 'eval("1")', '`x`']) {
      try { const v = calcular(f, ctx); expect(v === null || typeof v !== 'function').toBe(true); } catch (e) { expect(e).toBeInstanceOf(ErroExpressao); }
    }
    expect(calcular('__proto__ + 1', {})).toBeNull();
    expect(calcular('constructor', {})).toBeNull();
  });
  it('lista as variáveis usadas', () => {
    expect([...variaveisUsadas(analisar('se(a > b, max(c, 1), d * 2)'))].sort()).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('hipóteses no pack', () => {
  const base = { id: 'x', nome: 'X', versao: '1.0.0', funis: [{ chave: 'f', nome: 'F', principal: true, etapas: [{ chave: 'lead', nome: 'Lead', papel: 'lead' }, { chave: 'g', nome: 'G', papel: 'ganho' }, { chave: 'p', nome: 'P', papel: 'perdido' }] }], atividades: [{ chave: 't', nome: 'T', papel: 'tentativa', metaDiaria: true }] };
  const com = (hipoteses: unknown[]) => resolverPack('x', { x: { ...base, hipoteses } });
  it('aceita fórmulas válidas e recusa variável inexistente ou fórmula quebrada', () => {
    expect(com([{ chave: 'h', titulo: 'H', quando: 'vendas > 0', impacto: 'receita * 0.1', acao: 'agir' }]).ok).toBe(true);
    const ruim = com([{ chave: 'h', titulo: 'H', quando: 'vendass > 0', acao: 'a' }, { chave: 'i', titulo: 'I', quando: 'vendas >', acao: 'a' }]);
    expect(ruim.ok).toBe(false);
    expect(ruim.erros.join('\n')).toMatch(/hipoteses\[h\]\.quando: a variável "vendass" não existe/);
    expect(ruim.erros.join('\n')).toMatch(/hipoteses\[i\]\.quando: a fórmula termina/);
  });
  it('herança mescla pela chave e "remover" tira a hipótese herdada', () => {
    const cat = {
      pai: { ...base, id: 'pai', hipoteses: [{ chave: 'a', titulo: 'A', quando: 'vendas > 0', acao: 'x' }, { chave: 'b', titulo: 'B', quando: 'vendas > 1', acao: 'y' }] },
      filho: { id: 'filho', versao: '1.0.0', herda: 'pai', hipoteses: [{ chave: 'a', quando: 'vendas > 5' }, { chave: 'b', remover: true }, { chave: 'c', titulo: 'C', quando: 'leads > 0', acao: 'z' }] },
    };
    const r = resolverPack('filho', cat);
    expect(r.ok).toBe(true);
    expect(r.pack!.hipoteses.map(h => [h.chave, h.quando])).toEqual([['a', 'vendas > 5'], ['c', 'leads > 0']]);
  });
  it('a biblioteca do pack base é válida e usa só variáveis do catálogo', () => {
    const base = JSON.parse(require('node:fs').readFileSync(require('node:path').join(import.meta.dirname, '../../../packs/base.json'), 'utf8'));
    const r = resolverPack('base', { base });
    expect(r.ok, r.erros.join('; ')).toBe(true);
    expect(r.pack!.hipoteses.length).toBeGreaterThanOrEqual(8);
    expect(Object.keys(VARIAVEIS).length).toBeGreaterThan(30);
  });
});
