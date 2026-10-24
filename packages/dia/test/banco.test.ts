import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import { criarOperacao } from '@lab/conectores';
import { acrescentarMetas, operacao, cicloDaOperacao } from '@lab/planejamento';
import {
  ausencias, contextoDoDia, dadosDoDia, definirCapacidade, desfazerLancamento, equipeDoDia, ErroDoDia, fotosDoDia, gravarFoto, justificar, lancamentos, lancar,
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
