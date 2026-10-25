/* Construtor "e se": números de referência calculados à mão sobre um funil linear. */
import { describe, expect, it } from 'vitest';
import { POLITICA_VAZIA, type Politica } from '@lab/economia';
import { alvoDaClausula, aplicar, atalhos, catalogo, derivar, fecharBase, frase, indicador, normalizar, opcoesMantendo, premissasDaPolitica, quantoPrecisa, sensibilidadeDoIndicador, simularESe, validarCombinacao, validarValor, valor, type Clausula, type Estado } from '../src/index.js';

const E = [{ chave: 'lead', nome: 'Lead', papel: 'lead' }, { chave: 'contato', nome: 'Contato', papel: 'contato' }, { chave: 'agendada', nome: 'Reunião agendada', papel: 'agendada' }, { chave: 'realizada', nome: 'Reunião realizada', papel: 'realizada' }, { chave: 'proposta', nome: 'Proposta', papel: 'proposta' }, { chave: 'ganho', nome: 'Venda', papel: 'ganho' }];
/* 1.000 leads × 60% × 50% × 70% × 80% × 25% = 42 vendas × R$ 10 mil = R$ 420 mil; margem 30% = R$ 126 mil */
const base = (): Estado => ({
  etapas: E, L: 1000, Lp: 800, conv: [0.6, 0.5, 0.7, 0.8, 0.25], convInfo: { conv: [0.6, 0.5, 0.7, 0.8, 0.25], num: [600, 300, 210, 168, 42], den: [1000, 600, 300, 210, 168] }, total: null, nVend: 4,
  ticket: 10000, nTicket: 42, mPct: 0.3, custoPct: 0.5, comPct: 0.05, impPct: 0.1, taxaPct: 0.02, cx: 0.5, fixos: 50000, inv: 30000, imp: 500000, cli: 10000, mk: true, n: 1000,
});
const M = () => fecharBase(base());

describe('derivação', () => {
  it('vendas, receita, margem, caixa, marketing e ponto de equilíbrio', () => {
    const D = M();
    expect(D.V).toBeCloseTo(42); expect(D.R).toBeCloseTo(420000); expect(D.margem).toBeCloseTo(126000); expect(D.caixa).toBeCloseTo(210000);
    expect(D.mm).toBeCloseTo(96000); expect(D.ro).toBeCloseTo(46000); expect(D.pe).toBeCloseTo(80000 / 3000);
    expect(D.cpl).toBeCloseTo(37.5); expect(D.cac).toBeCloseTo(30000 / 42); expect(D.roas).toBeCloseTo(14); expect(D.ctr).toBeCloseTo(0.02); expect(D.cpc).toBeCloseTo(3); expect(D.tx).toBeCloseTo(0.08);
    expect(D.lpv).toBeCloseTo(250); expect(D.totalEf).toBeCloseTo(0.042);
    expect(D.tpm).toBeCloseTo(10000); expect(D.vnec).toBeCloseTo(42);   // na base, o ticket que preserva a margem é o atual e as vendas necessárias são as atuais
    expect(valor(D, 'r:0:5')).toBeCloseTo(0.042); expect(valor(D, 'r:1:3')).toBeCloseTo(0.35); expect(valor(D, 'c4')).toBe(0.25);
  });
  it('sem histórico numa passagem o funil não inventa: vendas ficam sem valor', () => { const s = base(); s.conv[2] = null; expect(derivar(s).V).toBeNull(); });
});

describe('catálogo e chaves', () => {
  it('atalhos só para os papéis que existem; normalização de chaves antigas', () => {
    const at = atalhos(E).map(x => x.k);
    expect(at).toEqual(expect.arrayContaining(['p:agend', 'p:compar', 'p:prop', 'p:fech', 'p:total'])); expect(at).not.toContain('p:oport');
    expect(atalhos(E).find(x => x.k === 'p:fech')!.r).toBe('r:4:5'); expect(atalhos(E).some(x => x.k === 'p:neg')).toBe(false);
    expect(normalizar({ ind: 'total' }, E).ind).toBe('r:0:5'); expect(normalizar({ ind: 'c2' }, E).ind).toBe('r:2:3'); expect(normalizar({ ind: 'p:compar' }, E).ind).toBe('r:2:3'); expect(normalizar({ ind: 'r:9:1' }, E).ind).toBe('r:4:5');
    expect(indicador('r:0:2', E).t).toBe('conversão lead → reunião agendada');
    expect(catalogo(E).some(x => x.k === 'custoPct')).toBe(true); expect(catalogo(E).some(x => /kwp/i.test(x.k))).toBe(false);
    expect(opcoesMantendo('ticket')!.map(x => x[0])).toEqual(['mpct', 'custo']); expect(opcoesMantendo('r:0:5')!.length).toBe(3); expect(opcoesMantendo('r:4:5')).toBeNull(); expect(opcoesMantendo('L', base())!.map(x => x[0])).toEqual(['inv', 'cpl']);
  });
});

describe('aplicar uma mudança', () => {
  it('ticket mantendo a margem % × mantendo o custo por venda', () => {
    const a = derivar(aplicar(M(), 'ticket', 12000, 'mpct').s); expect(a.R).toBeCloseTo(504000); expect(a.margem).toBeCloseTo(151200);
    const b = derivar(aplicar(M(), 'ticket', 12000, 'custo').s); expect(b.margem).toBeCloseTo(42 * 5000); expect(b.mPctEf).toBeCloseTo(5000 / 12000);
  });
  it('conversão do funil inteiro: espalhada, na primeira e na última passagem', () => {
    const d = aplicar(M(), 'r:0:5', 0.05, 'dist').s; expect(derivar(d).V).toBeCloseTo(50);
    const f = Math.pow(0.05 / 0.042, 1 / 5); expect(d.conv[0]!).toBeCloseTo(0.6 * f); expect(d.conv[4]!).toBeCloseTo(0.25 * f);
    const p = aplicar(M(), 'r:0:5', 0.05, 'prim').s; expect(p.conv[0]!).toBeCloseTo(0.05 / 0.07); expect(p.conv[1]).toBe(0.5);
    const u = aplicar(M(), 'r:0:5', 0.05, 'ult').s; expect(u.conv[4]!).toBeCloseTo(0.05 / 0.168); expect(u.conv[0]).toBe(0.6);
    const teto = aplicar(M(), 'r:3:5', 0.9, 'dist'); expect(teto.passos.some(p => /máximo possível/.test(p))).toBe(false);
    const uma = aplicar(M(), 'r:4:5', 0.3); expect(uma.s.conv[4]).toBe(0.3); expect(derivar(uma.s).V).toBeCloseTo(50.4);
  });
  it('leads: +20% mantendo o investimento (CPL sobe) ou mantendo o CPL (investimento sobe)', () => {
    const a = aplicar(M(), 'L', 1200); expect(a.s.Lp).toBe(1000); expect(a.s.inv).toBe(30000); expect(a.passos[0]).toMatch(/CPL passa a R\$ 30,00/);
    const b = aplicar(M(), 'L', 1200, 'cpl'); expect(b.s.inv).toBeCloseTo(37500); expect(b.s.imp).toBeCloseTo(625000);
    const c = aplicar(M(), 'inv', 45000); expect(c.s.imp).toBeCloseTo(750000); expect(c.s.cli).toBeCloseTo(15000); expect(c.s.Lp).toBeCloseTo(1200); expect(c.s.L).toBeCloseTo(1400);
    const d = aplicar(M(), 'cpl', 30); expect(d.s.Lp).toBeCloseTo(1000); expect(d.s.L).toBeCloseTo(1200);
    const e = aplicar(M(), 'nVend', 5); expect(e.s.L).toBeCloseTo(1250); expect(e.s.Lp).toBeCloseTo(1000);
  });
  it('deduções, desconto e custo variável saem inteiros da margem', () => {
    const a = derivar(aplicar(M(), 'comPct', 0.1).s); expect(a.margem).toBeCloseTo(105000); expect(a.dDed).toBeCloseTo(0.05);
    const b = derivar(aplicar(M(), 'desc', 0.1).s); expect(b.ticket).toBeCloseTo(9000); expect(b.margem).toBeCloseTo(42 * 2000);
    const c = derivar(aplicar(M(), 'custoPct', 0.6, 'preco').s); expect(c.margem).toBeCloseTo(42 * 2000);
    const d = derivar(aplicar(M(), 'custoPct', 0.6, 'mpct').s); expect(d.ticket).toBeCloseTo(8000 / 0.7); expect(d.mPctEf).toBeCloseTo(0.3);
    const e = derivar(aplicar(M(), 'mPct', 0.4).s); expect(e.margem).toBeCloseTo(168000);
    expect(derivar(aplicar(M(), 'fixos', 80000).s).ro).toBeCloseTo(16000);
  });
});

describe('alvos e validações', () => {
  it('maior em %, p.p. e absoluto; chegasse; referências aos pares e ao período anterior', () => {
    const D = M();
    expect(alvoDaClausula({ ind: 'ticket', op: 'maior', num: 10, un: '%' }, D).v).toBeCloseTo(11000);
    expect(alvoDaClausula({ ind: 'r:4:5', op: 'maior', num: 5, un: 'pp' }, D).v).toBeCloseTo(0.3);
    expect(alvoDaClausula({ ind: 'L', op: 'menor', num: 100, un: 'q' }, D).v).toBe(900);
    expect(alvoDaClausula({ ind: 'r:0:5', op: 'chegasse', num: 6 }, D).v).toBeCloseTo(0.06);
    const par = (t: number, n = 50) => ({ ...base(), ticket: t, n, nTicket: 5 });
    const refs = { pares: [{ id: 'v:a', M: par(8000) }, { id: 'v:b', M: par(10000) }, { id: 'v:c', M: par(12000) }, { id: 'v:d', M: par(50000, 3) }], tipoPares: 'vendedores' as const, anterior: { ...base(), ticket: 9000, nTicket: 0 }, porId: { 'v:c': par(12000) } };
    expect(alvoDaClausula({ ind: 'ticket', op: 'igual', ref: 'mediana' }, D, { refs })).toMatchObject({ v: 10000, n: 3 });   // o par com n=3 fica fora
    expect(alvoDaClausula({ ind: 'ticket', op: 'igual', ref: 'p75' }, D, { refs }).v).toBeCloseTo(11000);
    expect(alvoDaClausula({ ind: 'ticket', op: 'igual', ref: 'melhor' }, D, { refs }).v).toBe(12000);
    expect(alvoDaClausula({ ind: 'cpl', op: 'igual', ref: 'melhor' }, D, { refs }).v).toBeCloseTo(37.5);   // menor é melhor
    expect(alvoDaClausula({ ind: 'ticket', op: 'igual', ref: 'v:c' }, D, { refs })).toMatchObject({ v: 12000, rot: 'de c' });
    expect(alvoDaClausula({ ind: 'ticket', op: 'igual', ref: 'anterior' }, D, { refs })).toMatchObject({ v: null, semVenda: true });   // sem venda, ticket não existe (não é zero)
    expect(alvoDaClausula({ ind: 'L', op: 'igual', ref: 'anterior' }, D, { refs }).v).toBe(1000);
  });
  it('combinações que aplicariam o mesmo efeito duas vezes', () => {
    const v = (cls: Clausula[]) => validarCombinacao(cls, E);
    expect(v([{ ind: 'ticket', op: 'maior', num: 1, un: '%' }, { ind: 'ticket', op: 'maior', num: 1, un: '%' }])[0]).toMatch(/aparece nas condições 1 e 2/);
    expect(v([{ ind: 'r:0:3', op: 'chegasse', num: 1 }, { ind: 'r:2:5', op: 'chegasse', num: 1 }])[0]).toMatch(/sobrepõem/);
    expect(v([{ ind: 'r:0:2', op: 'chegasse', num: 1 }, { ind: 'r:2:5', op: 'chegasse', num: 1 }])).toEqual([]);
    expect(v([{ ind: 'mPct', op: 'chegasse', num: 1 }, { ind: 'custoPct', op: 'chegasse', num: 1 }])[0]).toMatch(/conflitam/);
    expect(v([{ ind: 'L', op: 'maior', num: 1, un: '%' }, { ind: 'nVend', op: 'chegasse', num: 5 }])[0]).toMatch(/duas vezes o volume de leads/);
    expect(v([{ ind: 'L', op: 'maior', num: 1, un: '%' }, { ind: 'cpl', op: 'chegasse', num: 20 }])[0]).toMatch(/marketing já gera/);
  });
  it('valores inválidos', () => {
    expect(validarValor({ ind: 'r:4:5', op: 'chegasse', num: 150 }, indicador('r:4:5', E), 1.5, E)).toMatch(/fora de 0% a 100%/);
    expect(validarValor({ ind: 'L', op: 'menor', num: 120, un: '%' }, indicador('L', E), -200, E)).toMatch(/mais de 100%/);
    expect(validarValor({ ind: 'L', op: 'maior', num: -5, un: 'q' }, indicador('L', E), 995, E)).toMatch(/positivo/);
    expect(validarValor({ ind: 'ticket', op: 'chegasse', num: 100 }, indicador('ticket', E), 100, E)).toBe('');
  });
});

describe('simulação completa', () => {
  it('duas condições em ordem, com passos, premissas e a frase', () => {
    const R = simularESe(base(), [{ ind: 'p:fech', op: 'maior', num: 5, un: 'pp' }, { ind: 'ticket', op: 'maior', num: 10, un: '%', mant: 'mpct' }], { res: 'margem', meses: 1 });
    expect(R.erros).toEqual([]);
    expect(R.linhas.length).toBe(2); expect(R.linhas[0]!.cl.ind).toBe('r:4:5'); expect(R.linhas[0]!.antes).toBe(0.25); expect(R.linhas[0]!.alvo.v).toBeCloseTo(0.3);
    expect(R.S.V).toBeCloseTo(50.4); expect(R.S.R).toBeCloseTo(50.4 * 11000); expect(R.S.margem).toBeCloseTo(50.4 * 11000 * 0.3);
    expect(R.premissas.some(p => /^volume de leads 1\.000$/.test(p))).toBe(true);
    expect(R.premissas.some(p => /^ticket médio/.test(p))).toBe(false);            // o que mudou não é premissa
    expect(R.premissasL.some(([t]) => t === 'conversão lead → venda')).toBe(false); // ocultos ficam fora da lista curta
    expect(R.ordem[0]).toMatch(/^1ª conversão proposta → venda/);
    expect(R.alertas.some(a => /pressupõe vendedores/.test(a))).toBe(true);
    expect(frase(R, 'margem')).toBe('Se a conversão proposta → venda fosse maior em 5 p.p. e o ticket médio fosse maior em 10%, mantendo a margem %, qual seria o impacto na margem de contribuição?');
  });
  it('erros que impedem a conta: marketing sem lançamento, taxa sem histórico, fixos ausentes, referência sem amostra', () => {
    const semMk = { ...base(), mk: false, inv: null, imp: null, cli: null, Lp: null };
    expect(simularESe(semMk, [{ ind: 'cpl', op: 'menor', num: 10, un: '%' }], { sujeito: 'o canal X' }).erros[0]).toMatch(/Sem investimento lançado para o canal X/);
    const s = base(); s.conv[2] = null;
    expect(simularESe(s, [{ ind: 'ticket', op: 'maior', num: 1, un: '%' }]).erros[0]).toMatch(/Sem histórico suficiente para calcular a passagem Reunião agendada → Reunião realizada/);
    expect(simularESe(s, [{ ind: 'r:2:3', op: 'chegasse', num: 70 }]).erros).toEqual([]);   // informar a taxa como premissa resolve
    expect(simularESe({ ...base(), fixos: null }, [{ ind: 'fixos', op: 'maior', num: 1, un: '%' }]).erros[0]).toMatch(/Sem custos fixos/);
    expect(simularESe({ ...base(), fixos: null }, [{ ind: 'ticket', op: 'maior', num: 1, un: '%' }], { res: 'pe' }).erros[0]).toMatch(/ponto de equilíbrio precisam/);
    expect(simularESe(base(), [{ ind: 'ticket', op: 'igual', ref: 'mediana' }], { refs: { pares: [] } }).erros[0]).toMatch(/sem amostra suficiente/);
    expect(simularESe(base(), [{ ind: 'r:4:5', op: 'chegasse', num: 150 }]).erros[0]).toMatch(/fora de 0% a 100%/);
  });
  it('alertas: capacidade por mês, base pequena, amostra pequena, margem estimada', () => {
    const R = simularESe(base(), [{ ind: 'L', op: 'maior', num: 50, un: '%' }], { capacidade: 1200, meses: 1 });
    expect(R.alertas.some(a => /Capacidade: o cenário pede 1\.500 leads por mês/.test(a))).toBe(true);
    const peq = { ...base(), n: 8, convInfo: { conv: base().conv, num: [5, 3, 2, 2, 1], den: [8, 5, 3, 2, 2] } };
    const R2 = simularESe(peq, [{ ind: 'r:4:5', op: 'chegasse', num: 30 }], { minN: 10 });
    expect(R2.alertas.some(a => /Amostra pequena \(8 leads/.test(a))).toBe(true);
    expect(R2.alertas.some(a => /base pequena.*Lead → Contato \(5 de 8\)/.test(a) && !/Proposta → Venda/.test(a))).toBe(true);   // a passagem substituída por premissa não entra
    expect(simularESe({ ...base(), margemEstimada: true }, [{ ind: 'ticket', op: 'maior', num: 1, un: '%' }], { res: 'margem' }).alertas.some(a => /Margem estimada pela política/.test(a))).toBe(true);
  });
});

describe('quanto precisa e sensibilidade', () => {
  it('bissecção acha o indicador que leva o resultado ao alvo; inalcançável diz o limite', () => {
    const D = M();
    const a = quantoPrecisa(D, 'r:0:5', 'V', 60, 'dist'); expect('v' in a && a.v).toBeCloseTo(0.06, 6);
    const b = quantoPrecisa(D, 'ticket', 'R', 600000, 'mpct'); expect('v' in b && b.v).toBeCloseTo(600000 / 42, 3);
    const c = quantoPrecisa(D, 'mPct', 'margem', 10_000_000); expect(c).toMatchObject({ erro: 'inalcançável', limite: 1 }); expect('valLim' in c && c.valLim).toBeCloseTo(420000);
    const d = quantoPrecisa(D, 'L', 'pe', 10); expect('erro' in d).toBe(true);   // o ponto de equilíbrio não muda com leads: sem solução
  });
  it('sensibilidade de −30% a +30% com o ponto zero igual à base', () => {
    const pts = sensibilidadeDoIndicador(M(), 'ticket', 'R', 'mpct');
    expect(pts.length).toBe(7); expect(pts[3]!.r).toBeCloseTo(420000); expect(pts[0]!.r).toBeCloseTo(420000 * 0.7); expect(pts[6]!.v).toBeCloseTo(13000);
    const tx = sensibilidadeDoIndicador(M(), 'r:0:5', 'V');
    expect(tx[6]!.r).toBeCloseTo(42 * 1.3);
    expect(sensibilidadeDoIndicador(derivar({ ...base(), inv: null, imp: null, cli: null, Lp: null, mk: false }), 'cpl', 'V')).toEqual([]);   // sem marketing, o CPL não existe
  });
});

describe('premissas da política de preço', () => {
  it('comissão fixa, imposto e custo variável virando % do ticket, com a margem % do preço', () => {
    const pol: Politica = { ...POLITICA_VAZIA, versao: 3, comissao: { tipo: 'fixa', alvo: 0.05 }, linhas: [{ chave: 'imposto', nome: 'Imposto', grupo: 'deducao', base: 'percentual_preco', valor: 0.1 }], condicoes: [{ chave: 'vista', nome: 'À vista', taxa: 0 }, { chave: 'cartao', nome: 'Cartão', taxa: 0.03 }] };
    const p = premissasDaPolitica(pol, 10000, 5000)!;
    expect(p.impPct).toBeCloseTo(0.1); expect(p.comPct).toBeCloseTo(0.9 * 0.05); expect(p.custoPct).toBeCloseTo(0.5); expect(p.taxaPct).toBe(0);
    expect(p.mPct).toBeCloseTo((10000 - 1000 - 450 - 5000) / 10000); expect(p.fonte).toMatch(/política de preço v3/);
    expect(premissasDaPolitica(pol, 10000, 5000, 'cartao')!.taxaPct).toBeCloseTo(0.03);
    expect(premissasDaPolitica(pol, 0, 5000)).toBeNull();
  });
});
