/* Ações recomendadas do dia (§7 e §9 da V1): cada uma diz por quê, o benefício esperado (rotulado), o que acontece se não fizer, como medir e de onde veio.
   Puro: recebe os dados montados e devolve a lista ordenada (crítica → alta → normal → estratégica). */
import { beneficio, cenarios, ordenar, type Classe } from './motor.js';
import { ritmoLegivel } from './producao.js';
import { NOMES, type Acao, type DadosDia, type ProducaoIndicador } from './tipos.js';

const nome = (k: string) => NOMES[k] ?? [k, k, k];
export const qtd = (n: number, k: string) => { const v = Math.ceil(n - 1e-9); return `${v} ${v === 1 ? nome(k)[1] : nome(k)[2]}`; };
export const q1 = (n: number, k: string) => `${n < 10 && Math.abs(n - Math.round(n)) > 0.05 ? n.toFixed(1).replace('.', ',') : String(Math.round(n))} ${Math.abs(n - 1) < 1e-9 ? nome(k)[1] : nome(k)[2]}`;
export const pct = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? '—' : `${Math.round(v * 100)}%`);
export const reais = (v: number) => `R$ ${Math.round(v).toLocaleString('pt-BR')}`;
const dataBR = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const arr = (n: number) => String(Math.round(n));

export function taxaDe(D: Pick<DadosDia, 'tx'>, k: string): { tx: number; fonte: 'plano' | 'hist'; para: string; n?: number } | null {
  const t = D.tx.find(x => x.de === k); if (!t) return null;
  if ((t.plano ?? 0) > 0) return { tx: t.plano as number, fonte: 'plano', para: t.para };
  if ((t.hist ?? 0) > 0) return { tx: t.hist as number, fonte: 'hist', para: t.para, n: t.nh };
  return null;
}
const cadeiaDe = (D: Pick<DadosDia, 'tx'>, k0: string) => { const cad: Array<{ para: string; tx: number; fonte: string }> = []; let k = k0; for (let i = 0; i < 3; i++) { const y = taxaDe(D, k); if (!y) break; cad.push({ para: y.para, tx: y.tx, fonte: y.fonte }); k = y.para; } return cad; };

export function etapaCenario(D: Pick<DadosDia, 'tx' | 'ciclo'>, x: ProducaoIndicador) {
  const t = taxaDe(D, x.k), jA = Math.max(1, Math.min(x.janela || 1, D.ciclo.diasRest || 1));
  return { k: x.k, nome: x.nome, falta: x.falta, metaHoje: x.metaHoje, feito: x.feito, alvo: x.alvo, atrasoTotal: x.atrasoTotal, metaAmanha: x.metaAmanha, jAmanha: jA, tx: t ? t.tx : null, para: t ? t.para : '' };
}

export function acoesDoDia(D: Omit<DadosDia, 'acoes' | 'cenario' | 'sucesso' | 'memoria'>, quem = 'você'): Acao[] {
  const A: Acao[] = [], crit = D.padrao, fimSem = dataBR(D.semana.fim);
  const fonteTx = (t: { fonte: string; n?: number }) => (t.fonte === 'plano' ? 'taxa embutida nas metas do plano' : `seu histórico de 90 dias (n=${t.n ?? 0})`);
  const txT = taxaDe(D, 'tentativa');
  /* propostas e negociações paradas (crítica) */
  D.cards.filter(x => x.classe === 'critica').slice(0, 3).forEach(x => A.push({ chave: `card:${x.id}`, classe: 'critica', tit: `${x.acao}: ${x.nome}`, qtd: `${x.etapa}${x.valor ? ` · ${reais(x.valor)}` : ''}`,
    porque: `Negócio exige atenção: ${x.motivos.join('; ')}.`, ben: x.ve > 0 ? { t: `Valor esperado do negócio: ${reais(x.ve)} (chance histórica da etapa ${pct(x.pv)}).`, e: 'hist' } : { t: 'Define o próximo passo e devolve o negócio ao controle.', e: 'hip' },
    nao: 'Sem próximo passo, o negócio fica exposto à perda; a idade continua crescendo.', medir: 'atividade registrada e próximo passo com data', prazo: x.prazo, origem: [{ neg: x.id, txt: x.nome }], score: x.score }));
  /* leads novos sem contato */
  if (D.leadsNovos.length) { const novos = D.leadsNovos.filter(x => x.horas <= 24).length;
    A.push({ chave: 'leadsnovos', classe: novos ? 'critica' : 'alta', tit: `Primeiro contato em ${D.leadsNovos.length} ${D.leadsNovos.length > 1 ? 'leads sem contato' : 'lead sem contato'}`, qtd: D.leadsNovos.slice(0, 3).map(x => x.nome).join(', ') + (D.leadsNovos.length > 3 ? '…' : ''),
      porque: `${novos ? `${novos} entrou nas últimas 24 h. ` : ''}Lead sem contato registrado fica sem dono na prática.`, habilita: D.leadsNovos.length * 10,
      ben: txT ? { t: `Cada tentativa vira reunião em ${pct(txT.tx)} das vezes (${fonteTx(txT)}).`, e: txT.fonte === 'plano' ? 'proj' : 'hist' } : { t: 'Responder rápido costuma aumentar a conversão de lead novo; efeito ainda não medido aqui.', e: 'hip' },
      nao: 'O tempo até o 1º contato cresce e o lead esfria.', medir: 'tempo até o 1º contato', prazo: 'hoje', origem: D.leadsNovos.slice(0, 8).map(x => ({ neg: x.id, txt: x.nome })) }); }
  /* objetivos da semana (indicadores que não são meta do dia) */
  D.prod.filter(x => !x.diario && x.sem && x.sem.falta > 0).forEach(x => { const w = x.sem!, t = taxaDe(D, x.k), B = beneficio(w.falta, cadeiaDe(D, x.k));
    A.push({ chave: `sem:${x.k}`, classe: w.atraso > 0 && w.restantes <= 2 ? 'alta' : 'normal', tit: `Fazer ${qtd(w.falta, x.k)} até ${fimSem} (${ritmoLegivel(w.ritmo)})`, qtd: '',
      porque: `Objetivo da semana: ${arr(w.meta)} planejados${w.recup > 0 ? ` + ${arr(w.recup)} de recuperação do atraso` : ''}; feito ${Math.round(w.feito)}. Restam ${w.restantes} dia(s) útil(eis).`,
      ben: B.length ? { t: `${qtd(w.falta, x.k)} → ${B.map(b => `≈ ${q1(b.n, b.para)}`).join(' → ')} em expectativa.`, e: t && t.fonte === 'plano' ? 'proj' : 'hist' } : { t: 'Cumpre o objetivo da semana.', e: null },
      nao: 'O que faltar no fim da semana vira atraso e entra nas próximas semanas, em parcelas.', medir: `${nome(x.k)[2]} na semana`, prazo: `até ${fimSem}`, origem: [] }); });
  /* produção do dia (indicadores diários) */
  D.prod.filter(x => x.diario && x.falta > 0).forEach(x => { const t = taxaDe(D, x.k), B = beneficio(x.falta, cadeiaDe(D, x.k)), v = x.k === 'tentativa' && D.viab ? D.viab : null;
    const C2 = cenarios({ etapas: [etapaCenario(D, x)] }), a = C2.nao.etapas[0]!, b = C2.exec.etapas[0]!;
    A.push({ chave: `prod:${x.k}`, classe: x.atraso > 0 ? 'alta' : 'normal', tit: `Fazer ${qtd(x.falta, x.k)} hoje`, qtd: '',
      porque: `Meta de hoje ${arr(x.metaHoje)}${x.recup > 0 ? ` + ${arr(x.recup)} de recuperação do atraso (${arr(x.atrasoTotal)} em aberto, recuperados em até ${x.janela} dias úteis)` : ''}; feito até agora ${Math.round(x.feito)}.${v && v.st !== 'ok' && v.st !== 'sem_cap' ? ` ${v.txt}` : ''}`,
      ben: B.length ? { t: `${qtd(x.falta, x.k)} → ${B.map(b2 => `≈ ${q1(b2.n, b2.para)}`).join(' → ')} em expectativa (${t && t.fonte === 'plano' ? 'taxas embutidas no plano' : 'seu histórico'}). Não garante venda: aumenta o volume que chega às etapas seguintes.`, e: t && t.fonte === 'plano' ? 'proj' : 'hist' } : { t: 'Mantém o plano do ciclo em dia.', e: 'proj' },
      nao: `Amanhã o alvo vira ${qtd(a.amanha, x.k)} (${arr(a.planejado)} planejados + ${arr(a.adicional)} de recuperação) em vez de ${qtd(b.amanha, x.k)}. O atraso em aberto sobe para ${arr(a.atraso)}.`,
      medir: `${nome(x.k)[2]} feitos hoje`, prazo: 'até o fim do dia', origem: [] }); });
  /* demais negócios em alerta */
  const altos = D.cards.filter(x => x.classe === 'alta');
  if (altos.length) A.push({ chave: 'cards', classe: 'alta', tit: `Definir o próximo passo em ${altos.length} ${altos.length > 1 ? 'negócios' : 'negócio'} sem acompanhamento`, qtd: altos.slice(0, 3).map(x => x.nome).join(', ') + (altos.length > 3 ? '…' : ''),
    porque: 'Sem atividade registrada recente e sem próximo passo.', ben: { t: `Valor esperado desses negócios: ${reais(altos.reduce((a, x) => a + x.ve, 0))} (exposição, não receita garantida).`, e: 'hist' },
    nao: 'Continuam sem dono na prática; a chance de perda cresce com o tempo parado.', medir: 'negócios sem próximo passo = 0', prazo: 'hoje ou amanhã', origem: altos.slice(0, 8).map(x => ({ neg: x.id, txt: x.nome })) });
  /* estratégicas: gargalo e padrão */
  const g = D.garg[0];
  if (g) A.push({ chave: `garg:${g.chave}`, classe: 'estrategica', tit: `Melhorar ${g.nome.toLowerCase()}`, qtd: g.teste ?? '', porque: `${g.prob ?? ''}. ${g.evid}`, ben: { t: `Mesmo resultado com menos volume. Causas possíveis: ${(g.causas ?? []).join('; ')}.`, e: 'hip' }, nao: 'O plano continua exigindo mais volume para compensar a taxa baixa.', medir: g.ind ?? '', prazo: 'próximas 2 semanas', conf: g.conf, origem: [] });
  if (crit.recorrente) A.push({ chave: 'padrao', classe: (crit.seguidos ?? 0) >= 3 ? 'alta' : 'estrategica', tit: `Quebrar o padrão: ${nome(crit.k)[2]} abaixo da meta em ${crit.abaixo} dos últimos ${crit.n} dias úteis`, qtd: crit.seguidos ? `${crit.seguidos} dia(s) seguidos` : '',
    porque: 'Não é um dia ruim isolado: é recorrente.', ben: { t: 'Evita concentrar a recuperação nos últimos dias do ciclo.', e: null }, nao: 'O atraso acumulado vira meta impossível no fim do ciclo e reduz o pipeline do próximo.', medir: `${nome(crit.k)[2]} por dia`, prazo: 'a partir de hoje', origem: [] });
  const notas = D.notas.justificativas;
  return ordenar(A).map(a => ({ ...a, justificativa: notas[a.chave] ?? null })) as Acao[];
}

/* "é um dia de sucesso se…": os compromissos do dia, com o que já foi cumprido */
export function compromissos(D: Omit<DadosDia, 'acoes' | 'cenario' | 'sucesso' | 'memoria'>): DadosDia['sucesso'] {
  const suc: DadosDia['sucesso'] = [];
  D.prod.filter(x => x.diario && x.alvo > 0).forEach(x => suc.push({ k: `prod:${x.k}`, ok: x.falta <= 1e-9, t: `fazer ${qtd(x.alvo, x.k)} hoje`, s: `feito ${Math.round(x.feito)}${x.recup > 0 ? ` · inclui ${arr(x.recup)} de recuperação do atraso` : ''}${x.falta > 0 ? '' : ' · cumprido'}` }));
  if (D.leadsNovos.length) suc.push({ k: 'leadsnovos', ok: false, t: `primeiro contato em ${D.leadsNovos.length} lead${D.leadsNovos.length > 1 ? 's' : ''} sem contato`, s: '' });
  const crit = D.cards.filter(x => x.classe === 'critica').length; if (crit) suc.push({ k: 'criticos', ok: false, t: `dar próximo passo a ${crit} negócio(s) crítico(s)`, s: '' });
  D.prod.filter(x => !x.diario && x.sem && x.sem.alvo > 0).forEach(x => { const w = x.sem!; suc.push({ k: `sem:${x.k}`, ok: w.falta <= 1e-9, t: `${qtd(w.alvo, x.k)} na semana`, s: `feito ${Math.round(w.feito)} · ${w.falta > 0 ? `faltam ${Math.ceil(w.falta - 1e-9)} · ${ritmoLegivel(w.ritmo)}` : 'cumprido'}` }); });
  const MK = D.notas.feitos;
  return suc.map(x => { const m = MK[x.k]; return !x.ok && m ? { ...x, ok: true, marcado: m } : x; });
}
export type { Classe };
