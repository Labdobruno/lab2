/* Conector de planilha (CSV): para operações sem CRM ou para importar histórico.
   Cada arquivo traz um tipo de coisa; o tipo sai do nome do arquivo (negocios.csv, atividades-outubro.csv…)
   ou da configuração. As colunas têm nomes padrão em português (ver docs/conectores.md);
   se a planilha usa outros nomes, informe em config.planilhas.<tipo>.colunas. */
import { chaveDe, lerData, lerNumero, type Comando } from '@lab/nucleo';
import { z } from 'zod';
import { MapaSchema } from '../mapa.js';
import { sha256 } from '../cripto.js';
import { lerCSV } from '../csv.js';
import { ErroDeEntrada, type Conector, type EntradaBruta } from '../tipos.js';

export const TIPOS_PLANILHA = ['pessoas', 'contas', 'negocios', 'transicoes', 'atividades', 'investimentos', 'recebimentos', 'contratos', 'eventos_cs'] as const;
type TipoPlanilha = (typeof TIPOS_PLANILHA)[number];

const Config = z.object({
  mapa: MapaSchema.optional(),
  /* nome do arquivo (início) → tipo e, se preciso, nomes das colunas: { campo_padrao: "Coluna na planilha" } */
  planilhas: z.record(z.string(), z.object({
    tipo: z.enum(TIPOS_PLANILHA),
    colunas: z.record(z.string(), z.string()).optional(),
  })).optional(),
}).strict();
type Config = z.infer<typeof Config>;

const norm = (s: string) => chaveDe(s);
type Linha = Record<string, string>;

function tipoDoArquivo(nome: string, cfg: Config): { tipo: TipoPlanilha; colunas: Record<string, string> } {
  const base = norm(nome.replace(/\.(csv|txt)$/i, ''));
  for (const [prefixo, def] of Object.entries(cfg.planilhas ?? {})) {
    if (base.startsWith(norm(prefixo))) return { tipo: def.tipo, colunas: def.colunas ?? {} };
  }
  const t = [...TIPOS_PLANILHA].sort((a, b) => b.length - a.length).find(t => base.startsWith(t));
  if (!t) throw new ErroDeEntrada(`não sei o que é "${nome}": comece o nome do arquivo com ${TIPOS_PLANILHA.join(', ')} ou configure em config.planilhas`);
  return { tipo: t, colunas: {} };
}

const sim = (v: string | undefined) => (v == null || v === '' ? undefined : /^(s|sim|true|1|x|yes)$/i.test(v.trim()));

const STATUS_RECEB: Record<string, string> = {
  pago: 'pago', paga: 'pago', recebido: 'pago', quitado: 'pago', aberto: 'previsto', a_vencer: 'previsto', previsto: 'previsto', pendente: 'previsto',
  vencido: 'atrasado', atrasado: 'atrasado', inadimplente: 'atrasado', parcial: 'parcial', cancelado: 'cancelado', estornado: 'estornado',
};
const STATUS_CONTRATO: Record<string, string> = { ativo: 'ativo', vigente: 'ativo', cancelado: 'cancelado', encerrado: 'encerrado', renovado: 'renovado', suspenso: 'suspenso', pausado: 'suspenso' };
const FUNCOES: Record<string, string> = { sdr: 'sdr', bdr: 'sdr', pre_vendas: 'sdr', closer: 'closer', vendedor: 'closer', consultor: 'closer', ambos: 'ambos', cs: 'cs', sucesso_do_cliente: 'cs', gestor: 'gestor' };

const refPessoa = (nome: string) => `pessoa:${norm(nome)}`;
const refConta = (nome: string) => `conta:${norm(nome)}`;

function exigir(v: string | undefined, campo: string): string {
  if (v == null || v.trim() === '') throw new ErroDeEntrada(`coluna "${campo}" vazia`);
  return v.trim();
}
function data(v: string | undefined, campo: string, obrigatoria = false): string | undefined {
  if (v == null || v.trim() === '') { if (obrigatoria) throw new ErroDeEntrada(`coluna "${campo}" vazia`); return undefined; }
  const d = lerData(v);
  if (!d) throw new ErroDeEntrada(`coluna "${campo}": "${v}" não é uma data (use 15/10/2026 ou 2026-10-15)`);
  return d;
}
function numero(v: string | undefined, campo: string): number | undefined {
  if (v == null || v.trim() === '') return undefined;
  const n = lerNumero(v);
  if (n == null) throw new ErroDeEntrada(`coluna "${campo}": "${v}" não é um número`);
  return n;
}

/* uma linha da planilha → comandos canônicos */
export function traduzirLinha(tipo: TipoPlanilha, l: Linha): Comando[] {
  const v = (k: string) => { const x = l[k]; return x == null || x.trim() === '' ? undefined : x.trim(); };
  const pessoaCmd = (nome: string | undefined): Comando[] => (nome ? [{ tipo: 'pessoa.upsert', ref: refPessoa(nome), nome }] : []);
  switch (tipo) {
    case 'pessoas': {
      const nome = exigir(v('nome'), 'nome');
      const f = v('funcao');
      return [{ tipo: 'pessoa.upsert', ref: v('id') ? `pessoa:${v('id')}` : refPessoa(nome), nome,
        ...(v('email') ? { email: v('email')! } : {}), ...(f ? { funcao: (FUNCOES[norm(f)] ?? 'outro') as never } : {}),
        ...(sim(v('ativa')) != null ? { ativa: sim(v('ativa'))! } : {}) }];
    }
    case 'contas': {
      const nome = exigir(v('nome'), 'nome');
      const tp = v('tipo_pessoa')?.toLowerCase();
      return [...pessoaCmd(v('dono_cs')), { tipo: 'conta.upsert', ref: v('id') ? `conta:${v('id')}` : refConta(nome), nome,
        ...(tp === 'pf' || tp === 'pj' ? { tipoPessoa: tp } : {}),
        ...(v('segmento') ? { segmento: v('segmento')! } : {}), ...(v('cidade') ? { cidade: v('cidade')! } : {}), ...(v('uf') ? { uf: v('uf')!.toUpperCase().slice(0, 2) } : {}),
        ...(v('dono_cs') ? { donoCsRef: refPessoa(v('dono_cs')!) } : {}) }];
    }
    case 'negocios': {
      const id = exigir(v('id'), 'id');
      const cliente = v('cliente') ?? v('conta');
      const contaRef = v('conta_id') ? `conta:${v('conta_id')}` : cliente ? refConta(cliente) : undefined;
      const criadoEm = data(v('criado_em'), 'criado_em', true)!;
      const out: Comando[] = [...pessoaCmd(v('responsavel'))];
      if (cliente && contaRef) out.push({ tipo: 'conta.upsert', ref: contaRef, nome: cliente, criadoEm,
        ...(v('segmento') ? { segmento: v('segmento')! } : {}), ...(v('cidade') ? { cidade: v('cidade')! } : {}), ...(v('uf') ? { uf: v('uf')!.toUpperCase().slice(0, 2) } : {}) });
      const tipoNeg = v('tipo') ? norm(v('tipo')!) : undefined;
      out.push({
        tipo: 'negocio.upsert', ref: `negocio:${id}`, criadoEm,
        ...(contaRef ? { contaRef } : {}),
        ...(v('canal') ? { canalRef: v('canal')! } : {}),
        ...(v('responsavel') ? { donoRef: refPessoa(v('responsavel')!) } : {}),
        ...(v('etapa') ? { etapa: v('etapa')! } : {}),
        ...(v('etapa_desde') ? { etapaDesde: data(v('etapa_desde'), 'etapa_desde')! } : {}),
        ...(v('funil') ? { funil: v('funil')! } : {}),
        ...(tipoNeg ? { tipoNegocio: (tipoNeg === 'cross' ? 'cross_sell' : tipoNeg) as never } : {}),
        ...(v('valor_estimado') ? { valorEstimado: numero(v('valor_estimado'), 'valor_estimado')! } : {}),
        ...(v('valor_fechado') ? { valorFechado: numero(v('valor_fechado'), 'valor_fechado')! } : {}),
        ...(v('fechado_em') ? { fechadoEm: data(v('fechado_em'), 'fechado_em')! } : {}),
        ...(v('motivo_perda') ? { motivoPerda: v('motivo_perda')! } : {}),
      });
      const precos: [string, 'referencia' | 'aprovado' | 'fechado'][] = [['preco_referencia', 'referencia'], ['preco_aprovado', 'aprovado']];
      for (const [col, momento] of precos) {
        const p = numero(v(col), col);
        if (p != null) out.push({ tipo: 'preco.registrar', negocioRef: `negocio:${id}`, momento, valor: p, em: v('etapa_desde') ? data(v('etapa_desde'), 'etapa_desde')! : criadoEm, ...(v('condicao') ? { condicao: v('condicao')! } : {}) });
      }
      const vf = numero(v('valor_fechado'), 'valor_fechado');
      if (vf != null && v('fechado_em')) {
        const custos = Object.entries(l).filter(([k, x]) => k.startsWith('custo_') && x.trim() !== '').map(([k, x]) => ({ chave: k.slice(6), valor: numero(x, k)! }));
        out.push({ tipo: 'preco.registrar', negocioRef: `negocio:${id}`, momento: 'fechado', valor: vf, em: data(v('fechado_em'), 'fechado_em')!,
          ...(v('condicao') ? { condicao: v('condicao')! } : {}), ...(custos.length ? { linhas: custos } : {}) });
      }
      return out;
    }
    case 'transicoes':
      return [{ tipo: 'negocio.transicao', negocioRef: `negocio:${exigir(v('negocio_id'), 'negocio_id')}`, para: exigir(v('etapa'), 'etapa'),
        em: data(v('data'), 'data', true)!, ...(v('de') ? { de: v('de')! } : {}), ...(v('responsavel') ? { donoRef: refPessoa(v('responsavel')!) } : {}) },
        ...pessoaCmd(v('responsavel'))];
    case 'atividades': {
      const em = data(v('data'), 'data', true)!;
      const pessoa = v('pessoa');
      const ref = v('id') ? `atividade:${v('id')}` : `atividade:${norm(pessoa ?? '')}:${em}:${norm(v('atividade') ?? '')}:${v('negocio_id') ?? ''}:${v('quantidade') ?? '1'}`;
      const q = numero(v('quantidade'), 'quantidade');
      if (q != null && (!Number.isInteger(q) || q <= 0)) throw new ErroDeEntrada(`coluna "quantidade": use um número inteiro maior que zero`);
      return [...pessoaCmd(pessoa), { tipo: 'atividade.registrar', ref, atividade: exigir(v('atividade'), 'atividade'), em,
        ...(pessoa ? { pessoaRef: refPessoa(pessoa) } : {}), ...(v('negocio_id') ? { negocioRef: `negocio:${v('negocio_id')}` } : {}),
        ...(v('conta') ? { contaRef: refConta(v('conta')!) } : {}), ...(q != null ? { quantidade: q } : {}), ...(v('resultado') ? { resultado: v('resultado')! } : {}) }];
    }
    case 'investimentos': {
      const mesBruto = exigir(v('mes'), 'mes');
      const m = mesBruto.match(/^(\d{1,2})\/(\d{4})$/) ?? mesBruto.match(/^(\d{4})-(\d{1,2})/);
      if (!m) throw new ErroDeEntrada(`coluna "mes": "${mesBruto}" — use 10/2026 ou 2026-10`);
      const [ano, mes] = mesBruto.includes('/') ? [m[2]!, m[1]!] : [m[1]!, m[2]!];
      const n = (k: string) => { const x = numero(v(k), k); return x == null ? {} : { [k === 'leads' ? 'leadsPlataforma' : k]: Math.round(x) }; };
      return [{ tipo: 'investimento.upsert', canalRef: exigir(v('canal'), 'canal'), mes: `${ano}-${mes.padStart(2, '0')}`,
        valor: numero(exigir(v('valor'), 'valor'), 'valor')!, ...n('impressoes'), ...n('cliques'), ...n('leads') }];
    }
    case 'recebimentos': {
      const st = STATUS_RECEB[norm(exigir(v('status'), 'status'))];
      if (!st) throw new ErroDeEntrada(`coluna "status": "${v('status')}" — use pago, aberto, vencido, parcial, cancelado ou estornado`);
      return [{ tipo: 'recebimento.upsert', ref: `recebimento:${exigir(v('id'), 'id')}`, status: st as never,
        ...(v('negocio_id') ? { negocioRef: `negocio:${v('negocio_id')}` } : {}), ...(v('conta') ? { contaRef: refConta(v('conta')!) } : {}),
        ...(v('descricao') ? { descricao: v('descricao')! } : {}),
        ...(v('valor_previsto') ? { valorPrevisto: numero(v('valor_previsto'), 'valor_previsto')! } : {}),
        ...(v('vencimento') ? { previstoEm: data(v('vencimento'), 'vencimento')! } : {}),
        ...(v('valor_recebido') ? { valorRecebido: numero(v('valor_recebido'), 'valor_recebido')! } : {}),
        ...(v('recebido_em') ? { recebidoEm: data(v('recebido_em'), 'recebido_em')! } : {}) }];
    }
    case 'contratos': {
      const st = STATUS_CONTRATO[norm(exigir(v('status'), 'status'))];
      if (!st) throw new ErroDeEntrada(`coluna "status": "${v('status')}" — use ativo, cancelado, encerrado, renovado ou suspenso`);
      const conta = exigir(v('conta'), 'conta');
      const per = numero(v('periodicidade_meses'), 'periodicidade_meses');
      return [{ tipo: 'conta.upsert', ref: refConta(conta), nome: conta }, { tipo: 'contrato.upsert', ref: `contrato:${exigir(v('id'), 'id')}`, contaRef: refConta(conta),
        recorrente: sim(v('recorrente')) ?? false, valorPeriodo: numero(exigir(v('valor'), 'valor'), 'valor')!, inicio: data(v('inicio'), 'inicio', true)!, status: st as never,
        ...(per != null ? { periodicidadeMeses: Math.round(per) } : {}), ...(v('negocio_id') ? { negocioOrigemRef: `negocio:${v('negocio_id')}` } : {}),
        ...(v('fim') ? { fim: data(v('fim'), 'fim')! } : {}), ...(v('renovacao') ? { renovacaoEm: data(v('renovacao'), 'renovacao')! } : {}),
        ...(v('motivo_cancelamento') ? { motivoCancelamento: v('motivo_cancelamento')! } : {}) }];
    }
    case 'eventos_cs': {
      const conta = exigir(v('conta'), 'conta');
      const em = data(v('data'), 'data', true)!;
      const evento = norm(exigir(v('evento'), 'evento'));
      return [...pessoaCmd(v('pessoa')), { tipo: 'conta.upsert', ref: refConta(conta), nome: conta },
        { tipo: 'evento_cs.registrar', ref: v('id') ? `evento_cs:${v('id')}` : `evento_cs:${norm(conta)}:${evento}:${em}`, contaRef: refConta(conta),
          evento: evento as never, em, ...(v('valor') ? { valor: numero(v('valor'), 'valor')! } : {}), ...(v('pessoa') ? { pessoaRef: refPessoa(v('pessoa')!) } : {}) }];
    }
  }
}

export const conectorPlanilha: Conector<Config> = {
  tipo: 'planilha',
  nome: 'Planilha (CSV)',
  descricao: 'Importa negócios, atividades, investimento, recebimentos, contratos e eventos de CS a partir de arquivos CSV.',
  config: Config,
  async importar(arquivo, ctx) {
    const { tipo, colunas } = tipoDoArquivo(arquivo.nome, ctx.config);
    const { cabecalho, linhas } = lerCSV(arquivo.conteudo);
    if (!linhas.length) throw new ErroDeEntrada(`${arquivo.nome}: nenhuma linha de dados`);
    /* coluna da planilha → campo padrão (nomes comparados sem acento e sem caixa) */
    const inverso = new Map<string, string>(Object.entries(colunas).map(([campo, col]) => [norm(col), campo]));
    const campos = cabecalho.map(h => inverso.get(norm(h)) ?? norm(h));
    const out: EntradaBruta[] = [];
    for (const [i, valores] of linhas.entries()) {
      const linha: Linha = {};
      campos.forEach((c, j) => { linha[c] = valores[j] ?? ''; });
      if (Object.values(linha).every(x => x.trim() === '')) continue;
      const h = await sha256(JSON.stringify(linha));
      const id = linha.id?.trim();
      out.push({ chave: `${tipo}:${id || 'linha'}:${h.slice(0, 24)}`, tipo, payload: { linha, arquivo: arquivo.nome, numero: i + 2 } });
    }
    return out;
  },
  async normalizar(e) {
    return traduzirLinha(e.tipo as TipoPlanilha, (e.payload as { linha: Linha }).linha);
  },
  rotulo(e) {
    const p = e.payload as { arquivo?: string; numero?: number };
    return `${p.arquivo ?? 'planilha'}, linha ${p.numero ?? '?'}`;
  },
};
