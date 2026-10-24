import { describe, expect, it } from 'vitest';
import { localizarDatas, noFuso } from '@lab/conectores';

describe('datas no fuso da operação', () => {
  it('data sem horário vale a meia-noite local (São Paulo, UTC−3)', () => {
    expect(noFuso('2026-07-01', 'America/Sao_Paulo')).toBe('2026-07-01T03:00:00.000Z');
    expect(noFuso('2026-12-31', 'America/Sao_Paulo')).toBe('2026-12-31T03:00:00.000Z');
  });
  it('data e hora sem fuso valem a hora local', () => {
    expect(noFuso('2026-10-15T14:03:00', 'America/Sao_Paulo')).toBe('2026-10-15T17:03:00.000Z');
    expect(noFuso('2026-10-15T14:03', 'America/Sao_Paulo')).toBe('2026-10-15T17:03:00.000Z');
  });
  it('outros fusos, inclusive à frente de UTC', () => {
    expect(noFuso('2026-07-01', 'UTC')).toBe('2026-07-01T00:00:00.000Z');
    expect(noFuso('2026-07-01', 'Asia/Tokyo')).toBe('2026-06-30T15:00:00.000Z');
  });
  it('quem já traz fuso (Z ou offset) não é mexido', () => {
    expect(noFuso('2026-10-15T14:03:00Z', 'America/Sao_Paulo')).toBe('2026-10-15T14:03:00Z');
    expect(noFuso('2026-10-15T14:03:00-03:00', 'America/Sao_Paulo')).toBe('2026-10-15T14:03:00-03:00');
    expect(noFuso('texto qualquer', 'America/Sao_Paulo')).toBe('texto qualquer');
  });
  it('só os campos de instante de um comando são convertidos', () => {
    const c = localizarDatas({ tipo: 'contrato.upsert', inicio: '2026-07-01', criadoEm: '2026-07-01', em: '2026-07-02', fechadoEm: null, nome: '2026-07-03' }, 'America/Sao_Paulo');
    expect(c).toMatchObject({ inicio: '2026-07-01', criadoEm: '2026-07-01T03:00:00.000Z', em: '2026-07-02T03:00:00.000Z', fechadoEm: null, nome: '2026-07-03' });
  });
});
