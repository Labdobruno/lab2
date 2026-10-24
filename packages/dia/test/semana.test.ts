/* Contrato: smJulgar (lab_semana.js) e psRitmo/psProjetar/psFracaoDia (lab_projsemana.js; ui/lab_projsemana.mjs) da V1. */
import { describe, expect, it } from 'vitest';
import { cascataReceita, fracaoDoDia, julgarSemana, metaDaSemana, projetarSemana, ritmoSemana, variacao } from '../src/semana.js';

const perto = (a: number | null | undefined, b: number, e = 1e-9) => a != null && Math.abs(a - b) <= e;

describe('semana passada: julgamento', () => {
  it('meta pesa primeiro: ≥ 100% bom; < 85% ruim; entre, cai para a base', () => {
    expect(julgarSemana({ atual: 10, base: 5, meta: 10, un: 'n', aditiva: true }).st).toBe('bom');
    expect(julgarSemana({ atual: 8, base: 20, meta: 10, un: 'n', aditiva: true })).toMatchObject({ st: 'ruim', motivo: 'abaixo de 85% da meta da semana' });
    expect(julgarSemana({ atual: 9, base: 9, meta: 10, un: 'n', aditiva: true }).st).toBe('neutro');   // 90% da meta e igual à base
    expect(julgarSemana({ atual: 9, base: 5, meta: 10, un: 'n', aditiva: true }).st).toBe('bom');      // 90% da meta, +80% contra a base
  });
  it('sem meta: variação contra a base com limiares 15% / 5 p.p. / 20%; volume pequeno e amostra pequena são neutros; menor é melhor', () => {
    expect(julgarSemana({ atual: 12, base: 10, un: 'n', aditiva: true }).st).toBe('bom');        // +20% ≥ 15%
    expect(julgarSemana({ atual: 11, base: 10, un: 'n', aditiva: true }).st).toBe('neutro');
    expect(julgarSemana({ atual: 8, base: 10, un: 'n', aditiva: true })).toMatchObject({ st: 'ruim' });
    expect(julgarSemana({ atual: 0.3, base: 0.24, un: '%', aditiva: false, n: 20 }).st).toBe('bom');
    expect(julgarSemana({ atual: 0.3, base: 0.27, un: '%', aditiva: false, n: 20 }).st).toBe('neutro');
    expect(julgarSemana({ atual: 0.3, base: 0.1, un: '%', aditiva: false, n: 3 })).toMatchObject({ st: 'neutro', motivo: 'amostra pequena (n=3)' });
    expect(julgarSemana({ atual: 2, base: 1, un: 'n', aditiva: true })).toMatchObject({ st: 'neutro', motivo: 'volume pequeno para concluir' });
    expect(julgarSemana({ atual: 10, base: 5, un: 'h', aditiva: false, menorMelhor: true }).st).toBe('ruim');
    expect(julgarSemana({ atual: 5, base: 10, un: 'h', aditiva: false, menorMelhor: true }).st).toBe('bom');
    expect(julgarSemana({ atual: null, base: 10, un: 'n', aditiva: true }).st).toBe('sem');
    expect(julgarSemana({ atual: 10, base: null, un: 'n', aditiva: true }).st).toBe('neutro');
  });
  it('variação e cascata da receita', () => {
    expect(variacao(0.3, 0.25, '%')!.d).toBeCloseTo(5); expect(variacao(0.3, 0.25, '%')!.pp).toBe(true); expect(variacao(12, 10, 'n')!.d).toBeCloseTo(20); expect(variacao(1, 0, 'n')).toBeNull();
    const W = cascataReceita(10, 1000, 8, 1200); expect(W).toMatchObject({ volume: -2000, ticket: 1600, total: -400 });
  });
});

describe('esta semana: projeção', () => {
  it('ritmo encolhido para o histórico (que pesa como 5 dias úteis)', () => {
    expect(ritmoSemana(1, 2.5, 2)).toBeCloseTo((1 + 2 * 5) / 7.5, 12);
    expect(ritmoSemana(4, 2, null)).toBe(2); expect(ritmoSemana(0, 0, 3)).toBe(3); expect(ritmoSemana(0, 0, null)).toBeNull();
  });
  it('quarta 13h: 2,5 dias passados e 2,5 pela frente; projeção, faixa e situação', () => {
    const h = 0.8, P = projetarSemana({ feito: 1, decorridos: 2.5, restantes: 2.5, ritmoHist: h, ritmos: [0.5, 1, 0.6, 1.2], meta: 4 });
    expect(perto(P.proj, 1 + ((1 + h * 5) / 7.5) * 2.5)).toBe(true);
    expect(P.lo! <= P.proj! && P.proj! <= P.hi!).toBe(true);
    expect(P.st).toBe('nao'); expect(perto(P.precisa, 3 / 2.5)).toBe(true);
    expect(projetarSemana({ feito: 5, decorridos: 2.5, restantes: 2.5, ritmoHist: 1, meta: 4 }).st).toBe('batida');
    expect(projetarSemana({ feito: 2, decorridos: 2.5, restantes: 2.5, ritmoHist: 1, meta: 4 }).st).toBe('bate');
    expect(projetarSemana({ feito: 2, decorridos: 2.5, restantes: 2.5, ritmoHist: 0.5, meta: 4 }).st).toBe('risco');   // ritmo (2 + 2,5) ÷ 7,5 = 0,6 → 3,5 = 87,5%
    expect(projetarSemana({ feito: 1, decorridos: 2.5, restantes: 2.5, ritmoHist: 1 }).st).toBe('sem');
  });
  it('fração do dia e meta da semana', () => {
    expect(fracaoDoDia(13)).toBe(0.5); expect(fracaoDoDia(7)).toBe(0); expect(fracaoDoDia(19)).toBe(1); expect(fracaoDoDia(9, 30)).toBeCloseTo(0.15);
    expect(metaDaSemana(20, 21, 5)).toBeCloseTo(20 * 5 / 21); expect(metaDaSemana(null, 21, 5)).toBeNull(); expect(metaDaSemana(20, 0, 5)).toBeNull();
  });
});
