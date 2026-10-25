/* Contrato: testes/lab_quarter.test.js da V1, com as chaves de indicador da V2. */
import { describe, expect, it } from 'vitest';
import {
  aprendizadoDe, aprovacao, avaliarIniciativa, avisos, bottomUp, capacidade, deslocarQuarter, desvio, diagnostico, diferencas, encadeamento, encerramento, fechamentoMes, foco, gatilhos,
  lacunasIniciativa, lacunasKR, marcosDaSemana, mesmaPessoa, metaVsCenarios, niveis, perguntas, pesosDoPrograma, pontuar, priorizar, publicar, repartir, reprevisao, resumoDiario, revisao, sequencia, tendencia, trimestre, TX, vago,
  type DocQuarter, type Medida,
} from '../src/quarter.js';

const ok_ = (v: number, n?: number): Medida => ({ v, n: n ?? 10, estado: 'ok' });

describe('calendário por chave', () => {
  it('quarter-calendário e ano fiscal', () => {
    const Q = trimestre('2026-11', 1)!;
    expect(Q.q).toBe(4); expect(Q.ciclos.join()).toBe('2026-10,2026-11,2026-12'); expect(Q.key).toBe('2026-10'); expect(Q.nome).toMatch(/4º quarter de 2026/);
    const F = trimestre('2026-02', 4)!;
    expect(F.q).toBe(4); expect(F.ciclos.join()).toBe('2026-01,2026-02,2026-03'); expect(F.ano).toBe(2025); expect(F.nome).toMatch(/2025\/26/);
    expect(trimestre('2026-04', 4)!.q).toBe(1); expect(trimestre('2026-04', 4)!.key).toBe('2026-04');
    expect(deslocarQuarter('2027-02', -1, 1)!.ciclos.join()).toBe('2026-10,2026-11,2026-12');
    expect(deslocarQuarter('2026-12', 1, 1)!.key).toBe('2027-01');
    expect(trimestre('2026-13', 1)).toBeNull(); expect(trimestre('', 1)).toBeNull();
  });
});

describe('desvio e tendência', () => {
  it('desvio', () => {
    const d = desvio(300000, 240000); expect(d.abs).toBe(-60000); expect(d.pct).toBeCloseTo(-0.2); expect(d.atingido).toBe(false);
    expect(desvio(0, 5).pct).toBeNull(); expect(desvio(0, 5).abs).toBe(5);
    expect(desvio(100, null).estado).toBe('sem_dado'); expect(desvio(null, 10).estado).toBe('sem_meta');
    expect(desvio(4, 2, true).atingido).toBe(true);
  });
  it('tendência', () => {
    expect(tendencia({ v: 120, estado: 'ok' }, { v: 100, estado: 'ok' }, 'leads').dir).toBe('melhorou');
    expect(tendencia({ v: 103, estado: 'ok' }, { v: 100, estado: 'ok' }, 'leads').dir).toBe('estavel');
    expect(tendencia({ v: 0.4, n: 3, estado: 'ok' }, { v: 0.2, n: 30, estado: 'ok' }, TX.oportVenda, 5).dir).toBe('amostra');
    expect(tendencia({ v: 0.2, n: 40, estado: 'ok' }, { v: 0.25, n: 40, estado: 'ok' }, TX.oportVenda, 5).dir).toBe('piorou');
    expect(tendencia({ v: 10, estado: 'ok' }, { v: 5, estado: 'ok' }, 't_contato').dir).toBe('piorou');
    expect(tendencia({ v: 1, estado: 'ok' }, null, 'leads').dir).toBe('sem_dado');
  });
});

describe('revisão do quarter anterior', () => {
  const ciclos = [
    { key: '2026-07', meta: { receita: { original: 100000, final: 100000 }, vendas: { original: 5, final: 5 } }, metas: { leads: 60 }, real: { receita: ok_(90000), leads: ok_(55) } },
    { key: '2026-08', meta: { receita: { original: 100000, final: 80000 }, vendas: { original: 5, final: 4 } }, metas: { leads: 60 }, real: { receita: ok_(70000), leads: ok_(50) } },
    { key: '2026-09', meta: { receita: { original: 100000, final: 100000 }, vendas: { original: 5, final: 5 } }, metas: { leads: 60 }, real: { receita: ok_(110000), leads: ok_(70) } },
  ];
  const total: Record<string, Medida> = { receita: ok_(270000, 13), vendas: ok_(13), leads: ok_(175), [TX.oportVenda]: ok_(0.2, 3), margem: { estado: 'semacesso' }, ticket: ok_(20769, 13) };
  const R = revisao({ ciclos, total, anterior: { receita: ok_(200000), leads: ok_(180), [TX.oportVenda]: ok_(0.3, 40) }, minN: 5 });
  const lin = (k: string) => R.linhas.find(l => l.ind === k)!;
  it('receita: final somada, original preservada, desvios, evolução, tendência', () => {
    expect(lin('receita').meta.final).toBe(280000); expect(lin('receita').meta.original).toBe(300000); expect(lin('receita').meta.revisada).toBe(true);
    expect(lin('receita').desvio.abs).toBe(-10000); expect(lin('receita').desvioOriginal!.abs).toBe(-30000);
    expect(lin('receita').evolucao.join()).toBe('90000,70000,110000');
    expect(lin('receita').tendencia.dir).toBe('melhorou'); expect(R.melhoraram).toContain('receita');
  });
  it('leads somados dos planos (180) e estável; taxa com amostra pequena; lacunas', () => {
    expect(lin('leads').meta.final).toBe(180); expect(lin('leads').tendencia.dir).toBe('estavel');
    expect(lin(TX.oportVenda).amostraBaixa).toBe(true); expect(lin(TX.oportVenda).tendencia.dir).toBe('amostra'); expect(R.lacunas.some(l => l.ind === TX.oportVenda)).toBe(true);
    expect(lin('margem').v).toBeNull(); expect(R.lacunas.some(l => l.ind === 'margem' && /sem acesso/.test(l.texto))).toBe(true);
    expect(R.lacunas.some(l => l.ind === 'proposta_enviada' && /não diz nada/.test(l.texto))).toBe(true);
    expect(R.resumo.metaFinal).toBe(280000); expect(R.resumo.resultado).toBe(270000); expect(R.resumo.diferenca).toBe(-10000);
  });
  it('mês com meta desconhecida: sem meta do quarter (nunca soma parcial)', () => {
    const R2 = revisao({ ciclos: [ciclos[0]!, { key: 'x', meta: { receita: { final: null } }, real: {} }, ciclos[2]!], total, minN: 5 });
    expect(R2.linhas[0]!.meta.final).toBeNull(); expect(R2.linhas[0]!.meta.nota).toMatch(/2 de 3/);
  });
});

describe('iniciativas anteriores: execução × hipótese', () => {
  const marcos = (feitos: number, total: number) => { const o: Record<string, { st: string }> = {}; for (let i = 0; i < total; i++) o['m' + i] = { st: i < feitos ? 'concluido' : 'previsto' }; return o; };
  it('seis leituras', () => {
    expect(avaliarIniciativa({ ind: TX.oportVenda, minimo: 0.3, marcos: marcos(1, 4) }, ok_(0.2, 30), 5).k).toBe('mal_executada');
    expect(avaliarIniciativa({ ind: TX.oportVenda, minimo: 0.3, marcos: marcos(4, 4) }, ok_(0.2, 30), 5).k).toBe('sem_resultado');
    const a = avaliarIniciativa({ ind: TX.oportVenda, minimo: 0.3, marcos: marcos(4, 4) }, ok_(0.35, 30), 5); expect(a.k).toBe('funcionou'); expect(a.texto).toMatch(/não prova de causa/);
    expect(avaliarIniciativa({ ind: TX.oportVenda, minimo: 0.3, marcos: marcos(1, 4) }, ok_(0.35, 30), 5).k).toBe('resultado_sem_execucao');
    expect(avaliarIniciativa({ ind: TX.oportVenda, minimo: 0.3, marcos: marcos(4, 4) }, ok_(0.5, 2), 5).k).toBe('sem_dado');
    expect(avaliarIniciativa({ ind: 'leads', minimo: 10, marcos: marcos(2, 2) }, { estado: 'ausente' }, 5).k).toBe('sem_dado');
  });
  it('perguntas só onde há lacuna', () => {
    const P = perguntas({ linhas: [{ ind: 'leads', tendencia: { dir: 'piorou' } }, { ind: 'receita', tendencia: { dir: 'melhorou' } }, { ind: TX.oportVenda, tendencia: { dir: 'piorou' } }] },
      [{ id: 'a', nome: 'Roteiro SDR', ind: TX.oportVenda, aval: { k: 'mal_executada' } }, { id: 'b', nome: 'Indicação', ind: 'vendas', aval: { k: 'sem_resultado' } }], { deficitCapacidade: true });
    const ids = P.map(p => p.id);
    expect(ids).toEqual(expect.arrayContaining(['exec:a', 'hip:b', 'ext:leads', 'pos:receita', 'cap']));
    expect(ids).not.toContain('ext:' + TX.oportVenda);
    expect(perguntas({ linhas: [{ ind: 'leads', tendencia: { dir: 'estavel' } }] }, [{ id: 'x', nome: 'X', aval: { k: 'funcionou' } }]).length).toBe(0);
  });
});

describe('diagnóstico', () => {
  const D = diagnostico({
    minN: 5, ticket: 20000, leads: { real: 150, necessario: 200, leadVenda: 0.05 },
    conv: [{ k: 'sql_ganho', nome: 'oportunidade → venda', atual: { v: 0.15, n: 200, k: 30 }, ref: { v: 0.3, n: 200, k: 60 }, entradas: 100, jusante: 1 },
      { k: 'lead_ag', nome: 'lead → reunião agendada', atual: { v: 0.3, n: 4 }, ref: { v: 0.45, n: 50 }, entradas: 4, jusante: 0.2 },
      { k: 'ag_real', nome: 'agendada → realizada', atual: { v: 0.7, n: 60, k: 42 }, ref: { v: 0.72, n: 60, k: 43 } }],
    ticketQ: { atual: 17000, ref: 20000, n: 12, nRef: 30, vendas: 12 }, margem: { semAcesso: true }, ciclo: { atual: 60, ref: 40, n: 12, receitaMes: 100000 },
    capacidade: { deficit: 12, etapa: 'reuniões realizadas' }, canais: [{ canal: 'Indicação', receita: 200000, vendas: 10 }, { canal: 'Google', receita: 40000, vendas: 2 }], perdas: { Preço: 6, 'Sem retorno do cliente': 4 },
    faltam: [{ falta: 'contatos não lançados', efeito: 'a taxa contato → reunião não é calculável' }],
  });
  const dg = (k: string) => D.find(x => x.k === k)!;
  it('cada dimensão com estado da evidência e impacto com premissas', () => {
    expect(dg('demanda').estado).toBe('comprovado'); expect(dg('demanda').impacto!.valor).toBeCloseTo(50 * 0.05 * 20000); expect(dg('demanda').impacto!.premissas.some(p => /potencial, não receita perdida/.test(p))).toBe(true);
    expect(dg('conv:sql_ganho').estado).toBe('comprovado'); expect(dg('conv:sql_ganho').impacto!.valor).toBeCloseTo(100 * 0.15 * 1 * 20000);
    expect(dg('conv:lead_ag').estado).toBe('hipotese'); expect(dg('conv:lead_ag').evidencia).toMatch(/Amostra abaixo/);
    expect(dg('conv:ag_real').estado).toBe('ok');
    expect(dg('ticket').estado).toBe('comprovado'); expect(dg('ticket').impacto!.valor).toBe(12 * 3000);
    expect(dg('margem').estado).toBe('sem_dado'); expect(dg('margem').evidencia).toMatch(/Sem acesso/);
    expect(dg('ciclo').estado).toBe('comprovado'); expect(dg('ciclo').impacto!.tipo).toBe('atraso_financeiro'); expect(dg('ciclo').impacto!.premissas.some(p => /deslocada/.test(p))).toBe(true);
    expect(dg('capacidade').estado).toBe('comprovado');
    expect(dg('perdas').estado).toBe('hipotese');
    expect(dg('canal').estado).toBe('comprovado'); expect(dg('canal').impacto!.tipo).toBe('receita_em_risco');
    expect(D.some(x => /entrega|operacional|obra/i.test(x.dim))).toBe(false);
    expect(D.some(x => /contatos não lançados/.test(x.dim) && x.estado === 'sem_dado')).toBe(true);
    expect(D[0]!.estado).toBe('comprovado'); expect(D.findIndex(x => x.estado === 'hipotese')).toBeGreaterThan(D.findIndex(x => x.estado === 'comprovado')); expect(D[D.length - 1]!.estado).not.toBe('comprovado');
  });
});

describe('priorização explicável', () => {
  it('pontos visíveis e ordem', () => {
    const pt = pontuar({ impacto: 3, evidencia: 3, urgencia: 2, controle: 2, esforco: 3, custo: 1, risco: 2, tempo: 2, dependencias: 2 });
    expect(pt.pontos).toBe(2); expect(pt.porque).toMatch(/impacto esperado alto/); expect(pt.porque).toMatch(/esforço necessário alto/);
    expect(pontuar({ evidencia: 3 }).porque).toMatch(/sem avaliação: Impacto esperado/);
    expect(priorizar([{ id: 'a', crit: { impacto: 1 } }, { id: 'b', crit: { impacto: 3 } }, { id: 'c', crit: { impacto: 3 }, impacto: { valor: 9 } }]).map(x => x.id).join()).toBe('c,b,a');
    expect(priorizar([{ id: 'a', crit: { impacto: 1 }, ordem: 1 }, { id: 'b', crit: { impacto: 3 } }])[0]!.id).toBe('a');
    expect(foco(Array(6).fill({ st: 'aceita' })).aviso).toMatch(/acima de 5/); expect(foco(Array(3).fill({ st: 'aceita' })).aviso).toBe('');
  });
});

describe('meta × cenários', () => {
  it('mostra o que a meta exige, não reduz a meta', () => {
    const V = metaVsCenarios(1000000, { continuidade: 700000, conservador: 650000, base: 800000, otimista: 950000 }, { fixo: 200000, novo: 600000 }, ['conversão oportunidade → venda +20% (hipótese)']);
    if ('erro' in V) throw new Error(V.erro);
    expect(V.meta).toBe(1000000); expect(V.linhas.some(l => l.alcanca)).toBe(false); expect(V.leitura).toMatch(/acima de todos/);
    expect(V.exige!.fator).toBeCloseTo(800000 / 600000 - 1); expect(V.dependencias.length).toBe(1);
    const W = metaVsCenarios(600000, { continuidade: 700000, conservador: 650000, base: 800000, otimista: 950000 }); expect('leitura' in W && W.leitura).toMatch(/pouco ambiciosa/);
    expect('erro' in metaVsCenarios(null, {})).toBe(true);
  });
  it('repartição e pesos', () => {
    const rep = repartir(900000, [20, 22, 18]); expect(rep.reduce<number>((a, x) => a + (x ?? 0), 0)).toBeCloseTo(900000); expect(rep[1]).toBeCloseTo((900000 * 22) / 60);
    const pz = pesosDoPrograma([300000, 400000, 200000], [20, 20, 20]); expect(pz[0]! / pz[1]!).toBeCloseTo(0.75); expect(pz[2]! / pz[1]!).toBeCloseTo(0.5);
  });
});

describe('campos obrigatórios e níveis', () => {
  it('lacunas', () => {
    expect(lacunasKR({ ind: 'receita', partida: 1, alvo: 2, criterio: 'x' }).join()).toBe('responsável,frequência de acompanhamento');
    expect(vago('Melhorar o comercial')).toBe(true); expect(vago('aumentar vendas')).toBe(true); expect(vago('Reduzir no-show com confirmação 24 h antes por WhatsApp')).toBe(false);
    const f = lacunasIniciativa({ nome: 'Aumentar vendas', prio: 'p1', resp: 'Ana' });
    expect(f[0]).toMatch(/intenção/); expect(f).toContain('hipótese'); expect(f).toContain('critério para interromper'); expect(f).toContain('ao menos um entregável ou marco');
  });
  it('quatro níveis separados', () => {
    const N = niveis({ ind: 'leads', minimo: 80, alvo: 100, marcos: { a: { st: 'concluido' }, b: { st: 'previsto', prazo: '2026-10-01' } } }, ok_(90), '2026-10-20');
    expect(N.entregavel.estado).toBe('atrasado'); expect(N.hipotese.estado).toBe('validada'); expect(N.resultado.estado).toBe('nao_atingido');
    const x = niveis({ ind: TX.leadAg, minimo: 0.4, alvo: 0.5 }, ok_(1, 1), '2026-10-20', 5); expect(x.hipotese.estado).toBe('amostra'); expect(x.resultado.estado).toBe('amostra');
  });
});

describe('bottom-up', () => {
  const tx = { [TX.oportVenda]: { v: 0.25, fonte: 'hist', n: 40 }, [TX.realOport]: { v: 0.5, fonte: 'manual' }, [TX.agReal]: { v: 0.8, fonte: 'hist' }, [TX.leadAg]: { v: 0.4, fonte: 'hist' }, [TX.contatoAg]: { v: 0.1, fonte: 'hist' } };
  it('20 vendas → 80 oport → 160 realizadas → 200 agendadas → 500 leads → 2000 contatos', () => {
    const B = bottomUp(400000, tx, { v: 20000, fonte: 'hist' }, { cicloDias: 35, capacidade: { reuniao_realizada: 100 } });
    if ('erro' in B) throw new Error(B.erro);
    const bp = (k: string) => B.passos.find(p => p.k === k)!;
    expect(bp('vendas').v).toBeCloseTo(20); expect(bp('oportunidades').v).toBeCloseTo(80); expect(bp('reuniao_realizada').v).toBeCloseTo(160); expect(bp('agendamento').v).toBeCloseTo(200); expect(bp('leads').v).toBeCloseTo(500); expect(bp('contato').v).toBeCloseTo(2000);
    expect(bp('reuniao_realizada').fonte).toBe('manual'); expect(bp('oportunidades').fonte).toBe('hist');
    expect(B.defasagem!.dias).toBe(35); expect(B.defasagem!.texto).toMatch(/mês anterior/);
    expect(B.sobrecarga.some(s => s.k === 'reuniao_realizada' && Math.abs(s.deficit - 60) < 1e-6)).toBe(true);
  });
  it('sem taxa para no passo; sem ticket erro', () => {
    const B = bottomUp(400000, { [TX.oportVenda]: { v: 0.25 } }, { v: 20000 });
    if ('erro' in B) throw new Error(B.erro);
    expect(B.passos.find(p => p.k === 'reuniao_realizada')!.v).toBeNull(); expect(B.falta).toContain(TX.realOport); expect(B.passos.find(p => p.k === 'reuniao_realizada')!.como).toMatch(/reunião realizada → oportunidade/);
    expect('erro' in bottomUp(1, tx, { v: null })).toBe(true);
  });
});

describe('capacidade e sequência', () => {
  const inis = [{ id: 'a', nome: 'Canal novo', resp: 'Ana', horas: 30, orcamento: 5000, meses: [0, 1], prioOrdem: 1 }, { id: 'b', nome: 'Roteiro', resp: 'Ana', horas: 20, meses: [0], prioOrdem: 2 }, { id: 'c', nome: 'Proposta', resp: 'Bia', horas: 10, meses: [2], prioOrdem: 3 }];
  it('capacidade', () => {
    let Cp = capacidade(inis, { pessoas: { Ana: 40, Bia: 40 }, operacao: 0, orcamento: 3000 });
    expect(Cp.meses[0]!.excesso.some(x => x.p === 'Ana' && Math.abs(x.falta - 10) < 1e-6)).toBe(true); expect(Cp.sobrecarga).toBe(true);
    expect(Cp.orcamento.excesso).toBe(2000);
    expect(['priorizar', 'redistribuir', 'adiar', 'reforcar'].every(k => Cp.alternativas.some(a => a.k === k))).toBe(true); expect(Cp.alternativas[0]!.texto).toMatch(/"Proposta"/);
    Cp = capacidade(inis, { pessoas: { Ana: 80, Bia: 40 }, operacao: 0.25 });
    expect(Cp.meses[0]!.excesso.length).toBe(0); expect(Cp.meses[0]!.porPessoa.Ana!.cap).toBeCloseTo(60);
    expect(capacidade([{ id: 'x', nome: 'X', resp: 'Caio', horas: 5 }], { pessoas: { Ana: 40 } }).meses[0]!.excesso.some(x => x.p === 'Caio')).toBe(true);
  });
  it('sequência', () => {
    const S = sequencia([{ id: 'a', nome: 'Configurar campanha', implantacaoDias: 30 }, { id: 'b', nome: 'Ajustar oferta', deps: ['a'], implantacaoDias: 10 }, { id: 'c', nome: 'Treino', implantacaoDias: 0 }], { cicloDias: 40 });
    if ('erro' in S) throw new Error(S.erro);
    const sq = (id: string) => S.itens.find(x => x.id === id)!;
    expect(sq('b').mesInicio).toBe(1); expect(sq('b').texto).toMatch(/depende de "Configurar campanha"/); expect(sq('c').mesInicio).toBe(0);
    const X = sequencia([{ id: 'x', nome: 'X', implantacaoDias: 60 }], { cicloDias: 45 }); if ('erro' in X) throw new Error(X.erro); expect(X.itens[0]!.foraDoQuarter).toBe(true);
    const C = sequencia([{ id: 'a', nome: 'A', deps: ['b'] }, { id: 'b', nome: 'B', deps: ['a'] }]); expect('erro' in C && C.erro).toMatch(/circular/);
  });
});

describe('gatilhos', () => {
  it('não reage a amostra pequena', () => {
    const G = gatilhos([{ ind: TX.oportVenda, op: 'abaixo', limite: 0.2, acao: 'investigar a etapa' }, { ind: TX.leadAg, op: 'abaixo', limite: 0.3 }, { ind: 'leads', op: 'abaixo', limite: 100 }, { ind: 'receita', op: 'abaixo' }],
      { [TX.oportVenda]: ok_(0.15, 30), [TX.leadAg]: ok_(0.1, 2), leads: { estado: 'ausente' } }, 5);
    expect(G[0]!.estado).toBe('disparado'); expect(G[0]!.texto).toMatch(/investigar a etapa/);
    expect(G[1]!.estado).toBe('amostra'); expect(G[2]!.estado).toBe('sem_dado'); expect(G[3]!.estado).toBe('incompleto');
  });
});

const qBom: DocQuarter = {
  objetivo: { texto: 'Crescer com margem', ind: 'receita', alvo: 900000 }, prioridades: { p1: { titulo: 'Conversão', st: 'aceita' } },
  iniciativas: { i1: { nome: 'Roteiro de qualificação antes da reunião', prio: 'p1', resp: 'Ana', problema: 'x', hipotese: 'x', variavel: 'x', ind: TX.oportVenda, inicial: 0.15, alvo: 0.25, minimo: 0.2, continuar: 'x', corrigir: 'x', interromper: 'x', marcos: { m1: { txt: 'roteiro', st: 'previsto' } } } },
  krs: { k1: { ind: 'receita', partida: 270000, alvo: 900000, resp: 'Bruno', criterio: '≥ meta', freq: 'semanal', tipo: 'resultado' }, k2: { ind: 'oportunidades', partida: 80, alvo: 120, resp: 'Ana', criterio: 'x', freq: 'semanal', tipo: 'antecedente' } },
  meses: { 0: { resultado: 'x', criterio: 'y', meta: 300000 }, 1: { resultado: 'x', criterio: 'y', meta: 300000 }, 2: { resultado: 'x', criterio: 'y', meta: 300000 } }, riscos: { r1: { txt: 'Google deixa de gerar leads', resposta: 'x' } }, gatilhos: { g1: { ind: TX.oportVenda } },
};
describe('aprovação, versões, reprevisão, encerramento', () => {
  it('aprovação', () => {
    let A = aprovacao(qBom, {}); expect(A.ok).toBe(true); expect(A.avisos.length).toBe(1); expect(A.avisos[0]).toMatch(/padrão é de 3 a 5/);
    A = aprovacao({ ...qBom, meses: { 0: { resultado: 'x', criterio: 'y', meta: 300000 }, 1: { resultado: 'x', criterio: 'y', meta: 300000 }, 2: { resultado: 'x', meta: 200000 } } }, { capacidade: { sobrecarga: true } });
    expect(A.ok).toBe(false); expect(A.bloqueios.some(b => /Mês 3: falta o critério/.test(b))).toBe(true); expect(A.bloqueios.some(b => /somam R\$ 800\.000/.test(b))).toBe(true); expect(A.bloqueios.some(b => /capacidade declarada/.test(b))).toBe(true);
    expect(aprovacao({ prioridades: { p1: { titulo: 'Conversão', st: 'aceita' } } }).bloqueios.some(b => /"Conversão" não tem iniciativa/.test(b))).toBe(true);
  });
  it('versões', () => {
    let Pb = publicar(qBom, '', { agora: 1, autor: 'Bruno' });
    if ('erro' in Pb) throw new Error(Pb.erro);
    expect(Pb.versao).toBe(1); expect(Pb.patch.status).toBe('publicado'); expect((Pb.patch.versoes.v1!.objetivo as { alvo: number }).alvo).toBe(900000); expect(Pb.patch.versoes.v1!.motivo).toBe('primeira publicação');
    const pub = { ...qBom, ...Pb.patch };
    expect(('erro' in publicar(pub, '  ') && publicar(pub, '  ').erro) || '').toMatch(/motivo/);
    Pb = publicar({ ...pub, objetivo: { texto: 'x', alvo: 800000 } }, 'conversão do Google abaixo do previsto', { agora: 2 });
    if ('erro' in Pb) throw new Error(Pb.erro);
    expect(Pb.versao).toBe(2); expect(Pb.patch.versoes.v2).toBeTruthy(); expect(Pb.patch.versoes.v1).toBeUndefined(); expect(Pb.patch.versoes.v2!.motivo).toBe('conversão do Google abaixo do previsto');
    expect(diferencas(pub.versoes.v1!, Pb.patch.versoes.v2!).join()).toBe('objetivo');
    expect('erro' in publicar({ status: 'encerrado' }, 'x')).toBe(true);
  });
  it('reprevisão, fechamento do mês, encerramento', () => {
    const Rp = reprevisao({ original: 900000 }, 400000, 820000, [{ impacto: 20000 }]);
    expect(Rp.metaOriginal).toBe(900000); expect(Rp.metaVigente).toBe(900000); expect(Rp.projecaoComAtrasos).toBe(800000); expect(Rp.leitura).toMatch(/não muda sozinha/);
    const F = fechamentoMes([{ id: 'a' }, { id: 'b' }, { id: 'c' }], { a: 'concluido', b: 'pendente' });
    expect(F.seguem.map(x => x.id).join()).toBe('b'); expect(F.completo).toBe(false); expect(F.semClassificar[0]!.id).toBe('c');
    const Pb = publicar(qBom, '', { agora: 1 }); if ('erro' in Pb) throw new Error(Pb.erro);
    const pub = { ...qBom, ...Pb.patch };
    const E = encerramento({ ...pub, objetivo: { alvo: 800000 }, iniciativas: { i1: { ...qBom.iniciativas!.i1!, marcos: { m1: { st: 'concluido' } } }, i2: { nome: 'Canal', st: 'cancelada' } } }, { real: 850000, inis: { i1: ok_(0.28, 40) }, minN: 5 });
    expect(E.metaOriginal).toBe(900000); expect(E.metaFinal).toBe(800000); expect(E.desvio.abs).toBe(-50000);
    expect(E.confirmadas.length).toBe(1); expect(E.abandonadas.length).toBe(1);
  });
});

describe('avisos', () => {
  const qPub: DocQuarter = { status: 'publicado', fechMes: {} };
  const base = () => ({
    hoje: '2026-10-21', T: { key: '2026-10', curto: 'Q4 2026' }, q: qPub, mesKey: '2026-10', semana: '2026-10-19',
    prox: { key: '2027-01', curto: 'Q1 2027', ini: '2027-01-01' }, ant: { key: '2026-07', curto: 'Q3 2026', fimISO: '2026-09-30' },
    gatilhos: [{ id: 'g1', estado: 'disparado', nome: 'Oportunidade → venda', vTxt: '15%', limiteTxt: 'abaixo de 20%', acao: 'investigar a etapa' }, { id: 'g2', estado: 'amostra' }, { id: 'g3', estado: 'ok' }],
    proj: { metaVigente: 450000, projecao: 400000, realizado: 30000, diasDecorridos: 20 },
    meses: [{ m: 0, nome: 'out/2026', fim: '2026-10-31', iniciou: true }, { m: 1, nome: 'nov/2026', fim: '2026-11-30', iniciou: false }],
    inis: [{ id: 'i1', nome: 'Responder na 1ª hora', marcos: [{ id: 'a', txt: 'Alerta de lead', prazo: '2026-10-15', st: 'previsto' }, { id: 'b', txt: 'Roteiro', prazo: '2026-10-15', st: 'concluido' }, { id: 'c', txt: 'Treino', prazo: '2026-11-10', st: 'previsto' }] }],
  });
  it('gatilho, marco, projeção, fases', () => {
    const Av = avisos(base()), ids = Av.map(a => a.id);
    expect(ids).toContain('lq:gat:2026-10:g1:2026-10'); expect(ids.some(i => /:g2:|:g3:/.test(i))).toBe(false);
    expect(ids.filter(i => /^lq:marco:/.test(i)).join()).toBe('lq:marco:2026-10:i1:a');
    expect(ids).toContain('lq:proj:2026-10:2026-10-19'); expect(Av.find(a => /proj/.test(a.id))!.titulo).toMatch(/R\$ 400\.000 de R\$ 450\.000/);
    expect(ids.some(i => /^lq:fech:/.test(i))).toBe(false); expect(ids.some(i => /^lq:prox:/.test(i))).toBe(false);
    expect(Av.find(a => /marco/.test(a.id))!.fase).toBe('iniciativas'); expect(Av.find(a => /gat/.test(a.id))!.fase).toBe('publicar');
  });
  it('limiares de projeção e calendário', () => {
    expect(avisos({ ...base(), proj: { metaVigente: 450000, projecao: 440000, realizado: 30000, diasDecorridos: 20 } }).some(a => /proj/.test(a.id))).toBe(false);
    expect(avisos({ ...base(), proj: { metaVigente: 450000, projecao: 100000, realizado: 0, diasDecorridos: 5 } }).some(a => /proj/.test(a.id))).toBe(false);
    expect(avisos({ ...base(), hoje: '2026-10-30' }).some(a => a.id === 'lq:fech:2026-10:0' && /fecha em 2 dias/.test(a.titulo))).toBe(true);
    expect(avisos({ ...base(), hoje: '2026-11-03' }).some(a => a.id === 'lq:fech:2026-10:0' && /pendente/.test(a.titulo))).toBe(true);
    expect(avisos({ ...base(), hoje: '2026-11-03', q: { status: 'publicado', fechMes: { 0: { em: 1 } } } }).some(a => /^lq:fech:/.test(a.id))).toBe(false);
    expect(avisos({ ...base(), hoje: '2026-12-20' }).some(a => a.id === 'lq:prox:2027-01' && /12 dias e ainda não tem plano/.test(a.titulo) && a.fase === 'visao')).toBe(true);
    expect(avisos({ ...base(), hoje: '2026-12-20', proxDoc: { status: 'rascunho' } }).some(a => a.id === 'lq:prox:2027-01' && /rascunho/.test(a.titulo) && a.fase === 'publicar')).toBe(true);
    expect(avisos({ ...base(), hoje: '2026-12-20', proxDoc: { status: 'publicado' } }).some(a => /^lq:prox:/.test(a.id))).toBe(false);
    expect(avisos({ ...base(), antDoc: { status: 'publicado' } }).some(a => a.id === 'lq:enc:2026-07')).toBe(true);
    expect(avisos({ ...base(), q: { status: 'rascunho' } }).length).toBe(0);
    expect(avisos({ ...base(), q: null }).length).toBe(0); expect(avisos({}).length).toBe(0);
  });
});

describe('Fechamento do dia dentro do quarter, aprendizado, encadeamento, marcos', () => {
  it('resumo diário', () => {
    const LD = [{ data: '2026-09-30', resumo: { status: 'critico', desvio: 'Ana sem reuniões' } }, { data: '2026-10-05', resumo: { status: 'atencao', desvio: 'Ana sem reuniões', risco: '' } },
      { data: '2026-10-06', resumo: { status: 'bom' } }, { data: '2026-10-07', resumo: { status: 'atencao', desvio: 'Ana sem reuniões', risco: 'Meta do Q4 2026 em risco' } },
      { data: '2026-10-08', resumo: { status: 'critico', desvio: 'Leads de Google abaixo', risco: 'Meta do Q4 2026 em risco' } }, { data: '2026-10-09' }];
    const DR = resumoDiario(LD, '2026-10-01', '2026-10-21', 'Q4 2026');
    expect(DR.dias).toBe(4); expect(DR.por.bom).toBe(1); expect(DR.por.atencao).toBe(2); expect(DR.por.critico).toBe(1);
    expect(DR.recorrentes.some(r => r.txt === 'Ana sem reuniões' && r.n === 2 && r.ultima === '2026-10-07' && !r.quarter)).toBe(true);
    expect(DR.diasQuarterRisco).toBe(2); expect(DR.recorrentes.some(r => r.quarter && r.n === 2)).toBe(true);
    expect(resumoDiario(null, 'a', 'b').dias).toBe(0); expect(resumoDiario({ erro: 'x' }, 'a', 'b').dias).toBe(0);
  });
  it('aprendizado sugerido', () => {
    const iniA = { nome: 'Responder na 1ª hora', ind: TX.leadAg, inicial: 0.3, hipotese: 'responder rápido dobra o agendamento', ampliar: '≥ 50% por 2 meses' };
    let Ap = aprendizadoDe(iniA, { k: 'funcionou', execucao: 1, minimo: 0.4, v: 0.45, marcos: { feitos: 2, total: 2 } }, () => 'Lead → reunião agendada', v => (v == null ? '—' : Math.round(v * 100) + '%'));
    expect(Ap.conclusao).toMatch(/produziu o resultado mínimo/); expect(Ap.evidencia).toBe('Lead → reunião agendada: inicial 30%, mínimo 40%, observado 45% · 2 de 2 marcos concluídos'); expect(Ap.implicacao).toMatch(/ampliar se ≥ 50%/); expect(Ap.confianca).toBe('media');
    Ap = aprendizadoDe(iniA, { k: 'mal_executada', execucao: 0.25, minimo: 0.4, v: 0.2 }, () => 'X');
    expect(Ap.conclusao).toMatch(/continua sem teste/); expect(Ap.confianca).toBe('baixa'); expect(Ap.implicacao).toMatch(/testar de novo/);
    expect(aprendizadoDe(iniA, { k: 'sem_dado' }).conclusao).toMatch(/Sem medida suficiente/);
  });
  it('encadeamento', () => {
    const qE: DocQuarter = {
      objetivo: { texto: 'Crescer', ind: 'receita', alvo: 900000 }, krs: { k1: { ind: 'oportunidades', tipo: 'antecedente', alvo: 120 } },
      prioridades: { p1: { titulo: 'Conversão', st: 'aceita', diag: 'conv:oport_venda', crit: { impacto: 3 } }, p2: { titulo: 'Própria', st: 'propria', justificativa: 'tempo de resposta alto' }, p3: { titulo: 'Rejeitada', st: 'rejeitada' } },
      iniciativas: { a: { nome: 'Roteiro', prio: 'p1', ind: TX.oportVenda, inicial: 0.2, minimo: 0.25, alvo: 0.3, meses: [0, 1], marcos: { m1: { mes: 0, txt: 'Escrever', st: 'concluido' }, m2: { mes: 1, txt: 'Treinar' } } }, b: { nome: 'Alerta', prio: 'p2', meses: [2] }, c: { nome: 'Solta', prio: 'p3' }, x: { nome: 'Cancelada', prio: 'p1', st: 'cancelada' } },
      meses: { 0: { meta: 300000, resultado: 'r1' }, 1: { meta: 300000 }, 2: { meta: 300000 } },
    };
    const En = encadeamento(qE, [{ k: 'conv:oport_venda', dim: 'Conversão oportunidade → venda', estado: 'comprovado', evidencia: '15% contra 30%', impacto: null }], { objetivo: 270000, krs: { k1: 80 }, inis: { a: { v: 0.22, n: 40, estado: 'ok' } }, meses: [90000, 70000, null] });
    expect(En.objetivo.alvo).toBe(900000); expect(En.objetivo.obs).toBe(270000); expect(En.krs[0]!.obs).toBe(80);
    expect(En.ramos[0]!.problema.estado).toBe('comprovado'); expect(En.ramos[0]!.problema.evidencia).toMatch(/15% contra 30%/);
    expect(En.ramos.find(r => r.prio.id === 'p2')!.problema.dim).toBe('tempo de resposta alto');
    const i = En.ramos[0]!.iniciativas[0]!; expect(i.nome).toBe('Roteiro'); expect(i.obs!.v).toBe(0.22); expect(i.meses.length).toBe(2); expect(i.meses[0]!.marcos[0]!.st).toBe('concluido'); expect(i.meses[1]!.marcos[0]!.st).toBe('previsto');
    expect(En.ramos.length).toBe(2); expect(En.ramos[0]!.iniciativas.some(x => x.nome === 'Cancelada')).toBe(false); expect(En.soltas.map(x => x.nome).join()).toBe('Solta');
    expect(En.meses[0]!.meta).toBe(300000); expect(En.meses[0]!.obs).toBe(90000); expect(En.meses[2]!.obs).toBeNull();
    expect(encadeamento(null).ramos.length).toBe(0);
  });
  it('marcos no plano do dia', () => {
    expect(mesmaPessoa('Ana', 'Ana Souza')).toBe(true); expect(mesmaPessoa('ANA SOUZA', 'Ana Souza')).toBe(true); expect(mesmaPessoa('Joao', 'João Lima')).toBe(true); expect(mesmaPessoa('Ana Lima', 'Ana Souza')).toBe(false); expect(mesmaPessoa('', 'Ana')).toBe(false);
    const qM: DocQuarter = { iniciativas: { i1: { nome: 'Responder na 1ª hora', resp: 'Ana', marcos: { a: { txt: 'Alerta', prazo: '2026-10-15' }, b: { txt: 'Roteiro', prazo: '2026-10-24', resp: 'Bruno' }, c: { txt: 'Treino', prazo: '2026-10-27' }, d: { txt: 'Longe', prazo: '2026-11-10' }, e: { txt: 'Feito', prazo: '2026-10-20', st: 'concluido' }, f: { txt: 'Sem prazo' } } }, i2: { nome: 'Cancelada', st: 'cancelada', resp: 'Ana', marcos: { x: { txt: 'X', prazo: '2026-10-22' } } } } };
    let MS = marcosDaSemana(qM, '2026-10-21', 'Ana Souza');
    expect(MS.itens.map(x => x.txt + ':' + x.situacao + ':' + x.dias).join()).toBe('Alerta:atrasado:6,Treino:semana:6'); expect(MS.ate).toBe('2026-10-27');
    MS = marcosDaSemana(qM, '2026-10-21'); expect(MS.itens.map(x => x.txt + ':' + x.resp).join()).toBe('Alerta:Ana,Roteiro:Bruno,Treino:Ana');
    expect(marcosDaSemana(null, '2026-10-21').itens.length).toBe(0); expect(marcosDaSemana(qM, '').itens.length).toBe(0);
  });
});
