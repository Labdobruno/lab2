import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import { criarOperacao } from '@lab/conectores';
import { acrescentarMetas, operacao } from '@lab/planejamento';
import { adiarTarefa, cancelarTarefa, classePendencia, concluirTarefa, criarTarefa, dadosDoDia, ErroDeTarefa, eventosDaTarefa, fotografiaDoDia, relatorioDoDia, tarefas } from '../src/index.js';
import { bancoLimpo, catalogo, semBanco } from '../../conectores/test/ajuda.js';

const falha = async (p: Promise<unknown>) => (await p.then(() => null, e => e)) as ErroDeTarefa | null;
const HOJE = '2026-10-14', AGORA = new Date('2026-10-14T20:00:00Z');
describe.skipIf(semBanco)('tarefas no banco', () => {
  let sql: postgres.Sql, opId: string, sara: string;
  beforeAll(async () => {
    sql = await bancoLimpo();
    await criarOperacao(sql, { slug: 't', nome: 'T', packId: 'base' }, catalogo());
    opId = (await operacao(sql, 't'))!.id;
    sara = (await sql<{ id: string }[]>`insert into lab.pessoa (operacao_id, nome, funcao) values (${opId}, 'Sara', 'sdr') returning id`)[0]!.id;
    await acrescentarMetas(sql, opId, '2026-10-01', [{ indicador: 'tentativa', pessoaId: sara, valor: 220 }]);
  });
  afterAll(async () => { await sql?.end(); });

  it('cria, valida, lista; adiar conta e guarda o prazo original; concluir e cancelar são finais', async () => {
    const op = (await operacao(sql, 't'))!;
    expect((await falha(criarTarefa(sql, op, { titulo: 'x', prazo: HOJE })))?.message).toMatch(/título/);
    expect((await falha(criarTarefa(sql, op, { titulo: 'Ligar para os leads parados', prazo: '14/10/2026' })))?.message).toMatch(/AAAA-MM-DD/);
    expect((await falha(criarTarefa(sql, op, { titulo: 'Ligar para os leads parados', prazo: HOJE, responsavelId: '00000000-0000-4000-8000-000000000000' })))?.status).toBe(404);
    const t = await criarTarefa(sql, op, { titulo: 'Ligar para os leads parados', prazo: '2026-10-10', responsavelId: sara, origem: { tipo: 'sinal', chave: 'leads_sem_contato', data: HOJE, lixo: 1 }, por: 'Gil' });
    expect(t).toMatchObject({ responsavel: 'Sara', prazo: '2026-10-10', prazoOriginal: '2026-10-10', prioridade: 'normal', status: 'aberta', adiamentos: 0, origem: { tipo: 'sinal', chave: 'leads_sem_contato', data: HOJE } });
    const g = await criarTarefa(sql, op, { titulo: 'Rever a alçada de desconto', prazo: HOJE, prioridade: 'alta', origem: { tipo: 'achado', chave: 'desconto_alto' } });
    expect(g.responsavel).toBe('Gestor'); expect(g.responsavelId).toBeNull();
    expect((await tarefas(sql, op, { responsavelId: 'gestor' })).map(x => x.id)).toEqual([g.id]);
    expect((await tarefas(sql, op, { status: 'aberta' })).length).toBe(2);
    expect((await falha(adiarTarefa(sql, op, t.id, { prazo: '2026-10-09', motivo: 'cliente viajou' })))?.message).toMatch(/depois do atual/);
    expect((await falha(adiarTarefa(sql, op, t.id, { prazo: '2026-10-15', motivo: '' })))?.message).toMatch(/motivo/);
    let a = await adiarTarefa(sql, op, t.id, { prazo: '2026-10-12', motivo: 'cliente viajou', terceiro: true }); expect(a).toMatchObject({ prazo: '2026-10-12', prazoOriginal: '2026-10-10', adiamentos: 1, terceiro: true, ultimoMotivo: 'cliente viajou' });
    a = await adiarTarefa(sql, op, t.id, { prazo: '2026-10-13', motivo: 'ainda sem retorno' }); expect(a.adiamentos).toBe(2); expect(a.terceiro).toBe(false);
    expect((await eventosDaTarefa(sql, op, t.id)).map(e => e.tipo)).toEqual(['criada', 'adiada', 'adiada']);
    const feita = await concluirTarefa(sql, op, g.id, 'Gil'); expect(feita.status).toBe('feita'); expect(feita.feitaEm).not.toBeNull();
    expect((await falha(concluirTarefa(sql, op, g.id)))?.status).toBe(409);
    expect((await falha(cancelarTarefa(sql, op, t.id, '')))?.message).toMatch(/motivo/);
  });
  it('entra no plano do dia (atrasada, pendência do cenário "se não fizer") e no Fechamento (classe da pendência: adiada 2× = decisão)', async () => {
    const op = (await operacao(sql, 't'))!;
    await criarTarefa(sql, op, { titulo: 'Confirmar a reunião de amanhã', prazo: HOJE, responsavelId: sara });
    await criarTarefa(sql, op, { titulo: 'Enviar a proposta revisada', prazo: '2026-10-15', responsavelId: sara });
    const D = await dadosDoDia(sql, op, sara, HOJE, 'fim', AGORA);
    expect(D.fontes.tarefas).toBe(true); expect(D.tarefas.atrasadas.map(t => t.titulo)).toEqual(['Ligar para os leads parados']); expect(D.tarefas.atrasadas[0]!.diasAtraso).toBe(1);
    expect(D.tarefas.hoje.length).toBe(1); expect(D.tarefas.amanha).toBe(1); expect(D.cenario.nao.pendencias).toBeGreaterThanOrEqual(2); expect(D.cenario.nao.tarefasAmanha).toBe(3); expect(D.cenario.exec.tarefasAmanha).toBe(1);
    const F = await fotografiaDoDia(sql, op, HOJE, AGORA), p = F.pessoas.find(x => x.n === 'Sara')!;
    expect(F.fontes!.indisponiveis).not.toContain('Tarefas'); expect(p.tarefas!.atrasadas!.length).toBe(1); expect(p.tarefas!.hoje!.length).toBe(1); expect(p.amanha!.tarefas).toBe(1);
    expect(classePendencia(p.tarefas!.atrasadas![0]!)).toBe('decisao');
    const R = relatorioDoDia(F); expect(R.pendencias.some(x => x.titulo === 'Ligar para os leads parados' && x.classe === 'decisao' && x.adiamentos === 2 && x.prazoOriginal === '2026-10-10')).toBe(true);
    expect(R.alertas.some(a => a.chave === 'adiadas:Sara')).toBe(true);
  });
});
