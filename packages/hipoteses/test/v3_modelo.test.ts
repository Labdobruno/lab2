/* Contrato do lab_modelo.test.js da V1: amostra, taxa ajustada, variação, condição de regra, histerese, confiança, inferência, maturidade, grafo. */
import { describe, expect, it } from 'vitest';
import { wilson } from '@lab/metricas';
import { amostra, caminhos, condicao, confianca, fmtVar, frase, histerese, INFERENCIA, maturidade, naturezaDoCaminho, taxaAjustada, variacao, type Condicao, type Medir, type Relacao } from '../src/index.js';

const DIA = 86_400_000, AGORA = Date.UTC(2026, 9, 8, 12);
const ADIT = ['leads', 'receita', 'vendas'], COORTE = ['tx_fech'];

describe('amostra, taxa ajustada e variação', () => {
  it('faixas: 9 insuficiente, 10 limitada, 30 relevante, 100 robusta; ajustáveis', () => {
    expect(amostra(9)).toMatchObject({ k: 'insuficiente', avalia: false }); expect(amostra(10).k).toBe('limitada'); expect(amostra(30)).toMatchObject({ k: 'relevante', ok: true }); expect(amostra(100).k).toBe('robusta');
    expect(amostra(15, { insuf: 20 }).k).toBe('insuficiente');
  });
  it('taxa ajustada (1+2)/(2+10) = 25% e converge com n grande', () => { expect(taxaAjustada(1, 2, 0.2, 10)).toBeCloseTo(0.25); expect(taxaAjustada(50, 100, 0.2, 10)).toBeCloseTo(52 / 110); });
  it('Wilson 1/2 ≈ 9%–91%; 50/100 ≈ 40%–60%', () => { const w = wilson(1, 2)!; expect(w.baixo).toBeLessThan(0.1); expect(w.alto).toBeGreaterThan(0.9); const w2 = wilson(50, 100)!; expect(w2.baixo).toBeGreaterThan(0.39); expect(w2.alto).toBeLessThan(0.61); });
  it('% em p.p., valor em % relativo, base negativa segue a direção', () => {
    expect(fmtVar(variacao(0.15, 0.24, '%'))).toBe('−9 p.p.'); expect(fmtVar(variacao(128, 100, 'R$'))).toBe('+28%');
    const v = variacao(-134000, -30000, 'R$')!; expect(v.delta).toBeLessThan(-340); expect(fmtVar(v).startsWith('−')).toBe(true);
  });
});

describe('condição de regra (seis parâmetros)', () => {
  const cond: Condicao = { met: 'desconto_medio', op: 'AUMENTOU', janela: 30, base: 'media90', limiar: 2, banda: 1, amostraMin: 20, histerese: { folga: 1, dias: 14 } };
  const medir = (atual: number, base: number, nA: number, nB: number): Medir => (a, b) => (b === AGORA ? { v: atual, n: nA, estado: 'ok' } : { v: base, n: nB, estado: 'ok' });
  it('7% → 10% = verdadeiro; +1 p.p. na banda = estável; +1,5 p.p. = indefinido; amostra pequena = insuficiente; sem dado = ausente', () => {
    let r = condicao(cond, medir(0.1, 0.07, 25, 60), '%', AGORA); expect(r).toMatchObject({ estado: 'verdadeiro', mov: 'aumentou' }); expect(r.delta).toBeCloseTo(3);
    r = condicao(cond, medir(0.08, 0.07, 25, 60), '%', AGORA); expect(r).toMatchObject({ estado: 'falso', mov: 'estavel' });
    r = condicao(cond, medir(0.085, 0.07, 25, 60), '%', AGORA); expect(r).toMatchObject({ estado: 'falso', mov: 'indefinido' });
    expect(condicao(cond, medir(0.1, 0.07, 12, 60), '%', AGORA).estado).toBe('insuficiente');
    expect(condicao(cond, () => ({ estado: 'ausente', nota: 'sem dado' }), '%', AGORA).estado).toBe('ausente');
  });
  it('receita +30% relativo; margem −4 p.p.; ABAIXO da referência', () => {
    let r = condicao({ met: 'receita', op: 'AUMENTOU', janela: 30, base: 'anterior', limiar: 10 }, medir(130000, 100000, 8, 7), 'R$', AGORA, { aditivas: [] }); expect(r).toMatchObject({ estado: 'verdadeiro', un: '%' }); expect(r.delta).toBeCloseTo(30);
    r = condicao({ met: 'margem_contrib', op: 'DIMINUIU', janela: 30, base: 'anterior', limiar: 2 }, medir(0.2, 0.24, 30, 30), '%', AGORA); expect(r.estado).toBe('verdadeiro'); expect(r.texto!.startsWith('−4 p.p.')).toBe(true);
    expect(condicao({ met: 'tx_fech', op: 'ABAIXO', janela: 30, ref: 0.2 }, () => ({ v: 0.15, n: 40, estado: 'ok' }), '%', AGORA).estado).toBe('verdadeiro');
  });
  it('aditivas: base de 90 dias reduzida à janela (130 contra 100/30 d = +30%, não −57%); taxa não é escalada; coorte termina 30 d antes', () => {
    const dur = (a: number, b: number) => Math.round((b - a) / DIA);
    const medirDur = (atual30: number, base30: number): Medir => (a, b) => ({ v: b === AGORA ? atual30 : (base30 * dur(a, b)) / 30, n: 40, estado: 'ok' });
    let r = condicao({ met: 'leads', op: 'AUMENTOU', janela: 30, base: 'media90', limiar: 10, banda: 3, amostraMin: 5 }, medirDur(130, 100), 'n', AGORA, { aditivas: ADIT }); expect(r.estado).toBe('verdadeiro'); expect(r.delta).toBeCloseTo(30);
    expect(condicao({ met: 'leads', op: 'ESTAVEL', janela: 30, base: 'media90', limiar: 10, banda: 3, amostraMin: 5 }, medirDur(101, 100), 'n', AGORA, { aditivas: ADIT }).estado).toBe('verdadeiro');
    r = condicao({ met: 'desconto_medio', op: 'AUMENTOU', janela: 30, base: 'media90', limiar: 2, banda: 1, amostraMin: 5 }, (a, b) => ({ v: b === AGORA ? 0.09 : 0.04, n: 40, estado: 'ok' }), '%', AGORA); expect(r.estado).toBe('verdadeiro'); expect(r.delta).toBeCloseTo(5);
    let visto: [number, number] | null = null;
    condicao({ met: 'tx_fech', op: 'DIMINUIU', janela: 30, base: 'media90', limiar: 5, banda: 2, amostraMin: 5 }, (a, b) => { if (!visto) visto = [dur(a, b), Math.round((AGORA - b) / DIA)]; return { v: 0.2, n: 40, estado: 'ok' }; }, '%', AGORA, { coorte: COORTE });
    expect(visto).toEqual([30, 30]);
  });
  it('ESTAVEL pela banda antes de tudo; limiar 0 sem variação não dispara; base 0 → negativo não é "aumentou"; NaN é ausente', () => {
    expect(condicao({ met: 'custo_var_venda', op: 'ESTAVEL', janela: 30, base: 'anterior', limiar: 2, banda: 2, amostraMin: 5 }, (a, b) => ({ v: b === AGORA ? 0.62 : 0.6, n: 40, estado: 'ok' }), '%', AGORA).estado).toBe('verdadeiro');
    expect(condicao({ met: 'x', op: 'AUMENTOU', janela: 30, base: 'anterior', limiar: 0, banda: 0, amostraMin: 0 }, () => ({ v: 100, n: 10, estado: 'ok' }), 'n', AGORA).estado).toBe('falso');
    const r = condicao({ met: 'caixa_oper', op: 'AUMENTOU', janela: 30, base: 'anterior', limiar: 10, banda: 3, amostraMin: 0 }, (a, b) => ({ v: b === AGORA ? -5000 : 0, n: 10, estado: 'ok' }), 'R$', AGORA, { aditivas: [] }); expect(r.estado).toBe('falso'); expect(r.delta).toBe(-Infinity);
    expect(condicao({ met: 'x', op: 'AUMENTOU', janela: 30, base: 'anterior', limiar: 5, banda: 1, amostraMin: 0 }, (a, b) => ({ v: b === AGORA ? NaN : 10, n: 10, estado: 'ok' }), 'n', AGORA).estado).toBe('ausente');
  });
});

describe('histerese', () => {
  const cond = { limiar: 2, histerese: { folga: 1, dias: 14, intervalo: 14 } };
  it('liga, segura com folga, zera sem folga, desliga após 14 dias, não religa antes do intervalo', () => {
    let st = histerese(null, { estado: 'verdadeiro', delta: 3 }, cond, AGORA); expect(st).toMatchObject({ ligada: true, desde: AGORA });
    st = histerese(st, { estado: 'falso', delta: 0.5 }, cond, AGORA + DIA); expect(st.ligada).toBe(true); expect(st.abaixoDesde).toBe(AGORA + DIA);
    st = histerese(st, { estado: 'falso', delta: 1.5 }, cond, AGORA + 3 * DIA); expect(st.ligada).toBe(true); expect(st.abaixoDesde).toBeNull();
    st = histerese(st, { estado: 'falso', delta: 0.2 }, cond, AGORA + 5 * DIA); st = histerese(st, { estado: 'falso', delta: 0.2 }, cond, AGORA + 20 * DIA); expect(st.ligada).toBe(false); expect(st.desligouEm).toBe(AGORA + 20 * DIA);
    st = histerese(st, { estado: 'verdadeiro', delta: 3 }, cond, AGORA + 25 * DIA); expect(st.ligada).toBe(false);
    st = histerese(st, { estado: 'verdadeiro', delta: 3 }, cond, AGORA + 40 * DIA); expect(st.ligada).toBe(true);
  });
});

describe('confiança, inferência, maturidade e grafo', () => {
  it('rubrica de confiança', () => {
    expect(confianca({ completo: true, n: 50, aderencia: 1, rivais: 0, contra: false, historico: true }).nivel).toBe('alta');
    expect(confianca({ completo: true, n: 50, aderencia: 1, rivais: 0, historico: false }).nivel).toBe('media');
    expect(confianca({ completo: true, n: 50, aderencia: 1, rivais: 1, historico: true }).nivel).toBe('media');
    expect(confianca({ completo: false, n: 50, aderencia: 1 }).nivel).toBe('baixa'); expect(confianca({ completo: true, n: 15, aderencia: 1, historico: true }).nivel).toBe('baixa'); expect(confianca({ completo: true, n: 50, aderencia: 1, contra: true, historico: true }).nivel).toBe('baixa');
    expect(confianca({ completo: true, n: 5 }).nivel).toBe('nao'); expect(confianca({ completo: false, n: 50, essencialAusente: true }).nivel).toBe('nao');
    expect(confianca({ completo: true, n: 50, aderencia: 1, rivais: 1, historico: false }).subir.length).toBe(2);
  });
  it('a linguagem trava o verbo', () => { expect(frase('observado', 'X', 'Y')).toBe('X ocorreu junto com Y'); expect((INFERENCIA.observado.permite as readonly string[]).includes('provocou')).toBe(false); expect((INFERENCIA.evidencia.permite as readonly string[]).includes('produziu')).toBe(true); });
  it('maturidade 0–4', () => { expect(maturidade({}).nivel).toBe(0); expect(maturidade({ funil: true })).toMatchObject({ nivel: 1 }); expect(maturidade({ funil: true, financeiro: true }).nivel).toBe(2); expect(maturidade({ funil: true, financeiro: true, operacao: true, intervencoes: true })).toMatchObject({ nivel: 4, falta: null }); });
  it('caminhos no grafo e a natureza do elo mais fraco', () => {
    const REL: Relacao[] = [{ id: 'a', tipo: 'causal', de: 'vendas', para: 'recebiveis', natureza: 'operacional', mecanismo: '', atraso: 0, origem: 'u' }, { id: 'b', tipo: 'causal', de: 'recebiveis', para: 'recebido', natureza: 'operacional', mecanismo: '', atraso: 0, origem: 'u' }, { id: 'c', tipo: 'causal', de: 'vendas', para: 'pago', natureza: 'matematica', mecanismo: '', atraso: 0, origem: 'u' }, { id: 'd', tipo: 'causal', de: 'pago', para: 'exposicao', natureza: 'matematica', mecanismo: '', atraso: 0, origem: 'u' }, { id: 'e', tipo: 'contextual', de: 'tx_agenda', para: 'tx_fech', natureza: 'hipotese', mecanismo: '', atraso: 0, origem: 'u' }, { id: 'f', tipo: 'causal', de: 'exposicao', para: 'saldo', natureza: 'matematica', mecanismo: '', atraso: 0, origem: 'u' }];
    const ps = caminhos(REL, 'vendas', 'saldo', 5); expect(ps.length).toBe(1); expect(ps[0]!.length).toBe(3);
    expect(naturezaDoCaminho(ps[0]!)).toBe('matematica'); expect(naturezaDoCaminho([REL[0]!, REL[4]!])).toBe('hipotese');
    expect(caminhos(REL, 'saldo', 'vendas').length).toBe(0);
  });
});
