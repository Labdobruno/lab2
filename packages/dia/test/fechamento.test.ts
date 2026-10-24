/* Contrato: testes/daily_motor.test.js e daily_worker.test.js (regra do tique) da V1, com as chaves da V2 (tentativa = atividade diária). */
import { describe, expect, it } from 'vitest';
import { agoraLocal, amanha, classePendencia, comparar, decidirTique, diferencas, relatorioDoDia, situacao, VERSAO_FECHAMENTO, type Fotografia, type PessoaFoto, type ProdFoto } from '../src/fechamento.js';

const P = (n: string, o: Partial<PessoaFoto> = {}): PessoaFoto => ({ n, funcaoNome: 'Pré-vendas', trabalha: true, prod: [], semana: [], tarefas: { hoje: [], atrasadas: [], feitasHoje: 0, feitasHojePrazoHoje: 0 }, reunioes: [], avancos: [], plano: { registrado: true }, quad: { tipo: 'em_dia', tit: 'Dentro do plano' }, ...o });
const cont = (alvo: number, feito: number, x: Partial<ProdFoto> = {}): ProdFoto => ({ k: 'tentativa', alvo, feito, falta: Math.max(0, alvo - feito), diario: true, recup: 0, janela: 5, ...x });
const F0 = (o: Partial<Fotografia> = {}): Fotografia => ({ data: '2026-10-23', corte: Date.UTC(2026, 9, 23, 20, 30), corteHora: '17:30', plano: { status: 'ativo' }, fontes: { avisos: [] }, pessoas: [],
  equipe: { sistemicos: [], mes: { nome: 'Outubro', meta: 300000, realizado: 60000, esperado: 150000, projecao: 180000, sinais: [{ origem: 'meta', grav: 3, tit: 'Meta de receita em risco', oque: 'A projeção ajustada é R$ 180.000.', esperado: 'Meta R$ 300.000.', desvio: '−R$ 120.000' }] } }, historico: [], ...o });

describe('fechamento do dia: peças', () => {
  it('previsto × realizado: status; sem dado não vira zero', () => {
    expect(comparar({ k: 'x', nome: '', periodo: 'dia', previsto: 10, realizado: 10 }).status).toBe('atingido');
    expect(comparar({ k: 'x', nome: '', periodo: 'dia', previsto: 10, realizado: 9 }).status).toBe('perto');
    expect(comparar({ k: 'x', nome: '', periodo: 'dia', previsto: 10, realizado: 5 })).toMatchObject({ status: 'abaixo', dif: -5 });
    expect(comparar({ k: 'x', nome: '', periodo: 'dia', previsto: 10, realizado: null })).toMatchObject({ status: 'sem_dado', pct: null });
    expect(comparar({ k: 'x', nome: '', periodo: 'dia', previsto: 0, realizado: 3 }).status).toBe('sem_meta');
  });
  it('situação da pessoa: em dia, falta, sem registro (≠ não executou), bloqueio, resultado, fora do expediente', () => {
    expect(situacao(P('Ana', { prod: [cont(30, 30)] })).k).toBe('em_dia');
    expect(situacao(P('Ana', { prod: [cont(30, 10)] })).k).toBe('falta_execucao');
    const s = situacao(P('Ana', { prod: [cont(30, 0)] })); expect(s.k).toBe('sem_registro'); expect(s.txt).toMatch(/registro ainda não feito/);
    expect(situacao(P('Ana', { prod: [cont(30, 10)], tarefas: { hoje: [{ id: 'x', titulo: 'Aguardar laudo', terceiro: true }], atrasadas: [], feitasHoje: 0 } })).k).toBe('bloqueio');
    expect(situacao(P('Ana', { prod: [cont(30, 30)], quad: { tipo: 'resultado', tit: 'Insuficiência de resultado' } })).k).toBe('resultado');
    expect(situacao(P('Ana', { trabalha: false, prod: [cont(30, 0)] })).k).toBe('nao_trabalha');
  });
  it('pendências e carga de amanhã', () => {
    expect([classePendencia({ negFechado: true }), classePendencia({ terceiro: true }), classePendencia({ adiamentos: 2 }), classePendencia({ prioridade: 'alta' }), classePendencia({ diasAtraso: 3 }), classePendencia({})]).toEqual(['sem_validade', 'terceiro', 'decisao', 'prioridade', 'prioridade', 'reagendar']);
    expect(amanha({ amanha: { iso: '2026-10-24', cap: 40, metaContatos: 35, atrasoContatos: 20 } })!.st).toBe('sobrecarga');
    expect(amanha({ amanha: { iso: '2026-10-24', cap: 60, metaContatos: 35, atrasoContatos: 20 } })!.st).toBe('cabe');
    expect(amanha({ amanha: { iso: '2026-10-24', cap: null, metaContatos: 35, atrasoContatos: 0 } })!.st).toBe('sem_cap');
  });
  it('regra do tique e hora local', () => {
    expect(agoraLocal('America/Sao_Paulo', new Date(Date.UTC(2026, 9, 23, 20, 30))).hm).toBe('17:30');
    expect(agoraLocal('America/Sao_Paulo', new Date(Date.UTC(2026, 9, 24, 2, 50))).iso).toBe('2026-10-23');
    expect(decidirTique({ existe: false }, '17:15')).toBeNull(); expect(decidirTique({ existe: false }, '17:30')).toBe('agendado');
    expect(decidirTique({ existe: false, cfg: { hora: '18:00' } }, '17:45')).toBeNull(); expect(decidirTique({ existe: false, cfg: { hora: '18:00' } }, '18:00')).toBe('agendado');
    expect(decidirTique({ existe: false, cfg: { ativo: false } }, '18:00')).toBeNull();
    expect(decidirTique({ existe: true }, '20:00')).toBeNull(); expect(decidirTique({ existe: true }, '23:30')).toBe('complemento'); expect(decidirTique({ existe: true, complementado: true }, '23:45')).toBeNull();
    expect(decidirTique({ existe: false, rodando: true }, '18:00')).toBeNull(); expect(decidirTique({ existe: false, sem_expediente: true }, '18:00')).toBeNull();
    expect(decidirTique({ existe: false, falhas: 3 }, '18:00')).toBe('agendado'); expect(decidirTique({ existe: false, falhas: 4 }, '18:00')).toBeNull();
  });
});

describe('fechamento do dia: o relatório', () => {
  const ana = P('Ana Souza', { prod: [cont(30, 32)], semana: [{ k: 'agendamento', alvo: 5, feito: 3 }], tarefas: { hoje: [], atrasadas: [], feitasHoje: 2, feitasHojePrazoHoje: 2 }, avancos: [{ k: 'agendamento', neg: 'n1', nome: 'Cliente A', txt: 'Reunião agendada: Cliente A' }] });
  const pedro = P('Pedro Lima', { funcaoNome: 'Vendas', prod: [cont(20, 8)], viab: { st: 'inviavel', txt: 'Recuperação inviável…' }, capFonte: 'observada',
    tarefas: { hoje: [{ id: 't1', titulo: 'Enviar proposta', prazo: '2026-10-23' }], atrasadas: [{ id: 't2', titulo: 'Ligar Cliente X', prazo: '2026-10-20', adiamentos: 2, diasAtraso: 3 }, { id: 't3', titulo: 'Retornar Cliente Y', prazo: '2026-10-21', negFechado: true, negNome: 'Cliente Y' }], feitasHoje: 0, feitasHojePrazoHoje: 0 },
    reunioes: [{ id: 'a1', conduz: true, passou: true, status: 'noshow', cliente: 'Cliente B' }, { id: 'a2', conduz: true, passou: true, status: 'realizado', cliente: 'Cliente C' }, { id: 'a3', conduz: true, passou: true, status: 'agendado', cliente: 'Cliente D' }],
    avancos: [{ k: 'vendas', neg: 'n9', nome: 'Cliente Z', valor: 25000, txt: 'Venda: Cliente Z' }], amanha: { iso: '2026-10-24', cap: 25, metaContatos: 20, atrasoContatos: 12 } });
  const R = relatorioDoDia(F0({ pessoas: [ana, pedro] }));
  it('equipe: tentativas da equipe hoje (30+20 × 32+8), agendamentos só pela semana, rótulos e origem', () => {
    expect(R.v).toBe(VERSAO_FECHAMENTO);
    const cc = R.comparacoes.find(c => c.k === 'tentativa' && c.periodo === 'dia')!; expect(cc).toMatchObject({ previsto: 50, realizado: 40, status: 'abaixo' });
    expect(R.comparacoes.some(c => c.k === 'agendamento' && c.periodo === 'semana') && !R.comparacoes.some(c => c.k === 'agendamento' && c.periodo === 'dia')).toBe(true);
    expect(R.comparacoes.every(c => /(da|pela) equipe/.test(c.nome) && c.origem)).toBe(true);
  });
  it('pessoas, deu certo, deu errado, agenda, no-show, viabilidade, recomendações, pendências, metas, limitações', () => {
    expect(R.pessoas.find(x => x.n === 'Ana Souza')!.sit).toBe('em_dia'); expect(R.pessoas.find(x => x.n === 'Pedro Lima')!.sit).toBe('falta_execucao');
    expect(R.certo.some(x => /Ana Souza cumpriu/.test(x.tit)) && R.certo.some(x => /1 venda fechada hoje \(R\$ 25\.000/.test(x.tit))).toBe(true);
    expect(R.errado.some(e => /Pedro/.test(e.tit) && e.esperado && e.aconteceu && e.desvio && e.evidencia && e.causa && e.impacto && e.acao)).toBe(true);
    expect(R.limitacoes.some(l => /sem resultado registrado/.test(l.txt)) && R.comparacoes.find(c => c.k === 'agenda')!.realizado === 1).toBe(true);
    expect(R.alertas.find(a => a.chave === 'noshow')!.confianca).toMatch(/sinal a investigar/);
    expect(R.alertas.some(a => a.chave === 'viab:Pedro Lima' && a.nivel === 3) && R.recomendacoes[0]!.chave === 'viab:Pedro Lima' && /Decidir/.test(R.recomendacoes[0]!.acao)).toBe(true);
    expect(R.recomendacoes.every(r => r.problema && r.consequencia && r.acao && r.resp && r.prazo && r.indicador)).toBe(true);
    expect(R.recomendacoes.filter(r => /mes:/.test(r.chave)).every(r => /Planejamento/.test(r.acao))).toBe(true);
    const pd = R.pendencias; expect([pd.find(x => x.id === 't3')!.classe, pd.find(x => x.id === 't2')!.classe, pd.find(x => x.id === 't1')!.classe]).toEqual(['sem_validade', 'decisao', 'reagendar']);
    expect(pd.find(x => x.id === 't2')!.prazoOriginal).toBe('2026-10-20'); expect(R.recomendacoes.some(r => r.chave === 'pend:decisao')).toBe(true);
    expect(R.metas[0]).toMatchObject({ tipo: 'risco' }); expect(R.metas[0]!.situacao).toMatch(/R\$ 60\.000/); expect(R.metas[0]!.impacto).toMatch(/R\$ 120\.000/);
    expect(R.limitacoes.some(l => /quarter publicado/.test(l.txt))).toBe(true);
    expect(R.resumo).toMatchObject({ status: 'critico' }); expect(R.resumo.objetivos.total).toBeGreaterThan(0); expect(R.resumo.avanco).toMatch(/Venda: Cliente Z/);
    expect(R.pessoas.find(x => x.n === 'Pedro Lima')!.amanha!.st).toBe('sobrecarga');
    expect(R.alertas.every(a => a.tipo) && R.certo.every(a => a.tipo) && R.recomendacoes.every(a => a.tipo === 'recomendacao')).toBe(true);
  });
  it('quarter publicado: meta, projeção com e sem atrasos; avisos viram alertas; recorrência sobe nível', () => {
    const Rq = relatorioDoDia(F0({ pessoas: [ana], equipe: { sistemicos: [], mes: null, quarter: { nome: 'Q4 2026', meta: 900000, metaOriginal: 900000, realizado: 180000, projecao: 640000, projecaoComAtrasos: 600000, impactoAtrasos: 40000, risco: true, leitura: 'A projeção vigente fica R$ 260.000 abaixo da meta aprovada.', premissas: 'out: realizado; nov e dez: ritmo de 90 dias' } } }));
    expect(Rq.metas.some(m => m.tipo === 'risco' && /Receita no Q4 2026/.test(m.obj) && /R\$ 180\.000 contratados de R\$ 900\.000/.test(m.situacao) && /R\$ 600\.000 descontando/.test(m.projecao) && /ritmo de 90 dias/.test(m.premissas))).toBe(true);
    expect(Rq.alertas.some(a => a.chave === 'qtr:receita') && Rq.recomendacoes.some(r => r.chave === 'qtr:receita' && /revisão do quarter/.test(r.acao)) && !Rq.limitacoes.some(l => /quarter publicado/.test(l.txt))).toBe(true);
    const avQ = [{ id: 'lq:gat:2026-10:g1:2026-10', titulo: 'Gatilho disparado: Oportunidade → venda 15%', texto: 'Limite abaixo de 20%' }, { id: 'lq:marco:2026-10:i1:m1', titulo: 'Marco atrasado: Alerta de lead', texto: '"Responder na 1ª hora" · prazo 20/10/2026' }, { id: 'lq:prox:2027-01', titulo: 'O Q1 2027 começa em 9 dias e ainda não tem plano', texto: '' }];
    const Ra = relatorioDoDia(F0({ pessoas: [ana], equipe: { sistemicos: [], mes: null, quarter: { nome: 'Q4 2026', meta: 900000, realizado: 500000, projecao: 950000, risco: false, avisos: avQ } } }));
    const aq = (k: string) => Ra.alertas.find(a => a.chave === k)!;
    expect(aq('qtr:gat:2026-10:g1:2026-10')).toMatchObject({ tipo: 'risco', nivel: 2 }); expect(aq('qtr:marco:2026-10:i1:m1').nivel).toBe(1); expect(aq('qtr:prox:2027-01').nivel).toBe(1);
    expect(Ra.chaves).toContain('qtr:marco:2026-10:i1:m1'); expect(Ra.recomendacoes.find(r => r.chave === 'qtr:gat:2026-10:g1:2026-10')!.acao).toMatch(/fase 6/); expect(Ra.recomendacoes.find(r => r.chave === 'qtr:marco:2026-10:i1:m1')!.acao).toMatch(/fase 4/);
    const Ra2 = relatorioDoDia(F0({ pessoas: [ana], equipe: { sistemicos: [], mes: null, quarter: { nome: 'Q4 2026', meta: 900000, realizado: 500000, projecao: 950000, risco: false, avisos: avQ } }, historico: [{ data: '2026-10-21', chaves: ['qtr:marco:2026-10:i1:m1'], acoes: {} }, { data: '2026-10-22', chaves: ['qtr:marco:2026-10:i1:m1'], acoes: {} }] }));
    expect(Ra2.alertas.find(a => a.chave === 'qtr:marco:2026-10:i1:m1')!.nivel).toBeGreaterThanOrEqual(2);
  });
  it('determinismo, recorrência (3º relatório seguido, decisão registrada), resolvido depois da intervenção, histórico do próprio dia ignorado', () => {
    expect(JSON.stringify(relatorioDoDia(F0({ pessoas: [ana, pedro] })))).toBe(JSON.stringify(R));
    const H = [{ data: '2026-10-21', chaves: ['dia:tentativa:Pedro Lima'], acoes: { 'dia:tentativa:Pedro Lima': { estado: 'decidida', texto: 'combinado bloco das 9h' } } }, { data: '2026-10-22', chaves: ['dia:tentativa:Pedro Lima'] }];
    const R2 = relatorioDoDia(F0({ pessoas: [ana, pedro], historico: H })), a2 = R2.alertas.find(a => a.chave === 'dia:tentativa:Pedro Lima')!;
    expect(a2.recorrencia!.seguidos).toBe(2); expect(a2.contexto).toMatch(/3º relatório seguido/); expect(a2.contexto).toMatch(/Recorrente/);
    expect(a2.nivel).toBeGreaterThan(R.alertas.find(a => a.chave === 'dia:tentativa:Pedro Lima')!.nivel);
    expect(a2.contexto).toMatch(/decisão registrada em 21\/10 e o desvio continua/);
    expect(R2.recomendacoes.some(r => r.chave === 'dia:tentativa:Pedro Lima' && /causa/.test(r.acao))).toBe(true);
    const R3 = relatorioDoDia(F0({ pessoas: [ana, { ...pedro, prod: [cont(20, 22)], viab: null }], historico: H }));
    expect(R3.certo.some(x => /não aparece hoje/.test(x.tit) && /Um dia não prova/.test(x.porque))).toBe(true);
    expect(relatorioDoDia(F0({ pessoas: [pedro], historico: [{ data: '2026-10-23', chaves: ['dia:tentativa:Pedro Lima'] }] })).alertas.find(a => a.chave === 'dia:tentativa:Pedro Lima')!.recorrencia!.seguidos).toBe(0);
    const Dif = diferencas(R, R3);
    expect(Dif.some(x => /Tentativas de contato da equipe hoje: 40\/50 → 54\/50/.test(x)) && Dif.some(x => /alerta saiu: dia:tentativa:Pedro Lima/.test(x))).toBe(true);
    expect(diferencas(R, R)).toHaveLength(0);
  });
  it('seletividade: padrão dentro do alerta do dia; causa sistêmica substitui as individuais, exceto "sem registro"; incompletos', () => {
    const pad = { recorrente: true, abaixo: 8, n: 10, k: 'tentativa' };
    const Rp = relatorioDoDia(F0({ pessoas: [P('Ana', { prod: [cont(30, 10)], padrao: pad }), P('Bia', { prod: [cont(30, 12)], padrao: pad })] })), aA = Rp.alertas.filter(a => a.p === 'Ana');
    expect(aA).toHaveLength(1); expect(aA[0]!.tit).toMatch(/8 de 10 dias úteis/); expect(aA[0]!.nivel).toBe(2); expect(Rp.alertas.some(a => a.chave === 'padrao:Ana')).toBe(false);
    expect(relatorioDoDia(F0({ pessoas: [P('Ana', { prod: [cont(30, 30)], padrao: pad })] })).alertas.some(a => a.chave === 'padrao:Ana')).toBe(true);
    expect(Rp.recomendacoes.some(r => r.chave === 'dia:tentativa:Ana' && /causa/.test(r.acao))).toBe(true);
    const sis = { sistemicos: [{ chave: 'atividade', nome: 'Volume de atividade', pessoas: ['Ana', 'Bia'] }] };
    const Rs = relatorioDoDia(F0({ pessoas: [P('Ana', { prod: [cont(30, 10)], padrao: pad }), P('Bia', { prod: [cont(30, 12)], padrao: pad })], equipe: sis }));
    expect(Rs.recomendacoes.some(r => r.chave === 'sis:atividade' && /Ana, Bia/.test(r.evidencia)) && !Rs.recomendacoes.some(r => r.chave === 'dia:tentativa:Ana' || r.chave === 'dia:tentativa:Bia')).toBe(true);
    expect(relatorioDoDia(F0({ pessoas: [P('Ana', { prod: [cont(30, 0)], padrao: pad }), P('Bia', { prod: [cont(30, 12)], padrao: pad })], equipe: sis })).recomendacoes.some(r => r.chave === 'dia:tentativa:Ana' && /Confirmar com Ana/.test(r.acao))).toBe(true);
    const R4 = relatorioDoDia(F0({ pessoas: [P('Eduardo', { prod: [cont(25, 0)], plano: { registrado: false } })], plano: { status: 'sem_plano' }, fontes: { indisponiveis: ['WhatsApp'], avisos: ['Conector do WhatsApp sem sinal desde 14:10.'] }, equipe: { sistemicos: [] } }));
    expect(R4.limitacoes.some(l => /Sem metas no ciclo/.test(l.txt)) && R4.limitacoes.some(l => /WhatsApp não está disponível/.test(l.txt)) && R4.limitacoes.some(l => /sem sinal/.test(l.txt)) && R4.limitacoes.some(l => /não registrado hoje por Eduardo/.test(l.txt))).toBe(true);
    expect(R4.alertas.find(a => a.chave === 'dia:tentativa:Eduardo')!.confianca).toMatch(/baixa/); expect(R4.recomendacoes.some(r => /Confirmar com Eduardo/.test(r.acao))).toBe(true);
    expect(relatorioDoDia(F0({ pessoas: [] })).resumo.status).toBe('sem_dado');
  });
});
