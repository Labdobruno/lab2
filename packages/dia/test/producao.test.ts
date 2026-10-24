import { describe, expect, it } from 'vitest';
import { type DiaProducao, type DiaSemana, distribuirInteiros, dividirMaiorResto, esperadoAteAgora, linhaEsforco, metaDiaInteira, metasDiarias, minimoDiario, objetivoSemana, producaoDoCiclo, ritmoLegivel, ritualDaHora } from '../src/index.js';

describe('metas diárias inteiras (metas_dia.test da V1)', () => {
  it('22 em 5 dias = 4,4,5,4,5 (soma 22, só 4 ou 5, dia 1 = 4)', () => {
    const v = [0, 1, 2, 3, 4].map(k => metaDiaInteira(22, k, 5));
    expect(v).toEqual([4, 4, 5, 4, 5]);
  });
  it('3 em 20 dias: zeros e uns somando 3; 40 em 20 = 2 por dia; 12,6 arredonda para 13', () => {
    const a = Array.from({ length: 20 }, (_, k) => metaDiaInteira(3, k, 20));
    expect(a.every(x => x === 0 || x === 1)).toBe(true); expect(a.reduce((s, x) => s + x, 0)).toBe(3);
    expect(Array.from({ length: 20 }, (_, k) => metaDiaInteira(40, k, 20)).every(x => x === 2)).toBe(true);
    expect(Array.from({ length: 5 }, (_, k) => metaDiaInteira(12.6, k, 5)).reduce((s, x) => s + x, 0)).toBe(13);
  });
  it('fora do intervalo, du 0 ou T vazio = 0; soma preservada para todo T ≤ 60 e du ≤ 23', () => {
    expect(metaDiaInteira(10, -1, 5)).toBe(0); expect(metaDiaInteira(10, 5, 5)).toBe(0); expect(metaDiaInteira(10, 0, 0)).toBe(0); expect(metaDiaInteira(NaN, 0, 5)).toBe(0);
    for (let T = 0; T <= 60; T++) for (let du = 1; du <= 23; du++) expect(Array.from({ length: du }, (_, k) => metaDiaInteira(T, k, du)).reduce((s, x) => s + x, 0)).toBe(T);
  });
  it('distribuirInteiros sem pesos = metaDiaInteira; com pesos a semana de peso 2 recebe o dobro', () => {
    expect(distribuirInteiros(22, undefined, 5)).toEqual([4, 4, 5, 4, 5]);
    const v = distribuirInteiros(30, [1, 1, 2, 2]);
    expect(v.reduce((s, x) => s + x, 0)).toBe(30); expect(v).toEqual([5, 5, 10, 10]);
    expect(distribuirInteiros(10, [0, 0, 0])).toEqual([3, 3, 4]);
  });
  it('maior resto: 150 mil em 50/30/20; 7 em 60/40 = 4/3; sem peso 5 = 3/2; 1 em três canais vai inteiro para um', () => {
    expect(dividirMaiorResto(150000, [50, 30, 20])).toEqual([75000, 45000, 30000]);
    expect(dividirMaiorResto(7, [60, 40])).toEqual([4, 3]);
    expect(dividirMaiorResto(5, [0, 0])).toEqual([3, 2]);
    expect(dividirMaiorResto(1, [1, 1, 1]).sort()).toEqual([0, 0, 1]);
  });
  it('metasDiarias nos dias úteis da pessoa somam a meta; mínimo diário sobe o mês, nunca desce', () => {
    const dias = ['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-09'];
    const m = metasDiarias(22, dias);
    expect(Object.values(m).reduce((s, x) => s + x, 0)).toBe(22);
    const poucas = metasDiarias(2, dias), min = minimoDiario(poucas);
    expect(Object.values(min.porDia).every(v => v >= 1)).toBe(true);
    expect(Object.values(min.porDia).reduce((s, x) => s + x, 0)).toBe(5); expect(min.extra).toBe(3);
    expect(minimoDiario({ a: 4, b: 5 })).toEqual({ porDia: { a: 4, b: 5 }, extra: 0 });
  });
});

/* producao.test da V1: a regra oficial da recuperação distribuída */
const dia = (iso: string, meta: number, feito?: number, ajuste?: number): DiaProducao => ({ iso, meta: { contatos: meta }, feito: feito == null ? {} : { contatos: feito }, ...(ajuste != null ? { ajuste: { contatos: ajuste } } : {}) });
const SEM: [string, string] = ['2026-10-05', '2026-10-11'];
describe('produção do ciclo (producao.test da V1)', () => {
  it('1. atraso acumula: meta 10/dia, seg 10, ter 5, hoje qua → a fazer 15, 5 em atraso', () => {
    const R = producaoDoCiclo({ dias: [dia('2026-10-05', 10, 10), dia('2026-10-06', 10, 5), dia('2026-10-07', 10, 0)], futuros: [{ iso: '2026-10-08', meta: { contatos: 10 } }, { iso: '2026-10-09', meta: { contatos: 10 } }], hoje: '2026-10-07', semana: SEM }).contatos!;
    expect(R).toMatchObject({ aFazerHoje: 15, atraso: 5, metaSemana: 50, feitoSemana: 15, metaHoje: 10 });
  });
  it('2. adiantou: seg 25 → ter a fazer 0 e 5 à frente', () => {
    const R = producaoDoCiclo({ dias: [dia('2026-10-05', 10, 25), dia('2026-10-06', 10, 0)], hoje: '2026-10-06', semana: SEM }).contatos!;
    expect(R).toMatchObject({ aFazerHoje: 0, adiantado: 5, atraso: 0 });
  });
  it('4. atraso passa de semana: semana nova herda 20; meta da semana só conta a semana', () => {
    const R = producaoDoCiclo({ dias: [dia('2026-09-28', 10, 0), dia('2026-09-29', 10, 0), dia('2026-09-30', 10, 10), dia('2026-10-01', 10, 10), dia('2026-10-02', 10, 10), dia('2026-10-05', 10, 0)], hoje: '2026-10-05', semana: SEM }).contatos!;
    expect(R).toMatchObject({ aFazerHoje: 30, atraso: 20, metaSemana: 10 });
  });
  it('6. sem meta: nada a fazer, temMeta false', () => {
    expect(producaoDoCiclo({ dias: [dia('2026-10-05', 0, 3)], hoje: '2026-10-05', semana: SEM }).contatos).toMatchObject({ temMeta: false, aFazerHoje: 0 });
  });
  it('7. recuperação distribuída: atraso 20, janela 5 → alvo 10 + ⌈20/5⌉ = 14; devendo no ciclo 30', () => {
    const R = producaoDoCiclo({ dias: [dia('2026-10-05', 10, 0), dia('2026-10-06', 10, 0), dia('2026-10-07', 10, 0)], hoje: '2026-10-07', semana: SEM, janela: 5 }).contatos!;
    expect(R).toMatchObject({ alvoHoje: 14, aFazerHoje: 14, recupHoje: 4, atrasoTotal: 20, atraso: 20, devendoCiclo: 30 });
    const R2 = producaoDoCiclo({ dias: [dia('2026-10-05', 10, 0), dia('2026-10-06', 10, 0), dia('2026-10-07', 10, 12)], hoje: '2026-10-07', semana: SEM, janela: 5 }).contatos!;
    expect(R2).toMatchObject({ aFazerHoje: 2, atraso: 18 });
  });
  it('8. lançamento do administrador: soma no total e nunca deixa o feito de hoje negativo', () => {
    const R = producaoDoCiclo({ dias: [dia('2026-10-12', 10, 0, 8), dia('2026-10-13', 10, 3, -5)], hoje: '2026-10-13', semana: ['2026-10-12', '2026-10-18'] }).contatos!;
    expect(R).toMatchObject({ feitoCiclo: 6, feitoHoje: 0 });
  });
  it('janela 3: ⌈10/3⌉ = 4 → alvo 14; dia sem trabalho: nada do atraso entra hoje; adiantado continua abatendo', () => {
    expect(producaoDoCiclo({ dias: [dia('2026-10-05', 10, 0), dia('2026-10-06', 10, 3)], hoje: '2026-10-06', semana: SEM, janela: 3 }).contatos!.alvoHoje).toBe(14);
    expect(producaoDoCiclo({ dias: [dia('2026-10-05', 10, 0), dia('2026-10-06', 0, 0)], hoje: '2026-10-06', semana: SEM, janela: 5, semRecup: true }).contatos).toMatchObject({ aFazerHoje: 0, atraso: 10 });
    expect(producaoDoCiclo({ dias: [dia('2026-10-05', 10, 25), dia('2026-10-06', 10, 0)], hoje: '2026-10-06', semana: SEM, janela: 5 }).contatos).toMatchObject({ aFazerHoje: 0, adiantado: 5 });
  });
  it('vários indicadores de uma vez, sem misturar', () => {
    const R = producaoDoCiclo({ dias: [{ iso: '2026-10-05', meta: { contatos: 10, reunioes: 2 }, feito: { contatos: 4 } }, { iso: '2026-10-06', meta: { contatos: 10, reunioes: 2 }, feito: { reunioes: 3 } }], hoje: '2026-10-06', semana: SEM, janela: 5 });
    expect(R.contatos).toMatchObject({ atrasoTotal: 6, recupHoje: 2, alvoHoje: 12, aFazerHoje: 12 });
    expect(R.reunioes).toMatchObject({ atrasoTotal: 2, alvoHoje: 3, aFazerHoje: 0, adiantado: 0, atraso: 1 });
  });
});

describe('semana e esforço (plano_dia.test §10 e esforco.test da V1)', () => {
  const vazio: Record<string, number> = {};
  const dias: DiaSemana[] = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'].map((iso, i) => ({ iso, util: i < 5, meta: i < 5 ? { visitas: 1, contatos: 40 } : vazio, feito: i < 2 ? { visitas: i, contatos: 30 } : vazio }));
  it('visitas: 5 na semana + 3 de atraso (janela 5 = tudo) = 8; feito 1; faltam 7 em 3 dias; contatos 200 − 20 adiantados = 180', () => {
    const W = objetivoSemana({ dias, antes: { visitas: 3, contatos: -20 }, janela: 5, hoje: '2026-10-07', indicadores: ['visitas', 'contatos'], diarias: ['contatos'] });
    expect(W.visitas).toMatchObject({ alvo: 8, feito: 1, falta: 7, restantes: 3, diario: false });
    expect(W.contatos).toMatchObject({ alvo: 180, feito: 60, diario: true });
  });
  it('janela 10 dias: na semana entra metade do atraso (5)', () => {
    expect(objetivoSemana({ dias, antes: { visitas: 10 }, janela: 10, hoje: '2026-10-05', indicadores: ['visitas'], diarias: [] }).visitas).toMatchObject({ recup: 5, alvo: 10 });
  });
  it('ritmo legível', () => {
    expect(ritmoLegivel(7 / 3)).toBe('≈ 2 por dia útil'); expect(ritmoLegivel(1)).toBe('≈ 1 por dia útil'); expect(ritmoLegivel(0.5)).toBe('≈ 1 a cada 2 dias úteis'); expect(ritmoLegivel(0)).toBe('feito'); expect(ritmoLegivel(null)).toBe('');
  });
  it('esforço: meta 100, esperado 40, feito 30 → saldo 70, progresso 30%, atrás, tendência 75; 50 → adiantado 125; sem meta', () => {
    expect(linhaEsforco({ metaTotal: 100, metaAteHoje: 40, feito: 30 })).toMatchObject({ saldo: 70, progresso: 0.3, status: 'atras', tendencia: 75 });
    expect(linhaEsforco({ metaTotal: 100, metaAteHoje: 40, feito: 50 })).toMatchObject({ status: 'adiantado', tendencia: 125 });
    expect(linhaEsforco({ metaTotal: 100, metaAteHoje: 40, feito: 40 }).status).toBe('em_dia');
    expect(linhaEsforco({ metaTotal: 0, metaAteHoje: 0, feito: 3 })).toMatchObject({ status: 'sem_meta', tendencia: null, progresso: null, saldo: 0 });
  });
});

describe('rituais: quanto de hoje conta no esperado', () => {
  const uteis = ['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06'];
  it('manhã não conta hoje; tarde conta meio dia; fim conta inteiro', () => {
    expect(esperadoAteAgora(40, uteis, '2026-10-05', 0)).toBe(20);
    expect(esperadoAteAgora(40, uteis, '2026-10-05', 0.5)).toBe(25);
    expect(esperadoAteAgora(40, uteis, '2026-10-05', 1)).toBe(30);
  });
  it('fim de semana (hoje não é útil) não conta fração; antes do ciclo é 0', () => {
    expect(esperadoAteAgora(40, uteis, '2026-10-03', 0.5)).toBe(20);
    expect(esperadoAteAgora(40, uteis, '2026-09-30', 1)).toBe(0);
  });
  it('ritual pela hora', () => { expect(ritualDaHora(9)).toBe('manha'); expect(ritualDaHora(13)).toBe('tarde'); expect(ritualDaHora(17)).toBe('fim'); });
});
