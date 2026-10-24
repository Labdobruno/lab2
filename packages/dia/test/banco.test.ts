import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import { criarOperacao } from '@lab/conectores';
import { acrescentarMetas, operacao, cicloDaOperacao } from '@lab/planejamento';
import {
  acaoFechamento, ausencias, cicloDoDia, contextoDoDia, projecaoDaSemana, relatorioDaSemana, gerarFechamento, lerFechamento, listaFechamentos, statusRotina, tiqueFechamento, dadosDoDia, definirCapacidade, desfazerLancamento, equipeDoDia, ErroDoDia, fotosDoDia, gravarFoto, justificar, lancamentos, lancar,
  marcarAusencia, marcarFeito, metasDiarias, metasDiariasDaPessoa, montarPessoa,
} from '../src/index.js';
import { bancoLimpo, catalogo, semBanco } from '../../conectores/test/ajuda.js';

const falha = async (p: Promise<unknown>) => (await p.then(() => null, e => e)) as ErroDoDia | null;
const HOJE = '2026-10-14', AGORA = new Date('2026-10-14T11:00:00Z');   // quarta; 12/10 é feriado; Sara folga dia 13

describe.skipIf(semBanco)('plano do dia no banco', () => {
  let sql: postgres.Sql, opId: string, sara: string, caio: string, lead: string, proposta: string;
  beforeAll(async () => {
    sql = await bancoLimpo();
    await criarOperacao(sql, { slug: 'd', nome: 'D', packId: 'base' }, catalogo());
    const op = (await operacao(sql, 'd'))!; opId = op.id;
    const ps = await sql<{ id: string; nome: string }[]>`insert into lab.pessoa (operacao_id, nome, funcao) values (${opId}, 'Sara', 'sdr'), (${opId}, 'Caio', 'closer'), (${opId}, 'Gil', 'gestor') returning id, nome`;
    sara = ps.find(p => p.nome === 'Sara')!.id; caio = ps.find(p => p.nome === 'Caio')!.id;
    await acrescentarMetas(sql, opId, '2026-10-01', [
      { indicador: 'receita', valor: 100000 }, { indicador: 'vendas', valor: 5 },
      { indicador: 'tentativa', pessoaId: sara, valor: 220 }, { indicador: 'agendamento', pessoaId: sara, valor: 22 },
      { indicador: 'reuniao_realizada', pessoaId: caio, valor: 20 }, { indicador: 'vendas', pessoaId: caio, valor: 4 },
    ]);
    await sql`insert into lab.pessoa_ausencia (operacao_id, pessoa_id, data, motivo) values (${opId}, ${sara}, '2026-10-13', 'folga')`;
    const tipo = async (papel: string) => (await sql<{ id: string }[]>`select id from lab.tipo_atividade where operacao_id = ${opId} and papel = ${papel} limit 1`)[0]!.id;
    const tT = await tipo('tentativa'), tA = await tipo('agendamento');
    /* Sara: 1/10 a 9/10 (7 dias úteis) fez 10 tentativas por dia; hoje 4 até agora; 2 agendamentos */
    for (const d of ['01', '02', '05', '06', '07', '08', '09']) await sql`insert into lab.atividade (operacao_id, tipo_id, pessoa_id, em, quantidade) values (${opId}, ${tT}, ${sara}, ${`2026-10-${d}T13:00:00Z`}, 10)`;
    await sql`insert into lab.atividade (operacao_id, tipo_id, pessoa_id, em, quantidade) values (${opId}, ${tT}, ${sara}, '2026-10-14T10:30:00Z', 4), (${opId}, ${tA}, ${sara}, '2026-10-06T13:00:00Z', 2)`;
    /* negócios: um lead novo da Sara sem contato (30 h) e uma proposta do Caio parada há 10 dias */
    const [funil] = await sql<{ id: string }[]>`select id from lab.funil where operacao_id = ${opId} and principal`;
    const etapa = async (chave: string) => (await sql<{ id: string }[]>`select id from lab.etapa where operacao_id = ${opId} and chave = ${chave}`)[0]!.id;
    const [l] = await sql<{ id: string }[]>`insert into lab.negocio (operacao_id, funil_id, dono_id, etapa_id, etapa_desde, criado_em, valor_estimado, atributos)
      values (${opId}, ${funil!.id}, ${sara}, ${await etapa('lead')}, '2026-10-13T05:00:00Z', '2026-10-13T05:00:00Z', 15000, ${sql.json({ cliente: 'Padaria Sol' })}) returning id`;
    lead = l!.id;
    const [p] = await sql<{ id: string }[]>`insert into lab.negocio (operacao_id, funil_id, dono_id, etapa_id, etapa_desde, criado_em, valor_estimado, atributos)
      values (${opId}, ${funil!.id}, ${caio}, ${await etapa('proposta')}, '2026-10-04T12:00:00Z', '2026-09-20T12:00:00Z', 30000, ${sql.json({ cliente: 'Mercado Lua' })}) returning id`;
    proposta = p!.id;
  });
  afterAll(async () => { await sql?.end(); });

  it('metas diárias da pessoa: inteiras, nos dias úteis dela (sem a ausência), mínimo 1 na etapa principal', async () => {
    const op = (await operacao(sql, 'd'))!;
    const ctx = await contextoDoDia(sql, op, HOJE, 'manha', AGORA);
    expect(ctx.diarias).toEqual(['tentativa']);
    expect(ctx.ticket).toEqual({ v: 20000, fonte: 'meta de receita ÷ meta de vendas do ciclo' });
    const p = ctx.pessoas.find(x => x.nome === 'Sara')!, M = metasDiariasDaPessoa(ctx, p);
    const uteisOp = cicloDaOperacao(op, HOJE).uteis;
    expect(uteisOp).not.toContain('2026-10-12');                    // feriado
    expect(M.uteis).toEqual(uteisOp.filter(d => d !== '2026-10-13'));
    expect(M.metaCiclo).toEqual({ tentativa: 220, agendamento: 22 });
    expect(Object.values(M.porDia).every(m => Number.isInteger(m.tentativa) && Number.isInteger(m.agendamento))).toBe(true);
    expect(Object.values(M.porDia).every(m => m.agendamento! >= 1)).toBe(true);
    expect(M.porDia['2026-10-13']).toBeUndefined();
    expect(M.porDia[HOJE]!.tentativa).toBe(metasDiarias(220, M.uteis)[HOJE]);
  });

  it('o plano da manhã da Sara: alvo = meta de hoje + recuperação, lead sem contato, "se não fizer"', async () => {
    const op = (await operacao(sql, 'd'))!;
    const D = await dadosDoDia(sql, op, sara, HOJE, 'manha', AGORA);
    expect(D.pessoa).toMatchObject({ nome: 'Sara', funcaoNome: 'Pré-vendas' });
    expect(D.ciclo).toMatchObject({ inicio: '2026-10-01', fim: '2026-11-01', trabalhaHoje: true, ontem: '2026-10-09', amanha: '2026-10-15' });
    const t = D.prod.find(x => x.k === 'tentativa')!;
    expect(t.diario).toBe(true);
    expect(t.metaTotal).toBe(220);
    expect(t.feitoCiclo).toBe(74);                                   // 7 × 10 + 4 de hoje
    expect(t.feito).toBe(4);
    const metaAteOntem = D.ciclo.uteisPessoa.filter(d => d < HOJE).reduce((s, d) => s + (metasDiarias(220, D.ciclo.uteisPessoa)[d] ?? 0), 0);
    const atrasoOntem = Math.max(0, metaAteOntem - 70);
    expect(t.atrasoTotal).toBe(atrasoOntem);
    expect(t.recup).toBe(Math.ceil(atrasoOntem / 5));
    expect(t.alvo).toBe(t.metaHoje + t.recup);
    expect(t.falta).toBe(Math.max(0, t.alvo - 4));
    expect(D.esperadoAgora.find(x => x.k === 'tentativa')!.esperado).toBeGreaterThan(0);
    /* o agendamento não é meta diária: entra como objetivo da semana */
    const a = D.prod.find(x => x.k === 'agendamento')!;
    expect(a.diario).toBe(false); expect(a.sem).not.toBeNull(); expect(a.sem!.alvo).toBeGreaterThan(0);
    /* lead sem contato há ~30 h */
    expect(D.leadsNovos).toHaveLength(1);
    expect(D.leadsNovos[0]).toMatchObject({ id: lead, nome: 'Padaria Sol' });
    expect(D.leadsNovos[0]!.horas).toBeCloseTo(30, 0);
    const acLead = D.acoes.find(x => x.chave === 'leadsnovos')!;
    expect(acLead.classe).toBe('alta');                              // entrou há mais de 24 h
    const acProd = D.acoes.find(x => x.chave === 'prod:tentativa')!;
    expect(acProd.nao).toMatch(/Amanhã o alvo vira/);
    expect(D.sucesso.map(s => s.k)).toEqual(expect.arrayContaining(['prod:tentativa', 'leadsnovos', 'sem:agendamento']));
    expect(D.fontes.tarefas).toBe(false);
    expect(D.cap.fonte).toBe('observada'); expect(D.cap.v).toBe(10);
    expect(D.memoria).toEqual([]);
  });

  it('dia em que a pessoa não trabalha: sem recuperação e sem meta de hoje', async () => {
    const op = (await operacao(sql, 'd'))!;
    const D = await dadosDoDia(sql, op, sara, '2026-10-13', 'manha', new Date('2026-10-13T11:00:00Z'));
    expect(D.ciclo.trabalhaHoje).toBe(false);
    const t = D.prod.find(x => x.k === 'tentativa')!;
    expect(t.metaHoje).toBe(0); expect(t.recup).toBe(0); expect(t.alvo).toBe(0);
  });

  it('lançamento do administrador soma no feito e pode ser desfeito uma vez', async () => {
    const op = (await operacao(sql, 'd'))!;
    expect((await falha(lancar(sql, op, { pessoaId: sara, data: HOJE, indicador: 'tentativa', delta: 0, motivo: 'teste teste' })))!.message).toMatch(/quantidade/);
    expect((await falha(lancar(sql, op, { pessoaId: sara, data: HOJE, indicador: 'tentativa', delta: 3, motivo: 'oi' })))!.message).toMatch(/motivo/);
    const { id } = await lancar(sql, op, { pessoaId: sara, data: HOJE, indicador: 'tentativa', delta: 3, motivo: 'ligações feitas fora do sistema', por: 'bruno' });
    let D = await dadosDoDia(sql, op, sara, HOJE, 'tarde', AGORA);
    expect(D.prod.find(x => x.k === 'tentativa')!.feito).toBe(7);
    expect(D.fracaoHoje).toBe(0.5);
    await desfazerLancamento(sql, op, id, 'bruno');
    expect((await falha(desfazerLancamento(sql, op, id)))!.status).toBe(409);
    D = await dadosDoDia(sql, op, sara, HOJE, 'tarde', AGORA);
    expect(D.prod.find(x => x.k === 'tentativa')!.feito).toBe(4);
    const L = await lancamentos(sql, op, sara, HOJE, HOJE);
    expect(L).toHaveLength(2); expect(L.find(l => l.id === id)!.desfeito).toBe(true);
    await expect(sql`delete from lab.lancamento where id = ${id}`).rejects.toThrow(/só de acréscimo/);
  });

  it('justificar e marcar feito entram no plano do mesmo dia', async () => {
    const op = (await operacao(sql, 'd'))!;
    expect((await falha(justificar(sql, op, { pessoaId: sara, data: HOJE, chave: 'leadsnovos', motivo: 'x' })))!.message).toMatch(/justificativa/);
    await justificar(sql, op, { pessoaId: sara, data: HOJE, chave: 'leadsnovos', motivo: 'lead pediu retorno só na sexta', terceiro: true, por: 'sara' });
    await marcarFeito(sql, op, { pessoaId: sara, data: HOJE, chave: 'sem:agendamento', feito: true, por: 'sara' });
    let D = await dadosDoDia(sql, op, sara, HOJE, 'fim', AGORA);
    expect(D.acoes.find(x => x.chave === 'leadsnovos')!.justificativa).toMatchObject({ motivo: 'lead pediu retorno só na sexta', terceiro: true, por: 'sara' });
    expect(D.sucesso.find(s => s.k === 'sem:agendamento')).toMatchObject({ ok: true, marcado: { por: 'sara' } });
    await marcarFeito(sql, op, { pessoaId: sara, data: HOJE, chave: 'sem:agendamento', feito: false, por: 'sara' });
    D = await dadosDoDia(sql, op, sara, HOJE, 'fim', AGORA);
    expect(D.sucesso.find(s => s.k === 'sem:agendamento')!.ok).toBe(false);
    expect((await falha(justificar(sql, op, { pessoaId: '00000000-0000-0000-0000-000000000000', data: HOJE, chave: 'x', motivo: 'motivo válido' })))!.status).toBe(404);
  });

  it('a foto de cada ritual é única por dia, assinada e imutável; a memória lê plano × executado', async () => {
    const op = (await operacao(sql, 'd'))!;
    const D = await dadosDoDia(sql, op, sara, HOJE, 'manha', AGORA);
    const f1 = await gravarFoto(sql, op, D);
    expect(f1.gravada).toBe(true); expect(f1.assinatura).toMatch(/^[0-9a-f]{64}$/);
    const f2 = await gravarFoto(sql, op, D);
    expect(f2).toEqual({ gravada: false, assinatura: f1.assinatura });
    await gravarFoto(sql, op, await dadosDoDia(sql, op, sara, HOJE, 'fim', AGORA));
    expect((await fotosDoDia(sql, op, sara, HOJE)).map(f => f.ritual)).toEqual(['manha', 'fim']);
    await expect(sql`update lab.dia_foto set dados = '{}'`).rejects.toThrow(/só de acréscimo/);
    const amanha = await dadosDoDia(sql, op, sara, '2026-10-15', 'manha', new Date('2026-10-15T11:00:00Z'));
    expect(amanha.memoria).toHaveLength(1);
    expect(amanha.memoria[0]).toMatchObject({ data: HOJE, ritual: 'fim', alvo: D.prod.find(x => x.k === 'tentativa')!.alvo, feito: 4 });
  });

  it('a equipe do gestor: só quem vende, cobrança da proposta parada e exposição', async () => {
    const op = (await operacao(sql, 'd'))!;
    const E = await equipeDoDia(sql, op, HOJE, 'manha', AGORA);
    expect(E.pessoas).toBe(2);
    expect(E.quadro.map(q => q.pessoa).sort()).toEqual(['Caio', 'Sara']);
    const caioQ = E.quadro.find(q => q.pessoa === 'Caio')!;
    expect(caioQ.criticos).toBe(1);
    expect(E.oportunidades[0]).toMatchObject({ id: proposta, nome: 'Mercado Lua', pessoa: 'Caio', classe: 'critica', proposta: true });
    expect(E.intervencoes.some(i => i.pessoa === 'Caio' && /propostas parados/.test(i.t))).toBe(true);
    expect(E.intervencoes.some(i => i.pessoa === 'Sara' && /leads e propostas/.test(i.t))).toBe(true);
    expect(E.semDono).toBe(0);
    expect(E.fontes.tarefas).toBe(false);
  });

  it('ausência e capacidade apontada', async () => {
    const op = (await operacao(sql, 'd'))!;
    await marcarAusencia(sql, op, { pessoaId: caio, data: '2026-10-15', motivo: 'médico' });
    expect((await ausencias(sql, op, '2026-10-01', '2026-10-31')).map(a => [a.pessoa, a.data, a.motivo])).toEqual([['Sara', '2026-10-13', 'folga'], ['Caio', '2026-10-15', 'médico']]);
    await marcarAusencia(sql, op, { pessoaId: caio, data: '2026-10-15', remover: true });
    expect(await ausencias(sql, op, '2026-10-15', '2026-10-15')).toHaveLength(0);
    expect((await falha(definirCapacidade(sql, op, sara, -1)))!.message).toMatch(/capacidade/);
    await definirCapacidade(sql, op, sara, 40);
    const ctx = await contextoDoDia(sql, op, HOJE, 'manha', AGORA);
    const D = montarPessoa(ctx, ctx.pessoas.find(p => p.id === sara)!);
    expect(D.cap).toMatchObject({ v: 40, fonte: 'apontada', obs: { v: 10 } });
    expect(D.viab).not.toBeNull();
    await definirCapacidade(sql, op, sara, null);
  });
});

describe.skipIf(semBanco)('vamos bater a meta? (ciclo no banco)', () => {
  let sql: postgres.Sql, opId: string, sara: string, caio: string;
  beforeAll(async () => {
    sql = await bancoLimpo();
    await criarOperacao(sql, { slug: 'c', nome: 'C', packId: 'base' }, catalogo());
    const op = (await operacao(sql, 'c'))!; opId = op.id;
    const ps = await sql<{ id: string; nome: string }[]>`insert into lab.pessoa (operacao_id, nome, funcao) values (${opId}, 'Sara', 'sdr'), (${opId}, 'Caio', 'closer') returning id, nome`;
    sara = ps.find(p => p.nome === 'Sara')!.id; caio = ps.find(p => p.nome === 'Caio')!.id;
    await acrescentarMetas(sql, opId, '2026-10-01', [{ indicador: 'receita', valor: 200000 }, { indicador: 'vendas', valor: 10 }, { indicador: 'tentativa', pessoaId: sara, valor: 220 }, { indicador: 'agendamento', pessoaId: sara, valor: 22 }]);
    const [funil] = await sql<{ id: string }[]>`select id from lab.funil where operacao_id = ${opId} and principal`;
    const E = Object.fromEntries((await sql<{ id: string; chave: string }[]>`select id, chave from lab.etapa where operacao_id = ${opId}`).map(e => [e.chave, e.id]));
    const tT = (await sql<{ id: string }[]>`select id from lab.tipo_atividade where operacao_id = ${opId} and papel = 'tentativa' limit 1`)[0]!.id;
    for (const d of ['01', '02', '05', '06', '07', '08', '09', '13']) await sql`insert into lab.atividade (operacao_id, tipo_id, pessoa_id, em, quantidade) values (${opId}, ${tT}, ${sara}, ${`2026-10-${d}T13:00:00Z`}, 10)`;
    /* histórico: 20 negócios criados em julho, 12 chegaram à proposta, 6 ganhos (R$ 20 mil cada, 30 dias de ciclo); 5 vendas no ciclo; pipeline aberto */
    const neg = async (criado: string, etapa: string, status: string, fechado: string | null, valor: number | null, dono: string | null) => (await sql<{ id: string }[]>`insert into lab.negocio (operacao_id, funil_id, dono_id, etapa_id, etapa_desde, criado_em, status, valor_fechado, valor_estimado, fechado_em)
      values (${opId}, ${funil!.id}, ${dono}, ${E[etapa]!}, ${criado}, ${criado}, ${status}, ${valor}, ${valor ?? 25000}, ${fechado}) returning id`)[0]!.id;
    const T = async (id: string, de: string | null, para: string, em: string) => { await sql`insert into lab.negocio_transicao (operacao_id, negocio_id, de_etapa_id, para_etapa_id, em, origem) values (${opId}, ${id}, ${de ? E[de]! : null}, ${E[para]!}, ${em}, 'evento')`; };
    for (let i = 0; i < 20; i++) { const ganho = i < 6, prop = i < 12, id = await neg('2026-07-01T12:00:00Z', ganho ? 'ganho' : prop ? 'perdido' : 'perdido', ganho ? 'ganho' : 'perdido', ganho ? '2026-07-31T12:00:00Z' : '2026-07-20T12:00:00Z', ganho ? 20000 : null, caio);
      await T(id, null, 'lead', '2026-07-01T12:00:00Z'); await T(id, 'lead', 'agendada', '2026-07-03T12:00:00Z'); if (prop) { await T(id, 'agendada', 'realizada', '2026-07-05T12:00:00Z'); await T(id, 'realizada', 'proposta', '2026-07-10T12:00:00Z'); } if (ganho) await T(id, 'proposta', 'ganho', '2026-07-31T12:00:00Z'); }
    for (let i = 0; i < 5; i++) { const id = await neg('2026-09-10T12:00:00Z', 'ganho', 'ganho', `2026-10-0${i + 2}T15:00:00Z`, 20000, caio); await T(id, null, 'lead', '2026-09-10T12:00:00Z'); await T(id, 'lead', 'proposta', '2026-09-20T12:00:00Z'); await T(id, 'proposta', 'ganho', `2026-10-0${i + 2}T15:00:00Z`); }
    for (let i = 0; i < 4; i++) { const id = await neg('2026-10-05T12:00:00Z', 'proposta', 'aberto', null, null, caio); await T(id, null, 'lead', '2026-10-05T12:00:00Z'); await T(id, 'lead', 'proposta', '2026-10-08T12:00:00Z'); }
    const grande = await neg('2026-10-06T12:00:00Z', 'proposta', 'aberto', null, null, caio); await sql`update lab.negocio set valor_estimado = 1000000 where id = ${grande}`; await T(grande, null, 'lead', '2026-10-06T12:00:00Z'); await T(grande, 'lead', 'proposta', '2026-10-08T12:00:00Z');
  });
  afterAll(async () => { await sql?.end(); });

  it('projeção, forecast com fora da curva, sinais e contingência', async () => {
    const op = (await operacao(sql, 'c'))!;
    const C = await cicloDoDia(sql, op, '2026-10-14', 'manha', new Date('2026-10-14T11:00:00Z'));
    expect(C.ciclo).toMatchObject({ du: 21, dd: 8, rest: 13 });            // manhã: hoje conta 0
    expect(C.metas).toMatchObject({ receita: 200000, vendas: 10, tentativa: 220, agendamento: 22 });
    expect(C.realizado).toMatchObject({ vendas: 5, receita: 100000, tentativa: 80 });
    expect(C.ticket).toMatchObject({ v: 20000 });
    expect(C.forecast.limite).toBe(100000); expect(C.forecast.fora).toHaveLength(1); expect(C.forecast.fora[0]!.valor).toBe(1000000);
    const prop = C.forecast.et.find(e => e.chave === 'proposta')!;
    expect(prop.n).toBe(17); expect(prop.g).toBe(11); expect(prop.abertos).toBe(5); expect(prop.foraN).toBe(1);   // 12 de julho + 5 do ciclo passaram pela proposta; 6 + 5 ganhos
    expect(C.hist.leadVenda).toBeCloseTo(11 / 25); expect(C.hist.leadVendaN).toBe(25);   // coorte: criados até 30 dias atrás (julho + setembro) expect(C.hist.cicloMediano).toBeGreaterThan(0);
    expect(C.proj.vendas.real).toBe(5); expect(C.proj.vendas.ritmo).toBeCloseTo(5 + (5 / 8) * 13); expect(C.proj.vendas.hist).toBeGreaterThan(5);
    expect(C.proj.prob).not.toBeNull(); expect(C.pergunta.resposta).not.toBe('sem_dado');
    const lt = C.linhas.find(l => l.ind === 'tentativa')!; expect(lt.esp).toBeCloseTo(220 * 8 / 21); expect(lt.real).toBe(80); expect(lt.status).toBe('atencao');   // 95% do esperado
    expect(C.sinais.some(s => s.origem === 'trajetoria' && s.ind === 'tentativa')).toBe(false);                                                             // acima de 85%: sem sinal
    expect(C.sinais.some(s => s.origem === 'dados' && /Reuniões agendadas/.test(s.oque))).toBe(true);                                                        // meta sem registro = sem dado, não zero
    expect(C.contingencia.receita).toMatchObject({ meta: 200000, real: 100000, diasRest: 13 });   // 14/10 a 30/10, contando hoje expect(C.contingencia.receita.razaoEsp).toBeCloseTo(100000 / (200000 * 8 / 21));
    expect(C.contingencia.trajetoria.rows).toHaveLength(21); expect(C.contingencia.trajetoria.antes).toBe(100000);
    const pS = C.contingencia.pessoas.find(p => p.n === 'Sara')!; expect(pS.etapas.find(e => e.k === 'tentativa')!.falta).toBe(140); expect(pS.ativ!.k).toBe('tentativa');
    expect(C.contingencia.pessoas.find(p => p.n === 'Caio')!.pipe).toBeGreaterThan(0);
    expect(C.pessoas.map(p => p.nome).sort()).toEqual(['Caio', 'Sara']);
    const fim = await cicloDoDia(sql, op, '2026-10-14', 'fim', new Date('2026-10-14T20:00:00Z'));
    expect(fim.ciclo.dd).toBe(9);
  });
  it('semana passada e projeção desta semana', async () => {
    const op = (await operacao(sql, 'c'))!;
    /* hoje é quarta 14/10 às 13h locais: semana passada = 05/10 a 11/10 (50 tentativas, 0 vendas); 4 semanas antes servem de base */
    const S = await relatorioDaSemana(sql, op, '2026-10-14', new Date('2026-10-14T16:00:00Z'), -1);
    expect(S.semana).toMatchObject({ ini: '2026-10-05', fim: '2026-10-11', parcial: false });
    const t = S.linhas.find(l => l.k === 'tentativa')!; expect(t.cur).toBe(50); expect(t.meta).toBeCloseTo(220 * 5 / 21);
    expect(t.J.st).toBe('bom');                                                 // 50 ≥ meta da semana (52,4 × … ) ? 50/52,4 = 95% → cai na base: base 20/4 = 5 → +900%
    const v = S.linhas.find(l => l.k === 'vendas')!; expect(v.cur).toBe(2);     // vendas de 05/10 e 06/10
    expect(S.texto).toMatch(/Semana passada · 05\/10 a 11\/10/);
    const P = await projecaoDaSemana(sql, op, '2026-10-14', new Date('2026-10-14T16:00:00Z'));
    expect(P.semana).toMatchObject({ ini: '2026-10-12', fim: '2026-10-18', du: 4 });   // 12/10 é feriado
    expect(P.semana.decorridos).toBeCloseTo(1.5);                                // ter inteira + quarta 13h = meio dia
    const pt = P.linhas.find(x => x.k === 'tentativa')!; expect(pt.feito).toBe(10); expect(pt.meta).toBeCloseTo(220 * 4 / 21); expect(pt.proj).not.toBeNull();
    expect(P.mesa.length).toBe(5); expect(P.mesa[0]!.valor).toBe(1000000); expect(P.mesaResumo.total).toBe(1100000);
    expect(P.semanasCiclo.find(x => x.k === 'tentativa')!.celulas.length).toBeGreaterThanOrEqual(4);
    expect(P.texto).toMatch(/Projeção da semana 12\/10 a 18\/10/);
  });
});

describe.skipIf(semBanco)('fechamento do dia no banco', () => {
  let sql: postgres.Sql, opId: string, sara: string;
  const AGORA = (d: number, h: number, m = 0) => new Date(Date.UTC(2026, 9, d, h + 3, m));   // horário de São Paulo (UTC−3)
  beforeAll(async () => {
    sql = await bancoLimpo();
    await criarOperacao(sql, { slug: 'f', nome: 'F', packId: 'base' }, catalogo());
    const op = (await operacao(sql, 'f'))!; opId = op.id;
    const [p] = await sql<{ id: string }[]>`insert into lab.pessoa (operacao_id, nome, funcao) values (${opId}, 'Sara', 'sdr') returning id`; sara = p!.id;
    await acrescentarMetas(sql, opId, '2026-10-01', [{ indicador: 'receita', valor: 100000 }, { indicador: 'vendas', valor: 5 }, { indicador: 'tentativa', pessoaId: sara, valor: 220 }]);
    const tT = (await sql<{ id: string }[]>`select id from lab.tipo_atividade where operacao_id = ${opId} and papel = 'tentativa' limit 1`)[0]!.id;
    for (const d of ['01', '02', '05', '06', '07', '08', '09', '13', '14', '15', '16', '19', '20', '21', '22']) await sql`insert into lab.atividade (operacao_id, tipo_id, pessoa_id, em, quantidade) values (${opId}, ${tT}, ${sara}, ${`2026-10-${d}T13:00:00Z`}, 6)`;
    await sql`insert into lab.atividade (operacao_id, tipo_id, pessoa_id, em, quantidade) values (${opId}, ${tT}, ${sara}, '2026-10-23T13:00:00Z', 3)`;
  });
  afterAll(async () => { await sql?.end(); });

  it('tique: 17:15 nada; 17:30 gera e grava; 17:45 nada; gerar de novo = sem mudança; 23:30 complementa uma vez; sábado sem expediente', async () => {
    const op = (await operacao(sql, 'f'))!;
    expect((await tiqueFechamento(sql, op, AGORA(23, 17, 15))).status).toBe('nada');
    const g = await tiqueFechamento(sql, op, AGORA(23, 17, 30));
    expect(g).toMatchObject({ status: 'ok', data: '2026-10-23' });
    const R = (await lerFechamento(sql, op, '2026-10-23'))!;
    expect(R.integro).toBe(true); expect(R.original.resumo.status).toBeDefined(); expect(R.original.ref.hash).toBe(R.assinatura);
    const cc = R.original.comparacoes.find((c: any) => c.k === 'tentativa' && c.periodo === 'dia'); expect(cc.realizado).toBe(3); expect(cc.previsto).toBeGreaterThan(3);
    expect(R.original.pessoas[0]).toMatchObject({ n: 'Sara', sit: 'falta_execucao' });
    expect(R.original.limitacoes.some((l: any) => /Tarefas não está disponível/.test(l.txt))).toBe(true);
    expect(R.original.metas[0].obj).toMatch(/Receita de ciclo/);
    expect((await tiqueFechamento(sql, op, AGORA(23, 17, 45))).status).toBe('nada');
    expect((await gerarFechamento(sql, op, AGORA(23, 18, 0), 'manual', 'bruno')).status).toBe('sem_mudanca');
    expect((await tiqueFechamento(sql, op, AGORA(23, 23, 30))).status).toBe('sem_mudanca');
    expect((await tiqueFechamento(sql, op, AGORA(23, 23, 45))).status).toBe('nada');
    const ex = await sql`select origem, status from lab.dia_execucao where operacao_id = ${opId} order by id`;
    expect(ex.map(e => e.origem + ':' + e.status)).toEqual(['agendado:ok', 'manual:sem_mudanca', 'complemento:sem_mudanca']);
    expect((await tiqueFechamento(sql, op, AGORA(24, 17, 30))).status).toBe('sem_expediente');
    expect((await tiqueFechamento(sql, op, AGORA(24, 17, 45))).status).toBe('nada');
  });
  it('registro atrasado vira complemento com o que mudou; o original não muda; decisão do gestor fica e entra na recorrência', async () => {
    const op = (await operacao(sql, 'f'))!;
    const tT = (await sql<{ id: string }[]>`select id from lab.tipo_atividade where operacao_id = ${opId} and papel = 'tentativa' limit 1`)[0]!.id;
    await sql`insert into lab.atividade (operacao_id, tipo_id, pessoa_id, em, quantidade) values (${opId}, ${tT}, ${sara}, '2026-10-23T19:00:00Z', 8)`;
    expect((await gerarFechamento(sql, op, AGORA(23, 23, 40), 'complemento')).status).toBe('complemento');
    const R = (await lerFechamento(sql, op, '2026-10-23'))!;
    expect(R.complementos).toHaveLength(1); expect(R.complementos[0].mudou.some((m: string) => /Tentativas de contato da equipe hoje: 3\//.test(m) && /→ 11\//.test(m))).toBe(true);
    expect(R.original.comparacoes.find((c: any) => c.k === 'tentativa').realizado).toBe(3); expect(R.atual.comparacoes.find((c: any) => c.k === 'tentativa').realizado).toBe(11);
    await expect(sql`update lab.dia_fechamento set original = '{}'::jsonb where operacao_id = ${opId}`).rejects.toThrow(/nunca muda/);
    await expect(sql`delete from lab.dia_fechamento where operacao_id = ${opId}`).rejects.toThrow(/só de acréscimo/);
    expect((await falha(acaoFechamento(sql, op, { data: '2026-10-23', chave: 'dia:tentativa:Sara', estado: 'decidida', texto: 'x' })))!.message).toMatch(/descreva/);
    const a = await acaoFechamento(sql, op, { data: '2026-10-23', chave: 'dia:tentativa:Sara', estado: 'decidida', texto: 'bloco de ligações às 9h', por: 'bruno' });
    expect(a.acao).toMatchObject({ estado: 'decidida', por: 'bruno' }); expect(a.acao.hist).toHaveLength(1);
    /* segunda-feira seguinte: o mesmo desvio cita a decisão de 23/10 */
    const g2 = await gerarFechamento(sql, op, AGORA(26, 17, 30), 'agendado');
    expect(g2.status).toBe('ok');
    const R2 = (await lerFechamento(sql, op, '2026-10-26'))!, al = R2.atual.alertas.find((x: any) => x.chave === 'dia:tentativa:Sara');
    expect(al.recorrencia.seguidos).toBe(1); expect(al.contexto).toMatch(/decisão registrada em 23\/10 e o desvio continua/);
    expect((await listaFechamentos(sql, op, '2026-10-01', '2026-10-31')).map(x => x.data)).toEqual(['2026-10-26', '2026-10-23']);
    const st = await statusRotina(sql, op, AGORA(27, 18, 0)); expect(st).toMatchObject({ hoje: '2026-10-27', existe: false, atrasado: true }); expect(st.ultima.status).toBe('ok');
  });
  it('duas execuções ao mesmo tempo: uma gera, a outra é ignorada', async () => {
    const op = (await operacao(sql, 'f'))!;
    const [a, b] = await Promise.all([gerarFechamento(sql, op, AGORA(27, 17, 30), 'agendado'), gerarFechamento(sql, op, AGORA(27, 17, 30), 'manual', 'bruno')]);
    expect([a.status, b.status].sort()).toEqual(['ignorado', 'ok']);
    expect((await sql`select count(*)::int as n from lab.dia_fechamento where operacao_id = ${opId} and data = '2026-10-27'`)[0]!.n).toBe(1);
  });
});
