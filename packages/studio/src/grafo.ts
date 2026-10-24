/* Funil em grafo: nós (etapas) e arestas com taxa de passagem. As taxas são número (0–1) ou fórmula na mesma
   linguagem das hipóteses, lida com as mesmas variáveis do dicionário: um só motor para o Studio e para as hipóteses. */
import { analisar, avaliar, ErroExpressao, variaveisUsadas, VARIAVEIS, type Contexto } from '@lab/nucleo';

export interface No { id: string; nome: string; tipo: 'etapa' | 'ganho' | 'perdido' }
export interface Aresta { de: string; para: string; taxa: number | string }
export interface Grafo { nos: No[]; arestas: Aresta[]; entrada: string }

const ID = /^[a-z0-9][a-z0-9_-]{0,39}$/;
export const LIMITE_NOS = 40, LIMITE_ARESTAS = 120;
export const chaveAresta = (a: { de: string; para: string }) => `${a.de}>${a.para}`;

export function validarGrafo(entrada: unknown): { ok: boolean; erros: string[]; avisos: string[]; grafo?: Grafo } {
  const erros: string[] = [], avisos: string[] = [];
  const g = entrada as Partial<Grafo> | null;
  if (!g || typeof g !== 'object' || !Array.isArray(g.nos) || !Array.isArray(g.arestas) || typeof g.entrada !== 'string') return { ok: false, erros: ['o grafo precisa de nos, arestas e entrada'], avisos };
  if (g.nos.length > LIMITE_NOS) erros.push(`no máximo ${LIMITE_NOS} nós`);
  if (g.arestas.length > LIMITE_ARESTAS) erros.push(`no máximo ${LIMITE_ARESTAS} arestas`);
  if (erros.length) return { ok: false, erros, avisos };
  const nos: No[] = [];
  const ids = new Set<string>();
  for (const n of g.nos as Partial<No>[]) {
    if (typeof n?.id !== 'string' || !ID.test(n.id)) { erros.push(`nó com id inválido: ${JSON.stringify(n?.id)} (use letras minúsculas, números, _ e -)`); continue; }
    if (ids.has(n.id)) { erros.push(`nó repetido: ${n.id}`); continue; }
    const nome = typeof n.nome === 'string' && n.nome.trim() ? n.nome.trim().slice(0, 80) : n.id;
    if (n.tipo !== 'etapa' && n.tipo !== 'ganho' && n.tipo !== 'perdido') { erros.push(`nó ${n.id}: tipo deve ser etapa, ganho ou perdido`); continue; }
    ids.add(n.id); nos.push({ id: n.id, nome, tipo: n.tipo });
  }
  const tipo = new Map(nos.map(n => [n.id, n.tipo]));
  if (!ids.has(g.entrada)) erros.push(`a entrada "${g.entrada}" não é um nó do grafo`);
  else if (tipo.get(g.entrada) !== 'etapa') erros.push('a entrada deve ser uma etapa');
  if (!nos.some(n => n.tipo === 'ganho')) erros.push('o grafo precisa de pelo menos um nó "ganho"');

  const arestas: Aresta[] = [];
  const vistas = new Set<string>();
  for (const a of g.arestas as Partial<Aresta>[]) {
    if (typeof a?.de !== 'string' || typeof a?.para !== 'string' || !ids.has(a.de) || !ids.has(a.para)) { erros.push(`aresta com nó inexistente: ${a?.de} → ${a?.para}`); continue; }
    if (a.de === a.para) { erros.push(`aresta de ${a.de} para ele mesmo`); continue; }
    if (tipo.get(a.de) !== 'etapa') { erros.push(`${a.de} é terminal (${tipo.get(a.de)}) e não pode ter saída`); continue; }
    if (vistas.has(chaveAresta(a as Aresta))) { erros.push(`aresta repetida: ${a.de} → ${a.para}`); continue; }
    vistas.add(chaveAresta(a as Aresta));
    if (typeof a.taxa === 'number') {
      if (!(a.taxa >= 0 && a.taxa <= 1)) { erros.push(`taxa de ${a.de} → ${a.para} deve estar entre 0 e 1 (0,25 = 25%)`); continue; }
    } else if (typeof a.taxa === 'string') {
      try { for (const v of variaveisUsadas(analisar(a.taxa))) if (!(v in VARIAVEIS)) erros.push(`taxa de ${a.de} → ${a.para}: a variável "${v}" não existe`); }
      catch (e) { erros.push(`taxa de ${a.de} → ${a.para}: ${e instanceof ErroExpressao ? e.message : 'fórmula inválida'}`); continue; }
    } else { erros.push(`taxa de ${a.de} → ${a.para} ausente`); continue; }
    arestas.push({ de: a.de, para: a.para, taxa: a.taxa });
  }
  if (erros.length) return { ok: false, erros, avisos };

  /* sem ciclos: ordem topológica (Kahn) */
  if (ordemTopologica({ nos, arestas, entrada: g.entrada! }) === null) return { ok: false, erros: ['o grafo tem um ciclo: um negócio não pode voltar a uma etapa anterior no modelo'], avisos };
  const alcancados = alcancaveis({ nos, arestas, entrada: g.entrada! });
  for (const n of nos) if (!alcancados.has(n.id)) avisos.push(`"${n.nome}" não é alcançado a partir da entrada`);
  for (const n of nos) if (n.tipo === 'etapa' && n.id !== g.entrada && !arestas.some(a => a.de === n.id)) avisos.push(`"${n.nome}" é uma etapa sem saída: tudo que chega nela fica parado`);
  return { ok: true, erros, avisos, grafo: { nos, arestas, entrada: g.entrada! } };
}

export function ordemTopologica(g: Grafo): string[] | null {
  const grau = new Map(g.nos.map(n => [n.id, 0]));
  for (const a of g.arestas) grau.set(a.para, (grau.get(a.para) ?? 0) + 1);
  const fila = [...grau].filter(([, d]) => d === 0).map(([id]) => id).sort();
  const ordem: string[] = [];
  while (fila.length) {
    const id = fila.shift()!;
    ordem.push(id);
    for (const a of g.arestas.filter(x => x.de === id)) {
      const d = grau.get(a.para)! - 1; grau.set(a.para, d);
      if (d === 0) fila.push(a.para);
    }
  }
  return ordem.length === g.nos.length ? ordem : null;
}

function alcancaveis(g: Grafo): Set<string> {
  const vistos = new Set([g.entrada]); const pilha = [g.entrada];
  while (pilha.length) {
    const atual = pilha.pop()!;
    for (const a of g.arestas.filter(x => x.de === atual)) if (!vistos.has(a.para)) { vistos.add(a.para); pilha.push(a.para); }
  }
  return vistos;
}

/* camada de cada nó (maior distância desde a entrada): serve para desenhar da esquerda para a direita */
export function camadas(g: Grafo): Record<string, number> {
  const ordem = ordemTopologica(g) ?? g.nos.map(n => n.id);
  const c: Record<string, number> = Object.fromEntries(g.nos.map(n => [n.id, 0]));
  for (const id of ordem) for (const a of g.arestas.filter(x => x.de === id)) c[a.para] = Math.max(c[a.para]!, c[id]! + 1);
  return c;
}

export interface TaxasResolvidas { taxas: Map<string, number>; faltam: Array<{ aresta: string; variaveis: string[] }>; excedem: string[] }

/* número fica como está; fórmula é calculada com o contexto; sem dado a aresta fica sem taxa (e a simulação avisa) */
export function resolverTaxas(g: Grafo, ctx: Contexto, alteracoes: Record<string, number | string> = {}): TaxasResolvidas {
  const taxas = new Map<string, number>(), faltam: TaxasResolvidas['faltam'] = [];
  for (const a of g.arestas) {
    const k = chaveAresta(a);
    const t = alteracoes[k] ?? a.taxa;
    if (typeof t === 'number') { taxas.set(k, Math.min(Math.max(t, 0), 1)); continue; }
    const f = analisar(t);
    const v = avaliar(f, ctx);
    if (typeof v === 'number' && Number.isFinite(v)) taxas.set(k, Math.min(Math.max(v, 0), 1));
    else faltam.push({ aresta: k, variaveis: [...variaveisUsadas(f)].filter(x => ctx[x] == null).sort() });
  }
  const excedem: string[] = [];
  for (const n of g.nos) {
    const soma = g.arestas.filter(a => a.de === n.id).reduce((s, a) => s + (taxas.get(chaveAresta(a)) ?? 0), 0);
    if (soma > 1.0001) excedem.push(n.id);
  }
  return { taxas, faltam, excedem };
}

export interface Simulacao {
  entrada: number; vendas: number; perdidos: number; receita: number | null;
  nos: Array<{ id: string; volume: number; saida: number; parado: number }>;
  arestas: Array<{ de: string; para: string; taxa: number; volume: number }>;
}

export function simular(g: Grafo, taxas: Map<string, number>, entrada: number, ticket: number | null): Simulacao {
  const vol = new Map(g.nos.map(n => [n.id, 0]));
  vol.set(g.entrada, entrada);
  const saida = new Map<string, number>(), arestas: Simulacao['arestas'] = [];
  for (const id of ordemTopologica(g) ?? []) {
    let enviado = 0;
    for (const a of g.arestas.filter(x => x.de === id)) {
      const t = taxas.get(chaveAresta(a)) ?? 0, v = vol.get(id)! * t;
      vol.set(a.para, vol.get(a.para)! + v); enviado += v;
      arestas.push({ de: a.de, para: a.para, taxa: t, volume: v });
    }
    saida.set(id, enviado);
  }
  const soma = (tipo: No['tipo']) => g.nos.filter(n => n.tipo === tipo).reduce((s, n) => s + vol.get(n.id)!, 0);
  const vendas = soma('ganho');
  return {
    entrada, vendas, perdidos: soma('perdido'), receita: ticket == null ? null : vendas * ticket,
    nos: g.nos.map(n => ({ id: n.id, volume: vol.get(n.id)!, saida: saida.get(n.id) ?? 0, parado: n.tipo === 'etapa' ? Math.max(vol.get(n.id)! - (saida.get(n.id) ?? 0), 0) : 0 })),
    arestas,
  };
}

export interface Alavanca { aresta: string; de: string; para: string; taxa: number; nova: number; ganhoVendas: number; ganhoReceita: number | null }

/* o que acontece se cada passagem melhorar 5 pontos. A melhora tem de sair de algum lugar: primeiro do que está
   parado na etapa, depois das saídas para "perdido". As passagens que mais rendem são as alavancas. */
export function alavancas(g: Grafo, taxas: Map<string, number>, entrada: number, ticket: number | null, pontos = 0.05): Alavanca[] {
  const base = simular(g, taxas, entrada, ticket);
  const tipo = new Map(g.nos.map(n => [n.id, n.tipo]));
  const out: Alavanca[] = [];
  for (const a of g.arestas) {
    const k = chaveAresta(a), t = taxas.get(k);
    if (t == null || tipo.get(a.para) === 'perdido') continue;
    const irmas = g.arestas.filter(x => x.de === a.de && x !== a);
    const folga = Math.max(1 - t - irmas.reduce((s, x) => s + (taxas.get(chaveAresta(x)) ?? 0), 0), 0);
    const perdas = irmas.filter(x => tipo.get(x.para) === 'perdido');
    const somaPerdas = perdas.reduce((s, x) => s + (taxas.get(chaveAresta(x)) ?? 0), 0);
    const delta = Math.min(pontos, folga + somaPerdas);
    if (delta <= 1e-12) continue;
    const novas = new Map(taxas).set(k, t + delta);
    const dasPerdas = Math.max(delta - folga, 0);
    if (dasPerdas > 0 && somaPerdas > 0) for (const x of perdas) { const kx = chaveAresta(x), tx = taxas.get(kx)!; novas.set(kx, tx - dasPerdas * (tx / somaPerdas)); }
    const s = simular(g, novas, entrada, ticket);
    out.push({ aresta: k, de: a.de, para: a.para, taxa: t, nova: t + delta, ganhoVendas: s.vendas - base.vendas, ganhoReceita: ticket == null ? null : s.receita! - base.receita! });
  }
  return out.filter(x => x.ganhoVendas > 1e-9).sort((a, b) => b.ganhoVendas - a.ganhoVendas || a.aresta.localeCompare(b.aresta));
}

export interface ResultadoSimulacao {
  ok: boolean; avisos: string[]; entrada: number | null; ticketMedio: number | null;
  faltam: TaxasResolvidas['faltam']; excedem: string[]; camadas: Record<string, number>;
  simulacao: Simulacao | null; alavancas: Alavanca[];
}

/* simulação completa de um grafo: resolve as taxas com o contexto (mesmas variáveis das hipóteses), simula e lista as alavancas */
export function simularFunil(g: Grafo, ctx: Contexto, opcoes: { entrada?: number | null; ticketMedio?: number | null; alteracoes?: Record<string, number | string> } = {}): ResultadoSimulacao {
  const avisos: string[] = [];
  const entrada = opcoes.entrada ?? ctx.leads ?? null, ticket = opcoes.ticketMedio ?? ctx.ticket_medio ?? null;
  const r = resolverTaxas(g, ctx, opcoes.alteracoes);
  const base = { entrada, ticketMedio: ticket, faltam: r.faltam, excedem: r.excedem, camadas: camadas(g), simulacao: null, alavancas: [] as Alavanca[] };
  if (entrada == null || !(entrada > 0)) return { ok: false, avisos: ['informe quantos leads entram no funil (ou tenha leads no histórico)'], ...base };
  const nome = (id: string) => g.nos.find(n => n.id === id)?.nome ?? id;
  if (r.faltam.length) return { ok: false, avisos: r.faltam.map(f => `sem dado para a taxa ${f.aresta.split('>').map(nome).join(' → ')}${f.variaveis.length ? ` (falta: ${f.variaveis.join(', ')})` : ''}`), ...base };
  if (r.excedem.length) return { ok: false, avisos: [`as saídas de "${r.excedem.map(nome).join('", "')}" somam mais de 100%: baixe outra passagem da mesma etapa`], ...base };
  if (ticket == null) avisos.push('sem ticket médio: a receita não pôde ser calculada');
  return { ok: true, avisos, ...base, simulacao: simular(g, r.taxas, entrada, ticket), alavancas: alavancas(g, r.taxas, entrada, ticket).slice(0, 5) };
}
