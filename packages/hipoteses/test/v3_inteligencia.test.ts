/* Contrato do lab_inteligencia.test.js da V1: waterfall, categoria do desvio, acurácia, faseado, proteção, saúde, contribuição necessária. */
import { describe, expect, it } from 'vitest';
import { acuracia, acuraciaGeral, acuraciaPorPessoa, categoriaDoDesvio, contribuicaoNecessariaMes, faseado, PROTECAO, protecao, saude, waterfallMargem, waterfallReceita } from '../src/index.js';

describe('pontes e categoria do desvio', () => {
  it('receita: 10 × 20 mil → 12 × 22 mil = +40 mil volume, +24 mil ticket', () => { expect(waterfallReceita(10, 20000, 12, 22000)).toMatchObject({ volume: 40000, ticket: 24000, total: 64000 }); });
  it('margem na ordem fixa; sem explicação = 0 quando tudo é contabilizado', () => {
    const W = waterfallMargem({ receita: 200000, impostos: 12000, taxa: 2000, custo: 120000, comissao: 6000, desconto: 5000 }, { receita: 230000, impostos: 13800, taxa: 2300, custo: 145000, comissao: 6900, desconto: 12000 });
    expect(W).toMatchObject({ de: 60000, para: 62000, semExplicacao: 0 }); expect(W.efeitos).toMatchObject({ preco: 30000, custo: -25000, comissao: -900, imposto: -1800, taxa: -300 });
  });
  it('categoria do desvio: premissa, execução, contexto, sem explicação', () => {
    expect(categoriaDoDesvio({ ticketPlan: 30000, ticketHist: 20000 }).map(c => c.k)).toEqual(['premissa']);
    expect(categoriaDoDesvio({ descontoReal: 0.09, descontoPolitica: 0.05 })[0]!.k).toBe('execucao');
    expect(categoriaDoDesvio({ eventos: ['reajuste tarifário'] })[0]!.k).toBe('contexto');
    expect(categoriaDoDesvio({})[0]!.k).toBe('sem_explicacao');
    expect(categoriaDoDesvio({ ticketPlan: 21000, ticketHist: 20000, taxaPlan: 0.3, taxaHist: 0.2, descontoReal: 0.04, descontoPolitica: 0.05, atividadeReal: 100, atividadePlan: 200 }).map(c => c.k)).toEqual(['premissa', 'execucao']);
  });
});

describe('acurácia do forecast', () => {
  const fotos = { '2026-09-01': { receita: { ajust: 130000 } }, '2026-09-16': { receita: { ajust: 115000 } }, '2026-09-24': { receita: { ajust: 104000 } } };
  it('3 fotos a 30/15/7 dias: erros +30%, +15%, +4%; erro médio 16,3%, viés otimista', () => {
    const A = acuracia(fotos, 100000, '2026-10-01'); expect(A.n).toBe(3); expect(A.erroAbs).toBeCloseTo((0.3 + 0.15 + 0.04) / 3, 9); expect(A.vies!).toBeGreaterThan(0);
    expect(A.a30).toBeCloseTo(0.3); expect(A.a15).toBeCloseTo(0.15); expect(A.a7).toBeCloseTo(0.04);
    const G = acuraciaGeral([A, acuracia({ '2026-08-02': { receita: { ajust: 90000 } } }, 100000, '2026-09-01')])!;
    expect(G).toMatchObject({ n: 2, direcao: 'sem viés relevante', confiavel: true }); expect(G.erroAbs).toBeCloseTo((0.1633333 + 0.1) / 2, 5);
    expect(acuracia({}, 100000, '2026-10-01').n).toBe(0); expect(acuraciaGeral([])).toBeNull();
  });
  it('por pessoa com erro simétrico: quem previu e vendeu zero conta como erro grande', () => {
    const P = acuraciaPorPessoa([{ pessoa: 'Ana', previsto: 30000, real: 0 }, { pessoa: 'Bia', previsto: 20000, real: 21000 }]);
    expect(P[0]).toMatchObject({ pessoa: 'Ana', direcao: 'otimista' }); expect(P[0]!.vies).toBeCloseTo(2); expect(P[1]!.direcao).toBe('sem viés');
  });
});

describe('build-up faseado, proteção, saúde e contribuição', () => {
  const sem = [{ n: 1, ini: '2026-11-02', du: 5 }, { n: 2, ini: '2026-11-09', du: 5 }, { n: 3, ini: '2026-11-16', du: 5 }, { n: 4, ini: '2026-11-23', du: 5 }];
  it('600 leads, ciclo 45 d, 3 vendedores, teto 3: 2,83 reuniões/pessoa/dia, cabe; 17 assinadas para 15 efetivas', () => {
    let F = faseado({ leads: 600, realizadas: 150 }, 45, sem, 3, 3, 0.1, 15, 20000);
    expect(F.porPessoaDia).toBeCloseTo(170 / 20 / 3); expect(F.cabe).toBe(true); expect(F.porSemana[0]).toMatchObject({ leadsEntrar: 170, devemEntrarAte: '2026-09-18' }); expect(F).toMatchObject({ vendasLiq: 17, receitaLiq: 340000 });
    expect(faseado({ leads: 600, realizadas: 150 }, 45, sem, 2, 3, 0, 15, 20000).cabe).toBe(false); expect(faseado({ leads: 600, realizadas: 150 }, 45, sem, 3, null, 0, 15, 20000).cabe).toBeNull();
    F = faseado({ leads: 600, realizadas: 150 }, 45, sem, 3, 3, 0.1, 15, 20000, '2026-10-15'); expect(F.porSemana.reduce((a, w) => a + w.leadsEntrar, 0)).toBeGreaterThanOrEqual(680); expect(F.reunioesDia).toBeCloseTo(Math.ceil((150 * 17) / 15) / 20); expect(F.porSemana[0]!.atrasado).toBe(true); expect(F.atrasoEntrada).toBe(true);
    expect(faseado({ leads: 600, realizadas: 150 }, 45, sem, 3, 3, 0, 15, 20000, '2026-08-01').atrasoEntrada).toBe(false);
  });
  it('proteção: volume sobe e a proteção piora', () => {
    expect(protecao({ met: 'agendadas', delta: 25 }, [{ met: 'tx_compar', delta: -6, un: 'pp' }, { met: 'tx_oport', delta: 1, un: 'pp' }], 10, 2)).toEqual([{ met: 'tx_compar', delta: -6, un: 'pp' }]);
    expect(protecao({ met: 'propostas', delta: 30 }, [{ met: 'desconto_medio', delta: 3, un: 'pp' }], 10, 2).length).toBe(1);
    expect(protecao({ met: 'propostas', delta: 5 }, [{ met: 'desconto_medio', delta: 3, un: 'pp' }], 10, 2).length).toBe(0);
    expect(Object.keys(PROTECAO).every(k => PROTECAO[k]!.length > 0)).toBe(true);
  });
  it('saúde da inteligência', () => {
    const S = saude({ 'H-1': { disparos: 4, uteis: 3, naoProcede: 1, intervencoes: 2 } }, [{ codigo: 'H-1', estado: 'ativo' }, { codigo: 'H-2', estado: 'nao_avaliavel' }, { codigo: 'H-3', estado: 'inativo' }, { codigo: 'C-1', composto: true, estado: 'ativo' }], [{ final: 'sucesso', aval: {} }, { final: 'insucesso' }, {}]);
    expect(S).toMatchObject({ regras: 3, ativas: 1, naoAvaliaveis: 1, utilidade: 0.75, taxaIntervencao: 0.5, ciclosCompletos: 1, taxaConfirmacao: 0.5 }); expect(S.cobertura).toBeCloseTo(2 / 3);
  });
  it('contribuição necessária: F ÷ (1 − l/m); MC abaixo do lucro → sem meta; sem fixo → null', () => {
    let CN = contribuicaoNecessariaMes({ fixo: 40000, mcMes: 30000, mcPct: 0.25, lucroPct: 0.1, mcVenda: 4000, fracMes: 0.5 })!;
    expect(CN).toMatchObject({ empate: 40000, faltaEmpate: 10000, vendasEmpate: 3, ritmo: 60000 }); expect(CN.meta).toBeCloseTo(40000 / 0.6); expect(CN.vendasMeta).toBe(Math.ceil((40000 / 0.6 - 30000) / 4000));
    CN = contribuicaoNecessariaMes({ fixo: 40000, mcMes: 50000, mcPct: 0.08, lucroPct: 0.1, mcVenda: 4000 })!; expect(CN).toMatchObject({ meta: null, faltaEmpate: 0, vendasEmpate: 0 });
    expect(contribuicaoNecessariaMes({ fixo: 0, mcMes: 1 })).toBeNull();
  });
});
