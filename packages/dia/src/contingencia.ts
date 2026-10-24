/* Contingência do ciclo: regras puras portadas do LAB V1 (contingencia_motor.js, CTM_VERSAO 2026-10-23.1); testes/contingencia.test.js é o contrato.
   Pergunta: "faltam N dias úteis até o fim do ciclo; para bater a meta de receita e de vendas, o que cada vendedor precisa fazer em cada dia?"
   Uma só régua para tudo: razão = realizado ÷ esperado até hoje (e projeção ÷ meta); ≥ 100% no ritmo · ≥ 90% atenção · ≥ 75% contingência · abaixo crítico.
   Esforço de recuperação = ritmo por dia útil que falta ÷ ritmo médio do ciclo: 1,2× atenção · 1,5× contingência · 2× crítico.
   Atividade abaixo de 90% do alvo do dia por 2 dias úteis seguidos = contingência para a atividade daquela pessoa. Nada aqui grava nem altera meta. */
export const VERSAO_CONTINGENCIA = '2026-10-23.1';
export interface CfgContingencia { atencao: number; contingencia: number; critico: number; esforco: [number, number, number]; minDiasProj: number; diasSeguidos: number; pctDia: number }
export const CONTINGENCIA_PADRAO: CfgContingencia = { atencao: 1, contingencia: 0.9, critico: 0.75, esforco: [1.2, 1.5, 2], minDiasProj: 3, diasSeguidos: 2, pctDia: 0.9 };
export type Nivel = 0 | 1 | 2 | 3;
export type ChaveNivel = 'no_ritmo' | 'atencao' | 'contingencia' | 'critico' | 'sem_dado';
const NIVEIS: Array<[ChaveNivel, string]> = [['no_ritmo', 'No ritmo'], ['atencao', 'Atenção'], ['contingencia', 'Contingência'], ['critico', 'Crítico']];

/* configuração do gestor sobrepõe o padrão; valor inválido (≤ 0, lista de esforço fora de 3 números) é ignorado */
export function cfgContingencia(c?: Partial<Record<keyof CfgContingencia, unknown>> | null): CfgContingencia {
  const o: CfgContingencia = { ...CONTINGENCIA_PADRAO, esforco: [...CONTINGENCIA_PADRAO.esforco] as [number, number, number] };
  for (const k of Object.keys(c ?? {}) as Array<keyof CfgContingencia>) {
    const v = (c as Record<string, unknown>)[k];
    if (k === 'esforco') { if (Array.isArray(v) && v.length === 3 && v.every(x => Number(x) > 0)) o.esforco = v.map(Number) as [number, number, number]; }
    else if (v != null && Number(v) > 0) o[k] = Number(v);
  }
  return o;
}
export const nomeNivel = (n: Nivel | null) => (n == null ? 'Sem dado' : (NIVEIS[n] ?? ['', 'Sem dado'])[1]);
export const chaveNivel = (n: Nivel | null): ChaveNivel => (n == null ? 'sem_dado' : (NIVEIS[n] ?? ['sem_dado'])[0]);
const n1 = (v: number | null | undefined) => (v == null || !isFinite(v) ? '—' : Math.round(v * 10) / 10 === Math.round(v) ? String(Math.round(v)) : (Math.round(v * 10) / 10).toFixed(1).replace('.', ','));
const pct = (v: number | null | undefined) => (v == null || !isFinite(v) ? '—' : Math.round(v * 100) + '%');

/* nível da razão realizado ÷ esperado (ou projeção ÷ meta) */
export function nivelDaRazao(razao: number | null | undefined, cfg?: Partial<CfgContingencia> | null): Nivel | null {
  if (razao == null || !isFinite(razao)) return null; const C = cfgContingencia(cfg);
  return razao >= C.atencao ? 0 : razao >= C.contingencia ? 1 : razao >= C.critico ? 2 : 3;
}
/* nível do esforço de recuperação (fator = ritmo necessário ÷ ritmo médio do ciclo) */
export function nivelDoEsforco(fator: number | null | undefined, cfg?: Partial<CfgContingencia> | null): Nivel | null {
  if (fator == null || !isFinite(fator)) return null; const e = cfgContingencia(cfg).esforco;
  return fator >= e[2] ? 3 : fator >= e[1] ? 2 : fator >= e[0] ? 1 : 0;
}

/* ---------- placar de uma meta do ciclo (receita ou vendas, da empresa ou de uma pessoa) ---------- */
export interface EntradaPlacar { nome?: string; de?: string; meta: number | null; real: number | null; esperado?: number | null; proj?: number | null; projFragil?: boolean; dd?: number; diasRest?: number; fmt?: (v: number) => string }
export interface Motivo { nivel: Nivel | null; cod: 'sem_dado' | 'batida' | 'encerrado' | 'ritmo' | 'projecao' | 'esforco' | 'atividade' | 'resultado' | 'seguidos'; txt: string }
export interface Placar { nivel: Nivel | null; st: ChaveNivel | 'batida' | 'encerrado'; motivos: Motivo[]; meta: number | null; real: number | null; falta?: number; esperado?: number | null; razaoEsp?: number | null; proj?: number | null; razaoProj?: number | null; diasRest?: number; dd?: number; ritmoNec?: number | null; ritmoAtual?: number | null; fator?: number | null }
export function placar(x: EntradaPlacar, cfg?: Partial<CfgContingencia> | null): Placar {
  const C = cfgContingencia(cfg), f = x.fmt ?? ((v: number) => n1(v)), meta = Number(x.meta), real = Number(x.real), nome = x.nome ?? 'Meta do ciclo', de = x.de ? ' ' + x.de : '';
  if (!(meta > 0) || x.real == null || !isFinite(real)) return { nivel: null, st: 'sem_dado', motivos: [{ nivel: null, cod: 'sem_dado', txt: nome + de + ': sem meta no plano do ciclo ou sem realizado para comparar.' }], meta: isFinite(meta) ? meta : null, real: isFinite(real) ? real : null };
  const falta = Math.max(0, meta - real), dr = Math.max(0, Number(x.diasRest) || 0), dd = Number(x.dd) || 0;
  const esperado = x.esperado != null && isFinite(Number(x.esperado)) ? Number(x.esperado) : null, razaoEsp = esperado != null && esperado > 0 ? real / esperado : null;
  const proj = x.proj != null && isFinite(Number(x.proj)) ? Number(x.proj) : null, projOk = proj != null && dd >= C.minDiasProj && !x.projFragil, razaoProj = projOk ? proj! / meta : null;
  const ritmoNec = falta <= 0 ? 0 : dr > 0 ? falta / dr : null, ritmoAtual = dd >= 1 ? real / dd : null;
  const fator = falta <= 0 ? 0 : ritmoNec != null && ritmoAtual != null && ritmoAtual > 0 ? ritmoNec / ritmoAtual : null;
  const R: Placar = { nivel: null, st: 'sem_dado', meta, real, falta, esperado, razaoEsp, proj, razaoProj, diasRest: dr, dd, ritmoNec, ritmoAtual, fator, motivos: [] };
  if (falta <= 0) { R.nivel = 0; R.st = 'batida'; R.motivos.push({ nivel: 0, cod: 'batida', txt: nome + de + ': meta do ciclo já atingida (' + f(real) + ' de ' + f(meta) + ').' }); return R; }
  if (dr === 0) { R.nivel = 3; R.st = 'encerrado'; R.motivos.push({ nivel: 3, cod: 'encerrado', txt: nome + de + ': não restam dias úteis no ciclo e faltam ' + f(falta) + ' para a meta de ' + f(meta) + '.' }); return R; }
  const nEsp = nivelDaRazao(razaoEsp, C), nProj = nivelDaRazao(razaoProj, C), nEsf = nivelDoEsforco(fator, C);
  if (nEsp != null && nEsp > 0) R.motivos.push({ nivel: nEsp, cod: 'ritmo', txt: nome + de + ' está em ' + pct(razaoEsp) + ' do esperado até hoje (' + f(real) + ' de ' + f(esperado!) + ').' });
  if (nProj != null && nProj > 0) R.motivos.push({ nivel: nProj, cod: 'projecao', txt: 'A projeção ajustada do Planejamento fecha o ciclo em ' + pct(razaoProj) + ' da meta (' + f(proj!) + ' de ' + f(meta) + ').' });
  if (nEsf != null && nEsf > 0) R.motivos.push({ nivel: nEsf, cod: 'esforco', txt: 'Para bater a meta faltam ' + f(falta) + ' em ' + dr + (dr === 1 ? ' dia útil' : ' dias úteis') + ' (' + f(ritmoNec!) + ' por dia útil), ' + n1(fator) + '× o ritmo médio do ciclo até hoje (' + f(ritmoAtual!) + ' por dia útil).' });
  if (nEsp == null && nProj == null && nEsf == null) { R.nivel = null; R.st = 'sem_dado'; R.motivos.push({ nivel: null, cod: 'sem_dado', txt: nome + de + ': ainda não há dias decorridos para medir o ritmo.' }); return R; }
  R.nivel = Math.max(0, nEsp ?? 0, nProj ?? 0, nEsf ?? 0) as Nivel;
  R.st = chaveNivel(R.nivel); R.motivos.sort((a, b) => (b.nivel ?? 0) - (a.nivel ?? 0));
  return R;
}

/* ---------- trajetória dia a dia até o fim do ciclo (empresa) ----------
   Passado: meta acumulada ao fim do dia × realizado acumulado (o que fecha em sábado, domingo ou feriado entra no próximo dia útil).
   Hoje e futuro: alvo do dia para chegar à meta (o que falta ANTES de hoje, repartido pelos dias úteis que restam, ponderados pelos pesos do calendário). */
export interface LinhaTrajetoria { iso: string; tipo: 'passado' | 'hoje' | 'futuro'; peso: number; metaDia: number; esperadoAcum: number; realAcum?: number; realDia?: number; desvio?: number; razao?: number | null; alvoDia?: number; alvoAcum?: number }
export function trajetoria(x: { dias: string[]; hoje: string; meta: number; realPorDia: Record<string, number>; pesos?: Record<string, number> | null }) {
  const D = [...(x.dias ?? [])].sort(), meta = Number(x.meta) || 0, R = x.realPorDia ?? {}, hoje = x.hoje;
  const w = (iso: string) => (x.pesos && x.pesos[iso] != null && Number(x.pesos[iso]) >= 0 ? Number(x.pesos[iso]) : 1);
  const tot = D.reduce((a, i) => a + w(i), 0), ate = (iso: string) => Object.keys(R).filter(k => k <= iso).reduce((a, k) => a + (Number(R[k]) || 0), 0);
  const antes = Object.keys(R).filter(k => k < hoje).reduce((a, k) => a + (Number(R[k]) || 0), 0), faltaAntes = Math.max(0, meta - antes);
  const resto = D.filter(i => i >= hoje), totResto = resto.reduce((a, i) => a + w(i), 0);
  let ac = 0, acR = 0, ant = 0; const rows: LinhaTrajetoria[] = [];
  for (const iso of D) {
    ac += w(iso); const tipo = iso < hoje ? 'passado' : iso === hoje ? 'hoje' : 'futuro';
    const row: LinhaTrajetoria = { iso, tipo, peso: w(iso), metaDia: tot > 0 ? (meta * w(iso)) / tot : 0, esperadoAcum: tot > 0 ? (meta * ac) / tot : 0 };
    if (tipo !== 'futuro') { row.realAcum = ate(iso); row.realDia = row.realAcum - ant; ant = row.realAcum; row.desvio = row.realAcum - row.esperadoAcum; row.razao = row.esperadoAcum > 0 ? row.realAcum / row.esperadoAcum : null; }
    if (tipo !== 'passado' && totResto > 0) { acR += w(iso); row.alvoDia = (faltaAntes * w(iso)) / totResto; row.alvoAcum = antes + (faltaAntes * acR) / totResto; }
    rows.push(row);
  }
  return { rows, antes, faltaAntes, diasRest: resto.length, totResto };
}

/* ---------- uma pessoa: o que falta em cada etapa e o alvo de cada dia até o fim do ciclo ----------
   alvo do dia = meta do plano naquele dia + parcela igual do atraso acumulado até ontem (negativa = adiantado, abate). Chega à meta no último dia. */
export interface EtapaPessoa { k: string; nome: string; metaTotal: number; metaCiclo: number; feitoCiclo: number; metaHoje?: number; feitoHoje?: number }
export interface EtapaContingencia { k: string; nome: string; metaTotal: number; esperado: number; feito: number; razao: number | null; nivel: Nivel | null; falta: number; atrasoAntes: number; ritmoNec: number | null; alvos: Array<{ iso: string; plano: number; alvo: number }>; alvoHoje: number | null }
export interface PessoaContingencia { n: string; etapas: EtapaContingencia[]; diasRest: number; ativ: { k: string; nivel: Nivel | null; porSeguidos?: boolean } | null; res: { k: string; nivel: Nivel | null } | null; motivos: Motivo[]; nivel: Nivel | null; st: ChaveNivel }
export function pessoaContingencia(x: { n: string; hoje?: string; etapas: EtapaPessoa[]; dias: string[]; metaDia?: Record<string, Record<string, number>>; seguidos?: number; ativK?: string; resK?: string }, cfg?: Partial<CfgContingencia> | null): PessoaContingencia {
  const C = cfgContingencia(cfg), dias = x.dias ?? [], nd = dias.length;
  const out: PessoaContingencia = { n: x.n, etapas: [], diasRest: nd, ativ: null, res: null, motivos: [], nivel: null, st: 'sem_dado' };
  for (const e of x.etapas ?? []) {
    const metaTotal = Number(e.metaTotal) || 0, esperado = Number(e.metaCiclo) || 0, feito = Number(e.feitoCiclo) || 0;
    if (metaTotal <= 0 && esperado <= 0 && feito <= 0) continue;
    const razao = esperado > 0 ? feito / esperado : null, nivel = nivelDaRazao(razao, C), falta = Math.max(0, metaTotal - feito);
    const atrasoAntes = (esperado - (Number(e.metaHoje) || 0)) - (feito - (Number(e.feitoHoje) || 0));
    const alvos = dias.map(iso => { const m = Number((x.metaDia ?? {})[iso]?.[e.k]) || 0; return { iso, plano: m, alvo: Math.max(0, m + (nd ? atrasoAntes / nd : 0)) }; });
    out.etapas.push({ k: e.k, nome: e.nome, metaTotal, esperado, feito, razao, nivel, falta, atrasoAntes, ritmoNec: nd > 0 ? falta / nd : null, alvos, alvoHoje: alvos.length && alvos[0]!.iso === x.hoje ? alvos[0]!.alvo : null });
  }
  const por = (k: string) => out.etapas.find(e => e.k === k), A = por(x.ativK ?? 'contatos'), Rs = por(x.resK ?? 'vendas');
  out.ativ = A ? { k: A.k, nivel: A.nivel } : null; out.res = Rs ? { k: Rs.k, nivel: Rs.nivel } : null;
  if (A && out.ativ && out.ativ.nivel != null && out.ativ.nivel > 0) out.motivos.push({ nivel: out.ativ.nivel, cod: 'atividade', txt: A.nome + ' (atividade) em ' + pct(A.razao) + ' do esperado até hoje: ' + n1(A.feito) + ' de ' + n1(A.esperado) + '.' });
  if (Rs && out.res && out.res.nivel != null && out.res.nivel > 0) out.motivos.push({ nivel: out.res.nivel, cod: 'resultado', txt: Rs.nome + ' (resultado) em ' + pct(Rs.razao) + ' do esperado até hoje: ' + n1(Rs.feito) + ' de ' + n1(Rs.esperado) + '.' });
  if (A && out.ativ && (x.seguidos ?? 0) >= C.diasSeguidos && (out.ativ.nivel == null || out.ativ.nivel < 2)) { out.ativ.nivel = 2; out.ativ.porSeguidos = true; out.motivos.push({ nivel: 2, cod: 'seguidos', txt: A.nome + ' abaixo de ' + pct(C.pctDia) + ' do alvo do dia por ' + x.seguidos + ' dias úteis seguidos.' }); }
  const ns = out.etapas.map(e => e.nivel).concat([out.ativ?.nivel ?? null, out.res?.nivel ?? null]).filter((v): v is Nivel => v != null);
  out.nivel = ns.length ? (Math.max(...ns) as Nivel) : null; out.st = chaveNivel(out.nivel); out.motivos.sort((a, b) => (b.nivel ?? 0) - (a.nivel ?? 0));
  return out;
}

/* contagem por nível, do pior para o melhor */
export function resumoContingencia(L: Array<{ n: string; nivel: Nivel | null }>) {
  const c = [0, 0, 0, 0], sem: string[] = [];
  for (const p of L ?? []) { if (p.nivel == null) sem.push(p.n); else c[p.nivel]!++; }
  return { no_ritmo: c[0]!, atencao: c[1]!, contingencia: c[2]!, critico: c[3]!, sem_dado: sem.length, semDado: sem };
}

/* ---------- ações sugeridas pelos gatilhos: tudo é "hipótese de melhoria" (efeito não medido), exceto a conta de quanto falta ---------- */
export interface AcaoContingencia { prio: number; tipo: 'hip'; quem: string; titulo: string; txt: string; prazo: string; ind: string }
export function acoesContingencia(emp: { receita?: { nivel: Nivel | null } | null; vendas?: { nivel: Nivel | null } | null }, pessoas: Array<{ n: string; nivel: Nivel | null; ativ?: { nivel: Nivel | null } | null; res?: { nivel: Nivel | null } | null; falta?: number | null; pipe?: number | null }>, fim: string | null): AcaoContingencia[] {
  const A: AcaoContingencia[] = [], pior = Math.max(0, emp.receita?.nivel ?? 0, emp.vendas?.nivel ?? 0), dtf = fim ? fim.split('-').reverse().slice(0, 2).join('/') : 'o fim do ciclo';
  if (pior >= 3) A.push({ prio: 0, tipo: 'hip', quem: 'Gestão', titulo: 'Decidir sobre a meta do ciclo', txt: 'O esforço que falta até ' + dtf + ' é crítico (menos de 75% do esperado, ou o ritmo necessário passa de 2× o médio). Decidir, com data: manter a meta e redistribuir o esforço, replanejar a partir de uma data ou reforçar a geração de oportunidades. Manter a meta sem mudar nada não é uma decisão.', prazo: 'hoje', ind: 'receita fechada e vendas fechadas do ciclo' });
  else if (pior >= 2) A.push({ prio: 1, tipo: 'hip', quem: 'Gestão', titulo: 'Ativar o plano de recuperação até ' + dtf, txt: 'Cada vendedor passa a seguir o alvo diário de contingência. Revisar o placar todo dia útil no início do expediente, com 10 minutos por vendedor sobre o que travou no dia anterior.', prazo: 'hoje', ind: 'alvo do dia cumprido por vendedor' });
  for (const p of pessoas ?? []) {
    if (p.nivel == null || p.nivel < 2) continue;
    const a = (p.ativ?.nivel ?? 0) >= 2, r = (p.res?.nivel ?? 0) >= 2, cobre = p.pipe != null && p.falta != null && p.pipe >= p.falta;
    if (a && !r) A.push({ prio: 2, tipo: 'hip', quem: p.n, titulo: 'Atraso operacional', txt: 'O resultado acompanha o plano, mas a atividade está abaixo: recuperar o volume de contatos e reuniões nos próximos dias úteis para sustentar o que ainda entra no ciclo.', prazo: 'hoje', ind: 'contatos e reuniões do alvo do dia' });
    else if (r && !a) A.push({ prio: 2, tipo: 'hip', quem: p.n, titulo: 'Insuficiência de resultado com atividade em dia', txt: cobre ? 'O pipeline aberto cobre as vendas que faltam: o foco é fechar, não gerar mais volume. Priorizar propostas e negociações abertas com data de decisão.' : 'O esforço está no ritmo, mas as vendas não acompanham: revisar a conversão das etapas finais (oportunidade → venda) nos negócios abertos.', prazo: 'hoje', ind: 'vendas por oportunidade' });
    else if (a && r) A.push({ prio: 1, tipo: 'hip', quem: p.n, titulo: 'Atividade e resultado abaixo do plano', txt: cobre ? 'O pipeline aberto cobre as vendas que faltam; fechar primeiro, e retomar o volume de contatos em seguida.' : 'Recuperar o volume de atividade é a primeira alavanca; a conversão vem em seguida.', prazo: 'hoje', ind: 'alvo do dia e vendas do ciclo' });
  }
  return A.sort((a, b) => a.prio - b.prio);
}
