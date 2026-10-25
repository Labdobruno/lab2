/* Onda 5 no banco: modelo observado por coorte, publicação imutável, monitor real, construtor por sujeito, perguntas e experimento. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import { criarOperacao } from '@lab/conectores';
import { publicarPolitica } from '@lab/economia';
import { operacao, type Operacao } from '@lab/planejamento';
import {
  apagarPergunta, capacidadeDeLeads, coorteReal, ErroDeStudio, levarPremissasAoPlano, modeloDoStudio, modeloDoSujeito, modeloObservado, modelos, monitorDoModelo, parametros, perguntasSalvas,
  preencherPeloHistorico, publicarModelo, salvarModelo, salvarPergunta, simularConstrutor, simularModelo, sujeitos, virarExperimento,
} from '../src/index.js';
import { bancoLimpo, catalogo, semBanco } from '../../conectores/test/ajuda.js';

const HOJE = '2026-10-24', AGORA = Date.parse('2026-10-24T12:00:00Z'), DE = '2026-09-01';
const falha = async (p: Promise<unknown>) => (await p.then(() => null, e => e)) as ErroDeStudio | null;

describe.skipIf(semBanco)('Studio Onda 5 no banco', () => {
  let sql: postgres.Sql, op: Operacao, ana: string, bia: string;
  beforeAll(async () => {
    sql = await bancoLimpo();
    await criarOperacao(sql, { slug: 'st', nome: 'St', packId: 'base' }, catalogo());
    op = (await operacao(sql, 'st'))!;
    const ps = await sql<{ id: string; nome: string }[]>`insert into lab.pessoa (operacao_id, nome, funcao) values (${op.id}, 'Ana', 'closer'), (${op.id}, 'Bia', 'closer') returning id, nome`;
    ana = ps.find(p => p.nome === 'Ana')!.id; bia = ps.find(p => p.nome === 'Bia')!.id;
    const [funil] = await sql<{ id: string }[]>`select id from lab.funil where operacao_id = ${op.id} and principal`;
    const et = Object.fromEntries((await sql<{ id: string; chave: string }[]>`select id, chave from lab.etapa where operacao_id = ${op.id}`).map(e => [e.chave, e.id]));
    const canal = Object.fromEntries((await sql<{ id: string; chave: string }[]>`select id, chave from lab.canal where operacao_id = ${op.id}`).map(c => [c.chave, c.id]));
    const [motivo] = await sql<{ id: string }[]>`select id from lab.motivo_perda where operacao_id = ${op.id} and chave = 'preco'`;
    /* 20 leads criados em setembro (Ana 12, Bia 8; 15 pagos, 5 indicação): todos chegam a contato; 12 agendam; 8 realizam; 6 recebem proposta; 4 negociam; 3 ganham.
       Quem parou: perdido (com motivo preço) ou aberto há muito tempo (elegível); um aberto recente em agendada fica pendente. */
    const ESC = ['lead', 'contato', 'agendada', 'realizada', 'proposta', 'negociacao', 'ganho'], chegou = [20, 20, 12, 8, 6, 4, 3];
    for (let i = 0; i < 20; i++) {
      let al = 0; for (let j = 1; j < ESC.length; j++) if (i < chegou[j]!) al = j;
      const ganho = al === 6, perdido = !ganho && i % 2 === 0 && al > 0, recente = i === 11;   // i=11 parou em agendada (al=2), aberto recente
      const criado = `2026-09-${String(5 + (i % 20)).padStart(2, '0')}T12:00:00Z`, desde = recente ? '2026-10-22T12:00:00Z' : `2026-09-${String(10 + (i % 15)).padStart(2, '0')}T12:00:00Z`;
      const [n] = await sql<{ id: string }[]>`insert into lab.negocio (operacao_id, funil_id, canal_id, dono_id, etapa_id, etapa_desde, status, valor_fechado, criado_em, fechado_em, motivo_perda_id)
        values (${op.id}, ${funil!.id}, ${canal[i < 15 ? 'pago' : 'indicacao']!}, ${i < 12 ? ana : bia}, ${ganho ? et.ganho! : perdido ? et.perdido! : et[ESC[al]!]!}, ${desde}, ${ganho ? 'ganho' : perdido ? 'perdido' : 'aberto'},
                ${ganho ? [10000, 12000, 8000][i]! : null}, ${criado}, ${ganho || perdido ? '2026-10-01T12:00:00Z' : null}, ${perdido ? motivo!.id : null}) returning id`;
      for (let j = 1; j <= al; j++) await sql`insert into lab.negocio_transicao (operacao_id, negocio_id, de_etapa_id, para_etapa_id, em, origem) values (${op.id}, ${n!.id}, ${et[ESC[j - 1]!]!}, ${et[ESC[j]!]!}, ${`2026-09-${String(6 + j + (i % 10)).padStart(2, '0')}T12:00:00Z`}, 'evento')`;
      if (perdido) await sql`insert into lab.negocio_transicao (operacao_id, negocio_id, de_etapa_id, para_etapa_id, em, origem) values (${op.id}, ${n!.id}, ${et[ESC[al]!]!}, ${et.perdido!}, '2026-10-01T12:00:00Z', 'evento')`;
    }
    await sql`insert into lab.investimento_canal (operacao_id, canal_id, mes, valor, impressoes, cliques) values (${op.id}, ${canal.pago!}, '2026-09-01', 6000, 300000, 3000), (${op.id}, ${canal.pago!}, '2026-10-01', 4000, 200000, 2000)`;
    await publicarPolitica(sql, op.id, { margemAlvo: 0.3, margemMinima: 0.2, custosFixosMes: 30000, comissao: { tipo: 'fixa', alvo: 0.05 }, linhas: [{ chave: 'imposto', nome: 'Imposto', grupo: 'deducao', base: 'percentual_preco', valor: 0.1 }] }, 'Bruno', 'política de teste');
  });
  afterAll(async () => { await sql?.end(); });

  it('modelo observado: funil principal em blocos com as taxas da coorte, volume por 30 dias e ticket', async () => {
    const o = await modeloObservado(sql, op, HOJE);
    expect(o.coorte).toBe(20);
    const M = o.modelo, P = parametros(M);
    expect(Object.keys(P.nos)).toEqual(expect.arrayContaining(['lead', 'contato', 'agendada', 'ganho', 'perdido']));
    expect(P.nos.lead!.tipo).toBe('entrada'); expect(P.nos.ganho!.tipo).toBe('resultado'); expect(P.nos.perdido!.tipo).toBe('perda');
    expect(P.arestas.a0!.taxa).toBe(1); expect(P.arestas.a0!.n).toBe(20); expect(P.arestas.a0!.fonte).toBe('historico');
    expect(P.arestas.a1!.taxa).toBeCloseTo(0.6); expect(P.arestas.a5!.taxa).toBeCloseTo(0.75);   // negociação → venda 3 de 4
    expect(P.nos.ganho!.ticket).toBe(10000); expect(P.nos.lead!.vol).toBeGreaterThan(0);
    const R = await simularModelo(sql, op, { doc: M, meta: 3, comPipeline: true }, HOJE);
    expect(R.alvo).toBe('ganho'); expect(R.direto!.ok).toBe(true); expect(R.reverso!.ok).toBe(true); expect(R.reverso!.rendimento!.lead).toBeCloseTo(0.15);
    expect(Object.keys(R.estoque).length).toBeGreaterThan(0);   // pipeline aberto entra como estoque
    expect(R.comparacao[0]!.cen).toBe('base');
  });

  it('salvar versiona, publicar congela e valida; preencher pelo histórico respeita o que foi desenhado', async () => {
    const doc = { nos: { L: { tipo: 'entrada', nome: 'Leads', bind: { etapa: 'lead' } }, A: { tipo: 'etapa', nome: 'Agendadas', bind: { etapa: 'agendada' } }, V: { tipo: 'resultado', nome: 'Vendas', ticket: 9000, bind: { etapa: 'ganho' } }, X: { tipo: 'etapa', nome: 'Sem vínculo' } },
      arestas: { la: { de: 'L', para: 'A', taxa: 0.5, fonte: 'premissa' }, av: { de: 'A', para: 'V', taxa: null }, ax: { de: 'A', para: 'X', taxa: 0.1 } }, cenarios: { otimista: { nome: 'Otimista', regras: { 'a:la.taxa': { v: 0.7, fonte: 'hipotese' } } } } };
    expect((await falha(salvarModelo(sql, op, '', doc, 'Bruno')))!.message).toMatch(/nome/);
    expect((await falha(salvarModelo(sql, op, 'Ruim', { nos: { a: { tipo: 'xyz' } }, arestas: {} }, 'Bruno')))!.message).toMatch(/tipo deve ser/);
    const s1 = await salvarModelo(sql, op, 'Meu modelo', doc, 'Bruno'); expect(s1.versao).toBe(1); expect(s1.validacao.some(v => v.cod === 'sem_taxa')).toBe(true);
    expect((await salvarModelo(sql, op, 'Meu modelo', doc, 'Bruno')).versao).toBe(2);
    /* publicar com taxa faltando é permitido (aviso), mas publicar com erro não */
    const comErro = structuredClone(doc); (comErro.arestas as any).ax.taxa = 1.5; await salvarModelo(sql, op, 'Com erro', comErro, 'Bruno');
    expect((await falha(publicarModelo(sql, op, 'Com erro', { validadeDe: DE, validadeAte: '2026-10-31' }, 'Bruno')))!.message).toMatch(/erros de validação/);
    expect((await falha(publicarModelo(sql, op, 'Meu modelo', { validadeDe: '2026-10-31', validadeAte: DE }, 'Bruno')))!.message).toMatch(/termina antes/);
    const p1 = await publicarModelo(sql, op, 'Meu modelo', { validadeDe: DE, validadeAte: '2026-10-31', meta: 3 }, 'Bruno');
    expect(p1.n).toBe(1); expect(p1.alvo).toBe('V'); expect(p1.meta).toBe(3);
    expect((await falha(publicarModelo(sql, op, 'Meu modelo', { validadeDe: DE, validadeAte: '2026-10-31', cenario: 'otimista' }, 'Bruno')))!.message).toMatch(/motivo/);
    const p2 = await publicarModelo(sql, op, 'Meu modelo', { validadeDe: DE, validadeAte: '2026-10-31', cenario: 'otimista', motivo: 'testar a hipótese otimista' }, 'Bruno'); expect(p2.n).toBe(2);
    await expect(sql`update lab.studio_publicacao set meta = 99 where id = ${p1.id}`).rejects.toThrow(/acréscimo/);
    await expect(sql`delete from lab.studio_modelo where nome = 'Meu modelo'`).rejects.toThrow(/arquivado/);
    const lista = await modelos(sql, op); expect(lista.find(m => m.nome === 'Meu modelo')).toMatchObject({ versao: 2, status: 'publicado', publicacoes: 2 });
    const det = await modeloDoStudio(sql, op, 'Meu modelo', HOJE); expect(det.vigente).toBe(2); expect(det.publicacoes.length).toBe(2);
    /* preencher pelo histórico: la e av ganham taxa da coorte; ax (sem vínculo) fica como está; o volume de L vem dos leads */
    const pr = await preencherPeloHistorico(sql, op, det.doc, HOJE);
    expect(pr.mudou).toEqual(expect.arrayContaining(['a:la', 'a:av', 'n:L'])); expect(pr.mudou).not.toContain('a:ax');
    expect(pr.modelo.arestas!.la!.taxa).toBeCloseTo(0.6); expect(pr.modelo.arestas!.av!.taxa).toBeCloseTo(0.25); expect(pr.modelo.arestas!.ax!.taxa).toBe(0.1);
  });

  it('coorte real por vínculo: cada negócio conta uma vez; saldo, prazo, motivos e canais; monitor da publicação vigente', async () => {
    const det = await modeloDoStudio(sql, op, 'Meu modelo', HOJE), P = parametros(det.doc);
    const obs = await coorteReal(sql, op, P, DE, HOJE, HOJE);
    expect(obs.nos!.L).toMatchObject({ estado: 'ok', entradas: 20 }); expect(obs.nos!.A).toMatchObject({ estado: 'ok', entradas: 12 }); expect(obs.nos!.V).toMatchObject({ estado: 'ok', entradas: 3 });
    expect(obs.nos!.X!.estado).toBe('semvinculo');
    expect(obs.nos!.L!.porCanal).toMatchObject({ 'Mídia paga': 15, Indicação: 5 });
    expect(obs.nos!.A!.saldo).toBe(2); expect(obs.nos!.A!.acimaPrazo).toBe(1);   // dois abertos em agendada: um antigo (acima do prazo), um recente
    expect(obs.arestas!.la).toMatchObject({ estado: 'ok', k: 12, n: 20 }); expect(obs.arestas!.av).toMatchObject({ estado: 'ok', k: 3, n: 12 });
    expect(obs.arestas!.ax!.estado).toBe('semvinculo');
    const mon = await monitorDoModelo(sql, op, 'Meu modelo', HOJE);
    expect(mon.publicacao.n).toBe(2); expect(mon.periodo.dias).toBe(61);
    expect(mon.monitor.nos.L!.real).toBe(20); expect(mon.monitor.arestas.la!.estado).toBe('atencao');   // 60% observado contra 70% do cenário otimista (n=20: o intervalo ainda alcança 70%)
    expect(mon.monitor.arestas.ax!.estado).toBe('insuficiente');
    expect(mon.monitor.diags.some(d => d.tipo === 'conversao_baixa')).toBe(true);
    expect((await falha(monitorDoModelo(sql, op, 'Com erro', HOJE)))!.status).toBe(409);
  });

  it('premissas ao plano do quarter: as taxas do modelo publicado entram em quarter_estrategia.doc.premissas', async () => {
    const r = await levarPremissasAoPlano(sql, op, 'Meu modelo', HOJE, 'Bruno');
    expect(r.premissas.ticket).toBe(9000); expect(r.premissas.taxas['leads>agendamento']).toBeCloseTo(0.7);   // cenário otimista publicado
    expect(r.premissas.taxas['leads>vendas']).toBeNull; expect(r.faltam.length).toBeGreaterThan(0);                 // sem bloco realizada/oportunidade
    const [q] = await sql<{ doc: any }[]>`select doc from lab.quarter_estrategia where operacao_id = ${op.id}`;
    expect(q!.doc.premissas.origem).toMatchObject({ tipo: 'studio', modelo: 'Meu modelo', publicacao: 2 });
    expect((await falha(levarPremissasAoPlano(sql, op, 'Com erro', HOJE, 'Bruno')))!.status).toBe(409);
  });

  it('construtor: sujeitos, estado medido por coorte elegível, margem pela política e marketing por canal', async () => {
    const S = await sujeitos(sql, op, DE, HOJE);
    expect(S.map(s => s.id)).toEqual(expect.arrayContaining(['equipe', 'v:' + ana, 'v:' + bia, 'c:pago', 'c:indicacao']));
    const M = await modeloDoSujeito(sql, op, 'equipe', DE, HOJE, AGORA);
    expect(M.L).toBe(20); expect(M.nTicket).toBe(3); expect(M.ticket).toBe(10000); expect(M.nVend).toBe(2);
    expect(M.conv[0]).toBe(1); expect(M.conv[1]).toBeCloseTo(0.6);                 // contato → agendada: 12 de 20 (todos elegíveis)
    expect(M.conv[2]).toBeCloseTo(8 / 11); expect(M.convInfo!.pend![2]).toBe(1);     // o aberto recente em agendada fica de fora
    expect(M.mk).toBe(true); expect(M.inv).toBe(10000); expect(M.Lp).toBe(15); expect(M.imp).toBe(500000);
    expect(M.margemEstimada).toBe(true); expect(M.mPct).toBeGreaterThan(0.2); expect(M.comPct).toBeCloseTo(0.9 * 0.05); expect(M.impPct).toBeCloseTo(0.1);
    expect(M.fixos).toBeGreaterThan(30000); expect(M.fontes!.margem).toMatch(/política/);
    const A = await modeloDoSujeito(sql, op, 'v:' + ana, DE, HOJE, AGORA); expect(A.L).toBe(12); expect(A.nVend).toBe(1); expect(A.mk).toBe(false);
    const C = await modeloDoSujeito(sql, op, 'c:pago', DE, HOJE, AGORA); expect(C.L).toBe(15); expect(C.Lp).toBe(15); expect(C.inv).toBe(10000);
    expect(await capacidadeDeLeads(sql, op, 'equipe', HOJE)).toBe(20);
  });

  it('construtor: a pergunta completa com frase, quanto precisa, sensibilidade, pares; erros amigáveis', async () => {
    const R = await simularConstrutor(sql, op, { sujeito: 'equipe', de: DE, ate: HOJE, res: 'R', clausulas: [{ ind: 'p:neg', op: 'maior', num: 10, un: 'pp' }], meta: { ind: 'ticket', alvo: 60000 } }, HOJE, AGORA);
    expect(R.erros).toEqual([]); expect(R.linhas[0]!.cl.ind).toBe('r:5:6');
    expect(R.S.R!).toBeGreaterThan(R.M.R!); expect(R.frase).toBe('Se a conversão negociação → venda fosse maior em 10 p.p., qual seria o impacto na receita?');
    expect(R.meta).toMatchObject({ ind: 'ticket', res: 'R' }); expect((R.meta as any).v).toBeGreaterThan(0);
    expect(R.sensibilidade!.pontos.length).toBe(7); expect(R.formatos.R![0]).toMatch(/^R\$/);
    expect(R.catalogo.some(x => x.k === 'inv')).toBe(true); expect(R.catalogo.some(x => x.k === 'fixos')).toBe(true);
    const P = await simularConstrutor(sql, op, { sujeito: 'v:' + ana, de: DE, ate: HOJE, res: 'V', clausulas: [{ ind: 'ticket', op: 'igual', ref: 'mediana' }] }, HOJE, AGORA);
    expect(P.erros.length + P.comparacao.length).toBeGreaterThan(0);   // ou a mediana dos vendedores tem amostra, ou o erro explica
    expect((await falha(simularConstrutor(sql, op, { sujeito: 'v:nao-existe', clausulas: [] }, HOJE)))!.status).toBe(404);
    const MK = await simularConstrutor(sql, op, { sujeito: 'v:' + ana, de: DE, ate: HOJE, clausulas: [{ ind: 'cpl', op: 'menor', num: 10, un: '%' }] }, HOJE, AGORA);
    expect(MK.erros[0]).toMatch(/marketing é medido por canal/);
    expect((await falha(simularConstrutor(sql, op, { clausulas: [{ ind: 'ticket', op: 'xyz' }] }, HOJE)))!.message).toMatch(/operador/);
  });

  it('perguntas salvas e a pergunta que vira experimento', async () => {
    const p = await salvarPergunta(sql, op, { nome: 'Fechamento +10pp', sujeito: 'equipe', periodo: { ciclos: 2 }, clausulas: [{ ind: 'p:fech', op: 'maior', num: 10, un: 'pp' }], res: 'R' }, 'Bruno');
    expect((await perguntasSalvas(sql, op))[0]).toMatchObject({ id: p.id, nome: 'Fechamento +10pp', periodo: { ciclos: 2 } });
    expect((await falha(salvarPergunta(sql, op, { nome: 'x', clausulas: [] }, 'Bruno')))!.message).toMatch(/condição/);
    const x = await virarExperimento(sql, op, HOJE, { sujeito: 'equipe', de: DE, ate: HOJE, clausulas: [{ ind: 'ticket', op: 'maior', num: 10, un: '%' }], fimPrevisto: '2026-12-31' });
    expect(x.metrica).toBe('ticket_medio'); expect(x.alvo).toBeCloseTo(11000); expect(x.experimento.status).toBe('rodando');
    const y = await virarExperimento(sql, op, HOJE, { sujeito: 'equipe', de: DE, ate: HOJE, clausulas: [{ ind: 'p:neg', op: 'maior', num: 10, un: 'pp' }] });
    expect(y.metrica).toBe('passo_ganho'); expect(y.experimento.titulo).toMatch(/^Se a conversão/);
    expect((await falha(virarExperimento(sql, op, HOJE, { clausulas: [{ ind: 'cx', op: 'chegasse', num: 50 }] })))!.message).toMatch(/métrica acompanhável/);
    await apagarPergunta(sql, op, p.id); expect(await perguntasSalvas(sql, op)).toEqual([]);
    expect((await falha(apagarPergunta(sql, op, p.id)))!.status).toBe(404);
  });
});
