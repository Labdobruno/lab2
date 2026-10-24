import { describe, expect, it } from 'vitest';
import { buildupReverso, cicloDe, contingencia, diasUteis, ehDiaUtil, esperadoAteHoje, feriadosBR, fechamentoDoDia, metaDiaInteira, statusDoRitmo } from '../src/index.js';

const cal = { feriados: 'BR' as const, diasUteis: [1, 2, 3, 4, 5], inicioCicloDia: 1 };

describe('calendário', () => {
  it('feriados móveis de 2026', () => {
    const f = feriadosBR(2026);
    expect(f).toContain('2026-02-17');   // Carnaval
    expect(f).toContain('2026-04-03');   // Sexta-feira Santa
    expect(f).toContain('2026-06-04');   // Corpus Christi
    expect(f).toContain('2026-11-20');
  });
  it('outubro de 2026 tem 21 dias úteis (22 seg-sex menos 12/10)', () => {
    expect(diasUteis('2026-10-01', '2026-11-01', cal)).toHaveLength(21);
    expect(ehDiaUtil('2026-10-12', cal)).toBe(false);
    expect(ehDiaUtil('2026-10-24', cal)).toBe(false);   // sábado
  });
  it('ciclo com início no dia 15 atravessa o mês e o ano', () => {
    expect(cicloDe('2026-10-10', 15)).toEqual({ inicio: '2026-09-15', fim: '2026-10-15' });
    expect(cicloDe('2026-01-05', 15)).toEqual({ inicio: '2025-12-15', fim: '2026-01-15' });
    expect(cicloDe('2026-12-20', 15)).toEqual({ inicio: '2026-12-15', fim: '2027-01-15' });
  });
});

describe('build-up reverso', () => {
  const taxas = { oportunidades: 0.25, reuniao_realizada: 0.5, agendamento: 0.8, contato: 0.5, tentativa: 0.25 };
  it('desce da receita até as tentativas', () => {
    const r = buildupReverso({ receita: 100_000, ticketMedio: 10_000, taxas, diasUteis: 20 });
    expect(r.totais).toEqual({ vendas: 10, oportunidades: 40, reuniao_realizada: 80, agendamento: 100, contato: 200, tentativa: 800 });
    expect(r.porDia.tentativa).toBe(40);
    expect(r.ok).toBe(true);
    expect(r.porCanal.total!.vendas).toBe(10);
  });
  it('divide por função e por canal', () => {
    const r = buildupReverso({
      receita: 100_000, ticketMedio: 10_000, taxas, diasUteis: 20, canais: { ads: 0.6, indicacao: 0.4 },
      pessoas: [{ id: 's', nome: 'Sara', funcao: 'sdr' }, { id: 'c1', nome: 'Caio', funcao: 'closer' }, { id: 'c2', nome: 'Cida', funcao: 'closer' }],
    });
    expect(r.porPessoa.find(p => p.pessoaId === 's')!.metas).toEqual({ agendamento: 100, contato: 200, tentativa: 800 });
    expect(r.porPessoa.find(p => p.pessoaId === 'c1')!.metas).toEqual({ vendas: 5, oportunidades: 20, reuniao_realizada: 40 });
    expect(r.porCanal.ads!.vendas).toBe(6);
  });
  it('taxa ausente interrompe a cadeia em vez de inventar', () => {
    const r = buildupReverso({ receita: 50_000, ticketMedio: 10_000, taxas: { oportunidades: 0.5, reuniao_realizada: null }, diasUteis: 20 });
    expect(r.ok).toBe(false);
    expect(r.totais).toEqual({ vendas: 5, oportunidades: 10 });
    expect(r.avisos[0]).toMatch(/reuniao_realizada/);
  });
  it('frações exatas na cadeia, arredondadas uma vez: não infla por degrau', () => {
    /* 95.000 ÷ 10.000 = 9,5 vendas → 38 oportunidades exatas; arredondando por degrau seriam 10 → 40 → 80 → 100 → 200 → 800 */
    const r = buildupReverso({ receita: 95_000, ticketMedio: 10_000, taxas, diasUteis: 20, pessoas: [{ id: 'a', nome: 'A', funcao: 'closer' }, { id: 'b', nome: 'B', funcao: 'closer' }, { id: 'c', nome: 'C', funcao: 'closer' }] });
    expect(r.totais).toEqual({ vendas: 10, oportunidades: 38, reuniao_realizada: 76, agendamento: 95, contato: 190, tentativa: 760 });
    expect(r.porDia).toEqual({ vendas: 1, oportunidades: 2, reuniao_realizada: 4, agendamento: 5, contato: 10, tentativa: 38 });
    expect(r.porPessoa.map(p => p.metas.vendas)).toEqual([4, 4, 4]);   // 9,5 ÷ 3 = 3,17 → 4 cada, e não ceil(10 ÷ 3) sobre um total já arredondado
  });
  it('sem ticket não calcula', () => expect(buildupReverso({ receita: 1, ticketMedio: null, taxas, diasUteis: 20 }).ok).toBe(false));
});

describe('ritmo', () => {
  const uteis = diasUteis('2026-10-01', '2026-11-01', cal);
  it('meta do dia é inteira e as parcelas somam a meta do ciclo (22 em 5 dias = 4, 4, 5, 4, 5)', () => {
    expect([0, 1, 2, 3, 4].map(k => metaDiaInteira(22, k, 5))).toEqual([4, 4, 5, 4, 5]);
    expect([0, 1, 2].map(k => metaDiaInteira(10, k, 3)).reduce((a, b) => a + b, 0)).toBe(10);   // ceil(10/3) = 4 daria 12
    expect(metaDiaInteira(5, 7, 5)).toBe(0);
    const porDia = uteis.map((_, k) => metaDiaInteira(200, k, uteis.length));
    expect(porDia.reduce((a, b) => a + b, 0)).toBe(200);
    expect(Math.max(...porDia) - Math.min(...porDia)).toBeLessThanOrEqual(1);
  });
  it('esperado é linear pelos dias úteis', () => {
    expect(esperadoAteHoje(210, uteis, '2026-10-10')).toBe(70);    // 7 dias úteis até 10/10 (1,2,5,6,7,8,9 → 7? 01,02,05,06,07,08,09)
    expect(esperadoAteHoje(210, uteis, '2026-09-30')).toBe(0);
  });
  it('status', () => {
    expect(statusDoRitmo(70, 70)).toBe('no_ritmo');
    expect(statusDoRitmo(60, 70)).toBe('atencao');
    expect(statusDoRitmo(40, 70)).toBe('atras');
    expect(statusDoRitmo(5, 0)).toBeNull();
  });
  it('contingência: quanto falta por dia e viabilidade', () => {
    const c = contingencia(210, 70, uteis, '2026-10-12');   // 12/10 é feriado: restam 14 úteis (13…30)
    expect(c.diasRestantes).toBe(14);
    expect(c.necessarioPorDia).toBe(10);
    expect(c.viavel).toBe(true);
    expect(contingencia(210, 0, uteis, '2026-10-28').viavel).toBe(false);
  });
  it('fechamento do dia: realizado, esperado, status e plano de amanhã', () => {
    const l = fechamentoDoDia({
      dia: '2026-10-02', ciclo: { inicio: '2026-10-01', fim: '2026-11-01' }, uteis,
      metas: [{ pessoaId: 'p', indicador: 'tentativa', valor: 210 }],
      realizados: [{ pessoaId: 'p', indicador: 'tentativa', dia: '2026-10-01', quantidade: 6 }, { pessoaId: 'p', indicador: 'tentativa', dia: '2026-10-02', quantidade: 4 }],
    });
    expect(l[0]).toMatchObject({ metaDoDia: 10, realizadoNoDia: 4, realizadoNoCiclo: 10, esperadoAteHoje: 20, status: 'atras' });
    expect(l[0]!.planoAmanha).toBe(Math.ceil(200 / 19));
  });
});
