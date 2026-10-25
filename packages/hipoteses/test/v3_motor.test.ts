/* Contrato do lab_motor.test.js da V1: problemas plantados → detecção, alarme falso zero, rivais, honestidade ("não sei"), consistência,
   composição, histerese, sombra, orçamento e marcas, curva de caixa, pontos de equilíbrio, desenho de experimento, elegibilidade.
   A biblioteca aqui reproduz a da V1 (métricas da V1 como ids livres: o motor é agnóstico ao catálogo; medir é injetado). */
import { describe, expect, it } from 'vitest';
import { avaliarV3, breakEvenDescontoSimples, breakEvenEntrada, desenhoDeExperimento, elegibilidade, orcamentoDeAtencao, simularCondicaoDeCaixa, type Composto, type HipoteseV3, type Intervencao, type MedirMetrica } from '../src/index.js';

const DIA = 86_400_000, AGORA = Date.UTC(2026, 9, 8, 12);
const UN: Record<string, string> = { receita: 'R$', recebiveis: 'R$', prazo_receb: 'd', caixa_oper: 'R$', desconto_medio: '%', margem_contrib: '%', custo_var_venda: '%', custo_kit_desvio: '%', tx_fech: '%', tx_oport: '%', tx_agenda: '%', leads: 'n', oport: 'n', realizadas: 'n', agendadas: 'n', ticket: 'R$', vendas: 'n', backlog: 'n', prazo_inst: 'd', atraso_os: 'n', exposicao: 'R$', retrabalho: 'R$', cancelamentos: 'n', propostas: 'n', visitas: 'n', tentativas: 'n' };
const un = (id: string) => UN[id] ?? 'n';
const ADITIVAS = ['leads', 'contatos', 'agendadas', 'realizadas', 'visitas', 'oport', 'propostas', 'vendas', 'vendas_assinadas', 'receita', 'recebido', 'pago', 'caixa_oper', 'retrabalho', 'cancelamentos'], COORTE = ['tx_agenda', 'tx_oport', 'tx_fech', 'tx_lead_venda'];
/* medir: base = linha de base (90 dias); atual = janela atual. Valores de base são "por 30 dias" para as aditivas: a janela de 90 dias devolve 3× */
type Vals = Record<string, number | null | undefined>;
const medirDe = (base: Vals, atual: Vals, n?: Record<string, number>): MedirMetrica => (id, a, b) => {
  const co = COORTE.includes(id), A = co ? b === AGORA - 30 * DIA && b - a === 30 * DIA : b === AGORA, src = A ? atual : base;
  if (!(id in src) || src[id] == null) return { estado: 'ausente', nota: 'sem dado' };
  const dias = (b - a) / DIA; let v = src[id]!; if (!A && ADITIVAS.includes(id)) v = (v * dias) / 30;
  return { v, n: n && n[id] != null ? n[id] : 40, estado: 'ok' };
};
const SAUDAVEL: Vals = { receita: 300000, recebiveis: 120000, prazo_receb: 30, caixa_oper: 40000, desconto_medio: 0.04, margem_contrib: 0.26, custo_var_venda: 0.6, custo_kit_desvio: 0, tx_fech: 0.22, tx_oport: 0.5, tx_agenda: 0.25, leads: 400, oport: 60, realizadas: 120, agendadas: 150, ticket: 20000, vendas: 15, backlog: 10, prazo_inst: 30, atraso_os: 1, exposicao: 5000, retrabalho: 1000, cancelamentos: 0, propostas: 70, visitas: 40, tentativas: 800 };
/* a biblioteca da V1 no formato v3 */
const C = (met: string, op: HipoteseV3['condicoes'] extends Array<infer T> | null | undefined ? (T extends { op: infer O } ? O : never) : never, extra: Record<string, unknown> = {}) => ({ met, op, janela: 30, base: 'media90' as const, limiar: 10, banda: 3, amostraMin: 5, histerese: { folga: 2, dias: 14, intervalo: 14 }, ...extra });
const C0 = (met: string, op: Parameters<typeof C>[1], extra: Record<string, unknown> = {}) => C(met, op, { amostraMin: 0, ...extra });
const Cpp = (met: string, op: Parameters<typeof C>[1], extra: Record<string, unknown> = {}) => C(met, op, { limiar: 2, banda: 1, ...extra });
const INT: Record<string, Intervencao> = {
  'I-PRE-003': { chave: 'I-PRE-003', nome: 'Teto de desconto por faixa de ticket', impacto: { receita: '0', conversao: '−', margem: '++' }, esforco: 1 },
  'I-COM-007': { chave: 'I-COM-007', nome: 'Alçada para venda abaixo do mínimo', impacto: { conversao: '−', margem: '+' }, esforco: 1 },
  'I-FIN-001': { chave: 'I-FIN-001', nome: 'Aumentar a entrada', impacto: { conversao: '−', caixa: '++' }, esforco: 2 },
  'I-FIN-003': { chave: 'I-FIN-003', nome: 'Prazo com o fornecedor', impacto: { margem: '−', caixa: '++' }, esforco: 2 },
  'I-COM-010': { chave: 'I-COM-010', nome: 'Roteiro de qualificação', impacto: { conversao: '++' }, esforco: 2 },
  'I-COM-011': { chave: 'I-COM-011', nome: 'Treino de fechamento', impacto: { receita: '++' }, esforco: 2 },
  'I-OPE-005': { chave: 'I-OPE-005', nome: 'Ampliar capacidade', impacto: { margem: '−', capacidade: '++' }, esforco: 3 },
  'I-OPE-006': { chave: 'I-OPE-006', nome: 'Travar preço do kit', impacto: { margem: '++', caixa: '−' }, esforco: 1 },
  'I-COM-013': { chave: 'I-COM-013', nome: 'Tratar o funil existente', impacto: { conversao: '+' }, esforco: 1 },
};
const BIB: HipoteseV3[] = [
  { chave: 'H-FIN-001', titulo: 'Crescimento comercial consumindo caixa', tipo: 'risco', dimensao: 'caixa', acao: '', condicoes: [C('receita', 'AUMENTOU'), C('recebiveis', 'AUMENTOU', { limiar: 15 }), C('prazo_receb', 'AUMENTOU', { limiar: 10, amostraMin: 5 }), C('caixa_oper', 'DIMINUIU', { limiar: 10, amostraMin: 3 })], essenciais: ['receita', 'recebiveis'], rivais: ['H-FIN-005', 'H-OPE-009'], intervencoes: ['I-FIN-001', 'I-FIN-003'], impacto: 'exposicao' },
  { chave: 'H-COM-002', titulo: 'Crescimento comprado com desconto', tipo: 'problema', dimensao: 'contribuicao', acao: '', condicoes: [C('receita', 'AUMENTOU'), Cpp('desconto_medio', 'AUMENTOU', { amostraMin: 10 }), Cpp('margem_contrib', 'DIMINUIU', { amostraMin: 10 }), Cpp('custo_var_venda', 'ESTAVEL', { banda: 2, amostraMin: 10 })], essenciais: ['desconto_medio', 'margem_contrib'], rivais: ['H-SOL-013', 'H-COM-010'], intervencoes: ['I-PRE-003', 'I-COM-007'], impacto: 'max(0, desconto_medio - desconto_medio_base) * receita / (1 - desconto_medio)' },
  { chave: 'H-COM-003', titulo: 'Gargalo comercial no fechamento', tipo: 'gargalo', dimensao: 'receita', acao: '', condicoes: [C('leads', 'ESTAVEL', { banda: 15, limiar: 30 }), C('oport', 'ESTAVEL', { banda: 15, limiar: 30 }), Cpp('tx_fech', 'DIMINUIU', { limiar: 5, amostraMin: 10 })], essenciais: ['tx_fech'], rivais: ['H-COM-004', 'H-COM-007'], intervencoes: ['I-COM-011', 'I-COM-013'], impacto: 'max(0, (tx_fech_base - tx_fech) * oport * ticket)' },
  { chave: 'H-COM-004', titulo: 'Lead pior', tipo: 'problema', dimensao: 'receita', acao: '', condicoes: [C('leads', 'AUMENTOU', { limiar: 20 }), C('agendadas', 'AUMENTOU', { limiar: 10 }), Cpp('tx_oport', 'DIMINUIU', { limiar: 5, amostraMin: 10 })], essenciais: ['tx_oport'], rivais: ['H-COM-003'], intervencoes: ['I-COM-010'], impacto: 'max(0, (tx_oport_base - tx_oport) * realizadas * tx_fech * ticket)' },
  { chave: 'H-FIN-005', titulo: 'Projeto lucrativo consumindo caixa', tipo: 'contradicao', dimensao: 'caixa', acao: '', condicoes: [Cpp('margem_contrib', 'ESTAVEL', { banda: 3, limiar: 6, amostraMin: 5 }), C0('exposicao', 'ACIMA', { ref: 20000 })], essenciais: ['exposicao'], rivais: ['H-FIN-001'], intervencoes: ['I-FIN-001', 'I-FIN-003'], impacto: 'exposicao' },
  { chave: 'H-FIN-006', titulo: 'Atraso operacional atrasando o caixa', tipo: 'problema', dimensao: 'caixa', acao: '', condicoes: [C0('atraso_os', 'AUMENTOU', { limiar: 20 }), C('prazo_receb', 'AUMENTOU', { limiar: 10, amostraMin: 5 })], essenciais: ['atraso_os'], rivais: ['H-SOL-012'], intervencoes: ['I-OPE-005'], impacto: 'atraso_os * ticket * 0.2' },
  { chave: 'H-COM-007', titulo: 'Ticket maior reduzindo a conversão', tipo: 'hipotese', dimensao: 'receita', acao: '', condicoes: [C('ticket', 'AUMENTOU', { limiar: 10, amostraMin: 5 }), Cpp('tx_fech', 'DIMINUIU', { limiar: 5, amostraMin: 10 })], essenciais: ['ticket', 'tx_fech'], rivais: ['H-COM-003'], intervencoes: ['I-PRE-003'], impacto: 'oport * (tx_fech_base * ticket_base - tx_fech * ticket)' },
  { chave: 'H-COM-008', titulo: 'Produtividade crescendo sem resultado', tipo: 'contradicao', dimensao: 'capacidade', acao: '', condicoes: [C('contatos', 'AUMENTOU', { limiar: 15, amostraMin: 5 }), C('realizadas', 'AUMENTOU', { limiar: 10 }), C('vendas', 'ESTAVEL', { banda: 10, limiar: 20, amostraMin: 3 })], essenciais: ['vendas'], rivais: ['H-COM-003', 'H-COM-004'], intervencoes: ['I-COM-011'] },
  { chave: 'H-OPE-009', titulo: 'Capacidade operacional virou gargalo', tipo: 'gargalo', dimensao: 'caixa', acao: '', condicoes: [C('vendas', 'AUMENTOU', { limiar: 15, amostraMin: 3 }), C0('backlog', 'AUMENTOU', { limiar: 20 }), C('prazo_inst', 'AUMENTOU', { limiar: 15, amostraMin: 3 })], essenciais: ['backlog'], rivais: ['H-SOL-020'], intervencoes: ['I-OPE-005'], impacto: 'backlog * ticket * 0.2' },
  { chave: 'H-COM-010', titulo: 'Mix alterou a qualidade da receita', tipo: 'investigacao', dimensao: 'contribuicao', acao: '', condicoes: [C('receita', 'ESTAVEL', { banda: 10, limiar: 20 }), Cpp('margem_contrib', 'DIMINUIU', { amostraMin: 10 }), Cpp('desconto_medio', 'ESTAVEL', { banda: 1, limiar: 2, amostraMin: 10 })], essenciais: ['margem_contrib'], rivais: ['H-COM-002', 'H-SOL-013'], impacto: 'max(0, margem_contrib_base - margem_contrib) * receita' },
  { chave: 'H-SOL-011', titulo: 'Financiamento como gargalo', tipo: 'gargalo', dimensao: 'receita', acao: '', condicoes: [C('vendas', 'ESTAVEL', { banda: 10, limiar: 20, amostraMin: 3 }), C0('cancelamentos', 'AUMENTOU', { limiar: 30 })], essenciais: ['cancelamentos'], rivais: ['H-SOL-014', 'H-SOL-015'], impacto: 'cancelamentos * ticket' },
  { chave: 'H-SOL-012', titulo: 'Homologação atrasando o caixa', tipo: 'problema', dimensao: 'caixa', acao: '', condicoes: [C0('atraso_os', 'ESTAVEL', { banda: 20, limiar: 40 }), C('prazo_receb', 'AUMENTOU', { limiar: 10, amostraMin: 5 })], essenciais: ['prazo_receb'], rivais: ['H-FIN-006'], impacto: 'max(0, prazo_receb - prazo_receb_base) / 30 * 0.02 * receita' },
  { chave: 'H-SOL-013', titulo: 'Erosão de margem entre proposta e compra', tipo: 'problema', dimensao: 'contribuicao', acao: '', condicoes: [Cpp('margem_contrib', 'DIMINUIU', { amostraMin: 5 }), Cpp('custo_kit_desvio', 'AUMENTOU', { limiar: 3, amostraMin: 3 })], essenciais: ['custo_kit_desvio'], rivais: ['H-COM-002', 'H-COM-010'], intervencoes: ['I-OPE-006'], impacto: 'max(0, custo_kit_desvio) * receita * 0.45' },
  { chave: 'H-SOL-014', titulo: 'Cancelamento pós-venda inflando o resultado', tipo: 'risco', dimensao: 'receita', acao: '', condicoes: [C('vendas_assinadas', 'AUMENTOU', { limiar: 10, amostraMin: 3 }), C0('cancelamentos', 'AUMENTOU', { limiar: 30 })], essenciais: ['cancelamentos'], rivais: ['H-SOL-011', 'H-SOL-015'], impacto: 'cancelamentos * ticket' },
  { chave: 'H-SOL-015', titulo: 'Inviabilidade técnica descoberta tarde', tipo: 'problema', dimensao: 'capacidade', acao: '', condicoes: [C('propostas', 'AUMENTOU', { limiar: 10 }), C0('cancelamentos', 'AUMENTOU', { limiar: 30 })], essenciais: ['cancelamentos'], rivais: ['H-SOL-011'] },
  { chave: 'H-SOL-016', titulo: 'Visita técnica como restrição', tipo: 'gargalo', dimensao: 'capacidade', acao: '', condicoes: [C('realizadas', 'AUMENTOU', { limiar: 10 }), C0('visitas', 'ESTAVEL', { banda: 10, limiar: 20 }), C('propostas', 'ESTAVEL', { banda: 10, limiar: 20 })], essenciais: ['visitas'], rivais: ['H-COM-004'] },
  { chave: 'H-SOL-017', titulo: 'Geração abaixo do prometido', tipo: 'risco', dimensao: 'contribuicao', acao: '', condicoes: [C('leads', 'DIMINUIU', { limiar: 15 })], essenciais: ['leads'], rivais: ['H-COM-004'] },
  { chave: 'H-SOL-018', titulo: 'Dependência de poucos vendedores', tipo: 'risco', dimensao: 'contribuicao', acao: '', condicoes: [] },
  { chave: 'H-SOL-019', titulo: 'Demanda puxada por evento tarifário', tipo: 'investigacao', dimensao: 'contribuicao', acao: '', condicoes: [C('leads', 'AUMENTOU', { limiar: 30 })], essenciais: ['leads'], rivais: ['H-COM-004'] },
  { chave: 'H-SOL-020', titulo: 'Retrabalho consumindo capacidade', tipo: 'gargalo', dimensao: 'capacidade', acao: '', condicoes: [C0('retrabalho', 'AUMENTOU', { limiar: 30 }), C('vendas', 'ESTAVEL', { banda: 10, limiar: 20, amostraMin: 3 })], essenciais: ['retrabalho'], rivais: ['H-OPE-009'], intervencoes: ['I-OPE-005'], impacto: 'retrabalho' },
];
const COMPOSTOS: Composto[] = [
  { chave: 'C-001', nome: 'Crescimento acima da capacidade', de: ['H-FIN-001', 'H-OPE-009'], relacao: 'vendas → backlog → prazo_inst → prazo_receb → caixa_oper', tipo: 'risco', dimensao: 'caixa' },
  { chave: 'C-002', nome: 'Margem perdida duas vezes', de: ['H-COM-002', 'H-SOL-013'], tipo: 'problema', dimensao: 'contribuicao' },
  { chave: 'C-003', nome: 'Atraso de obra virando atraso de caixa', de: ['H-OPE-009', 'H-FIN-006'], tipo: 'problema', dimensao: 'caixa' },
];
const opts = (extra: Record<string, unknown> = {}) => ({ agora: AGORA, intervencoes: INT, compostos: COMPOSTOS, aditivas: ADITIVAS, coorte: COORTE, ...extra });
const ativos = (R: ReturnType<typeof avaliarV3>) => R.filter(x => x.ativo).map(x => x.codigo);
const H1: Vals = { ...SAUDAVEL, receita: 390000, recebiveis: 178000, prazo_receb: 42, caixa_oper: 24000, exposicao: 30000 };
const H2: Vals = { ...SAUDAVEL, receita: 360000, desconto_medio: 0.09, margem_contrib: 0.21 };

describe('motor v3 com problemas plantados', () => {
  it('período saudável: nenhum achado ativo, nenhum composto, 20 hipóteses avaliadas', () => {
    const R = avaliarV3(BIB, medirDe(SAUDAVEL, SAUDAVEL), un, opts());
    expect(ativos(R)).toEqual([]); expect(R.some(x => x.composto)).toBe(false); expect(R.length).toBe(20);
  });
  it('H-FIN-001 plantada: detectada, impacto 30 mil em caixa, confiança média, primeira da lista; só as compatíveis disparam', () => {
    const R = avaliarV3(BIB, medirDe(SAUDAVEL, H1), un, opts());
    expect(ativos(R)).toContain('H-FIN-001');
    const a1 = R.find(x => x.codigo === 'H-FIN-001')!; expect(a1.impacto).toMatchObject({ valor: 30000, dimensao: 'caixa' }); expect(a1.confianca.nivel).toBe('media'); expect(R[0]!.codigo).toBe('H-FIN-001');
    expect(avaliarV3(BIB, medirDe(SAUDAVEL, H1), un, opts({ historico: ['H-FIN-001'] })).find(x => x.codigo === 'H-FIN-001')!.confianca.nivel).toBe('media');   // rival ativa
    expect(avaliarV3(BIB, medirDe(SAUDAVEL, { ...H1, exposicao: 5000 }), un, opts({ historico: ['H-FIN-001'] })).find(x => x.codigo === 'H-FIN-001')!.confianca.nivel).toBe('alta');
    expect(ativos(R).every(c => ['H-FIN-001', 'H-FIN-005', 'H-SOL-012'].includes(c))).toBe(true); expect(ativos(R)).toContain('H-FIN-005');
    expect(a1.rivais.some(r => r.codigo === 'H-FIN-005')).toBe(true);
  });
  it('H-COM-002 plantada: rivais não disparam; impacto = desconto adicional × preço aprovado', () => {
    const R = avaliarV3(BIB, medirDe(SAUDAVEL, H2), un, opts());
    expect(ativos(R)).toContain('H-COM-002'); expect(ativos(R)).not.toContain('H-SOL-013'); expect(ativos(R)).not.toContain('H-COM-010');
    expect(Math.abs(R.find(x => x.codigo === 'H-COM-002')!.impacto!.valor - (0.05 * 360000) / 0.91)).toBeLessThan(1);
  });
  it('desconto + kit juntos: ambas ativas, viram composto C-002 (não rivais); componentes cobertos e escondidos no orçamento', () => {
    const R = avaliarV3(BIB, medirDe(SAUDAVEL, { ...H2, custo_kit_desvio: 0.06 }), un, opts());
    expect(ativos(R)).toEqual(expect.arrayContaining(['H-COM-002', 'H-SOL-013']));
    const a2 = R.find(x => x.codigo === 'H-COM-002')!; expect(a2.rivais.length).toBe(0); expect(a2.cobertoPor).toBe('C-002');
    expect(R.some(x => x.codigo === 'C-002' && x.componentes!.join() === 'H-COM-002,H-SOL-013')).toBe(true);
    const O = orcamentoDeAtencao(R, {}, 5); expect(O.visiveis.some(x => x.codigo === 'C-002')).toBe(true); expect(O.visiveis.some(x => x.codigo === 'H-COM-002')).toBe(false); expect(O.resto.some(x => x.codigo === 'H-COM-002')).toBe(true);
  });
  it('honestidade: amostra 4 < 10 = não avaliável; dado essencial ausente lista o que falta; condição não essencial ausente = ativa com confiança baixa', () => {
    const h2 = avaliarV3(BIB, medirDe(SAUDAVEL, H2, { desconto_medio: 4, margem_contrib: 4 }), un, opts()).find(x => x.codigo === 'H-COM-002')!; expect(h2.estado).toBe('nao_avaliavel'); expect(h2.confianca.nivel).toBe('nao');
    const f = avaliarV3(BIB, medirDe(SAUDAVEL, { ...H1, recebiveis: null }), un, opts()).find(x => x.codigo === 'H-FIN-001')!; expect(f.estado).toBe('nao_avaliavel'); expect(f.faltando).toContain('recebiveis');
    const semPrazo = { ...H1 }; delete semPrazo.prazo_receb;
    const f1 = avaliarV3(BIB, medirDe(SAUDAVEL, semPrazo), un, opts()).find(x => x.codigo === 'H-FIN-001')!; expect(f1.ativo).toBe(true); expect(f1.faltando).toContain('prazo_receb'); expect(f1.confianca.nivel).toBe('baixa');
    expect(avaliarV3(BIB, medirDe(SAUDAVEL, { ...SAUDAVEL, cancelamentos: 0 }), un, opts()).find(x => x.codigo === 'H-SOL-014')!.estado).not.toBe('nao_avaliavel');
  });
  it('determinístico', () => {
    const j = (X: ReturnType<typeof avaliarV3>) => JSON.stringify(X.map(x => [x.codigo, x.estado, x.prioridade, x.impacto?.valor, x.confianca.nivel]));
    const m = medirDe(SAUDAVEL, { ...H2, custo_kit_desvio: 0.06 }); expect(j(avaliarV3(BIB, m, un, opts()))).toBe(j(avaliarV3(BIB, m, un, opts())));
  });
  it('composição emergente C-001: prioridade acima dos componentes, impacto = o maior (não a soma)', () => {
    const R = avaliarV3(BIB, medirDe(SAUDAVEL, { ...H1, vendas: 20, backlog: 16, prazo_inst: 40 }), un, opts());
    expect(ativos(R)).toContain('H-OPE-009'); const c1 = R.find(x => x.codigo === 'C-001')!;
    expect(c1.prioridade).toBeGreaterThan(R.find(x => x.codigo === 'H-FIN-001')!.prioridade); expect(c1.impacto!.valor).toBe(Math.max(30000, 16 * 20000 * 0.2));
  });
  it('histerese e modo sombra', () => {
    const R = avaliarV3(BIB, medirDe(SAUDAVEL, H1), un, opts()); const hist: Record<string, any> = {}; for (const x of R) if (!x.composto) hist[x.codigo] = x.hist;
    expect(R.find(x => x.codigo === 'H-FIN-001')!.novo).toBe(true); expect(hist['H-FIN-001'].ligada).toBe(true);
    let R2 = avaliarV3(BIB, medirDe(SAUDAVEL, SAUDAVEL), un, opts({ hist, agora: AGORA + 2 * DIA }));
    expect(R2.find(x => x.codigo === 'H-FIN-001')!.ligada).toBe(true); expect(R2.find(x => x.codigo === 'H-FIN-001')!.novo).toBe(false);
    expect(orcamentoDeAtencao(R2, {}, 5).visiveis.some(x => x.codigo === 'H-FIN-001')).toBe(true);
    R2 = avaliarV3(BIB, () => ({ estado: 'ausente' }), un, opts({ hist, agora: AGORA + 30 * DIA }));
    expect(R2.find(x => x.codigo === 'H-FIN-001')).toMatchObject({ ligada: true, estado: 'nao_avaliavel' }); expect(orcamentoDeAtencao(R2, {}, 5).visiveis.some(x => x.codigo === 'H-FIN-001')).toBe(false);
    R2 = avaliarV3(BIB, medirDe(SAUDAVEL, SAUDAVEL), un, opts({ hist, agora: AGORA + 20 * DIA })); const f = R2.find(x => x.codigo === 'H-FIN-001')!; expect(f.ligada === false || f.hist.abaixoDesde != null).toBe(true);
    R2 = avaliarV3(BIB, medirDe(SAUDAVEL, H1), un, opts({ regras: { 'H-FIN-001': { estado: 'sombra' } } }));
    expect(R2.find(x => x.codigo === 'H-FIN-001')!.sombra).toBe(true); expect(orcamentoDeAtencao(R2, {}, 5).visiveis.every(x => x.codigo !== 'H-FIN-001')).toBe(true); expect(orcamentoDeAtencao(R2, {}, 5).sombra.length).toBe(1);
    expect(avaliarV3(BIB, medirDe(SAUDAVEL, H1), un, opts({ regras: { 'H-FIN-001': { estado: 'aposentada' } } })).some(x => x.codigo === 'H-FIN-001')).toBe(false);
    expect(avaliarV3(BIB, medirDe(SAUDAVEL, H1), un, opts({ regras: { 'H-FIN-005': { estado: 'sombra' } } })).find(x => x.codigo === 'H-FIN-001')!.rivais.some(r => r.codigo === 'H-FIN-005')).toBe(false);
  });
  it('orçamento de atenção, marcas e expiração em 1,5×', () => {
    const R = avaliarV3(BIB, medirDe(SAUDAVEL, { ...H1, vendas: 20, backlog: 16, prazo_inst: 40 }), un, opts());
    let O = orcamentoDeAtencao(R, {}, 2); const exib = R.filter(x => !x.sombra && (x.composto ? x.ativo : (x.ligada && x.estado !== 'nao_avaliavel') || x.estado === 'parcial'));
    expect(O.visiveis.length).toBe(2); expect(O.visiveis.length + O.resto.length).toBe(exib.length);
    O = orcamentoDeAtencao(R, { 'C-001': { estado: 'naoprocede' } }, 2); expect(O.tratados.length).toBe(1); expect(O.visiveis.every(x => x.codigo !== 'C-001')).toBe(true);
    const R1 = avaliarV3(BIB, medirDe(SAUDAVEL, H1), un, opts()), imp0 = R1.find(x => x.codigo === 'H-FIN-001')!.impacto!.valor;
    expect(orcamentoDeAtencao(R1, { 'H-FIN-001': { estado: 'naoprocede', ref: imp0 } }, 5).tratados.some(x => x.codigo === 'H-FIN-001')).toBe(true);
    const O2 = orcamentoDeAtencao(R1, { 'H-FIN-001': { estado: 'naoprocede', ref: Math.round(imp0 / 2) } }, 5); expect(O2.visiveis.some(x => x.codigo === 'H-FIN-001')).toBe(true); expect(O2.tratados.some(x => x.codigo === 'H-FIN-001')).toBe(false);
  });
  it('receita vira contribuição pela margem; coorte estável não dispara; aditivas; contexto por área; calibração por métrica', () => {
    const R = avaliarV3(BIB, medirDe(SAUDAVEL, { ...SAUDAVEL, tx_fech: 0.12 }), un, opts()), a3 = R.find(x => x.codigo === 'H-COM-003')!;
    expect(a3.ativo).toBe(true); expect(a3.impacto!.dimensao).toBe('contribuicao'); expect(Math.abs(a3.impacto!.valor - 0.1 * 60 * 20000 * 0.26)).toBeLessThan(1); expect(a3.impacto).toMatchObject({ receitaBruta: 120000, margemUsada: 0.26 });
    expect(avaliarV3(BIB, medirDe(SAUDAVEL, SAUDAVEL), un, opts()).find(x => x.codigo === 'H-COM-003')!.ativo).toBe(false);
    expect(avaliarV3(BIB, medirDe(SAUDAVEL, { ...SAUDAVEL, leads: 520 }), un, opts()).find(x => x.codigo === 'H-COM-004')!.conds.find(c => c.met === 'leads')!.estado).toBe('verdadeiro');
    expect(avaliarV3(BIB, medirDe(SAUDAVEL, SAUDAVEL), un, opts()).find(x => x.codigo === 'H-SOL-017')!.ativo).toBe(false);
    const ev = { ts: AGORA - 5 * DIA, areas: ['Marketing'], data: '2026-10-03', desc: 'campanha' };
    expect(avaliarV3(BIB, medirDe(SAUDAVEL, H1), un, opts({ contexto: [ev] })).find(x => x.codigo === 'H-FIN-001')!.contexto.length).toBe(0);
    expect(avaliarV3(BIB, medirDe(SAUDAVEL, H1), un, opts({ contexto: [{ ...ev, areas: ['Financeiro'] }] })).find(x => x.codigo === 'H-FIN-001')!.contexto.length).toBe(1);
    expect(avaliarV3(BIB, medirDe(SAUDAVEL, H2), un, opts({ regras: { 'H-COM-002': { params: { desconto_medio: { limiar: 10 } } } } })).find(x => x.codigo === 'H-COM-002')!.ativo).toBe(false);
  });
  it('hipótese simples ("quando") convive com as estruturadas', () => {
    const bib: HipoteseV3[] = [{ chave: 'simples', titulo: 'Desconto alto', acao: 'rever alçada', quando: 'desconto_medio > 0.10', impacto: 'receita * desconto_medio', dimensao: 'contribuicao' }, { chave: 'sem_dado', titulo: 'Churn', acao: '', quando: 'churn_receita > 0.05', impacto: 'mrr_inicial' }];
    const R = avaliarV3(bib, () => ({ estado: 'ausente' }), un, opts({ ctx: { desconto_medio: 0.15, receita: 100000, churn_receita: null, mrr_inicial: null }, nSimples: 40 }));
    expect(R.find(x => x.codigo === 'simples')).toMatchObject({ ativo: true, estado: 'ativo' }); expect(R.find(x => x.codigo === 'simples')!.impacto!.valor).toBeCloseTo(15000);
    expect(R.find(x => x.codigo === 'sem_dado')).toMatchObject({ estado: 'nao_avaliavel' });
  });
});

describe('curva de caixa, pontos de equilíbrio, desenho de experimento e elegibilidade', () => {
  const SAI: Array<[number, number, string]> = [[2, 11000, 'kit'], [15, 2000, 'instalação'], [30, 1200, 'impostos'], [30, 600, 'comissão']];
  it('curva de caixa por condição de pagamento', () => {
    const c6 = simularCondicaoDeCaixa(20000, [[0, 0.6], [15, 0.2], [45, 0.2]], SAI), c7 = simularCondicaoDeCaixa(20000, [[0, 0.7], [15, 0.2], [45, 0.1]], SAI), c5 = simularCondicaoDeCaixa(20000, [[0, 0.5], [15, 0.3], [45, 0.2]], SAI), c3 = simularCondicaoDeCaixa(20000, [[0, 0.3], [15, 0.3], [45, 0.4]], SAI);
    expect(c6.pior).toBe(0); expect(c6.final).toBe(5200); expect(Math.min(...c6.pts.map(p => p.saldo))).toBe(1000);
    expect(Math.min(...c7.pts.map(p => p.saldo))).toBe(3000); expect(c5.pior).toBe(-1000); expect(c3).toMatchObject({ pior: -5000, diasNeg: 43, final: 5200 });
  });
  it('break-even do desconto e da entrada', () => {
    const be = breakEvenDescontoSimples(5000, 0.05, 20000, 0.2)!; expect(be.volPct).toBeCloseTo(25); expect(be.quedaMax).toBeCloseTo(0.2); expect(be.convEq).toBeCloseTo(0.16);
    const be2 = breakEvenEntrada(20000, 0.1, 45, 0.02, 5000, 0.2)!; expect(be2.ganhoPorVenda).toBeCloseTo(60); expect(be2.quedaMax).toBeCloseTo(0.012);
  });
  it('desenho de experimento aponta 6 lacunas; completo passa', () => {
    const des = desenhoDeExperimento({ id: 'a', ind: 'tx_fech', secundarios: [], esperado: null, ini: '2026-10-01', fim: '2026-10-10', grupo: '' }, { cicloDias: 45, outras: [{ id: 'b', ind: 'tx_fech', ini: '2026-10-05', fim: '2026-10-20', titulo: 'Outra' }], eventos: [{ data: '2026-10-03', desc: 'reajuste tarifário' }] });
    expect(des.ok).toBe(false); expect(des.avisos.length).toBe(6);
    expect(desenhoDeExperimento({ id: 'a', ind: 'tx_fech', secundarios: ['desconto_medio'], esperado: 0.25, ini: '2026-10-01', fim: '2026-12-01', grupo: 'leads de tráfego', pessoa: '' }, { cicloDias: 45, outras: [], eventos: [] }).ok).toBe(true);
  });
  it('elegibilidade', () => {
    expect(elegibilidade({ chave: 'x', impacto: { receita: '+', conversao: '0', risco: '− (menos risco)' } })).toBe('elegivel');
    expect(elegibilidade({ chave: 'x', impacto: { conversao: '−' } })).toBe('experimento');
    expect(elegibilidade({ chave: 'x', impacto: { conversao: '−' } }, { confirmadas: ['x'] })).toBe('elegivel');
    expect(elegibilidade({ chave: 'x', impacto: {} }, { breakEven: { x: false } })).toBe('inelegivel');
  });
});
