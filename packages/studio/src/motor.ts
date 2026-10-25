/* Motor do Studio (GTM & Revenue Studio): o modelo de operação em blocos (nós) e conexões (arestas com taxa de passagem),
   cálculo direto (volumes esperados), reverso (meta → entradas, com inteiros), validações, cenários por regras,
   sensibilidade, prontidão da campanha, monitor planejado × realizado e layout automático.
   Puro: sem banco, sem tela. Porta 1:1 o motor da V1 (gs*), cujo studio.test.js é o contrato (packages/studio/test/motor.test.ts). */
import { wilson as wilsonIC } from '@lab/metricas';

export const VERSAO_STUDIO = 'gs-2.0';
const EPS = 1e-9;

/* ---------- vocabulário ---------- */
export type TipoNo = 'entrada' | 'etapa' | 'decisao' | 'acao' | 'compromisso' | 'resultado' | 'perda' | 'pos';
export const TIPOS_NO: Record<TipoNo, { nome: string; d: string }> = {
  entrada: { nome: 'Entrada', d: 'Onde as entidades entram (leads, oportunidades, eventos)' },
  etapa: { nome: 'Etapa de processo', d: 'Uma fase de avanço' },
  decisao: { nome: 'Decisão', d: 'Divide o fluxo por uma condição explícita; a distribuição tem de fechar 100%' },
  acao: { nome: 'Ação operacional', d: 'Atividade que gera ou modifica um resultado' },
  compromisso: { nome: 'Marco de compromisso', d: 'Evento decisivo (ex.: contrato assinado)' },
  resultado: { nome: 'Resultado', d: 'O que o modelo pretende produzir (vendas, receita, clientes ativados)' },
  perda: { nome: 'Perda ou saída alternativa', d: 'Descartados, desqualificados ou encaminhados a outro destino' },
  pos: { nome: 'Marco pós-venda', d: 'Entrega concluída, onboarding, indicação, nova oportunidade' },
};
/* natureza de toda taxa, volume e premissa */
export type Fonte = 'historico' | 'premissa' | 'benchmark' | 'estimativa' | 'hipotese';
export const NATUREZA: Record<Fonte, string> = { historico: 'Dado histórico', premissa: 'Premissa informada', benchmark: 'Benchmark configurado', estimativa: 'Estimativa calculada', hipotese: 'Hipótese não validada' };
export const COM_EVIDENCIA: ReadonlySet<string> = new Set(['historico', 'benchmark']);
const evidencia = (f?: string | null) => COM_EVIDENCIA.has(f ?? 'premissa');
/* unidade de contagem */
export const UNIDADES: Record<string, string> = { lead: 'Lead', pessoa: 'Pessoa', empresa: 'Empresa', reuniao: 'Reunião', oportunidade: 'Oportunidade', proposta: 'Proposta', contrato: 'Contrato', cliente: 'Cliente', pedido: 'Pedido', os: 'OS', brl: 'Valor (R$)' };

export const num = (v: unknown): number | null => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
/* arredonda para cima sem transformar 105,0000000001 em 106 */
export const teto = (v: number | null | undefined): number | null => (v == null ? null : Math.ceil(v - 1e-7));
/* quantidade em texto: inteiro sem casas, fração com uma casa e vírgula (nunca 6.200000000000001) */
export const qtxt = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? '—' : Math.abs(v - Math.round(v)) < 1e-6 ? String(Math.round(v)) : v.toFixed(1).replace('.', ','));
const pctTxt = (t: number, casas = 1) => (t * 100).toFixed(casas).replace('.', ',');
const umaCasa = (v: number) => v.toFixed(1).replace('.', ',');
const brlTxt = (v: number) => 'R$ ' + Math.round(v).toLocaleString('pt-BR');

/* ---------- o modelo (como é guardado) ---------- */
export interface Capacidade { v: number | null; por?: 'periodo' | 'dia' }
export interface Vinculo { tipo?: string | null; etapa?: string | null; canal?: string | null; indicador?: string | null }
export interface NoModelo {
  tipo: TipoNo; nome?: string; un?: string | null;
  vol?: number | null;            // volume de entrada no período (só nós de entrada)
  limite?: number | null;         // quanto a fonte entrega no máximo no período (entrada)
  cap?: Capacidade | null;        // capacidade de processamento no período
  ticket?: number | null; margem?: number | null;   // nós de resultado: valor por unidade e margem %
  prazo?: number | null;          // dias de permanência esperados (monitor)
  bind?: Vinculo | null;          // vínculo com o dado real (coorte)
  fonte?: Fonte | null; fontes?: Partial<Record<string, Fonte>>;
  x?: number; y?: number; apagado?: boolean;
}
export interface ArestaModelo {
  de: string; para: string; taxa?: number | null; fonte?: Fonte | null; n?: number | null;
  dias?: number | null;           // defasagem média da passagem
  retorno?: boolean; maxVoltas?: number | null;   // conexão de retorno (ciclo controlado)
  exclusiva?: boolean;            // a taxa já conta só quem não passou pelo outro caminho
  ind?: string | null;            // indicador/taxa do LAB que mede esta passagem
  fontes?: Partial<Record<string, Fonte>>; apagado?: boolean;
}
export interface Regra { v: number | null; fonte?: Fonte | null; n?: number | null; nota?: string }
export interface Cenario { nome?: string; regras?: Record<string, Regra> }
export interface Modelo { nos?: Record<string, NoModelo>; arestas?: Record<string, ArestaModelo>; cenarios?: Record<string, Cenario>; dir?: 'LR' | 'TB'; diasPeriodo?: number | null }

export type NoP = NoModelo & { id: string };
export type ArestaP = ArestaModelo & { id: string };
export interface Alterado { chave: string; de: number | null | undefined; para: number; fonte: Fonte; nota: string }
export interface Parametros { nos: Record<string, NoP>; arestas: Record<string, ArestaP>; dir: 'LR' | 'TB'; cen: string; alterados: Alterado[]; dias: number | null }
type PBase = Pick<Parametros, 'nos' | 'arestas'> & { dias?: number | null };

const lista = <T extends { apagado?: boolean }>(o: Record<string, T> | undefined) => Object.keys(o ?? {}).filter(k => { const x = o![k]; return x && typeof x === 'object' && !x.apagado; });
const CAMPOS_REGRA = { n: new Set(['vol', 'limite', 'cap', 'ticket', 'margem', 'prazo']), a: new Set(['taxa', 'dias', 'maxVoltas']) };

/* ---------- parâmetros efetivos: o modelo + as regras do cenário (o base é o próprio modelo) ---------- */
export function parametros(M: Modelo | null | undefined, cen?: string | null): Parametros {
  const m = M ?? {}, nos: Record<string, NoP> = {}, arestas: Record<string, ArestaP> = {};
  const C = cen && cen !== 'base' ? (m.cenarios ?? {})[cen] ?? null : null, regras = C?.regras ?? {};
  for (const id of lista(m.nos)) nos[id] = { ...m.nos![id]!, id };
  for (const id of lista(m.arestas)) { const a = m.arestas![id]!; if (nos[a.de] && nos[a.para]) arestas[id] = { ...a, id }; }
  const alterados: Alterado[] = [];
  for (const k of Object.keys(regras)) {
    const r = regras[k], mm = /^([na]):([^.]+)\.(\w+)$/.exec(k);
    if (!mm || !r || num(r.v) == null) continue;
    const lado = mm[1] as 'n' | 'a', campo = mm[3]!;
    if (!CAMPOS_REGRA[lado].has(campo)) continue;
    const alvo: (NoP | ArestaP) | undefined = lado === 'n' ? nos[mm[2]!] : arestas[mm[2]!];
    if (!alvo) continue;
    const valor = Number(r.v), fonte: Fonte = r.fonte ?? 'hipotese';
    const antes = campo === 'cap' ? (alvo as NoP).cap?.v : (alvo as unknown as Record<string, number | null | undefined>)[campo];
    if (campo === 'cap') (alvo as NoP).cap = { ...((alvo as NoP).cap ?? { v: null }), v: valor };
    else (alvo as unknown as Record<string, number>)[campo] = valor;
    if (campo === 'taxa') { alvo.fonte = fonte; (alvo as ArestaP).n = r.n ?? null; }
    else alvo.fontes = { ...(alvo.fontes ?? {}), [campo]: fonte };
    alterados.push({ chave: k, de: antes, para: valor, fonte, nota: r.nota ?? '' });
  }
  return { nos, arestas, dir: m.dir ?? 'LR', cen: cen ?? 'base', alterados, dias: num(m.diasPeriodo) };
}

/* ---------- grafo: adjacência, ordem topológica (sem as arestas de retorno), alcance ---------- */
export interface GrafoP { ids: string[]; out: Record<string, string[]>; inn: Record<string, string[]>; ordem: string[]; ciclo: string[]; ent: string[]; res: string[] }
export function grafo(P: PBase): GrafoP {
  const ids = Object.keys(P.nos), out: Record<string, string[]> = {}, inn: Record<string, string[]> = {};
  for (const n of ids) { out[n] = []; inn[n] = []; }
  for (const a of Object.keys(P.arestas)) { const e = P.arestas[a]!; out[e.de]!.push(a); inn[e.para]!.push(a); }
  const grau: Record<string, number> = {};
  for (const n of ids) grau[n] = inn[n]!.filter(a => !P.arestas[a]!.retorno).length;
  const fila = ids.filter(n => !grau[n]), ordem: string[] = [];
  while (fila.length) { const n = fila.shift()!; ordem.push(n); for (const a of out[n]!) { const e = P.arestas[a]!; if (e.retorno) continue; if (--grau[e.para]! === 0) fila.push(e.para); } }
  const ciclo = ids.filter(n => !ordem.includes(n));
  return { ids, out, inn, ordem, ciclo, ent: ids.filter(n => P.nos[n]!.tipo === 'entrada'), res: ids.filter(n => P.nos[n]!.tipo === 'resultado') };
}
/* nós alcançáveis a partir de n (seguindo as arestas, com ou sem as de retorno) */
function alcance(P: PBase, G: GrafoP, n: string, comRetorno: boolean): Set<string> {
  const vis = new Set<string>(), pilha = [n];
  while (pilha.length) { const x = pilha.pop()!; for (const a of G.out[x] ?? []) { const e = P.arestas[a]!; if (e.retorno && !comRetorno) continue; if (!vis.has(e.para)) { vis.add(e.para); pilha.push(e.para); } } }
  return vis;
}

/* ---------- validações: erro impede o número; aviso diz o que pode distorcer ---------- */
export type Gravidade = 'erro' | 'aviso' | 'info';
export interface Validacao { grav: Gravidade; cod: string; alvo: string; msg: string }
export const temErro = (V: Validacao[] | null | undefined) => (V ?? []).some(x => x.grav === 'erro');

export function validar(P: PBase): Validacao[] {
  const G = grafo(P), L: Validacao[] = [], add = (grav: Gravidade, cod: string, alvo: string, msg: string) => L.push({ grav, cod, alvo, msg });
  const nome = (n: string) => P.nos[n]?.nome || n;
  if (!G.ids.length) { add('erro', 'vazio', '', 'O modelo não tem blocos.'); return L; }
  if (!G.ent.length) add('erro', 'sem_entrada', '', 'O modelo não tem bloco de entrada: o cálculo direto não tem de onde partir.');
  if (!G.res.length) add('aviso', 'sem_resultado', '', 'Sem bloco de resultado: o cálculo reverso não tem alvo.');
  const pares = new Set<string>();
  for (const a of Object.keys(P.arestas)) {
    const e = P.arestas[a]!, t = num(e.taxa), rot = nome(e.de) + ' → ' + nome(e.para);
    if (e.de === e.para) add('erro', 'laco', 'a:' + a, rot + ': a conexão sai e chega no mesmo bloco. Use uma conexão de retorno para outro bloco.');
    if (t == null) add('aviso', 'sem_taxa', 'a:' + a, rot + ': sem taxa definida. O volume não passa por aqui até a taxa ser informada.');
    else if (t < 0 || t > 1) add('erro', 'taxa_invalida', 'a:' + a, rot + ': taxa de ' + pctTxt(t) + '% está fora de 0% a 100%.');
    const k = e.de + '>' + e.para;
    if (pares.has(k)) add('aviso', 'duplicada', 'a:' + a, rot + ': há duas conexões entre os mesmos blocos; o volume passa pelas duas.');
    pares.add(k);
    const ud = P.nos[e.de]?.un, up = P.nos[e.para]?.un;
    if (ud && up && (ud === 'brl') !== (up === 'brl')) add('erro', 'unidade', 'a:' + a, rot + ': liga um valor em R$ a uma contagem. Valor financeiro sai do resultado (quantidade × ticket), não de uma taxa.');
    if (e.retorno) { const mv = num(e.maxVoltas); if (mv == null || mv < 1 || mv > 10 || Math.round(mv) !== mv) add('erro', 'retorno_regra', 'a:' + a, rot + ': conexão de retorno precisa de um limite de voltas inteiro entre 1 e 10 (para não contar a mesma entidade sem fim).'); }
  }
  /* distribuição das saídas (ramificações) */
  for (const n of G.ids) {
    const N = P.nos[n]!, sai = G.out[n]!.map(a => P.arestas[a]!), tx = sai.map(e => num(e.taxa)).filter((t): t is number => t != null && t >= 0), soma = tx.reduce((s, t) => s + t, 0);
    if (soma > 1 + 0.005) add('erro', 'distribuicao', 'n:' + n, nome(n) + ': as saídas somam ' + pctTxt(soma) + '%. Uma entidade não sai para dois destinos ao mesmo tempo: a distribuição não fecha.');
    else if (N.tipo === 'decisao' && sai.length && Math.abs(soma - 1) > 0.005 && tx.length === sai.length) add('aviso', 'decisao_aberta', 'n:' + n, nome(n) + ': a decisão distribui ' + pctTxt(soma) + '%; o restante não tem destino definido.');
    if (N.tipo === 'decisao' && sai.length < 2) add('aviso', 'decisao_unica', 'n:' + n, nome(n) + ': um bloco de decisão precisa de pelo menos dois caminhos.');
    if (N.tipo === 'entrada' && G.inn[n]!.some(a => !P.arestas[a]!.retorno)) add('aviso', 'entrada_recebe', 'n:' + n, nome(n) + ': uma entrada recebe volume de outra etapa; confira se não é uma etapa comum.');
    if (N.tipo === 'entrada' && num(N.vol) == null) add('info', 'entrada_sem_volume', 'n:' + n, nome(n) + ': sem volume de entrada. Informe o volume ou use o cálculo reverso a partir da meta.');
    if (['etapa', 'acao', 'compromisso', 'decisao'].includes(N.tipo) && !sai.length) add('aviso', 'sem_saida', 'n:' + n, nome(n) + ': etapa sem saída definida; o volume para aqui.');
    const cap = N.cap; if (cap && cap.v != null && !((num(cap.v) ?? 0) > 0)) add('erro', 'capacidade', 'n:' + n, nome(n) + ': capacidade precisa ser um número maior que zero.');
  }
  /* ciclos sem regra de retorno */
  if (G.ciclo.length) add('erro', 'ciclo', 'n:' + G.ciclo[0], 'Ciclo sem regra de retorno entre ' + G.ciclo.map(nome).join(', ') + '. Marque a conexão que volta como "retorno" e defina o limite de voltas.');
  /* blocos que não recebem volume de nenhuma entrada */
  const alc = new Set<string>(); for (const e of G.ent) { alc.add(e); for (const x of alcance(P, G, e, true)) alc.add(x); }
  for (const n of G.ids) if (!alc.has(n)) add('aviso', 'orfao', 'n:' + n, nome(n) + ': não recebe volume de nenhuma entrada.');
  /* convergência: uma origem que também alcança a outra origem pode contar a mesma entidade duas vezes */
  if (!G.ciclo.length) for (const n of G.ids) {
    const ins = G.inn[n]!.filter(a => !P.arestas[a]!.retorno); if (ins.length < 2) continue;
    for (const a of ins) {
      const e = P.arestas[a]!; if (e.exclusiva) continue;
      const alcA = alcance(P, G, e.de, false), outro = ins.find(b => b !== a && alcA.has(P.arestas[b]!.de));
      if (outro) add('aviso', 'convergencia', 'a:' + a, nome(n) + ' recebe de ' + nome(e.de) + ' e também de ' + nome(P.arestas[outro]!.de) + ', que vem de ' + nome(e.de) + '. Confira se a taxa ' + nome(e.de) + ' → ' + nome(n) + ' conta só quem NÃO passou pelo outro caminho; se sim, marque a conexão como exclusiva.');
    }
  }
  /* retorno que gera mais do que recebe */
  if (!temErro(L)) for (const a of Object.keys(P.arestas).filter(a => P.arestas[a]!.retorno)) {
    const e = P.arestas[a]!, t = num(e.taxa); if (t == null) continue;
    const y = direto(P, { entradas: { [e.para]: 1 }, semRetorno: true, semCap: true }).v[e.de] ?? 0;
    if (t * y >= 1) add('erro', 'retorno_explosivo', 'a:' + a, nome(e.de) + ' → ' + nome(e.para) + ': o retorno devolve mais entidades do que o trecho recebe (' + (t * y * 100).toFixed(0) + '%).');
  }
  return L;
}

/* ---------- cálculo direto: volumes esperados; retornos em passadas; capacidade vira fila ---------- */
export interface ResultadoNo { vol: number; contratado: number | null; margem: number | null; noPeriodo: number | null; fracPeriodo: number | null; lag: number }
export interface Direto {
  ok: boolean; erro?: string;
  v: Record<string, number>;         // quanto chega em cada bloco (novos + retornos)
  novo: Record<string, number>; ret: Record<string, number>;
  proc: Record<string, number>;      // quanto o bloco processa (limitado pela capacidade)
  fila: Record<string, number>;      // o que ficou esperando por falta de capacidade
  fluxo: Record<string, number>;     // volume por conexão
  perdaImpl: Record<string, number>; // o que não avança por nenhuma saída
  lag: Record<string, number>;       // dias médios desde a entrada até chegar no bloco
  resultado: Record<string, ResultadoNo>;
}
export interface OpcoesDireto { entradas?: Record<string, number>; semRetorno?: boolean; semCap?: boolean; diasPeriodo?: number | null }
const zeros = (ids: string[]) => Object.fromEntries(ids.map(n => [n, 0])) as Record<string, number>;

export function direto(P: PBase, opt: OpcoesDireto = {}): Direto {
  const G = grafo(P), v = zeros(G.ids), novo = zeros(G.ids), ret = zeros(G.ids), proc = zeros(G.ids), fila = zeros(G.ids), perdaImpl = zeros(G.ids), lagAc = zeros(G.ids), lagPeso = zeros(G.ids);
  const fluxo = zeros(Object.keys(P.arestas));
  if (G.ciclo.length) return { ok: false, erro: 'ciclo', v, novo, ret, proc, fila, fluxo, perdaImpl, lag: {}, resultado: {} };
  const capLeft: Record<string, number> = {};
  for (const n of G.ids) { const c = P.nos[n]!.cap; capLeft[n] = !opt.semCap && c && (num(c.v) ?? 0) > 0 ? Number(c.v) : Infinity; }
  let inj: Record<string, number> = {};
  if (opt.entradas) for (const n of Object.keys(opt.entradas)) { if (n in v) inj[n] = Number(opt.entradas[n]) || 0; }
  else for (const n of G.ent) inj[n] = num(P.nos[n]!.vol) ?? 0;
  const voltas = zeros(Object.keys(P.arestas));
  for (let passada = 0; passada < 12; passada++) {
    const chega: Record<string, number> = {}; for (const n of G.ids) chega[n] = inj[n] ?? 0;
    const sai: Record<string, number> = {};
    for (const n of G.ordem) {
      const c = chega[n]!; if (!(c > EPS)) { sai[n] = 0; continue; }
      const p = Math.min(c, capLeft[n]!); capLeft[n]! -= p; fila[n]! += c - p; sai[n] = p;
      v[n]! += c; proc[n]! += p; if (passada === 0) novo[n]! += c; else ret[n]! += c;
      let somaTx = 0;
      for (const a of G.out[n]!) {
        const e = P.arestas[a]!, t = num(e.taxa); if (t == null || t < 0) continue;
        somaTx += Math.min(1, t); if (e.retorno) continue;
        const q = p * Math.min(1, t);
        fluxo[a]! += q; chega[e.para]! += q;
        const dd = num(e.dias) ?? 0;
        lagAc[e.para]! += q * ((lagPeso[n]! ? lagAc[n]! / lagPeso[n]! : 0) + dd); lagPeso[e.para]! += q;
      }
      if (!['resultado', 'perda'].includes(P.nos[n]!.tipo) && G.out[n]!.length) perdaImpl[n]! += p * Math.max(0, 1 - somaTx);
    }
    if (opt.semRetorno) break;
    inj = {}; let tem = false;
    for (const a of Object.keys(P.arestas)) {
      const e = P.arestas[a]!; if (!e.retorno) continue;
      const t = num(e.taxa), mv = num(e.maxVoltas) ?? 1; if (t == null || voltas[a]! >= mv) continue;
      const q = (sai[e.de] ?? 0) * Math.min(1, t);
      if (q > EPS) { inj[e.para] = (inj[e.para] ?? 0) + q; fluxo[a]! += q; tem = true; }
      voltas[a]!++;
    }
    if (!tem) break;
  }
  const lag: Record<string, number> = {}; for (const n of G.ids) lag[n] = lagPeso[n]! > EPS ? lagAc[n]! / lagPeso[n]! : 0;
  const D = num(opt.diasPeriodo != null ? opt.diasPeriodo : P.dias), resultado: Record<string, ResultadoNo> = {};
  for (const n of G.res.concat(G.ids.filter(n => P.nos[n]!.tipo === 'pos' || P.nos[n]!.tipo === 'compromisso'))) {
    const N = P.nos[n]!, tk = num(N.ticket), mg = num(N.margem), q = proc[n]!;
    const frac = D != null && D > 0 ? Math.max(0, Math.min(1, (D - lag[n]!) / D)) : null;
    resultado[n] = { vol: q, contratado: tk != null ? q * tk : null, margem: tk != null && mg != null ? q * tk * mg : null, noPeriodo: frac == null ? null : q * frac, fracPeriodo: frac, lag: lag[n]! };
  }
  return { ok: true, v, novo, ret, proc, fila, fluxo, perdaImpl, lag, resultado };
}

/* ---------- rendimento: quanto chega ao alvo por entidade colocada em cada bloco (sem capacidade) ---------- */
export function rendimento(P: PBase, alvo: string): Record<string, number> {
  const y: Record<string, number> = {};
  for (const n of Object.keys(P.nos)) { const r = direto(P, { entradas: { [n]: 1 }, semCap: true }); y[n] = r.ok ? r.proc[alvo] ?? 0 : 0; }
  return y;
}

/* ---------- cálculo reverso: alvo → entradas e volumes necessários ---------- */
export interface Impossivel { no: string; tipo: 'capacidade' | 'fonte'; req: number; max: number; msg: string }
export interface Reverso {
  ok: boolean; erro?: string; validacao?: Validacao[]; avisos: string[]; impossiveis: Impossivel[];
  nos: Record<string, { exato: number; inteiro: number; comInteiros: number }>;
  entradas: Record<string, { exato: number; inteiro: number; peso: number }>;
  alvoVol?: number; alvoInteiro?: number; alvoReceita?: number; ticket?: number;
  rendimento?: Record<string, number>; contrib?: number; falta?: number; resultadoComInteiros?: number;
}
export interface OpcoesReverso { medida?: 'volume' | 'receita'; estoque?: Record<string, number>; mix?: Record<string, number> }

export function reverso(P: PBase, alvo: string, valor: unknown, opt: OpcoesReverso = {}): Reverso {
  const out: Reverso = { ok: false, avisos: [], impossiveis: [], nos: {}, entradas: {} }, N = P.nos[alvo];
  if (!N) { out.erro = 'Escolha o bloco de resultado que recebe a meta.'; return out; }
  const V = validar(P); if (temErro(V)) { out.erro = 'O modelo tem erros de validação: corrija antes do cálculo reverso.'; out.validacao = V; return out; }
  let alvoVol = num(valor); if (alvoVol == null || alvoVol <= 0) { out.erro = 'Informe a meta (maior que zero).'; return out; }
  if (opt.medida === 'receita') { const tk = num(N.ticket); if (!(tk != null && tk > 0)) { out.erro = 'Meta em R$ precisa do ticket no bloco de resultado.'; return out; } out.alvoReceita = alvoVol; alvoVol = alvoVol / tk; out.ticket = tk; }
  out.alvoVol = alvoVol; out.alvoInteiro = teto(alvoVol)!;
  const y = rendimento(P, alvo); out.rendimento = y;
  /* o pipeline aberto já contribui: estoque × rendimento */
  const est = opt.estoque ?? {}; out.contrib = Object.keys(est).reduce((s, n) => s + (Number(est[n]) || 0) * (y[n] ?? 0), 0);
  out.falta = Math.max(0, out.alvoInteiro - out.contrib);
  const G = grafo(P), ents = G.ent.filter(n => (y[n] ?? 0) > EPS);
  if (!ents.length) {
    const semTx = Object.keys(P.arestas).filter(a => num(P.arestas[a]!.taxa) == null).map(a => (P.nos[P.arestas[a]!.de]?.nome ?? '?') + ' → ' + (P.nos[P.arestas[a]!.para]?.nome ?? '?'));
    out.erro = 'Nenhuma entrada chega a ' + (N.nome || 'o resultado') + ' com as taxas atuais.' + (semTx.length ? ' Falta taxa em: ' + semTx.join(', ') + '.' : ''); return out;
  }
  /* mistura das entradas: a proporção dos volumes informados (ou partes iguais) */
  const pesos: Record<string, number> = {}; let tp = 0;
  for (const n of ents) { const w = opt.mix && opt.mix[n] != null ? Number(opt.mix[n]) : num(P.nos[n]!.vol); pesos[n] = w != null && w > 0 ? w : 0; tp += pesos[n]!; }
  if (!(tp > 0)) { for (const n of ents) pesos[n] = 1; tp = ents.length; }
  const rendMix = ents.reduce((s, n) => s + (pesos[n]! / tp) * y[n]!, 0), k = out.falta / rendMix;
  const entExato: Record<string, number> = {}; for (const n of ents) entExato[n] = (k * pesos[n]!) / tp;
  const exato = direto(P, { entradas: entExato, semCap: true });
  const entInt: Record<string, number> = {}; for (const n of ents) entInt[n] = teto(entExato[n])!;
  const conf = direto(P, { entradas: entInt, semCap: true });
  for (const n of ents) out.entradas[n] = { exato: entExato[n]!, inteiro: entInt[n]!, peso: pesos[n]! / tp };
  for (const n of Object.keys(P.nos)) out.nos[n] = { exato: exato.v[n]!, inteiro: teto(exato.v[n])!, comInteiros: conf.v[n]! };
  out.resultadoComInteiros = (conf.proc[alvo] ?? 0) + out.contrib;
  /* capacidade e limite das fontes: a meta cabe? */
  for (const n of Object.keys(P.nos)) {
    const M2 = P.nos[n]!, cap = M2.cap ? num(M2.cap.v) : null, lim = num(M2.limite), req = exato.v[n]!;
    if (cap != null && cap > 0 && req > cap + EPS) out.impossiveis.push({ no: n, tipo: 'capacidade', req, max: cap, msg: (M2.nome || n) + ': precisa de ' + teto(req) + ' e a capacidade declarada é ' + cap + '.' });
    if (lim != null && lim > 0 && M2.tipo === 'entrada' && req > lim + EPS) out.impossiveis.push({ no: n, tipo: 'fonte', req, max: lim, msg: (M2.nome || n) + ': precisa de ' + teto(req) + ' e a fonte entrega no máximo ' + lim + '.' });
  }
  /* premissas sem evidência no caminho do resultado */
  const fracas = Object.keys(P.arestas).filter(a => { const e = P.arestas[a]!; return (y[e.para] ?? 0) > EPS && num(e.taxa) != null && !evidencia(e.fonte); });
  if (fracas.length) out.avisos.push(fracas.length + ' taxa(s) no caminho do resultado não têm evidência histórica: o número é condicional a essas premissas.');
  out.ok = true; return out;
}

/* ---------- sensibilidade: cada taxa num intervalo plausível; volume de entrada ±; esforço para +1 resultado ---------- */
export interface LinhaSensibilidade {
  alvo: string; tipo: 'taxa' | 'volume'; nome: string; base: number; lo: number; hi: number; rLo: number; rHi: number; amp: number;
  ppPorUm?: number | null; porUm?: number | null; incerta: boolean; fonte: string; banda?: boolean;
}
export interface Sensibilidade { ok: boolean; R0?: number; L: LinhaSensibilidade[]; alerta?: LinhaSensibilidade[] }
export interface OpcoesSensibilidade { pp?: number; pctVol?: number; minN?: number; bandas?: Record<string, [number, number]> }

export function sensibilidade(P: PBase, alvo: string, opt: OpcoesSensibilidade = {}): Sensibilidade {
  const pp = opt.pp ?? 0.05, pv = opt.pctVol ?? 0.1, minN = opt.minN || 5;
  const base = direto(P, { semCap: true }); if (!base.ok) return { ok: false, L: [] };
  const R0 = base.proc[alvo] ?? 0, L: LinhaSensibilidade[] = [];
  const com = (fn: (Q: PBase) => void) => { const Q: PBase = { nos: { ...P.nos }, arestas: { ...P.arestas }, dias: P.dias }; fn(Q); const r = direto(Q, { semCap: true }); return r.ok ? r.proc[alvo] ?? 0 : 0; };
  for (const a of Object.keys(P.arestas)) {
    const e = P.arestas[a]!, t = num(e.taxa); if (t == null) continue;
    const banda = opt.bandas?.[a], lo = banda ? Math.max(0, banda[0]) : Math.max(0, t - pp), hi = banda ? Math.min(1, banda[1]) : Math.min(1, t + pp);
    const rl = com(Q => { Q.arestas[a] = { ...e, taxa: lo }; }), rh = com(Q => { Q.arestas[a] = { ...e, taxa: hi }; });
    const h = 0.001, rd = com(Q => { Q.arestas[a] = { ...e, taxa: Math.min(1, t + h) }; }), der = (rd - R0) / h;
    const incerta = !evidencia(e.fonte) || (e.n != null && e.n < minN);
    L.push({ alvo: 'a:' + a, tipo: 'taxa', nome: (P.nos[e.de]?.nome ?? e.de) + ' → ' + (P.nos[e.para]?.nome ?? e.para), base: t, lo, hi, rLo: rl, rHi: rh, amp: rh - rl, ppPorUm: der > EPS ? (1 / der) * 100 : null, incerta, fonte: e.fonte ?? 'premissa', banda: !!banda });
  }
  for (const n of Object.keys(P.nos).filter(n => P.nos[n]!.tipo === 'entrada' && (num(P.nos[n]!.vol) ?? 0) > 0)) {
    const N = P.nos[n]!, vol = Number(N.vol);
    const rl = com(Q => { Q.nos[n] = { ...N, vol: vol * (1 - pv) }; }), rh = com(Q => { Q.nos[n] = { ...N, vol: vol * (1 + pv) }; });
    const y = vol > 0 ? R0 / vol : 0;
    L.push({ alvo: 'n:' + n, tipo: 'volume', nome: 'Volume de ' + (N.nome || n), base: vol, lo: vol * (1 - pv), hi: vol * (1 + pv), rLo: rl, rHi: rh, amp: rh - rl, porUm: y > EPS ? 1 / y : null, incerta: !evidencia(N.fontes?.vol ?? N.fonte), fonte: N.fonte ?? 'premissa' });
  }
  L.sort((x, y) => y.amp - x.amp);
  return { ok: true, R0, L, alerta: L.filter(x => x.incerta && R0 > 0 && x.amp / R0 > 0.2) };
}

/* ---------- comparação de cenários ---------- */
const declarouLimite = (P: PBase) => Object.keys(P.nos).some(n => (P.nos[n]!.cap && (num(P.nos[n]!.cap!.v) ?? 0) > 0) || (num(P.nos[n]!.limite) ?? 0) > 0);
export interface PremissaCenario { alvo: string; nome: string; v: number | null; fonte: string; n: number | null | undefined }
export interface Comparacao {
  cen: string; nome: string; P: Parametros; validacao: Validacao[]; direto: Direto | null; resultado: ResultadoNo | null; reverso: Reverso | null; sens: Sensibilidade | null;
  premissas: PremissaCenario[]; lacunas: string[]; alterados: Alterado[]; viavel: boolean | null; condicoes: string[];
}
export interface OpcoesComparar { meta?: number | null; medida?: 'volume' | 'receita'; estoque?: Record<string, number>; minN?: number }

export function comparar(M: Modelo, cens: string[], alvo: string | null, opt: OpcoesComparar = {}): Comparacao[] {
  return cens.map(c => {
    const P = parametros(M, c), V = validar(P), d = temErro(V) ? null : direto(P), r = d && alvo && d.resultado[alvo] ? d.resultado[alvo]! : null;
    const rev = alvo && opt.meta ? reverso(P, alvo, opt.meta, { medida: opt.medida, estoque: opt.estoque }) : null;
    const sens = d && alvo ? sensibilidade(P, alvo, { minN: opt.minN }) : null;
    const premissas: PremissaCenario[] = Object.keys(P.arestas).map(a => { const e = P.arestas[a]!; return { alvo: 'a:' + a, nome: (P.nos[e.de]?.nome ?? e.de) + ' → ' + (P.nos[e.para]?.nome ?? e.para), v: num(e.taxa), fonte: e.fonte ?? 'premissa', n: e.n }; });
    const lacunas = premissas.filter(p => p.v == null).map(p => 'sem taxa: ' + p.nome).concat(premissas.filter(p => p.v != null && p.fonte === 'hipotese').map(p => 'hipótese não validada: ' + p.nome));
    const limites = declarouLimite(P);
    return {
      cen: c, nome: c === 'base' ? 'Base' : (M.cenarios ?? {})[c]?.nome || c, P, validacao: V, direto: d, resultado: r, reverso: rev, sens, premissas, lacunas, alterados: P.alterados,
      viavel: rev && rev.ok && limites ? !rev.impossiveis.length : null,
      condicoes: rev && rev.ok ? (limites ? rev.impossiveis.map(x => x.msg) : ['nenhuma capacidade nem limite de fonte declarado: viabilidade não avaliada']) : [],
    };
  });
}

/* ---------- prontidão da campanha: critérios explícitos, sem nota mágica ---------- */
export type EstadoProntidao = 'completo' | 'pendente' | 'fragil' | 'bloqueador';
export const ESTADOS_PRONTIDAO: Record<EstadoProntidao, string> = { completo: 'Completo', pendente: 'Pendente', fragil: 'Frágil', bloqueador: 'Bloqueador' };
export interface Brief {
  publico?: { icp?: string | null; criterios?: string | null; segmento?: string | null };
  oferta?: { produto?: string | null; valor?: string | null; condicoes?: string | null };
  canais?: { lista?: Array<string | null | undefined> };
  financeiro?: { ticket?: unknown; orcamento?: unknown; margem?: unknown; pagamento?: string | null };
  experimento?: { metrica?: string | null; amostra?: string | null; duracao?: string | null; continuar?: string | null; corrigir?: string | null; encerrar?: string | null };
}
export interface ItemProntidao { k: string; nome: string; st: EstadoProntidao; porque: string; essencial: boolean }
export interface Prontidao { L: ItemProntidao[]; bloq: number; pend: number; fragil: number; pronto: boolean; leitura: string }

export function prontidao(C: { brief?: Brief } | null | undefined, P: PBase | null, ctx: { reverso?: Reverso | null; minN?: number } = {}): Prontidao {
  const B = C?.brief ?? {}, L: ItemProntidao[] = [];
  const it = (k: string, nome: string, st: EstadoProntidao, porque: string, essencial = false) => L.push({ k, nome, st, porque, essencial });
  const tem = (v: unknown) => v != null && String(v).trim() !== '';
  const pub = B.publico ?? {}, of = B.oferta ?? {}, ca = B.canais ?? {}, fi = B.financeiro ?? {}, ex = B.experimento ?? {};
  it('publico', 'O público está definido?', tem(pub.icp) && tem(pub.criterios) ? 'completo' : tem(pub.icp) || tem(pub.segmento) ? 'fragil' : 'pendente', tem(pub.icp) && tem(pub.criterios) ? 'Perfil e critérios de elegibilidade escritos.' : 'Falta ' + [!tem(pub.icp) && 'o perfil de cliente ideal', !tem(pub.criterios) && 'os critérios de elegibilidade'].filter(Boolean).join(' e ') + '.', true);
  const nOf = [of.produto, of.valor, of.condicoes].filter(tem).length;
  it('oferta', 'A oferta é suficientemente clara?', nOf === 3 ? 'completo' : nOf ? 'fragil' : 'pendente', nOf === 3 ? 'Produto, proposta de valor e condições comerciais definidos.' : 'Falta ' + [!tem(of.produto) && 'o produto', !tem(of.valor) && 'a proposta de valor', !tem(of.condicoes) && 'as condições comerciais'].filter(Boolean).join(', ') + '.');
  const lc = (ca.lista ?? []).filter((x): x is string => tem(x));
  it('demanda', 'Existe uma fonte de demanda identificada?', lc.length ? 'completo' : 'bloqueador', lc.length ? 'Canais: ' + lc.join(', ') + '.' : 'Nenhum canal de aquisição: o teste não tem de onde receber entidades.', true);
  const V = P ? validar(P) : null;
  it('processo', 'O processo de conversão foi desenhado?', !P || temErro(V) ? 'bloqueador' : 'completo', !P ? 'Nenhum funil vinculado à campanha.' : temErro(V) ? 'O funil tem ' + V!.filter(x => x.grav === 'erro').length + ' erro(s) de validação.' : 'Funil vinculado e sem erros de validação.', true);
  if (P) {
    const tx = Object.values(P.arestas).filter(e => num(e.taxa) != null), ev = tx.filter(e => evidencia(e.fonte) && !(e.n != null && e.n < (ctx.minN ?? 5)));
    it('evidencia', 'As premissas de conversão têm evidência?', !tx.length ? 'pendente' : ev.length / tx.length >= 0.7 ? 'completo' : 'fragil', !tx.length ? 'Nenhuma taxa informada.' : ev.length + ' de ' + tx.length + ' taxa(s) com dado histórico ou benchmark com amostra.' + (ev.length / tx.length < 0.7 ? ' O resultado é condicional às hipóteses: o teste serve para medi-las.' : ''));
  } else it('evidencia', 'As premissas de conversão têm evidência?', 'pendente', 'Sem funil, não há premissas.');
  const R = ctx.reverso;
  const fonteImp = R?.ok ? R.impossiveis.filter(x => x.tipo === 'fonte') : [], capImp = R?.ok ? R.impossiveis.filter(x => x.tipo === 'capacidade') : [];
  const temLim = !!P && Object.values(P.nos).some(n => n.tipo === 'entrada' && (num(n.limite) ?? 0) > 0);
  it('volume', 'O volume necessário é compatível com o canal?', !R?.ok ? 'pendente' : fonteImp.length ? 'bloqueador' : temLim ? 'completo' : 'pendente', !R?.ok ? 'Defina a meta para o cálculo reverso.' : fonteImp.length ? fonteImp.map(x => x.msg).join(' ') : temLim ? 'O volume necessário cabe no que as fontes entregam.' : 'Informe quanto cada fonte entrega no máximo no período.');
  const nosCom = P ? Object.keys(P.nos).filter(n => P.nos[n]!.cap && (num(P.nos[n]!.cap!.v) ?? 0) > 0) : [];
  const ehEntrega = (n: string) => ['pos', 'compromisso'].includes(P!.nos[n]!.tipo);
  const comerc = nosCom.filter(n => !ehEntrega(n)), entrega = nosCom.filter(ehEntrega);
  const impDe = (L2: string[]) => capImp.filter(x => L2.includes(x.no));
  it('capacidade', 'O time tem capacidade para atender a demanda?', !R?.ok ? 'pendente' : impDe(comerc).length ? 'bloqueador' : comerc.length ? 'completo' : 'pendente', impDe(comerc).length ? impDe(comerc).map(x => x.msg).join(' ') : comerc.length ? 'A demanda cabe na capacidade declarada.' : 'Nenhuma capacidade comercial declarada nos blocos.');
  it('entrega', 'A entrega comporta o volume projetado?', !R?.ok ? 'pendente' : impDe(entrega).length ? 'bloqueador' : entrega.length ? 'completo' : 'pendente', impDe(entrega).length ? impDe(entrega).map(x => x.msg).join(' ') : entrega.length ? 'O volume cabe na capacidade de entrega declarada.' : 'Capacidade de entrega não declarada.');
  const nFi = [fi.ticket, fi.orcamento, fi.margem].filter(v => num(v) != null).length;
  it('financeiro', 'As condições financeiras estão definidas?', nFi === 3 && tem(fi.pagamento) ? 'completo' : nFi ? 'fragil' : 'pendente', nFi ? 'Definidos: ' + [num(fi.ticket) != null && 'ticket', num(fi.orcamento) != null && 'orçamento', num(fi.margem) != null && 'margem', tem(fi.pagamento) && 'condição de pagamento'].filter(Boolean).join(', ') + '.' : 'Sem ticket, orçamento nem margem.');
  const ligados = P ? Object.keys(P.nos).filter(n => P.nos[n]!.bind?.tipo) : [], entLig = !!P && ligados.some(n => P.nos[n]!.tipo === 'entrada'), resLig = !!P && ligados.some(n => P.nos[n]!.tipo === 'resultado');
  it('medicao', 'Existe mecanismo para medir o resultado?', entLig && resLig && lc.length ? 'completo' : ligados.length ? 'fragil' : 'bloqueador', entLig && resLig && lc.length ? 'Entrada e resultado ligados ao dado real; atribuição pelos canais da campanha.' : ligados.length ? 'Só parte dos blocos está ligada ao dado real (' + ligados.length + ').' : 'Nenhum bloco ligado ao dado real: o resultado não seria medido.', true);
  const nEx = [ex.metrica, ex.amostra || ex.duracao, ex.continuar || ex.corrigir || ex.encerrar].filter(tem).length;
  it('decisao', 'Há um critério objetivo para decidir depois do teste?', nEx === 3 ? 'completo' : nEx ? 'fragil' : 'pendente', nEx === 3 ? 'Métrica, amostra ou duração e limites de decisão definidos.' : 'Falta ' + [!tem(ex.metrica) && 'a métrica de avaliação', !tem(ex.amostra || ex.duracao) && 'a amostra ou duração', !tem(ex.continuar || ex.corrigir || ex.encerrar) && 'os limites de continuar, corrigir ou encerrar'].filter(Boolean).join(', ') + '.', true);
  const bloq = L.filter(x => x.st === 'bloqueador'), pend = L.filter(x => x.st === 'pendente' && x.essencial);
  return {
    L, bloq: bloq.length, pend: L.filter(x => x.st === 'pendente').length, fragil: L.filter(x => x.st === 'fragil').length, pronto: !bloq.length && !pend.length,
    leitura: bloq.length ? 'Não está pronta para testar: ' + bloq.length + ' bloqueador(es).' : pend.length ? 'Ainda não está pronta: ' + pend.length + ' item(ns) essencial(is) pendente(s).' : 'Pronta para ser testada' + (L.some(x => x.st === 'fragil' || x.st === 'pendente') ? ', com pontos frágeis registrados.' : '.'),
  };
}

/* ---------- monitor: planejado × realizado por bloco e conexão, estados e diagnósticos ---------- */
export const wilson = (k: number, n: number): [number, number] | null => { const w = wilsonIC(k, n); return w ? [w.baixo, w.alto] : null; };
export type EstadoMonitor = 'dentro' | 'atencao' | 'fora' | 'bloqueado' | 'insuficiente';
export const ESTADOS_MONITOR: Record<EstadoMonitor, string> = { dentro: 'Dentro do esperado', atencao: 'Em atenção', fora: 'Fora do esperado', bloqueado: 'Bloqueado por restrição operacional', insuficiente: 'Dados insuficientes' };
export const INVESTIGAR: Record<string, string[]> = {
  entrada_baixa: ['volume entregue por cada canal no período', 'investimento e cadência das fontes de demanda', 'leads criados fora do sistema ou sem origem'],
  conversao_baixa: ['perfil dos leads da coorte (origem, segmento, porte)', 'qualidade da qualificação na etapa de origem', 'comparecimento às reuniões', 'critério de passagem entre as duas etapas', 'motivos de perda registrados'],
  acumulo: ['negócios sem próximo passo na etapa', 'capacidade de quem atende a etapa', 'critério de saída da etapa'],
  tempo_acima: ['negócios parados há mais tempo que o prazo da etapa', 'dependências externas (cliente, financiamento, documentação)'],
  volume_meta: ['volume de entrada necessário pelo cálculo reverso', 'pipeline aberto por etapa e chance de cada uma'],
  perdas_motivo: ['os negócios perdidos pelo motivo dominante', 'proposta e condição comercial desses negócios'],
  canal_qualidade: ['critério de qualificação do canal', 'perfil dos leads do canal comparado aos outros'],
  dependencia: ['risco de a origem dominante cair', 'alternativas de canal com conversão conhecida'],
  capacidade_entrega: ['fila de entrega e prazo', 'capacidade da equipe de entrega'],
  qualidade_dados: ['blocos sem vínculo ou sem acesso', 'negócios importados sem histórico', 'passagens de período maiores que 100%'],
};
export interface ObsNo {
  estado?: 'ok' | 'semacesso' | 'semvinculo' | 'semdado' | string; entradas?: number | null; saldo?: number | null; perdas?: number | null; retornos?: number | null;
  idadeMed?: number | null; acimaPrazo?: number | null; prazo?: number | null; nota?: string; motivos?: Record<string, number>; porCanal?: Record<string, number>;
}
export interface ObsAresta { estado?: 'ok' | string; k?: number | null; n?: number | null; fluxo?: number | null; imaturo?: boolean; nota?: string; porCanal?: Record<string, { k: number; n: number }> }
export interface Observado { nos?: Record<string, ObsNo>; arestas?: Record<string, ObsAresta> }
export interface MonitorNo {
  plano: number | null; esperado: number | null; real: number | null | undefined; saldo?: number | null; perdas?: number | null; retornos?: number | null; idade?: number | null; acimaPrazo?: number | null;
  frac: number; nota: string; estado: EstadoMonitor; motivo?: string; razao?: number; projetado: number | null; deficit: number | null; impactoVol: number | null; impactoRec: number | null; saldoEsperado?: number;
}
export interface MonitorAresta {
  plano: number | null; k?: number | null; n?: number | null; real: number | null; fluxo?: number | null; imaturo: boolean; nota: string; estado: EstadoMonitor; motivo?: string;
  ic?: [number, number] | null; perdidos?: number; impactoVol?: number; impactoRec?: number | null;
}
export interface Diagnostico { chave: string; tipo: string; alvo: string; estado: EstadoMonitor; titulo: string; evidencia: string; consequencia: string; investigar: string[]; impactoVol?: number | null; impactoRec?: number | null; metrica?: string | null }
export interface MetaMonitor { alvo: number; realizado: number; pipeline: number; pipelineNota: string; futuro: number; projecao: number; gap: number }
export interface Monitor { nos: Record<string, MonitorNo>; arestas: Record<string, MonitorAresta>; diags: Diagnostico[]; gargalo: Diagnostico | null; meta: MetaMonitor | null; rendimento: Record<string, number>; alvo: string | undefined }
export interface OpcoesMonitor { minN?: number; minVol?: number; tolAtencao?: number; tolFora?: number; diasPeriodo?: number; decorridos?: number; alvo?: string; meta?: number | null; pipeline?: number | null; pipelineNota?: string }

/* frac: fração do período já decorrida; fracAte(lag): quanto do volume planejado já deveria ter chegado considerando a defasagem */
export function monitorar(P: PBase, plano: Direto | null, obs: Observado, opt: OpcoesMonitor = {}): Monitor {
  const minN = opt.minN || 5, minVol = opt.minVol ?? 3, tolA = opt.tolAtencao || 0.9, tolF = opt.tolFora || 0.75, D = Math.max(1, Number(opt.diasPeriodo) || 30), dec = Math.max(0, Number(opt.decorridos) || 0);
  const G = grafo(P), alvo = opt.alvo ?? G.res[0], y = alvo ? rendimento(P, alvo) : {}, tk = alvo ? num(P.nos[alvo]?.ticket) : null;
  const nos: Record<string, MonitorNo> = {}, arestas: Record<string, MonitorAresta> = {}, diags: Diagnostico[] = [];
  const nome = (n: string) => P.nos[n]?.nome || n, fracAte = (lag: number | undefined) => Math.max(0, Math.min(1, (dec - (lag ?? 0)) / D));
  const rec = (q: number | null) => (tk != null && q != null ? q * tk : null);
  const obsNos = obs.nos ?? {}, obsAr = obs.arestas ?? {};
  for (const n of G.ids) {
    const N = P.nos[n]!, o = obsNos[n] ?? {}, pl = plano?.ok ? plano.v[n] ?? 0 : null, lag = plano?.lag ? plano.lag[n] : 0, f = fracAte(lag), esp = pl != null ? pl * f : null;
    const r: MonitorNo = { plano: pl, esperado: esp, real: o.entradas, saldo: o.saldo, perdas: o.perdas, retornos: o.retornos, idade: o.idadeMed, acimaPrazo: o.acimaPrazo, frac: f, nota: o.nota ?? '', estado: 'insuficiente', projetado: null, deficit: null, impactoVol: null, impactoRec: null };
    if (o.estado !== 'ok' || o.entradas == null) { r.estado = 'insuficiente'; r.motivo = o.estado === 'semacesso' ? 'sem acesso a esta fonte' : N.bind?.tipo ? o.nota || 'sem dado no período' : 'bloco sem vínculo com o CRM'; }
    else if (esp == null) { r.estado = 'insuficiente'; r.motivo = 'sem volume planejado para comparar'; }
    else if (esp < minVol && o.entradas < minVol) { r.estado = 'insuficiente'; r.motivo = 'volume esperado até agora (' + umaCasa(esp) + ') pequeno demais para concluir'; }
    else { const rz = esp > 0 ? o.entradas / esp : o.entradas > 0 ? Infinity : 1; r.razao = rz; r.estado = rz >= tolA ? 'dentro' : rz >= tolF ? 'atencao' : 'fora'; }
    const cap = N.cap ? num(N.cap.v) : null;
    if (cap != null && cap > 0 && o.estado === 'ok' && o.entradas != null && o.entradas > cap * Math.max(f, EPS) + EPS && f > 0) { r.estado = 'bloqueado'; r.motivo = 'entradas acima da capacidade declarada para o período decorrido (' + cap + ' no período)'; }
    r.projetado = o.entradas != null && f >= 0.15 ? o.entradas / f : null;
    r.deficit = esp != null && o.entradas != null ? Math.max(0, esp - o.entradas) : null;
    r.impactoVol = r.deficit != null && y[n] != null ? r.deficit * y[n]! : null; r.impactoRec = rec(r.impactoVol);
    nos[n] = r;
    if (N.tipo === 'entrada' && (r.estado === 'fora' || r.estado === 'atencao')) diags.push({ chave: 'entrada:' + n, tipo: 'entrada_baixa', alvo: 'n:' + n, estado: r.estado, titulo: 'Entrada de ' + nome(n) + ' abaixo do necessário', evidencia: Math.round(o.entradas!) + ' entradas contra ' + umaCasa(esp!) + ' esperadas até agora (' + Math.round(r.razao! * 100) + '%).', consequencia: r.impactoVol != null ? 'Se o ritmo não mudar, o resultado perde ≈ ' + umaCasa(r.impactoVol) + (r.impactoRec != null ? ' (≈ ' + brlTxt(r.impactoRec) + ')' : '') + ' (projeção pelas taxas do plano).' : '', impactoVol: r.impactoVol, impactoRec: r.impactoRec, investigar: INVESTIGAR.entrada_baixa! });
    /* acúmulo (lei de Little: saldo esperado ≈ fluxo diário planejado × permanência) e tempo acima do prazo: um diagnóstico por etapa, não dois */
    const prazo = num(N.prazo) ?? num(o.prazo); let acum: string | null = null, tempo: string | null = null;
    if (pl != null && prazo != null && prazo > 0 && o.saldo != null) { const sEsp = (pl / D) * prazo; r.saldoEsperado = sEsp; if (o.saldo >= Math.max(minVol, 1.5 * sEsp)) acum = o.saldo + ' na etapa agora; o fluxo planejado com ' + prazo + ' dia(s) de permanência sustenta ≈ ' + umaCasa(sEsp) + '.'; }
    if (o.acimaPrazo != null && o.saldo != null && o.saldo >= minVol && o.acimaPrazo / Math.max(1, o.saldo) >= 0.3) tempo = o.acimaPrazo + ' de ' + o.saldo + ' estão na etapa há mais que o prazo (' + (prazo ?? '—') + ' dias)' + (o.idadeMed != null ? '; idade média ' + Math.round(o.idadeMed) + ' dias' : '') + '.';
    if (acum || tempo) diags.push({ chave: (acum ? 'acumulo:' : 'tempo:') + n, tipo: acum ? 'acumulo' : 'tempo_acima', alvo: 'n:' + n, estado: 'atencao', titulo: acum && tempo ? 'Acúmulo e tempo acima do padrão em ' + nome(n) : acum ? 'Acúmulo em ' + nome(n) : 'Tempo acima do padrão em ' + nome(n), evidencia: [acum, tempo].filter(Boolean).join(' '), consequencia: (acum ? 'Entidades paradas atrasam as etapas seguintes e podem virar perda. ' : '') + (tempo ? 'Ciclo mais longo empurra vendas para o período seguinte.' : ''), investigar: (acum ? INVESTIGAR.acumulo! : []).concat(tempo ? INVESTIGAR.tempo_acima! : []) });
    if (o.motivos) { const mo = o.motivos, tot = Object.values(mo).reduce((s, k) => s + k, 0), top = Object.keys(mo).sort((a, b) => mo[b]! - mo[a]!)[0];
      if (top && tot >= minVol && mo[top]! / tot >= 0.5) diags.push({ chave: 'perdas:' + n + ':' + top, tipo: 'perdas_motivo', alvo: 'n:' + n, estado: 'atencao', titulo: 'Perdas em ' + nome(n) + ' concentradas em "' + top + '"', evidencia: mo[top] + ' de ' + tot + ' perdas registradas no período.', consequencia: 'Um motivo dominante indica onde investigar primeiro.', investigar: INVESTIGAR.perdas_motivo! }); }
    if (o.porCanal && N.tipo === 'entrada') { const pc = o.porCanal, tot = Object.values(pc).reduce((s, k) => s + k, 0), top = Object.keys(pc).sort((a, b) => pc[b]! - pc[a]!)[0];
      if (top && tot >= 10 && pc[top]! / tot >= 0.7) diags.push({ chave: 'dep:' + n + ':' + top, tipo: 'dependencia', alvo: 'n:' + n, estado: 'atencao', titulo: 'Dependência de uma origem: ' + top, evidencia: Math.round((pc[top]! / tot) * 100) + '% das ' + tot + ' entradas vêm de ' + top + '.', consequencia: 'Se essa origem cair, a entrada cai junto.', investigar: INVESTIGAR.dependencia! }); }
  }
  for (const a of Object.keys(P.arestas)) {
    const e = P.arestas[a]!, o = obsAr[a] ?? {}, t = num(e.taxa);
    const r: MonitorAresta = { plano: t, k: o.k, n: o.n, real: o.n && o.k != null ? o.k / o.n : null, fluxo: o.fluxo, imaturo: !!o.imaturo, nota: o.nota ?? '', estado: 'insuficiente' };
    if (o.estado !== 'ok' || !o.n) { r.estado = 'insuficiente'; r.motivo = o.estado === 'ok' ? 'ninguém entrou na etapa de origem no período' : o.nota || 'conexão sem vínculo com o CRM'; }
    else if (t == null) { r.estado = 'insuficiente'; r.motivo = 'sem taxa planejada para comparar'; }
    else if (o.n < minN) { r.estado = 'insuficiente'; r.motivo = 'amostra de ' + o.n + ' (mínimo ' + minN + ')'; }
    else {
      const w = wilson(o.k ?? 0, o.n)!; r.ic = w;
      r.estado = w[1] < t ? 'fora' : r.real! < t - 0.05 || r.real! < t * 0.85 ? 'atencao' : 'dentro';
      if (r.estado === 'fora' && r.imaturo) { r.estado = 'atencao'; r.motivo = 'coorte ainda amadurecendo: parte das passagens pode acontecer depois'; }
    }
    if (r.real != null && t != null && r.real < t) { r.perdidos = (t - r.real) * o.n!; r.impactoVol = r.perdidos * (y[e.para] ?? 0); r.impactoRec = rec(r.impactoVol); }
    arestas[a] = r;
    if (r.estado === 'fora' || r.estado === 'atencao') diags.push({ chave: 'conv:' + a, tipo: 'conversao_baixa', alvo: 'a:' + a, estado: r.estado, metrica: e.ind ?? null,
      titulo: 'Conversão ' + nome(e.de) + ' → ' + nome(e.para) + ' abaixo do parâmetro',
      evidencia: o.k + ' de ' + o.n + ' (' + pctTxt(r.real!) + '%) contra ' + pctTxt(t!) + '% planejado' + (r.ic ? '; intervalo de 95%: ' + (r.ic[0] * 100).toFixed(0) + '% a ' + (r.ic[1] * 100).toFixed(0) + '%' : '') + (r.motivo ? ' (' + r.motivo + ')' : '') + '.',
      consequencia: r.perdidos != null ? '≈ ' + umaCasa(r.perdidos) + ' a menos em ' + nome(e.para) + (r.impactoVol != null ? ', ≈ ' + umaCasa(r.impactoVol) + ' no resultado' : '') + (r.impactoRec != null ? ' (≈ ' + brlTxt(r.impactoRec) + ')' : '') + '. O dado mostra onde está o desvio; a causa precisa de evidência adicional.' : '',
      impactoVol: r.impactoVol, impactoRec: r.impactoRec, investigar: INVESTIGAR.conversao_baixa! });
    if (o.porCanal && (o.n ?? 0) >= 10) {
      const cs = Object.keys(o.porCanal).map(c => ({ c, ...o.porCanal![c]! })).filter(x => x.n >= minN);
      for (const x of cs) {
        const outros = cs.filter(z => z.c !== x.c), kO = outros.reduce((s, z) => s + z.k, 0), nO = outros.reduce((s, z) => s + z.n, 0);
        if (nO >= minN && x.n / o.n! >= 0.3 && kO / nO > 0 && x.k / x.n < 0.5 * (kO / nO)) diags.push({ chave: 'canal:' + a + ':' + x.c, tipo: 'canal_qualidade', alvo: 'a:' + a, estado: 'atencao', titulo: x.c + ': volume alto e pouca passagem em ' + nome(e.de) + ' → ' + nome(e.para), evidencia: x.c + ' tem ' + Math.round((x.n / o.n!) * 100) + '% da coorte e converte ' + ((x.k / x.n) * 100).toFixed(0) + '% contra ' + ((kO / nO) * 100).toFixed(0) + '% das outras origens.', consequencia: 'Volume de um canal que não avança ocupa a capacidade do time.', investigar: INVESTIGAR.canal_qualidade! });
      }
    }
    if (o.fluxo != null && o.fluxo > 1.05 && o.estado === 'ok') diags.push({ chave: 'dado:' + a, tipo: 'qualidade_dados', alvo: 'a:' + a, estado: 'insuficiente', titulo: 'Passagem do período acima de 100% em ' + nome(e.de) + ' → ' + nome(e.para), evidencia: 'No período, entraram mais em ' + nome(e.para) + ' do que em ' + nome(e.de) + ' (' + Math.round(o.fluxo * 100) + '%): parte vem de coortes anteriores ou pulou a etapa.', consequencia: 'Não use a passagem do período como taxa; use a coorte.', investigar: INVESTIGAR.qualidade_dados! });
  }
  /* boa conversão comercial com entrega travada */
  for (const n of G.ids.filter(n => ['pos', 'compromisso'].includes(P.nos[n]!.tipo) && nos[n]!.estado === 'bloqueado')) diags.push({ chave: 'entrega:' + n, tipo: 'capacidade_entrega', alvo: 'n:' + n, estado: 'bloqueado', titulo: 'Capacidade de entrega insuficiente em ' + nome(n), evidencia: nos[n]!.motivo ?? '', consequencia: 'Vender mais sem capacidade de entrega aumenta fila e prazo.', investigar: INVESTIGAR.capacidade_entrega! });
  /* volume para a meta: realizado + pipeline aberto × rendimento + entradas que ainda faltam no plano */
  let meta: MetaMonitor | null = null;
  if (alvo && opt.meta != null && opt.meta > 0) {
    const realRes = nos[alvo]?.real ?? 0;
    const pipe = dec >= D ? 0 : opt.pipeline != null ? opt.pipeline : G.ids.filter(n => n !== alvo).reduce((s, n) => s + (nos[n]?.saldo ?? 0) * (y[n] ?? 0), 0);
    const futuro = G.ent.reduce((s, n) => s + (plano?.ok ? plano.v[n] ?? 0 : 0) * Math.max(0, 1 - Math.min(1, dec / D)) * (y[n] ?? 0), 0);
    meta = { alvo: opt.meta, realizado: realRes, pipeline: pipe, pipelineNota: opt.pipelineNota ?? (dec >= D ? 'período encerrado' : 'saldo de cada etapa × taxas do plano (sem ajuste pelo tempo que resta)'), futuro, projecao: realRes + pipe + futuro, gap: opt.meta - (realRes + pipe + futuro) };
    if (meta.gap > 0.5) diags.push({ chave: 'meta:' + alvo, tipo: 'volume_meta', alvo: 'n:' + alvo, estado: meta.projecao < opt.meta * tolF ? 'fora' : 'atencao', titulo: 'Volume insuficiente para a meta de ' + nome(alvo), evidencia: 'Realizado ' + realRes + ' + pipeline aberto ≈ ' + umaCasa(pipe) + ' (' + meta.pipelineNota + ') + entradas planejadas restantes ≈ ' + umaCasa(futuro) + ' = ≈ ' + umaCasa(meta.projecao) + ' contra a meta ' + qtxt(opt.meta) + '.', consequencia: 'Faltam ≈ ' + umaCasa(meta.gap) + (tk != null ? ' (≈ ' + brlTxt(meta.gap * tk) + ')' : '') + ' se nada mudar.', impactoVol: meta.gap, impactoRec: rec(meta.gap), investigar: INVESTIGAR.volume_meta! });
  }
  const semDado = G.ids.filter(n => P.nos[n]!.bind?.tipo && nos[n]!.estado === 'insuficiente' && /sem acesso|sem dado/.test(nos[n]!.motivo ?? ''));
  if (semDado.length) diags.push({ chave: 'dados:nos', tipo: 'qualidade_dados', alvo: '', estado: 'insuficiente', titulo: 'Dados que impedem conclusão', evidencia: semDado.map(n => nome(n) + ' (' + nos[n]!.motivo + ')').join('; ') + '.', consequencia: 'Os estados desses blocos aparecem como "dados insuficientes", não como ruins.', investigar: INVESTIGAR.qualidade_dados! });
  const ordem: Record<string, number> = { fora: 0, bloqueado: 1, atencao: 2, insuficiente: 3, dentro: 4 };
  diags.sort((x, z) => ordem[x.estado]! - ordem[z.estado]! || (z.impactoRec || z.impactoVol || 0) - (x.impactoRec || x.impactoVol || 0));
  /* principal gargalo: o desvio de conversão ou de entrada com o maior impacto no resultado */
  const gargalo = diags.filter(d => (d.tipo === 'conversao_baixa' || d.tipo === 'entrada_baixa') && d.estado !== 'insuficiente').sort((x, z) => (z.impactoVol ?? 0) - (x.impactoVol ?? 0))[0] ?? null;
  return { nos, arestas, diags, gargalo, meta, rendimento: y, alvo };
}

/* antes × depois de uma intervenção (mesma conexão, coortes de antes e de depois da data da ação) */
export interface Coorte { k: number; n: number }
export interface AntesDepois { st: 'sem' | 'amostra' | 'melhorou' | 'piorou' | 'igual'; txt: string; pa?: number; pd?: number; wa?: [number, number]; wd?: [number, number] }
export function antesDepois(antes: Coorte | null | undefined, depois: Coorte | null | undefined, minN = 5): AntesDepois {
  if (!antes || !depois || !antes.n || !depois.n) return { st: 'sem', txt: 'sem coortes dos dois lados para comparar' };
  if (antes.n < minN || depois.n < minN) return { st: 'amostra', txt: 'amostra pequena (' + antes.n + ' antes, ' + depois.n + ' depois; mínimo ' + minN + ')' };
  const pa = antes.k / antes.n, pd = depois.k / depois.n, wa = wilson(antes.k, antes.n)!, wd = wilson(depois.k, depois.n)!;
  const st = wd[0] > wa[1] ? 'melhorou' : wd[1] < wa[0] ? 'piorou' : 'igual';
  return { st, pa, pd, wa, wd, txt: st === 'melhorou' ? 'melhora observável (os intervalos de 95% não se sobrepõem)' : st === 'piorou' ? 'piora observável' : 'sem diferença conclusiva (os intervalos se sobrepõem)' };
}

/* ---------- layout automático em camadas (só quando a pessoa pede "Organizar") ---------- */
export function layout(P: PBase, dir: 'LR' | 'TB' = 'LR'): Record<string, { x: number; y: number }> {
  const G = grafo(P), cam: Record<string, number> = {}, ordem = G.ordem.concat(G.ciclo);
  for (const n of ordem) { cam[n] = cam[n] ?? 0; for (const a of G.out[n]!) { const e = P.arestas[a]!; if (e.retorno) continue; cam[e.para] = Math.max(cam[e.para] ?? 0, cam[n]! + 1); } }
  const porCam: Record<number, string[]> = {}; for (const n of ordem) (porCam[cam[n]!] ??= []).push(n);
  /* muitas camadas viram faixas (5 por faixa), como linhas de texto: o desenho não fica comprido demais para ler */
  const pos: Record<string, { x: number; y: number }> = {}, DX = 230, DY = 120, porFaixa = 5;
  const alt = Math.max(1, ...Object.values(porCam).map(l => l.length)), faixa = (c: number) => Math.floor(c / porFaixa), col = (c: number) => c % porFaixa;
  for (const c of Object.keys(porCam).map(Number).sort((a, b) => a - b)) {
    const L = porCam[c]!;
    if (c > 0) L.sort((a, b) => { const bc = (n: string) => { const ps = G.inn[n]!.map(x => P.arestas[x]!.de).filter(p => pos[p]); return ps.length ? ps.reduce((s, p) => s + (dir === 'TB' ? pos[p]!.x : pos[p]!.y), 0) / ps.length : 0; }; return bc(a) - bc(b); });
    L.forEach((n, i) => { pos[n] = dir === 'TB' ? { x: 40 + i * DX + faixa(c) * (alt * DX + 60), y: 40 + col(c) * DY * 1.3 } : { x: 40 + col(c) * DX, y: 40 + i * DY + faixa(c) * (alt * DY + 50) }; });
  }
  return pos;
}
