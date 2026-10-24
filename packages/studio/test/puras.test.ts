import { describe, expect, it } from 'vitest';
import { alavancas, simularFunil, camadas, desvios, ordemTopologica, projetar, realizadoDe, resolverTaxas, simular, validarGrafo, valorDe, type Grafo } from '../src/index.js';

/* lead → contato → reunião → proposta → ganho, com perdas pelo caminho e um atalho lead → reunião */
const G: Grafo = {
  entrada: 'lead',
  nos: [
    { id: 'lead', nome: 'Lead', tipo: 'etapa' }, { id: 'contato', nome: 'Contato', tipo: 'etapa' }, { id: 'reuniao', nome: 'Reunião', tipo: 'etapa' },
    { id: 'proposta', nome: 'Proposta', tipo: 'etapa' }, { id: 'ganho', nome: 'Venda', tipo: 'ganho' }, { id: 'perdido', nome: 'Perdido', tipo: 'perdido' },
  ],
  arestas: [
    { de: 'lead', para: 'contato', taxa: 0.5 }, { de: 'lead', para: 'reuniao', taxa: 0.1 }, { de: 'lead', para: 'perdido', taxa: 0.4 },
    { de: 'contato', para: 'reuniao', taxa: 0.4 }, { de: 'contato', para: 'perdido', taxa: 0.6 },
    { de: 'reuniao', para: 'proposta', taxa: 0.5 }, { de: 'reuniao', para: 'perdido', taxa: 0.5 },
    { de: 'proposta', para: 'ganho', taxa: 0.4 }, { de: 'proposta', para: 'perdido', taxa: 0.6 },
  ],
};

describe('validação do grafo', () => {
  it('aceita o grafo bom', () => expect(validarGrafo(G)).toMatchObject({ ok: true, erros: [], avisos: [] }));
  it('recusa ciclo, nó repetido, aresta solta, taxa fora de 0–1 e saída de nó terminal', () => {
    const ruim = (mudar: (g: Grafo) => void) => { const g = structuredClone(G); mudar(g); return validarGrafo(g); };
    expect(ruim(g => g.arestas.push({ de: 'proposta', para: 'contato', taxa: 0.1 })).erros[0]).toMatch(/ciclo/);
    expect(ruim(g => g.nos.push({ id: 'lead', nome: 'X', tipo: 'etapa' })).erros[0]).toMatch(/repetido/);
    expect(ruim(g => g.arestas.push({ de: 'lead', para: 'nao_existe', taxa: 0.1 })).erros[0]).toMatch(/inexistente/);
    expect(ruim(g => { g.arestas[0]!.taxa = 1.5; }).erros[0]).toMatch(/entre 0 e 1/);
    expect(ruim(g => g.arestas.push({ de: 'ganho', para: 'perdido', taxa: 0.1 })).erros[0]).toMatch(/terminal/);
    expect(ruim(g => { g.arestas[0]!.taxa = 'vendass * 2'; }).erros[0]).toMatch(/variável "vendass" não existe/);
    expect(ruim(g => { g.arestas[0]!.taxa = '1 +'; }).erros[0]).toMatch(/termina/);
    expect(ruim(g => { g.nos = g.nos.filter(n => n.tipo !== 'ganho'); g.arestas = g.arestas.filter(a => a.para !== 'ganho'); }).erros.join()).toMatch(/ganho/);
    expect(validarGrafo({ nos: [], arestas: [] }).ok).toBe(false);
  });
  it('avisa de nó inalcançável e de etapa sem saída', () => {
    const g = structuredClone(G); g.nos.push({ id: 'ilha', nome: 'Ilha', tipo: 'etapa' });
    const r = validarGrafo(g);
    expect(r.ok).toBe(true);
    expect(r.avisos.join()).toMatch(/Ilha.*não é alcançado/);
    expect(r.avisos.join()).toMatch(/Ilha.*sem saída/);
  });
  it('ordem topológica e camadas (maior distância da entrada)', () => {
    const ordem = ordemTopologica(G)!;
    expect(ordem.indexOf('lead')).toBeLessThan(ordem.indexOf('contato'));
    expect(ordem.indexOf('proposta')).toBeLessThan(ordem.indexOf('ganho'));
    expect(camadas(G)).toMatchObject({ lead: 0, contato: 1, reuniao: 2, proposta: 3, ganho: 4 });
  });
});

describe('simulação', () => {
  const taxas = () => resolverTaxas(G, {}).taxas;
  it('propaga o volume pelas arestas, inclusive pelo atalho', () => {
    const s = simular(G, taxas(), 1000, 10000);
    const v = (id: string) => s.nos.find(n => n.id === id)!.volume;
    expect(v('contato')).toBe(500);
    expect(v('reuniao')).toBeCloseTo(100 + 200);        // atalho + via contato
    expect(v('proposta')).toBeCloseTo(150);
    expect(s.vendas).toBeCloseTo(60);
    expect(s.receita).toBeCloseTo(600000);
    expect(s.vendas + s.perdidos).toBeCloseTo(1000);     // nada some: ou vende ou perde
    expect(s.nos.every(n => n.parado < 1e-9)).toBe(true);
  });
  it('o que sobra num nó (saídas somando menos de 100%) aparece como parado', () => {
    const g = structuredClone(G); g.arestas = g.arestas.map(a => (a.de === 'proposta' && a.para === 'perdido' ? { ...a, taxa: 0.1 } : a));
    const s = simular(g, resolverTaxas(g, {}).taxas, 100, null);
    expect(s.nos.find(n => n.id === 'proposta')!.parado).toBeCloseTo(7.5);   // chegam 15; saem 6 (ganho) + 1,5 (perdido)
    expect(s.receita).toBeNull();
  });
  it('taxa em fórmula usa o dicionário; sem dado a aresta fica sem taxa e a falta é dita', () => {
    const g = structuredClone(G); g.arestas[0]!.taxa = 'passo_agendada * 2';
    expect(resolverTaxas(g, { passo_agendada: 0.2 }).taxas.get('lead>contato')).toBeCloseTo(0.4);
    const r = resolverTaxas(g, { passo_agendada: null });
    expect(r.faltam).toEqual([{ aresta: 'lead>contato', variaveis: ['passo_agendada'] }]);
    expect(r.taxas.has('lead>contato')).toBe(false);
  });
  it('simularFunil recusa, com nomes (não ids), saídas que passam de 100%', () => {
    const g = structuredClone(G); g.arestas[0]!.taxa = 0.9;
    const r = simularFunil(g, { leads: 100 });
    expect(r.ok).toBe(false);
    expect(r.avisos[0]).toMatch(/"Lead".*100%/);
  });
  it('saídas somando mais de 100% são denunciadas', () => {
    const g = structuredClone(G); g.arestas[0]!.taxa = 0.9;
    expect(resolverTaxas(g, {}).excedem).toEqual(['lead']);
  });
  it('alterações por aresta valem no lugar da taxa do desenho', () => {
    const t = resolverTaxas(G, {}, { 'proposta>ganho': 0.6 }).taxas;
    expect(simular(G, t, 1000, null).vendas).toBeCloseTo(90);
  });
});

describe('alavancas', () => {
  it('ordena pelo ganho em vendas e só lista o que de fato melhora', () => {
    const t = resolverTaxas(G, {}).taxas;
    const a = alavancas(G, t, 1000, 10000);
    /* melhor: o atalho lead → reunião. 50 leads saem da perda (0,4 → 0,35) e cada um vale 0,5 × 0,4 = 0,2 venda */
    expect(a[0]!.aresta).toBe('lead>reuniao');
    expect(a[0]!.ganhoVendas).toBeCloseTo(50 * 0.5 * 0.4);
    /* proposta → ganho: 150 propostas × 5 pontos */
    const p = a.find(x => x.aresta === 'proposta>ganho')!;
    expect(p.ganhoVendas).toBeCloseTo(150 * 0.05);
    expect(p.ganhoReceita).toBeCloseTo(7.5 * 10000);
    expect(a.every(x => x.ganhoVendas > 0)).toBe(true);
    expect(a.some(x => x.para === 'perdido')).toBe(false);  // melhorar a perda não é alavanca
    expect(a.map(x => x.ganhoVendas)).toEqual([...a.map(x => x.ganhoVendas)].sort((x, y) => y - x));
  });
  it('a melhora sai da perda do mesmo nó (as saídas continuam somando 100%)', () => {
    const t = resolverTaxas(G, {}).taxas;
    const a = alavancas(G, t, 1000, null).find(x => x.aresta === 'lead>contato')!;
    expect(a.nova).toBeCloseTo(0.55);
    /* 5 pontos a mais para contato: 50 leads a mais seguem pelo funil (0,4 → reunião 0,5 → proposta 0,4 → ganho) */
    expect(a.ganhoVendas).toBeCloseTo(50 * 0.4 * 0.5 * 0.4);
  });
  it('sem perda nem folga no nó, não há alavanca (nada de onde tirar)', () => {
    const g: Grafo = { entrada: 'a', nos: [{ id: 'a', nome: 'A', tipo: 'etapa' }, { id: 'g', nome: 'G', tipo: 'ganho' }], arestas: [{ de: 'a', para: 'g', taxa: 1 }] };
    expect(alavancas(g, resolverTaxas(g, {}).taxas, 100, null)).toEqual([]);
  });
});

describe('campanha', () => {
  const ctx = { cpl_medio: 100, ticket_medio: 10000, margem_percentual: 0.4 };
  it('orçamento → leads → vendas → CAC, ROI e margem', () => {
    const p = projetar({ grafo: G, ctx, orcamento: 100000, premissas: { cpl: 'cpl_medio', ticketMedio: 'ticket_medio' } });
    expect(p.ok).toBe(true);
    expect(p.leads).toBe(1000);
    expect(p.vendas).toBeCloseTo(60);
    expect(p.receita).toBeCloseTo(600000);
    expect(p.cac).toBeCloseTo(100000 / 60);
    expect(p.roi).toBeCloseTo(5);
    expect(p.margemContribuicao).toBeCloseTo(240000);
    expect(p.mcMenosOrcamento).toBeCloseTo(140000);
    expect(p.alavancas.length).toBeGreaterThan(0);
  });
  it('sem CPL, sem taxa ou sem orçamento: não projeta e diz por quê (nada vira zero)', () => {
    expect(projetar({ grafo: G, ctx: {}, orcamento: 1000, premissas: { cpl: 'cpl_medio', ticketMedio: 10 } })).toMatchObject({ ok: false, vendas: null });
    expect(projetar({ grafo: G, ctx, orcamento: 0, premissas: { cpl: 100, ticketMedio: 10 } }).avisos[0]).toMatch(/orçamento/);
    const g = structuredClone(G); g.arestas[0]!.taxa = 'conv_ganho';
    expect(projetar({ grafo: g, ctx, orcamento: 1000, premissas: { cpl: 100, ticketMedio: 10 } }).avisos[0]).toMatch(/lead → contato.*conv_ganho/);
  });
  it('sem ticket projeta vendas mas avisa que falta a receita', () => {
    const p = projetar({ grafo: G, ctx: { cpl_medio: 100 }, orcamento: 10000, premissas: { cpl: 'cpl_medio', ticketMedio: 'ticket_medio' } });
    expect(p.ok).toBe(true);
    expect(p).toMatchObject({ receita: null, roi: null });
    expect(p.avisos[0]).toMatch(/ticket/);
  });
  it('valorDe aceita número, fórmula e rejeita lixo', () => {
    expect(valorDe(5, {})).toBe(5);
    expect(valorDe('a * 2', { a: 4 })).toBe(8);
    expect(valorDe('a * ', { a: 4 })).toBeNull();
    expect(valorDe(null, {})).toBeNull();
  });
  it('plano × realizado compara só o que existe dos dois lados', () => {
    const r = realizadoDe({ leads: 800, vendas: 40, receita: 400000, investimento: null });
    expect(r).toMatchObject({ cpl: null, cac: null, roi: null });
    const d = Object.fromEntries(desvios({ leads: 1000, vendas: 60, receita: 600000, cac: 1666.67, roi: 5 }, r).map(x => [x.campo, x]));
    expect(d.vendas).toMatchObject({ diferenca: -20 });
    expect(d.vendas!.pct).toBeCloseTo(-1 / 3);
    expect(d.cac).toMatchObject({ realizado: null, diferenca: null, pct: null });
  });
});
