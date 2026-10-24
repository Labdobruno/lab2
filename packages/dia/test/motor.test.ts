import { describe, expect, it } from 'vitest';
import { beneficio, capacidadeObservada, cenarios, gargalo, negligencia, ordenar, padrao, quadrante, sistemico, viabilidade } from '../src/index.js';

const perto = (a: number, b: number, e = 1e-6) => Math.abs(a - b) < e;

describe('motor do plano do dia (plano_dia.test da V1)', () => {
  it('1. quadrante: separa insuficiência de resultado de atraso operacional', () => {
    expect(quadrante({ meta: 100, feito: 95 }, { meta: 4, feito: 4 }).tipo).toBe('em_dia');
    expect(quadrante({ meta: 100, feito: 100 }, { meta: 4, feito: 1 }).tipo).toBe('resultado');
    expect(quadrante({ meta: 100, feito: 50 }, { meta: 4, feito: 4 }).tipo).toBe('operacional');
    expect(quadrante({ meta: 100, feito: 50 }, { meta: 4, feito: 1 }).tipo).toBe('ambos');
    expect(quadrante(null, { meta: 0, feito: 2 }).tipo).toBe('sem_dado');
    expect(quadrante({ meta: 100, feito: 40 }, null).tipo).toBe('operacional');
  });
  it('2. viabilidade: meta impossível não passa calada', () => {
    expect(viabilidade({ falta: 40, metaHoje: 40, atraso: 0, cap: 60, metaRestante: 400, diasRest: 10 }).st).toBe('ok');
    const j = viabilidade({ falta: 140, metaHoje: 40, atraso: 100, cap: 70, metaRestante: 400, diasRest: 10 });
    expect(j.st).toBe('janela'); expect(perto(j.ritmoJanela, 60)).toBe(true);
    const c = viabilidade({ falta: 340, metaHoje: 40, atraso: 300, cap: 70, metaRestante: 400, diasRest: 10 });
    expect(c.st).toBe('ciclo'); expect(perto(c.ritmoFim, 740 / 11)).toBe(true);
    const i = viabilidade({ falta: 940, metaHoje: 40, atraso: 900, cap: 70, metaRestante: 400, diasRest: 10 });
    expect(i.st).toBe('inviavel'); expect(i.txt).toMatch(/Decisão gerencial/); expect(i.deficit!).toBeGreaterThan(0);
    expect(viabilidade({ falta: 10, metaHoje: 10, atraso: 0, cap: null, diasRest: 5 }).st).toBe('sem_cap');
  });
  it('3. negligência: idade sozinha não decide; valor e tipo de falha pesam', () => {
    expect(negligencia({ etapaIdx: 2, diasSemAtiv: 1, diasNaEtapa: 1, refEtapa: 5, valor: 30000, pv: 0.3 }).alerta).toBe(false);
    const n = negligencia({ etapaIdx: 3, diasSemAtiv: 6, diasNaEtapa: 9, refEtapa: 5, valor: 48000, pv: 0.4, semProximo: true, proposta: true });
    expect(n).toMatchObject({ alerta: true, classe: 'critica', prazo: 'hoje' }); expect(n.motivos.length).toBeGreaterThanOrEqual(3);
    const caro = negligencia({ diasSemAtiv: 6, valor: 80000, pv: 0.4, semProximo: true }), barato = negligencia({ diasSemAtiv: 20, valor: 3000, pv: 0.1, semProximo: true });
    expect(caro.score!).toBeGreaterThan(barato.score!);
    expect(negligencia({ diasSemAtiv: 0, semHistorico: true }).classe).toBe('normal');
  });
  it('4. ordem: classe, depois quem habilita mais, depois horário, depois valor', () => {
    const O = ordenar([{ id: 'n', classe: 'normal', score: 999 }, { id: 'a1', classe: 'alta', score: 1 }, { id: 'c', classe: 'critica', score: 1 }, { id: 'a2', classe: 'alta', score: 1, habilita: 10 }, { id: 'e', classe: 'estrategica', score: 1e6 }]);
    expect(O.map(x => x.id).join(',')).toBe('c,a2,a1,n,e');
  });
  it('5. cenários com recuperação distribuída: atraso 20, meta 40, alvo 44 (janela 5), feito 14', () => {
    const S = cenarios({ etapas: [{ k: 'tentativa', nome: 'Tentativas', falta: 30, metaHoje: 40, feito: 14, alvo: 44, atrasoTotal: 20, metaAmanha: 40, jAmanha: 5, tx: 0.1, para: 'reuniões' }],
      pend: { tarefasVencidas: 2, tarefasHoje: 1, cadVencidos: 3, semCad: 1, semProximo: 2 }, amanha: { tarefas: 2, reunioes: 1 }, cap: 60 });
    expect(S.exec.etapas[0]).toMatchObject({ atraso: 16, adicional: 4, amanha: 44 });
    expect(S.nao.etapas[0]).toMatchObject({ atraso: 46, adicional: 10, amanha: 50, planejado: 40 });
    expect(S.nao.pendencias).toBe(7); expect(S.exec.pendencias).toBe(0);
    expect(S.nao.tarefasAmanha).toBe(5); expect(S.exec.tarefasAmanha).toBe(2);
    expect(S.exec.esperado).toHaveLength(1); expect(perto(S.exec.esperado[0]!.n, 3)).toBe(true);
    const S1 = cenarios({ etapas: [{ k: 'tentativa', nome: 'Tentativas', falta: 30, metaHoje: 40, feito: 14, alvo: 44, atrasoTotal: 20, metaAmanha: 40, jAmanha: 1, tx: 0.1, para: 'reuniões' }], cap: 60 });
    expect(S1.nao.etapas[0]!.amanha).toBe(86); expect(S1.nao.sobrecarga).toBe(true); expect(S1.exec.sobrecarga).toBe(false);
  });
  it('6. padrão recorrente: 7 de 10 dias abaixo, 4 seguidos; poucos dias não conclui', () => {
    const dias = [10, 10, 4, 5, 3, 10, 2, 4, 5, 3].map((f, i) => ({ iso: `2026-10-${String(i + 1).padStart(2, '0')}`, meta: 10, feito: f }));
    expect(padrao(dias)).toMatchObject({ recorrente: true, abaixo: 7, seguidos: 4 });
    expect(padrao(dias.slice(0, 4)).recorrente).toBe(false);
  });
  it('7. gargalo: compara com plano, histórico e equipe; confiança pela amostra', () => {
    let G = gargalo({ tentativa: 200, contato: 0, agendamento: 10, reuniao_realizada: 8, oportunidades: 6, vendas: 1 }, { tentativa: 400, agendamento: 40, reuniao_realizada: 30 }, { 'tentativa>agendamento': 0.1, 'oportunidades>vendas': 0.3 }, null, { meta: 220, feito: 200 });
    const ca = G.find(g => g.chave === 'tentativa>agendamento')!;
    expect(perto(ca.real, 0.05)).toBe(true); expect(ca.ref).toBe(0.1); expect(ca.conf).toMatch(/alta/);
    expect(G.find(g => g.chave === 'oportunidades>vendas')!.conf).toMatch(/baixa/);
    expect(G.some(g => g.chave === 'atividade')).toBe(false);
    expect(G.every(g => g.teste && g.ind)).toBe(true);
    G = gargalo({ tentativa: 100, contato: 10, agendamento: 2 }, null, { 'contato>agendamento': 0.3 }, null, { meta: 300, feito: 100 });
    expect(G.some(g => g.chave === 'contato>agendamento')).toBe(true); expect(G.some(g => g.chave === 'tentativa>agendamento')).toBe(false);
    expect(G.some(g => g.chave === 'atividade')).toBe(true);
    const sis = sistemico({ A: [{ chave: 'agendamento>reuniao_realizada', nome: 'x' }], B: [{ chave: 'agendamento>reuniao_realizada', nome: 'x' }], C: [{ chave: 'oportunidades>vendas', nome: 'y' }] });
    expect(sis).toHaveLength(1); expect(sis[0]!.pessoas.join()).toBe('A,B');
  });
  it('8. benefício: 30 contatos → 3 reuniões → 1,8 realizadas; para na taxa ausente', () => {
    const B = beneficio(30, [{ para: 'reuniões', tx: 0.1 }, { para: 'realizadas', tx: 0.6 }, { para: 'vendas', tx: 0 }]);
    expect(B).toHaveLength(2); expect(perto(B[1]!.n, 1.8)).toBe(true);
  });
  it('9. capacidade observada: percentil 80 dos dias com atividade (9 dias ativos → 84); menos de 5 dias, sem capacidade', () => {
    expect(capacidadeObservada([0, 20, 30, 40, 50, 60, 0, 70, 80, 90, 100])).toMatchObject({ n: 9, v: 84 });
    expect(capacidadeObservada([10, 0, 12, 0, 9, 11]).v).toBeNull();
  });
});
