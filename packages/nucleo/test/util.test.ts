import { describe, expect, it } from 'vitest';
import { chaveDe, lerData, lerNumero } from '@lab/nucleo';

describe('lerNumero', () => {
  it.each([
    ['1.234,56', 1234.56], ['1234.56', 1234.56], ['R$ 18.500,50', 18500.5], ['1.234', 1234],
    ['1,234.5', 1234.5], ['12%', 0.12], ['6,5%', 0.065], ['', null], ['abc', null], [42, 42],
  ])('%s → %s', (e, s) => expect(lerNumero(e)).toBe(s));
});

describe('lerData', () => {
  it.each([
    ['15/10/2026', '2026-10-15'], ['5/1/26', '2026-01-05'], ['15/10/2026 14:03', '2026-10-15T14:03:00'],
    ['2026-10-15', '2026-10-15'], ['2026-10-15T14:03:12.000Z', '2026-10-15T14:03:12.000Z'],
    ['31/02/2026', null], ['', null], ['ontem', null],
  ])('%s → %s', (e, s) => expect(lerData(e)).toBe(s));
});

it('chaveDe', () => {
  expect(chaveDe('Tráfego Pago')).toBe('trafego_pago');
  expect(chaveDe('  Indicação / Parceiro ')).toBe('indicacao_parceiro');
});
