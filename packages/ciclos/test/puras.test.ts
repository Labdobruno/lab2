import { describe, expect, it } from 'vitest';
import { assinar, canonico, cenariosDoQuarter, metasDoCiclo, normalizarPesos, podeFechar, programaDeCiclos, quarterAnterior, quarterDe, ROTULO_QUARTER, taxasDoCenario } from '../src/index.js';

describe('quarter', () => {
  it('quarter civil: outubro cai no Q4 e atravessa 3 ciclos', () => {
    const q = quarterDe('2026-10-24');
    expect(q).toMatchObject({ inicio: '2026-10-01', fim: '2027-01-01' });
    expect(q.ciclos.map(c => c.inicio)).toEqual(['2026-10-01', '2026-11-01', '2026-12-01']);
    expect(ROTULO_QUARTER(q.inicio)).toBe('Q4 2026');
  });
  it('ano fiscal começando em abril e ciclo no dia 15', () => {
    const q = quarterDe('2026-10-20', 4, 15);          // abr-jun, jul-set, out-dez
    expect(q.inicio).toBe('2026-10-15');
    expect(q.fim).toBe('2027-01-15');
    expect(ROTULO_QUARTER('2026-10-15', 4)).toBe('Q3 2026');
    expect(quarterDe('2026-08-01', 4, 15).inicio).toBe('2026-07-15');
  });
  it('quarter anterior atravessa o ano', () => {
    expect(quarterAnterior('2027-01-01')).toMatchObject({ inicio: '2026-10-01', fim: '2027-01-01' });
  });
});

describe('cenários e programa', () => {
  const premissas = { taxas: { oportunidades: 0.4, reuniao_realizada: 0.5, agendamento: 0.8, contato: 0.5, tentativa: 0.25 }, ticketMedio: 10_000 };
  it('conservador exige mais esforço que otimista; ticket não muda', () => {
    const c = cenariosDoQuarter({ receita: 300_000, premissas, diasUteis: 60 });
    expect(c.base.totais.vendas).toBe(30);
    expect(c.conservador.totais.vendas).toBe(30);
    expect(c.conservador.totais.tentativa!).toBeGreaterThan(c.base.totais.tentativa!);
    expect(c.base.totais.tentativa!).toBeGreaterThan(c.otimista.totais.tentativa!);
  });
  it('taxa nunca passa de 100% e nula continua nula', () => {
    expect(taxasDoCenario({ a: 0.95, b: null } as never, 'otimista')).toEqual({ a: 1, b: null });
  });
  it('pesos: padrão pelos dias úteis, normalizados, inválidos recusados', () => {
    expect(normalizarPesos(undefined, [21, 21, 22])!.reduce((s, p) => s + p, 0)).toBeCloseTo(1);
    expect(normalizarPesos([1, 1, 2], [21, 21, 22])).toEqual([0.25, 0.25, 0.5]);
    expect(normalizarPesos([1, -1, 2], [21, 21, 22])).toBeNull();
    expect(normalizarPesos([0, 0, 0], [21, 21, 22])).toBeNull();
  });
  it('a soma das metas dos ciclos é exatamente a meta do quarter', () => {
    const p = programaDeCiclos({ receita: 100_000.01, premissas, cenario: 'base', ciclos: [{ inicio: 'a', fim: 'b', diasUteis: 21 }, { inicio: 'b', fim: 'c', diasUteis: 20 }, { inicio: 'c', fim: 'd', diasUteis: 22 }] });
    expect(p.ok).toBe(true);
    expect(Math.round(p.ciclos.reduce((s, c) => s + c.metaReceita, 0) * 100) / 100).toBe(100_000.01);
  });
  it('sem ticket, o programa não fecha e avisa', () => {
    const p = programaDeCiclos({ receita: 1000, premissas: { taxas: {}, ticketMedio: null }, cenario: 'base', ciclos: [{ inicio: 'a', fim: 'b', diasUteis: 20 }] });
    expect(p.ok).toBe(false);
    expect(p.avisos[0]).toMatch(/ticket/);
  });
  it('metas do ciclo: receita, funil e por pessoa', () => {
    const p = programaDeCiclos({ receita: 100_000, premissas, cenario: 'base', pessoas: [{ id: 's', nome: 'S', funcao: 'sdr' }, { id: 'c', nome: 'C', funcao: 'closer' }], ciclos: [{ inicio: 'a', fim: 'b', diasUteis: 20 }] });
    const m = metasDoCiclo(p.ciclos[0]!);
    expect(m[0]).toEqual({ indicador: 'receita', pessoaId: null, valor: 100_000 });
    expect(m.some(x => x.indicador === 'tentativa' && x.pessoaId === 's')).toBe(true);
    expect(m.some(x => x.indicador === 'vendas' && x.pessoaId === 'c' && x.valor === 10)).toBe(true);
  });
});

describe('retrato', () => {
  it('assinatura não depende da ordem das chaves e muda com o conteúdo', async () => {
    expect(canonico({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe('{"a":[2,{"c":2,"d":1}],"b":1}');
    expect(await assinar({ a: 1, b: 2 })).toBe(await assinar({ b: 2, a: 1 }));
    expect(await assinar({ a: 1 })).not.toBe(await assinar({ a: 2 }));
    expect(await assinar({ a: 1 })).toHaveLength(64);
  });
  it('só fecha depois do último dia útil', () => {
    const uteis = ['2026-10-29', '2026-10-30'];
    expect(podeFechar(uteis, '2026-10-30').pode).toBe(false);
    expect(podeFechar(uteis, '2026-10-31').pode).toBe(true);
    expect(podeFechar([], '2026-11-01').pode).toBe(false);
  });
});
