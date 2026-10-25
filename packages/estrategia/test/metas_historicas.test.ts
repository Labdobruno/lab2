/* Contrato: testes/lab_metas.test.js da V1 (D16–D20). */
import { describe, expect, it } from 'vitest';
import { anual, atingimento, diasCorridos, intervalo, metaDaPessoa, oficial, registroInicial, revisaoDaMeta, snapshot, versoes, type CicloIntervalo, type PlanoDoc } from '../src/index.js';

const meta = (alvo: number, extra?: Record<string, unknown>) => ({ ind: 'receita', escopo: 'empresa', alvo, ...(extra ?? {}) });
const set = { chave: '2026-09', ini: '2026-09-01', fim: '2026-10-01' };
const plano: PlanoDoc = {
  status: 'fechado', versao: 3, metas: { r: meta(80000), p1: { ind: 'receita', escopo: 'pessoa', ref: 'Ana', alvo: 50000 }, v: { ind: 'vendas', escopo: 'empresa', alvo: 8 } },
  original: { em: 1, por: 'Bruno', metas: { r: meta(100000) } },
  versoes: { v1: { n: 1, em: 10, por: 'Bruno', corte: '2026-09-10', motivo: 'perda de dois vendedores', metas: { r: meta(100000) } } as never, v2: { n: 2, em: 20, por: 'Carla', corte: '2026-09-20', motivo: 'feriado prolongado', metas: { r: meta(90000) } } as never },
};

describe('D16: replanejamento e fechamento', () => {
  it('meta oficial = versão final do plano, versões em ordem', () => {
    const S = snapshot({ ...set, encerrado: true, plano, metaMensal: 50000 });
    expect(S.estado).toBe('conhecida'); expect(S.receita).toBe(80000); expect(S.fonte).toBe('plano'); expect(S.plano!.status).toBe('fechado'); expect(S.plano!.versao).toBe(3);
    const V = S.plano!.versoes;
    expect(V.map(v => v.tipo).join(',')).toBe('aprovada,substituida,substituida,final');
    expect(V[0]!.receita).toBe(100000); expect(V[0]!.por).toBe('Bruno'); expect(V[0]!.em).toBe(1);
    expect(V[1]!.receita).toBe(100000); expect(V[1]!.vigenteAte).toBe('2026-09-10'); expect(V[1]!.motivo).toBe('perda de dois vendedores'); expect(V[2]!.receita).toBe(90000); expect(V[2]!.por).toBe('Carla');
    expect(V[3]!.receita).toBe(80000); expect(V[3]!.n).toBe(3); expect(V[3]!.por).toBe('Carla'); expect(V[3]!.desde).toBe('2026-09-20'); expect(V[3]!.motivo).toBe('feriado prolongado');
    expect(S.pessoas.Ana).toBe(50000); expect(S.metas.vendas).toBe(8);
  });
  it('variações do plano', () => {
    expect(snapshot({ ...set, encerrado: true, plano: { ...plano, status: 'ativo' } }).receita).toBe(80000);
    expect(snapshot({ ...set, encerrado: true, plano: { status: 'fechado', metas: {}, reverso: { tipo: 'receita', alvo: 70000 } } }).receita).toBe(70000);
    const S = snapshot({ ...set, encerrado: true, plano: { status: 'fechado', metas: { v: { ind: 'vendas', alvo: 5 } } }, metaMensal: 50000 }); expect(S.estado).toBe('desconhecida'); expect(S.receita).toBeNull();
    expect(versoes({ metas: { r: meta(10) } }).map(v => v.tipo).join(',')).toBe('final');
  });
  it('metas individuais: hoje no ciclo em andamento; só as da época no encerrado', () => {
    let S = snapshot({ ...set, encerrado: false, plano: { status: 'ativo', metas: { r: meta(100), p: { ind: 'receita', escopo: 'pessoa', ref: 'Ana', alvo: 60 } } }, metasVend: { Ana: 10, Bia: 30 } });
    expect(S.pessoas.Ana).toBe(60); expect(S.pessoas.Bia).toBe(30);
    S = snapshot({ ...set, encerrado: true, plano: { status: 'fechado', metas: { r: meta(100) } }, metasVend: { Bia: 999 }, obs: { '2026-09-20': { v: 100, fonte: 'plano', pessoas: { Bia: 30 } } } }); expect(S.pessoas.Bia).toBe(30);
    S = snapshot({ ...set, encerrado: true, plano: { status: 'fechado', metas: { r: meta(100) } }, metasVend: { Bia: 999 } }); expect(S.pessoas.Bia).toBeUndefined();
  });
});

describe('D17: ciclo sem histórico', () => {
  it('desconhecida, observação, fotos, configuração em andamento', () => {
    let S = snapshot({ ...set, encerrado: true, plano: null, metaMensal: 70000 }); expect(S.estado).toBe('desconhecida'); expect(S.receita).toBeNull(); expect(S.motivo).toMatch(/configuração de hoje/);
    S = snapshot({ ...set, encerrado: true, plano: { status: 'rascunho', metas: { r: meta(60000) } }, metaMensal: 70000 }); expect(S.estado).toBe('desconhecida'); expect(S.motivo).toMatch(/rascunho/);
    S = snapshot({ ...set, encerrado: true, obs: { '2026-09-05': { v: 40000, fonte: 'configuracao' }, '2026-09-28': { v: 45000, fonte: 'configuracao' }, '2026-10-02': { v: 99999, fonte: 'configuracao' } } });
    expect(S.estado).toBe('conhecida'); expect(S.receita).toBe(45000); expect(S.fonte).toBe('observacao'); expect(S.evidencia!.dia).toBe('2026-09-28');
    expect(snapshot({ ...set, encerrado: true, obs: { '2026-09-28': { v: null, fonte: 'nenhuma' } } }).estado).toBe('sem_meta');
    S = snapshot({ ...set, encerrado: true, fotos: { '2026-09-15': { meta: { receita: 55000 } }, '2026-08-30': { meta: { receita: 1 } } } }); expect(S.estado).toBe('conhecida'); expect(S.receita).toBe(55000); expect(S.fonte).toBe('foto_diaria');
    S = snapshot({ ...set, encerrado: false, plano: null, metaMensal: 70000, metasVend: { Ana: 30000, Bia: 0 } }); expect(S.estado).toBe('conhecida'); expect(S.receita).toBe(70000); expect(S.fonte).toBe('configuracao'); expect(S.pessoas.Ana).toBe(30000); expect(S.pessoas.Bia).toBeUndefined();
    expect(snapshot({ ...set, encerrado: false, plano: { status: 'rascunho', metas: { r: meta(1) } } }).estado).toBe('sem_meta');
  });
});

describe('D19: registro, idempotência, revisão', () => {
  const snapF = snapshot({ ...set, encerrado: true, plano });
  const R1 = registroInicial({}, snapF, { agora: 1000, autor: 'Bruno' });
  it('r1 e idempotência', () => {
    if (R1.acao !== 'gravar') throw new Error(R1.motivo);
    expect(R1.id).toBe('r1'); expect(R1.registro.receita).toBe(80000); expect(R1.registro.ini).toBe('2026-09-01'); expect(R1.registro.fim).toBe('2026-10-01'); expect(R1.registro.por).toBe('Bruno'); expect(R1.registro.em).toBe(1000); expect(R1.registro.fonte).toBe('plano'); expect((R1.registro.plano as { versoes: unknown[] }).versoes.length).toBe(4);
    const rec = registroInicial({}, snapF, { agora: 500, autor: 'Bruno', tipo: 'recuperacao', registradoPor: 'Ana', registradoEm: 900 }); if (rec.acao !== 'gravar') throw new Error('x');
    expect(rec.registro.tipo).toBe('recuperacao'); expect(rec.registro.registradoPor).toBe('Ana'); expect(rec.registro.em).toBe(500);
    const doc = { registros: { r1: R1.registro } };
    expect(registroInicial(doc, snapF, { agora: 2000 }).acao).toBe('nada');
    expect(registroInicial({}, snapshot({ ...set, encerrado: false, metaMensal: 1 })).acao).toBe('nada');
  });
  it('alteração posterior não muda o registro; revisão cria r2', () => {
    if (R1.acao !== 'gravar') throw new Error('x');
    const doc = { registros: { r1: R1.registro } };
    const snapMudou = snapshot({ ...set, encerrado: true, plano: { ...plano, metas: { r: meta(95000) } } });
    let O = oficial(doc, snapMudou); expect(O.receita).toBe(80000); expect(O.registrado).toBe(true); expect(O.id).toBe('r1'); expect(O.divergencia!.receita).toBe(95000);
    expect(registroInicial(doc, snapMudou).acao).toBe('nada');
    expect('erro' in revisaoDaMeta(doc, { receita: 95000, justificativa: 'curto' }, {})).toBe(true);
    const RV = revisaoDaMeta(doc, { receita: 95000, justificativa: 'meta corrigida pela diretoria em 12/10' }, { agora: 3000, autor: 'Carla' }); if ('erro' in RV) throw new Error(RV.erro);
    expect(RV.id).toBe('r2'); expect(RV.registro.revisaDe).toBe('r1'); expect(RV.registro.n).toBe(2); expect(RV.registro.por).toBe('Carla'); expect(doc.registros.r1.receita).toBe(80000);
    O = oficial({ registros: { r1: R1.registro, r2: RV.registro } }, snapMudou); expect(O.receita).toBe(95000); expect(O.id).toBe('r2'); expect(O.historico.length).toBe(2); expect(O.divergencia).toBeNull();
    expect('erro' in revisaoDaMeta({}, { receita: 1, justificativa: 'qualquer coisa aqui' })).toBe(true);
    const D = revisaoDaMeta(doc, { justificativa: 'meta original não confere com a ata' }); if ('erro' in D) throw new Error(D.erro); expect(D.registro.estado).toBe('desconhecida');
  });
  it('estimativa não substitui o desconhecido', () => {
    const snapD = snapshot({ ...set, encerrado: true }), r1 = registroInicial({}, snapD, { agora: 1 }); if (r1.acao !== 'gravar') throw new Error('x');
    const docD = { registros: { r1: r1.registro } }; expect(docD.registros.r1.estado).toBe('desconhecida'); expect(docD.registros.r1.motivo).toBeTruthy();
    expect('erro' in revisaoDaMeta(docD, { tipo: 'estimativa', receita: 50000, justificativa: 'estimada pela média dos ciclos vizinhos' })).toBe(true);
    const ES = revisaoDaMeta(docD, { tipo: 'estimativa', receita: 50000, justificativa: 'estimada pela média dos ciclos vizinhos', origem: 'média de ago e out', limitacoes: 'sem ata da meta' }, { agora: 5 }); if ('erro' in ES) throw new Error(ES.erro);
    const O = oficial({ registros: { r1: docD.registros.r1, r2: ES.registro } }, snapD);
    expect(O.estado).toBe('desconhecida'); expect(O.receita).toBeNull(); expect(O.estimativas.length).toBe(1); expect(O.estimativas[0]!.estado).toBe('estimada'); expect(O.estimativas[0]!.origem).toBe('média de ago e out');
    expect(oficial({}, snapF).registrado).toBe(false); expect(oficial({}, snapF).receita).toBe(80000);
  });
});

const uteis = (ini: string, fim: string) => diasCorridos(ini, fim).filter(d => { const w = new Date(d + 'T12:00:00Z').getUTCDay(); return w >= 1 && w <= 5; });
const C = (chave: string, ini: string, fim: string, receita: number | null, estado?: string, pesos?: Record<string, number> | null): CicloIntervalo => ({ chave, nome: chave, ini, fim, oficial: { estado: estado ?? 'conhecida', receita }, dias: uteis(ini, fim), pesos: pesos ?? null });
const jul = C('2026-07', '2026-07-01', '2026-08-01', 100000), ago = C('2026-08', '2026-08-01', '2026-09-01', 100000), setC = C('2026-09', '2026-09-01', '2026-10-01', 100000), out = C('2026-10', '2026-10-01', '2026-11-01', 100000);
describe('rateio por dias elegíveis e pesos', () => {
  it('intervalos', () => {
    expect(diasCorridos('2026-09-01', '2026-10-01').length).toBe(30);
    let I = intervalo([setC], '2026-09-01', '2026-09-30'); expect(I.v).toBeCloseTo(100000); expect(I.estado).toBe('ok');
    I = intervalo([jul, ago, setC, out], '2026-07-13', '2026-10-10');
    const fJul = jul.dias!.filter(d => d >= '2026-07-13').length / jul.dias!.length, fOut = out.dias!.filter(d => d <= '2026-10-10').length / out.dias!.length;
    expect(I.v).toBeCloseTo(100000 * (fJul + 1 + 1 + fOut)); expect(I.itens.length).toBe(4);
    const a1 = intervalo([jul, ago, setC, out], '2026-07-13', '2026-08-20'), a2 = intervalo([jul, ago, setC, out], '2026-08-21', '2026-10-10'); expect(a1.v! + a2.v!).toBeCloseTo(I.v!);
    const pesos: Record<string, number> = {}; setC.dias!.forEach(d => { pesos[d] = d < '2026-09-08' ? 2 : 1; });
    I = intervalo([{ ...setC, pesos }], '2026-09-01', '2026-09-07');
    const nS1 = setC.dias!.filter(d => d < '2026-09-08').length, nTot = setC.dias!.length; expect(I.v).toBeCloseTo((100000 * (2 * nS1)) / (2 * nS1 + (nTot - nS1)));
    I = intervalo([setC], '2026-09-05', '2026-09-06'); expect(I.v).toBeNull(); expect(I.itens.length).toBe(0);
    expect(intervalo([{ ...setC, dias: setC.dias!.filter(d => d !== '2026-09-07') }], '2026-09-07', '2026-09-07').v).toBeNull();
    I = intervalo([{ ...setC, dias: [] }], '2026-09-01', '2026-09-15'); expect(I.v).toBeCloseTo((100000 * 15) / 30); expect(I.confianca).toBe('baixa'); expect(I.notas.some(n => /dias corridos/.test(n))).toBe(true);
    I = intervalo([jul, C('2026-08', '2026-08-01', '2026-09-01', null, 'desconhecida'), setC], '2026-07-01', '2026-09-30');
    expect(I.estado).toBe('parcial'); expect(I.v).toBeCloseTo(200000); expect(I.desconhecidos[0]).toBe('2026-08');
    expect(atingimento(150000, I).v).toBeNull(); expect(atingimento(150000, I).motivo).toMatch(/desconhecida/);
    expect(atingimento(50000, intervalo([setC], '2026-09-01', '2026-09-30')).v).toBeCloseTo(0.5);
    expect(intervalo([setC], '2026-09-10', '2026-09-01').estado).toBe('invalido'); expect(intervalo([setC], '', '').v).toBeNull();
    I = intervalo([C('2026-10', '2026-10-01', '2026-11-01', null, 'sem_meta')], '2026-10-01', '2026-10-10'); expect(I.estado).toBe('sem_meta'); expect(I.v).toBeNull(); expect(I.semMeta.length).toBe(1);
    expect(metaDaPessoa({ Ana: 10 }, 'bia')).toBeNull(); expect(metaDaPessoa({ 'Ana Souza': 10 }, ' ana  souza ')).toBe(10);
  });
  it('D20: ciclos antes da operação ficam fora', () => {
    const foraC = (c: CicloIntervalo): CicloIntervalo => ({ ...c, oficial: { estado: 'fora', receita: null, motivo: 'antes da operação' } });
    const fOut = out.dias!.filter(d => d <= '2026-10-10').length / out.dias!.length;
    const I = intervalo([foraC(jul), foraC(ago), setC, out], '2026-07-13', '2026-10-10');
    expect(I.v).toBeCloseTo(100000 * (1 + fOut)); expect(I.estado).toBe('ok'); expect(I.fora.join(',')).toBe('2026-07,2026-08');
    expect(I.desconhecidos.length).toBe(0); expect(atingimento(50000, I).v).not.toBeNull();
    expect(I.pesoTotal).toBe(setC.dias!.length + out.dias!.length); expect(I.notas.some(n => /fora da operação/.test(n))).toBe(true);
  });
});

describe('D18: ano', () => {
  const ano = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(m => { const ini = '2026-' + m + '-01', fim = m === '12' ? '2027-01-01' : '2026-' + String(+m + 1).padStart(2, '0') + '-01'; return C('2026-' + m, ini, fim, 100000); });
  const tot = intervalo(ano, '2026-01-01', '2026-12-31'), acum = intervalo(ano, '2026-01-01', '2026-10-10');
  it('meta final, acumulada, atingimento e projeção', () => {
    let A = anual(tot, acum, 800000);
    expect(A.metaTotal).toBeCloseTo(1200000); expect(A.metaAcum!).toBeGreaterThan(900000); expect(A.metaAcum!).toBeLessThan(1000000);
    expect(A.atingAcum).toBeCloseTo(800000 / A.metaAcum!); expect(A.atingAcum!).toBeGreaterThan(0.8);
    expect(A.projecao!).toBeGreaterThan(800000); expect(A.atingProj).toBeCloseTo(A.projecao! / 1200000); expect(A.metodo).toMatch(/dias elegíveis/);
    A = anual(tot, intervalo(ano, '2026-01-01', '2026-01-10'), 50000); expect(A.projecao).toBeNull(); expect(A.notas.some(n => /10%/.test(n))).toBe(true); expect(A.atingAcum).not.toBeNull();
    const anoD = [...ano]; anoD[2] = C('2026-03', '2026-03-01', '2026-04-01', null, 'desconhecida');
    A = anual(intervalo(anoD, '2026-01-01', '2026-12-31'), intervalo(anoD, '2026-01-01', '2026-10-10'), 800000);
    expect(A.atingAcum).toBeNull(); expect(A.atingProj).toBeNull(); expect(A.projecao!).toBeGreaterThan(0); expect(A.notas.some(n => /desconhecida/.test(n))).toBe(true);
    A = anual(tot, tot, 1300000); expect(A.projecao).toBe(1300000); expect(A.atingProj).toBeCloseTo(1300000 / 1200000);
  });
});
