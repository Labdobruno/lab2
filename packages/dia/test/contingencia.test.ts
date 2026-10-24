/* Contrato: testes/contingencia.test.js da V1, com os mesmos números. */
import { describe, expect, it } from 'vitest';
import { acoesContingencia, cfgContingencia, nivelDaRazao, nivelDoEsforco, nomeNivel, pessoaContingencia, placar, resumoContingencia, trajetoria } from '../src/contingencia.js';

const perto = (a: number | null | undefined, b: number, e = 1e-6) => a != null && Math.abs(a - b) < e;

describe('contingência: a régua 100 / 90 / 75', () => {
  it('níveis pela razão e pelo esforço; configuração do gestor', () => {
    expect([nivelDaRazao(1), nivelDaRazao(1.3)]).toEqual([0, 0]);
    expect([nivelDaRazao(0.999), nivelDaRazao(0.9)]).toEqual([1, 1]);
    expect([nivelDaRazao(0.899), nivelDaRazao(0.75)]).toEqual([2, 2]);
    expect([nivelDaRazao(0.749), nivelDaRazao(0)]).toEqual([3, 3]);
    expect([nivelDaRazao(null), nivelDaRazao(NaN)]).toEqual([null, null]);
    expect([nivelDoEsforco(1.1), nivelDoEsforco(1.2), nivelDoEsforco(1.5), nivelDoEsforco(2)]).toEqual([0, 1, 2, 3]);
    expect(cfgContingencia({ contingencia: 0.8, critico: -1, esforco: [1, 2] }).contingencia).toBe(0.8);
    expect(cfgContingencia({ critico: -1 }).critico).toBe(0.75);
    expect(cfgContingencia({ esforco: [1, 2] }).esforco[2]).toBe(2);
    expect([nomeNivel(2), nomeNivel(null)]).toEqual(['Contingência', 'Sem dado']);
  });
});

describe('contingência: placar de uma meta do ciclo', () => {
  it('R$ 400.000, 10 de 20 dias úteis, R$ 150.000 fechados → contingência por 3 motivos', () => {
    const P = placar({ nome: 'Receita fechada no ciclo', de: 'da Amicta', meta: 400000, real: 150000, esperado: 200000, proj: 300000, dd: 10, diasRest: 10 });
    expect(perto(P.falta, 250000) && P.diasRest === 10 && perto(P.ritmoNec, 25000)).toBe(true);
    expect(perto(P.ritmoAtual, 15000) && perto(P.fator, 25000 / 15000)).toBe(true);
    expect([P.nivel, P.st, P.motivos.length]).toEqual([2, 'contingencia', 3]);
    expect(P.motivos.every(m => /Receita fechada no ciclo da Amicta|projeção ajustada|Para bater a meta/.test(m.txt))).toBe(true);
  });
  it('casos de borda', () => {
    expect(placar({ nome: 'Receita fechada no ciclo', meta: 400000, real: 150000, esperado: 200000, proj: 200000, dd: 10, diasRest: 10 })).toMatchObject({ nivel: 3, st: 'critico' });
    expect(placar({ nome: 'Vendas', meta: 20, real: 11, esperado: 10, proj: 22, dd: 10, diasRest: 10 })).toMatchObject({ nivel: 0, st: 'no_ritmo' });
    expect(placar({ nome: 'Vendas', meta: 20, real: 21, esperado: 10, dd: 10, diasRest: 10 })).toMatchObject({ st: 'batida', nivel: 0, falta: 0 });
    const enc = placar({ nome: 'Vendas', de: 'da Amicta', meta: 20, real: 15, esperado: 20, dd: 20, diasRest: 0 });
    expect(enc).toMatchObject({ nivel: 3, st: 'encerrado' }); expect(enc.motivos[0]!.txt).toMatch(/não restam dias úteis/);
    expect(placar({ nome: 'Vendas', meta: 0, real: 3 })).toMatchObject({ nivel: null, st: 'sem_dado' });
    expect(placar({ nome: 'Receita', meta: 400000, real: 5000, esperado: 20000, proj: 5000, projFragil: true, dd: 1, diasRest: 19 }).motivos.some(m => m.cod === 'projecao')).toBe(false);
    expect(placar({ nome: 'Receita', meta: 400000, real: 5000, esperado: 20000, proj: 5000, dd: 2, diasRest: 18 }).motivos.some(m => m.cod === 'projecao')).toBe(false);
    expect(placar({ nome: 'Receita', meta: 400000, real: 0, esperado: null, dd: 0.5, diasRest: 20 })).toMatchObject({ nivel: null, st: 'sem_dado' });
    expect(placar({ nome: 'Receita', meta: 100, real: 95, esperado: 100, dd: 10, diasRest: 10, fmt: v => 'R$ ' + Math.round(v) }).motivos[0]!.txt).toMatch(/R\$ 95 de R\$ 100/);
  });
});

describe('contingência: trajetória dia a dia', () => {
  const dias = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30'];
  it('meta 100, vendido 5 no sábado, 10, 20 e 15 hoje (quarta)', () => {
    const T = trajetoria({ dias, hoje: '2026-10-28', meta: 100, realPorDia: { '2026-10-24': 5, '2026-10-26': 10, '2026-10-27': 20, '2026-10-28': 15 } });
    expect(T.rows.map(r => r.tipo).join()).toBe('passado,passado,hoje,futuro,futuro');
    expect(T.rows.map(r => Math.round(r.esperadoAcum)).join()).toBe('20,40,60,80,100');
    expect([T.rows[0]!.realAcum, T.rows[1]!.realAcum, T.rows[2]!.realAcum]).toEqual([15, 35, 50]);
    expect(perto(T.faltaAntes, 65) && T.diasRest === 3 && perto(T.rows[2]!.alvoDia, 65 / 3) && perto(T.rows[4]!.alvoDia, 65 / 3)).toBe(true);
    expect(perto(T.rows[4]!.alvoAcum, 100) && perto(T.rows[2]!.alvoAcum, 35 + 65 / 3)).toBe(true);
    expect(perto(T.rows[1]!.desvio, -5) && perto(T.rows[1]!.razao, 35 / 40)).toBe(true);
    expect(T.rows[3]!.realAcum).toBeUndefined(); expect(T.rows[3]!.desvio).toBeUndefined();
  });
  it('meta batida antes de hoje → alvo 0; pesos do calendário; ciclo vazio', () => {
    const T = trajetoria({ dias, hoje: '2026-10-28', meta: 100, realPorDia: { '2026-10-26': 60, '2026-10-27': 50 } });
    expect([T.faltaAntes, T.rows[2]!.alvoDia, T.rows[4]!.alvoDia]).toEqual([0, 0, 0]);
    const W = trajetoria({ dias, hoje: '2026-10-28', meta: 100, realPorDia: {}, pesos: { '2026-10-26': 2, '2026-10-27': 1, '2026-10-28': 1, '2026-10-29': 1, '2026-10-30': 1 } });
    expect(perto(W.rows[0]!.metaDia, 100 * 2 / 6) && perto(W.rows[0]!.esperadoAcum, 100 * 2 / 6)).toBe(true);
    expect(trajetoria({ dias: [], hoje: '2026-10-28', meta: 100, realPorDia: {} })).toMatchObject({ rows: [], diasRest: 0 });
  });
});

describe('contingência: uma pessoa', () => {
  const et = [{ k: 'contatos', nome: 'Contatos', metaTotal: 180, metaCiclo: 140, feitoCiclo: 80, metaHoje: 20, feitoHoje: 10 }, { k: 'vendas', nome: 'Vendas', metaTotal: 6, metaCiclo: 4, feitoCiclo: 1, metaHoje: 0, feitoHoje: 0 }];
  const md = { '2026-10-28': { contatos: 20, vendas: 0 }, '2026-10-29': { contatos: 20, vendas: 1 }, '2026-10-30': { contatos: 20, vendas: 1 } };
  it('Ana: faltam 100 em 3 dias; atraso até ontem 50; alvo de hoje 20 + 50/3; crítica', () => {
    const Q = pessoaContingencia({ n: 'Ana Souza', hoje: '2026-10-28', etapas: et, dias: Object.keys(md), metaDia: md, seguidos: 0 });
    expect(Q.etapas[0]!.falta).toBe(100); expect(perto(Q.etapas[0]!.ritmoNec, 100 / 3)).toBe(true);
    expect(perto(Q.etapas[0]!.atrasoAntes, 50)).toBe(true);
    expect(perto(Q.etapas[0]!.alvos[0]!.alvo, 20 + 50 / 3) && perto(Q.etapas[0]!.alvos.reduce((a, x) => a + x.alvo, 0), 110)).toBe(true);
    expect(perto(Q.etapas[0]!.alvoHoje, 20 + 50 / 3)).toBe(true);
    expect([Q.etapas[0]!.nivel, Q.etapas[1]!.nivel, Q.nivel]).toEqual([3, 3, 3]);
    expect([Q.ativ!.k, Q.res!.k, Q.ativ!.nivel, Q.res!.nivel]).toEqual(['contatos', 'vendas', 3, 3]);
    expect(Q.motivos.some(m => /Contatos \(atividade\)/.test(m.txt)) && Q.motivos.some(m => /Vendas \(resultado\)/.test(m.txt))).toBe(true);
  });
  it('em dia; 2 dias seguidos abaixo → contingência; adiantado nunca negativo; sem meta; sem dias', () => {
    const base = [{ k: 'contatos', nome: 'Contatos', metaTotal: 200, metaCiclo: 100, feitoCiclo: 105, metaHoje: 10, feitoHoje: 5 }];
    expect(pessoaContingencia({ n: 'Pedro', hoje: '2026-10-28', etapas: [...base, { k: 'vendas', nome: 'Vendas', metaTotal: 6, metaCiclo: 3, feitoCiclo: 3, metaHoje: 0, feitoHoje: 0 }], dias: Object.keys(md), metaDia: md, seguidos: 0 })).toMatchObject({ nivel: 0, st: 'no_ritmo' });
    const S = pessoaContingencia({ n: 'Pedro', hoje: '2026-10-28', etapas: base, dias: Object.keys(md), metaDia: md, seguidos: 2 });
    expect(S.ativ).toMatchObject({ nivel: 2, porSeguidos: true }); expect(S.nivel).toBe(2); expect(S.motivos.some(m => m.cod === 'seguidos')).toBe(true);
    const A = pessoaContingencia({ n: 'Pedro', hoje: '2026-10-28', etapas: [{ k: 'contatos', nome: 'Contatos', metaTotal: 200, metaCiclo: 100, feitoCiclo: 140, metaHoje: 10, feitoHoje: 5 }], dias: Object.keys(md), metaDia: md, seguidos: 0 });
    expect(A.etapas[0]!.atrasoAntes).toBeLessThan(0); expect(A.etapas[0]!.alvos.every(a => a.alvo >= 0)).toBe(true);
    expect(pessoaContingencia({ n: 'Sem meta', hoje: '2026-10-28', etapas: [{ k: 'contatos', nome: 'Contatos', metaTotal: 0, metaCiclo: 0, feitoCiclo: 0 }], dias: Object.keys(md), metaDia: md })).toMatchObject({ nivel: null, st: 'sem_dado', etapas: [] });
    const Z = pessoaContingencia({ n: 'Ausente', hoje: '2026-10-28', etapas: et, dias: [], metaDia: {} });
    expect(Z.etapas[0]!.ritmoNec).toBeNull(); expect(Z.etapas[0]!.alvos).toEqual([]);
  });
});

describe('contingência: resumo e ações', () => {
  it('resumo por nível, com quem está sem dado', () => {
    expect(resumoContingencia([{ n: 'a', nivel: 0 }, { n: 'b', nivel: 2 }, { n: 'c', nivel: 3 }, { n: 'd', nivel: 3 }, { n: 'e', nivel: null }])).toMatchObject({ no_ritmo: 1, contingencia: 1, critico: 2, sem_dado: 1, semDado: ['e'] });
  });
  it('gatilhos: crítico decide; contingência ativa o plano; atenção nada; por pessoa', () => {
    const emp = (n: 0 | 1 | 2 | 3) => ({ receita: { nivel: n }, vendas: { nivel: n } });
    let A = acoesContingencia(emp(3), [], '2026-11-05');
    expect(A).toHaveLength(1); expect(A[0]).toMatchObject({ prio: 0 }); expect(A[0]!.titulo).toMatch(/Decidir sobre a meta/); expect(A[0]!.txt).toMatch(/05\/11/);
    A = acoesContingencia(emp(2), [], '2026-11-05'); expect(A).toHaveLength(1); expect(A[0]!.titulo).toMatch(/Ativar o plano de recuperação até 05\/11/);
    expect(acoesContingencia(emp(1), [], '2026-11-05')).toHaveLength(0);
    A = acoesContingencia(emp(0), [{ n: 'Ana', nivel: 2, ativ: { nivel: 2 }, res: { nivel: 0 } }, { n: 'Bia', nivel: 2, ativ: { nivel: 0 }, res: { nivel: 2 }, falta: 2, pipe: 3 }, { n: 'Cris', nivel: 3, ativ: { nivel: 3 }, res: { nivel: 3 }, falta: 5, pipe: 1 }, { n: 'Dani', nivel: 1, ativ: { nivel: 1 }, res: { nivel: 1 } }], '2026-11-05');
    expect(A).toHaveLength(3);
    expect(A.some(a => a.quem === 'Ana' && a.titulo === 'Atraso operacional')).toBe(true);
    expect(A.some(a => a.quem === 'Bia' && /pipeline aberto cobre/.test(a.txt))).toBe(true);
    expect(A.some(a => a.quem === 'Cris' && /abaixo do plano/.test(a.titulo))).toBe(true);
    expect(A.every(a => a.tipo === 'hip')).toBe(true);
  });
});
