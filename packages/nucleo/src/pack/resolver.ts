/* Resolve um pack: segue a cadeia "herda", mescla, aplica os padrões e confere as regras.
   Devolve erros (impedem o uso) e avisos (o pack funciona, mas algo parece estranho),
   sempre em português e apontando o item pela chave, não pela posição. */
import { PAPEIS_ETAPA, type PapelEtapa } from '../papeis.js';
import { Pack, PackArquivo, type PackResolvido } from './schema.js';
import { analisar, ErroExpressao, variaveisUsadas } from '../hipoteses/expr.js';
import { VARIAVEIS } from '../hipoteses/variaveis.js';

export type Catalogo = Record<string, unknown>;     // id do pack → conteúdo do arquivo
export interface ResultadoPack { ok: boolean; pack: PackResolvido | null; erros: string[]; avisos: string[] }

const PADROES = {
  calendario: { feriados: 'BR' as const, diasUteis: [1, 2, 3, 4, 5], inicioCicloDia: 1, mesInicioAno: 1, fuso: 'America/Sao_Paulo' },
  parametros: { maturacaoCoorteDias: 30, amostraMinima: 10, janelaHistoricaDias: 180, orcamentoAtencao: 3 },
  tiposNegocio: ['novo'] as const,
};

type Obj = Record<string, unknown>;
const ehObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const ehListaComChave = (v: unknown): v is Obj[] => Array.isArray(v) && v.length > 0 && v.every(x => ehObj(x) && typeof x.chave === 'string');

function mesclarItem(pai: Obj, filho: Obj): Obj {
  const out: Obj = { ...pai };
  for (const [k, v] of Object.entries(filho)) {
    if (k === 'etapas') out[k] = v;                      // etapas: o filho substitui a lista inteira
    else out[k] = mesclar(pai[k], v);
  }
  return out;
}

function mesclarPorChave(pai: Obj[], filho: Obj[]): Obj[] {
  const out = pai.map(x => ({ ...x }));
  for (const f of filho) {
    const i = out.findIndex(x => x.chave === f.chave);
    if (f.remover) { if (i >= 0) out.splice(i, 1); continue; }
    const { remover: _r, ...limpo } = f;
    if (i >= 0) out[i] = mesclarItem(out[i]!, limpo);
    else out.push(limpo);
  }
  return out;
}

export function mesclar(pai: unknown, filho: unknown): unknown {
  if (filho === undefined) return pai;
  if (Array.isArray(filho)) {
    if (Array.isArray(pai) && (ehListaComChave(filho) || ehListaComChave(pai)) && filho.every(ehObj)) return mesclarPorChave(pai as Obj[], filho as Obj[]);
    return filho.map(x => (ehObj(x) ? (({ remover: _r, ...l }) => l)(x) : x)).filter(x => !(ehObj(x) && (x as Obj).remover));
  }
  if (ehObj(filho)) {
    const base: Obj = ehObj(pai) ? { ...pai } : {};
    for (const [k, v] of Object.entries(filho)) base[k] = mesclar(base[k], v);
    return base;
  }
  return filho;
}

const caminho = (p: PropertyKey[]) => p.map(x => (typeof x === 'number' ? `[${x}]` : `.${String(x)}`)).join('').replace(/^\./, '');

export function resolverPack(id: string, catalogo: Catalogo): ResultadoPack {
  const erros: string[] = [], avisos: string[] = [];
  const linhagem: string[] = [];
  const arquivos: Obj[] = [];
  let atual: string | undefined = id;
  while (atual) {
    if (linhagem.includes(atual)) { erros.push(`herança circular: ${[...linhagem, atual].join(' → ')}`); break; }
    const bruto = catalogo[atual];
    if (bruto === undefined) { erros.push(linhagem.length ? `"${linhagem.at(-1)}" herda de "${atual}", que não existe` : `pack "${atual}" não existe`); break; }
    const r = PackArquivo.safeParse(bruto);
    if (!r.success) {
      r.error.issues.forEach(i => erros.push(`${atual}: ${caminho(i.path) || 'arquivo'} — ${i.message}`));
      break;
    }
    if (r.data.id !== atual) erros.push(`${atual}: o campo "id" diz "${r.data.id}"; ele precisa ser igual ao nome do pack`);
    linhagem.push(atual);
    arquivos.push(r.data as Obj);
    atual = r.data.herda;
  }
  if (erros.length) return { ok: false, pack: null, erros, avisos };

  /* do mais genérico para o mais específico */
  let m: unknown = {};
  for (const a of [...arquivos].reverse()) m = mesclar(m, a);
  const mesclado = m as Obj;
  mesclado.id = id;
  mesclado.versao = arquivos[0]!.versao;
  mesclado.nome = arquivos[0]!.nome ?? mesclado.nome;
  delete mesclado.herda;
  delete mesclado.$schema;

  const v = Pack.safeParse(mesclado);
  if (!v.success) {
    v.error.issues.forEach(i => erros.push(`${id} (resolvido): ${rotulo(mesclado, i.path)} — ${i.message}`));
    return { ok: false, pack: null, erros, avisos };
  }
  const p = v.data;
  const pack: PackResolvido = {
    id, nome: p.nome!, versao: p.versao, linhagem,
    ...(p.descricao ? { descricao: p.descricao } : {}),
    ...(p.modelo ? { modelo: p.modelo } : {}),
    textos: p.textos ?? {},
    calendario: { ...PADROES.calendario, ...(p.calendario ?? {}) } as PackResolvido['calendario'],
    funis: (p.funis ?? []).map(f => ({ ...f, lado: f.lado ?? 'aquisicao', etapas: f.etapas ?? [] })) as PackResolvido['funis'],
    atividades: (p.atividades ?? []) as PackResolvido['atividades'],
    canais: (p.canais ?? []).map(c => ({ ...c, origemDeLead: c.origemDeLead ?? true })) as PackResolvido['canais'],
    motivosPerda: (p.motivosPerda ?? []) as PackResolvido['motivosPerda'],
    tiposNegocio: p.tiposNegocio ?? [...PADROES.tiposNegocio],
    precificacao: {
      ...(p.precificacao?.margemAlvo != null ? { margemAlvo: p.precificacao.margemAlvo } : {}),
      ...(p.precificacao?.margemMinima != null ? { margemMinima: p.precificacao.margemMinima } : {}),
      ...(p.precificacao?.descontoMaximo != null ? { descontoMaximo: p.precificacao.descontoMaximo } : {}),
      ...(p.precificacao?.custoCapitalMes != null ? { custoCapitalMes: p.precificacao.custoCapitalMes } : {}),
      ...(p.precificacao?.custosFixosMes != null ? { custosFixosMes: p.precificacao.custosFixosMes } : {}),
      ...(p.precificacao?.lucroDesejadoMes != null ? { lucroDesejadoMes: p.precificacao.lucroDesejadoMes } : {}),
      ...(p.precificacao?.comissao ? { comissao: p.precificacao.comissao } : {}),
      linhas: (p.precificacao?.linhas ?? []) as PackResolvido['precificacao']['linhas'],
      condicoes: (p.precificacao?.condicoes ?? []).map(c => ({ ...c, taxa: c.taxa ?? 0 })) as PackResolvido['precificacao']['condicoes'],
    },
    hipoteses: (p.hipoteses ?? []) as PackResolvido['hipoteses'],
    cs: p.cs ?? {},
    parametros: { ...PADROES.parametros, ...(p.parametros ?? {}) },
  };
  conferir(pack, erros, avisos);
  return { ok: erros.length === 0, pack: erros.length ? null : pack, erros, avisos };
}

/* mostra "funis[principal].etapas[visita_ok].papel" em vez de "funis[0].etapas[3].papel" */
function rotulo(raiz: unknown, path: PropertyKey[]): string {
  let no: unknown = raiz, out = '';
  for (const k of path) {
    if (typeof k === 'number' && Array.isArray(no)) {
      const item = no[k];
      out += ehObj(item) && typeof item.chave === 'string' ? `[${item.chave}]` : `[${k}]`;
      no = item;
    } else { out += (out ? '.' : '') + String(k); no = ehObj(no) ? no[String(k)] : undefined; }
  }
  return out || 'pack';
}

function duplicadas(lista: { chave: string }[], onde: string, erros: string[]) {
  const vistos = new Set<string>();
  for (const x of lista) { if (vistos.has(x.chave)) erros.push(`${onde}: a chave "${x.chave}" aparece mais de uma vez`); vistos.add(x.chave); }
}

const ORDEM_PAPEL = (p: PapelEtapa) => PAPEIS_ETAPA.indexOf(p);

function conferir(p: PackResolvido, erros: string[], avisos: string[]) {
  duplicadas(p.funis, 'funis', erros);
  duplicadas(p.atividades, 'atividades', erros);
  duplicadas(p.canais, 'canais', erros);
  duplicadas(p.motivosPerda, 'motivosPerda', erros);
  duplicadas(p.precificacao.linhas, 'precificacao.linhas', erros);
  duplicadas(p.precificacao.condicoes, 'precificacao.condicoes', erros);
  duplicadas(p.hipoteses, 'hipoteses', erros);
  for (const h of p.hipoteses) {
    for (const [campo, texto] of [['quando', h.quando], ['impacto', h.impacto]] as const) {
      if (texto == null) continue;
      try {
        for (const v of variaveisUsadas(analisar(texto))) if (!(v in VARIAVEIS)) erros.push(`hipoteses[${h.chave}].${campo}: a variável "${v}" não existe (veja /admin/hipoteses/variaveis)`);
      } catch (e) { erros.push(`hipoteses[${h.chave}].${campo}: ${e instanceof ErroExpressao ? e.message : 'fórmula inválida'}`); }
    }
  }

  const aq = p.funis.filter(f => f.lado === 'aquisicao');
  if (!aq.length) erros.push('o pack precisa de pelo menos um funil de aquisição (lado "aquisicao")');
  const principais = p.funis.filter(f => f.principal);
  if (principais.length > 1) erros.push(`só um funil pode ser o principal; marcados: ${principais.map(f => f.chave).join(', ')}`);

  const etapasGlobais = new Map<string, string>();
  for (const f of p.funis) {
    duplicadas(f.etapas, `funis[${f.chave}].etapas`, erros);
    if (!f.etapas.length) { erros.push(`funis[${f.chave}]: não tem etapas`); continue; }
    for (const e of f.etapas) {
      const outro = etapasGlobais.get(e.chave);
      if (outro && outro !== f.chave) erros.push(`a etapa "${e.chave}" existe nos funis "${outro}" e "${f.chave}"; use chaves diferentes`);
      etapasGlobais.set(e.chave, f.chave);
    }
    const papeis = f.etapas.map(e => e.papel);
    const unicos: PapelEtapa[] = f.lado === 'aquisicao' ? ['lead', 'ganho', 'perdido'] : ['churn'];
    for (const u of unicos) {
      const n = papeis.filter(x => x === u).length;
      if (n > 1) erros.push(`funis[${f.chave}]: o papel "${u}" só pode aparecer uma vez (aparece ${n})`);
    }
    if (f.lado === 'aquisicao') {
      if (!papeis.includes('ganho')) erros.push(`funis[${f.chave}]: falta a etapa com papel "ganho"`);
      if (!papeis.includes('perdido')) erros.push(`funis[${f.chave}]: falta a etapa com papel "perdido"`);
      if (papeis[0] !== 'lead') avisos.push(`funis[${f.chave}]: a primeira etapa costuma ter papel "lead" (está "${papeis[0]}")`);
    }
    /* ordem dos papéis canônicos (ignorando intermediárias e terminais): fora de ordem distorce coortes */
    const seq = f.etapas.filter(e => !['intermediaria', 'ganho', 'perdido', 'churn'].includes(e.papel));
    for (let i = 1; i < seq.length; i++) {
      if (ORDEM_PAPEL(seq[i]!.papel) < ORDEM_PAPEL(seq[i - 1]!.papel)) {
        avisos.push(`funis[${f.chave}]: a etapa "${seq[i]!.chave}" (${seq[i]!.papel}) vem depois de "${seq[i - 1]!.chave}" (${seq[i - 1]!.papel}); confira a ordem`);
      }
    }
  }

  if (!p.atividades.some(a => a.metaDiaria)) avisos.push('nenhuma atividade tem "metaDiaria": o plano do dia ficará sem meta de esforço');
  for (const c of p.canais) if (c.pai && !p.canais.some(x => x.chave === c.pai)) erros.push(`canais[${c.chave}]: o canal-pai "${c.pai}" não existe`);

  const pr = p.precificacao;
  if (pr.margemAlvo != null && pr.margemMinima != null && pr.margemMinima > pr.margemAlvo) erros.push('precificacao: a margem mínima é maior que a margem-alvo');
  for (const l of pr.linhas) {
    if (l.base !== 'informado' && l.valor == null) erros.push(`precificacao.linhas[${l.chave}]: falta "valor" (só a base "informado" pode ficar sem)`);
    if ((l.base === 'percentual_preco' || l.base === 'percentual_liquido') && l.valor != null && l.valor > 1) erros.push(`precificacao.linhas[${l.chave}]: percentual acima de 1 (use 0,06 para 6%)`);
  }
  for (const c of pr.condicoes) {
    if (c.partes?.length) { const soma = c.partes.reduce((a, x) => a + x.fracao, 0); if (Math.abs(soma - 1) > 1e-6) erros.push(`precificacao.condicoes[${c.chave}]: as partes do recebimento somam ${Math.round(soma * 100)}%, precisam somar 100%`); }
  }
  for (const l of pr.linhas) for (const x of l.excluir ?? []) if (!pr.linhas.some(y => y.chave === x && y.base === 'informado')) erros.push(`precificacao.linhas[${l.chave}]: "excluir" aponta para "${x}", que não é um custo informado desta política`);
  if (pr.comissao?.tipo === 'por_margem') {
    if (pr.comissao.alvo == null || pr.comissao.minima == null) erros.push('precificacao.comissao: comissão por margem precisa de "alvo" e "minima"');
    if (pr.margemAlvo == null || pr.margemMinima == null) erros.push('precificacao.comissao: comissão por margem precisa de margemAlvo e margemMinima na política');
    if (pr.comissao.alvo != null && pr.comissao.minima != null && pr.comissao.minima > pr.comissao.alvo) erros.push('precificacao.comissao: a comissão mínima é maior que a alvo');
  }
  if (pr.comissao?.tipo === 'fixa' && pr.comissao.alvo == null) erros.push('precificacao.comissao: comissão fixa precisa de "alvo"');
  if (p.cs.recorrente && !p.cs.periodicidadeMeses) avisos.push('cs: receita recorrente sem "periodicidadeMeses"; vou assumir 1 (mensal)');
}
