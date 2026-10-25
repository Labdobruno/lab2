/* Pessoas: benchmark, receita potencial, gargalos, sensibilidade, alertas, matriz, transferência, drill-down, leads, meta reversa. */
import { describe, expect, it } from 'vitest';
import { alertas, calcularPessoas, drillCompleto, gargalos, leadsDaEtapa, matriz, metaReversa, mediana, pontosFortes, potencial, quantil, receitaFormula, sensibilidade, transferencia, type Encerrado, type NegocioPessoa } from '../src/index.js';

const DIA = 86_400_000, AGORA = Date.UTC(2026, 9, 8, 12), E = ['Lead', 'Reunião', 'Proposta', 'Venda'];
let seq = 0;
const neg = (pessoa: string, alcance: number, status: NegocioPessoa['status'], valor: number | null, canal = 'trafego', criadoEm = AGORA - 40 * DIA): NegocioPessoa => ({ id: 'n' + ++seq, nome: 'Lead ' + seq, pessoa, canal, criadoEm, fechadoEm: status === 'aberto' ? null : criadoEm + 20 * DIA, status, alcance, entrouEm: E.map((_, i) => (i <= alcance ? criadoEm + i * 5 * DIA : null)), valor });
/* Ana 20/10/6/3 (R$ 20 mil); Bia 20/15/8/2 (R$ 24 mil); Caio 10/8/6/3 (R$ 20 mil) */
const bloco = (p: string, N: number[], valor: number) => { const out: NegocioPessoa[] = []; for (let i = 0; i < N[0]!; i++) { const al = i < N[3]! ? 3 : i < N[2]! ? 2 : i < N[1]! ? 1 : 0; out.push(neg(p, al, al === 3 ? 'ganho' : i % 2 ? 'perdido' : 'aberto', al === 3 ? valor : null, i % 3 ? 'trafego' : 'indicacao')); } return out; };
const COORTE = [...bloco('Ana', [20, 10, 6, 3], 20000), ...bloco('Bia', [20, 15, 8, 2], 24000), ...bloco('Caio', [10, 8, 6, 3], 20000)];
const X = calcularPessoas(COORTE, E, 5);

describe('funil por pessoa e benchmark', () => {
  it('mediana e quantil interpolado', () => { expect(mediana([3, 1, 2])).toBe(2); expect(mediana([1, 2, 3, 4])).toBe(2.5); expect(quantil([0.5, 0.8, 0.8], 0.75)).toBeCloseTo(0.8); expect(quantil([1, 2, 3, 4], 0.75)).toBeCloseTo(3.25); expect(mediana([])).toBeNull(); });
  it('volumes, conversões, ticket, total e benchmark por etapa (p75 e mediana de quem tem n ≥ minN)', () => {
    expect(X.vends).toEqual(['Ana', 'Bia', 'Caio']); const A = X.porV['Ana']!;
    expect(A.N).toEqual([20, 10, 6, 3]); expect(A.conv).toEqual([0.5, 0.6, 0.5]); expect(A.ticket).toBe(20000); expect(A.receita).toBe(60000); expect(A.total).toBeCloseTo(0.15); expect(A.ciclo).toBe(20);
    expect(X.equipe.N).toEqual([50, 33, 20, 8]); expect(X.bench[0]).toMatchObject({ mediana: 0.75, n: 3 }); expect(X.bench[0]!.p75).toBeCloseTo(0.775); expect(X.bench[1]!.p75).toBeCloseTo(0.675); expect(X.bench[2]!.p75).toBeCloseTo(0.5); expect(X.ticketMediano).toBe(20000);
    expect(calcularPessoas(COORTE, E, 12).bench[0]!.n).toBe(2);   // Caio (10 leads) fica fora do benchmark com minN 12
  });
  it('receita potencial: efeito isolado por etapa, só quando abaixo do quartil superior', () => {
    expect(receitaFormula(20, [0.5, 0.6, 0.5], 20000)).toBe(60000);
    const P = potencial(X.porV['Ana']!, X.bench, X.ticketMediano); expect(P[0]!.ganho).toBeCloseTo(33000); expect(P[1]!.ganho).toBeCloseTo(7500); expect(P[2]!.ganho).toBe(0); expect(P[0]).toMatchObject({ de: 0.5, para: 0.775 });
    const G = gargalos(X); expect(G.map(g => g.i)).toEqual([2, 0, 1]); expect(G[0]!.total).toBeCloseTo(48000); const G0 = G.find(g => g.i === 0)!; expect(G0.total).toBeCloseTo(34600); expect(G0.afetados.map(a => a.v)).toEqual(['Ana', 'Bia']);
    expect(gargalos(X, 'Ana')[0]!.total).toBeCloseTo(33000); expect(gargalos(X, 'Ana')[0]!.afetados).toEqual([]);
  });
  it('sensibilidade: +10% relativo dá o mesmo efeito em qualquer fator; a diferença está na coluna do benchmark', () => {
    const S = sensibilidade(X, X.porV['Ana']!); expect(S.base).toBe(60000); expect(S.linhas.every(l => Math.abs(l.impacto - 6000) < 1e-6)).toBe(true);
    expect(S.linhas.find(l => l.k === 't0')!.bench).toBeCloseTo(33000); expect(S.linhas.find(l => l.k === 't2')!.bench).toBeNull();
  });
});

describe('alertas, matriz, pontos fortes e transferência', () => {
  it('gargalo ≥ 10 p.p. abaixo da mediana; oportunidade 1,15× e < 0,7× do volume; anomalia 0,75×; tendência do ticket ≥ 10%', () => {
    const enc: Encerrado[] = [];
    for (let i = 0; i < 10; i++) enc.push({ pessoa: 'Ana', status: i < 3 ? 'ganho' : 'perdido', fechadoEm: AGORA - 10 * DIA, valor: 30000 });
    for (let i = 0; i < 10; i++) enc.push({ pessoa: 'Ana', status: i < 6 ? 'ganho' : 'perdido', fechadoEm: AGORA - 100 * DIA, valor: 20000 });
    for (let i = 0; i < 3; i++) enc.push({ pessoa: 'Bia', status: 'ganho', fechadoEm: AGORA - 40 * DIA, valor: 20000 });
    const A = alertas(X, enc, AGORA);
    expect(A.filter(a => a.t === 'gargalo').map(a => a.pessoa + ':' + a.i)).toEqual(['Ana:0', 'Bia:2']);
    expect(A.find(a => a.t === 'oport')).toMatchObject({ pessoa: 'Caio' });
    expect(A.find(a => a.t === 'anom')).toMatchObject({ pessoa: 'Ana' }); expect(A.find(a => a.t === 'anom')!.txt).toContain('caiu 50%');
    expect(A.find(a => a.t === 'tend')!.txt).toContain('subiu 50%');
    expect(alertas(X, [], AGORA).some(a => a.t === 'anom' || a.t === 'tend')).toBe(false);
  });
  it('matriz volume × eficiência nas medianas, com hipótese por quadrante', () => {
    const M = matriz(X); expect(M.mX).toBe(20); expect(M.mY).toBeCloseTo(0.15);
    expect(M.pts.find(p => p.v === 'Bia')!.quadrante).toBe('alto volume · baixa eficiência'); expect(M.pts.find(p => p.v === 'Caio')!.quadrante).toBe('baixo volume · alta eficiência'); expect(M.pts.find(p => p.v === 'Ana')!.hipotese).toContain('documentar');
  });
  it('pontos fortes', () => { const F = pontosFortes(X, 'Caio'); expect(F.some(x => x.startsWith('Lead → Reunião'))).toBe(true); expect(pontosFortes(X, 'Bia').some(x => x.startsWith('Ticket 20%'))).toBe(true); });
  it('transferência: Ana com a conversão de Caio; combinação; fontes mediana e quartil superior', () => {
    const T = transferencia(X, 'Ana', 'Caio', ['t0', 't1', 't2'])!; expect(T.base).toBe(60000);
    expect(T.linhas.find(l => l.k === 't0')).toMatchObject({ de: 0.5, para: 0.8 }); expect(T.linhas.find(l => l.k === 't0')!.incremento).toBeCloseTo(36000);
    expect(T.combinacao.receita).toBeCloseTo(120000); expect(T.linhas.find(l => l.k === 'vol')!.receita).toBeCloseTo(30000);
    expect(transferencia(X, 'Ana', 'p75')!.linhas.find(l => l.k === 't1')!.para).toBeCloseTo(0.675); expect(transferencia(X, 'Ana', 'ninguem')).toBeNull();
  });
});

describe('drill-down, leads e meta reversa', () => {
  it('drill por pessoa, canal, mês e segmento com IC de Wilson', () => {
    const D = drillCompleto(X, 0); expect(D).toMatchObject({ de: 'Lead', para: 'Reunião', n: 50 }); expect(D.potencial).toBeCloseTo(34600);
    const ana = D.grupos.pessoa!.find(l => l.chave === 'Ana')!; expect(ana).toMatchObject({ n: 20, avancaram: 10, conv: 0.5 }); expect(ana.ic!.baixo).toBeLessThan(0.5);
    expect(D.grupos.canal.map(l => l.chave)).toEqual(['indicacao', 'trafego']); expect(D.grupos.mes[0]!.chave).toBe('2026-08'); expect(D.grupos.segmento[0]!.chave).toBe('—');
    expect(drillCompleto(X, 1, 'Ana').grupos.pessoa).toBeUndefined();
  });
  it('leads por trás de um número', () => { const L = leadsDaEtapa(X.porV['Ana']!, 1); expect(L.total).toBe(10); expect(L.leads[0]!.alcance).toBe(3); expect(L.leads.every(l => l.chegouEm != null)).toBe(true); });
  it('meta reversa arredonda para cima em cada etapa', () => {
    const R = metaReversa(X.porV['Ana']!, 100000, X.ticketMediano)!; expect(R.vendas).toBe(5); expect(R.necessarios.map(n => n.necessario)).toEqual([34, 17, 10, 5]); expect(R.necessarios[0]!.faltam).toBe(14);
    expect(metaReversa(X.porV['Ana']!, 0, null)).toBeNull();
  });
});
