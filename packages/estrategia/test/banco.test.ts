import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import { criarOperacao } from '@lab/conectores';
import { acrescentarMetas, operacao, type Operacao } from '@lab/planejamento';
import {
  ativarPlano, encerrarQuarter, ErroDeEstrategia, estrategiaDoQuarter, fecharMesDoQuarter, fecharPlano, levarMetasAosCiclos, marcosParaODia, metaDoAno, metaIntervalo, metaOficialDoCiclo, metasHistoricas, planoDoCiclo,
  publicarEstrategia, registrarEncerramento, replanejarCiclo, revisarMeta, salvarEstrategia, tiqueMetas, TX,
} from '../src/index.js';
import { bancoLimpo, catalogo, semBanco } from '../../conectores/test/ajuda.js';

const falha = async (p: Promise<unknown>) => (await p.then(() => null, e => e)) as ErroDeEstrategia | null;
const HOJE = '2026-10-14', AGORA = new Date('2026-10-14T14:00:00Z');

describe.skipIf(semBanco)('estratégia no banco', () => {
  let sql: postgres.Sql, op: Operacao, ana: string, bia: string;
  beforeAll(async () => {
    sql = await bancoLimpo();
    await criarOperacao(sql, { slug: 'e', nome: 'E', packId: 'base' }, catalogo());
    op = (await operacao(sql, 'e'))!;
    const ps = await sql<{ id: string; nome: string }[]>`insert into lab.pessoa (operacao_id, nome, funcao) values (${op.id}, 'Ana Souza', 'closer'), (${op.id}, 'Bia', 'sdr') returning id, nome`;
    ana = ps.find(p => p.nome === 'Ana Souza')!.id; bia = ps.find(p => p.nome === 'Bia')!.id;
    /* setembro: meta cadastrada durante o ciclo (evidência), vendas; agosto: nada; outubro (atual): metas e vendas */
    await sql`insert into lab.meta (operacao_id, ciclo_inicio, indicador, pessoa_id, valor, criado_em) values (${op.id}, '2026-09-01', 'receita', null, 90000, '2026-09-02T12:00:00Z'), (${op.id}, '2026-09-01', 'vendas', null, 5, '2026-09-02T12:00:00Z')`;
    await acrescentarMetas(sql, op.id, '2026-10-01', [{ indicador: 'receita', valor: 100000 }, { indicador: 'vendas', valor: 5 }, { indicador: 'receita', pessoaId: ana, valor: 100000 }]);
    const [funil] = await sql<{ id: string }[]>`select id from lab.funil where operacao_id = ${op.id} and principal`;
    const etapa = async (chave: string) => (await sql<{ id: string }[]>`select id from lab.etapa where operacao_id = ${op.id} and chave = ${chave}`)[0]!.id;
    const ganho = await etapa('ganho'), oport = await etapa('proposta');
    const venda = (criado: string, fechado: string, valor: number, dono = ana) => sql`insert into lab.negocio (operacao_id, funil_id, dono_id, etapa_id, etapa_desde, criado_em, status, fechado_em, valor_fechado, valor_estimado, atributos)
      values (${op.id}, ${funil!.id}, ${dono}, ${ganho}, ${fechado}, ${criado}, 'ganho', ${fechado}, ${valor}, ${valor}, ${sql.json({ cliente: 'C' })})`;
    for (const [c, f, v] of [['2026-07-03', '2026-07-20', 20000], ['2026-08-05', '2026-08-25', 22000], ['2026-09-02', '2026-09-18', 18000], ['2026-09-10', '2026-09-28', 24000], ['2026-10-02', '2026-10-09', 21000]] as Array<[string, string, number]>) await venda(c + 'T12:00:00Z', f + 'T15:00:00Z', v);
    await sql`insert into lab.negocio (operacao_id, funil_id, dono_id, etapa_id, etapa_desde, criado_em, valor_estimado, atributos) values (${op.id}, ${funil!.id}, ${ana}, ${oport}, '2026-10-10T12:00:00Z', '2026-10-05T12:00:00Z', 30000, ${sql.json({ cliente: 'Aberto' })})`;
  });
  afterAll(async () => { await sql?.end(); });

  it('plano do ciclo: ativar congela a original; replanejar guarda a versão com corte e motivo; a vigente é a nova meta', async () => {
    expect((await falha(replanejarCiclo(sql, op, '2026-10-01', { corte: '2026-10-13', motivo: 'x', metas: [{ indicador: 'receita', valor: 80000 }] })))?.status).toBe(409);
    const P = await ativarPlano(sql, op, '2026-10-01', 'Bruno', AGORA);
    expect(P.linha!.status).toBe('ativo'); expect(P.linha!.original!.metas.find(m => m.indicador === 'receita' && !m.pessoaId)!.valor).toBe(100000); expect(P.doc.metas!['receita:op']!.alvo).toBe(100000);
    expect((await falha(replanejarCiclo(sql, op, '2026-10-01', { corte: '2026-10-13', motivo: '', metas: [{ indicador: 'receita', valor: 80000 }] })))?.message).toMatch(/motivo/);
    const R = await replanejarCiclo(sql, op, '2026-10-01', { corte: '2026-10-13', motivo: 'perda de um closer', metas: [{ indicador: 'receita', valor: 80000 }], por: 'Bruno' }, AGORA);
    expect(R.linha!.versao).toBe(2); expect(R.linha!.corte).toBe('2026-10-13'); expect(R.linha!.versoes.v1!.motivo).toBe('perda de um closer'); expect((R.linha!.versoes.v1!.metas as unknown as Array<{ valor: number; indicador: string; pessoaId: string | null }>).find(m => m.indicador === 'receita' && !m.pessoaId)!.valor).toBe(100000);
    expect(R.restanteNoCorte.receita).toBe(80000 - 21000); expect(R.doc.metas!['receita:op']!.alvo).toBe(80000); expect(R.linha!.original!.metas.find(m => m.indicador === 'receita' && !m.pessoaId)!.valor).toBe(100000);
    /* a meta original nunca muda nem pelo banco */
    await expect(sql`update lab.plano_ciclo set original = '{}'::jsonb where id = ${R.linha!.id}`).rejects.toThrow(/original/);
  });

  it('metas históricas: ciclo atual com plano ativo = conhecida pela versão final; setembro conhecida pela meta cadastrada na época; agosto desconhecida (nunca zero nem a de hoje)', async () => {
    const out = await metaOficialDoCiclo(sql, op, '2026-10-01', HOJE);
    expect(out.oficial.estado).toBe('conhecida'); expect(out.oficial.receita).toBe(80000); expect(out.oficial.fonte).toBe('plano'); expect(out.snap.plano!.versoes.map(v => v.tipo).join()).toBe('aprovada,substituida,final');
    const set = await metaOficialDoCiclo(sql, op, '2026-09-01', HOJE);
    expect(set.encerrado).toBe(true); expect(set.oficial.estado).toBe('conhecida'); expect(set.oficial.receita).toBe(90000); expect(set.oficial.fonte).toBe('observacao'); expect(set.oficial.registrado).toBe(false);
    const ago = await metaOficialDoCiclo(sql, op, '2026-08-01', HOJE);
    expect(ago.oficial.estado).toBe('desconhecida'); expect(ago.oficial.receita).toBeNull(); expect(ago.oficial.motivo).toMatch(/configuração de hoje/);
  });

  it('registro no encerramento é idempotente; revisão cria r2 e passa a valer; estimativa não substitui o desconhecido', async () => {
    const r = await registrarEncerramento(sql, op, '2026-09-01', { agora: AGORA, hoje: HOJE }); expect(r.acao).toBe('gravar');
    expect((await registrarEncerramento(sql, op, '2026-09-01', { agora: AGORA, hoje: HOJE })).acao).toBe('nada');
    expect((await registrarEncerramento(sql, op, '2026-10-01', { agora: AGORA, hoje: HOJE })).acao).toBe('nada');
    expect((await falha(revisarMeta(sql, op, '2026-09-01', { receita: 95000, justificativa: 'curto' }, 'Bruno', AGORA)))?.message).toMatch(/10 caracteres/);
    const RV = await revisarMeta(sql, op, '2026-09-01', { receita: 95000, justificativa: 'meta corrigida pela diretoria em 12/10' }, 'Carla', AGORA);
    expect(RV.id).toBe('r2');
    const X = await metaOficialDoCiclo(sql, op, '2026-09-01', HOJE); expect(X.oficial.receita).toBe(95000); expect(X.oficial.id).toBe('r2'); expect(X.oficial.historico.length).toBe(2);
    await expect(sql`update lab.meta_ciclo_registro set registro = '{}'::jsonb where operacao_id = ${op.id}`).rejects.toThrow(/acréscimo/);
    await registrarEncerramento(sql, op, '2026-08-01', { agora: AGORA, hoje: HOJE });
    const ES = await revisarMeta(sql, op, '2026-08-01', { tipo: 'estimativa', receita: 85000, justificativa: 'estimada pela média dos ciclos vizinhos', origem: 'média de jul e set', limitacoes: 'sem ata' }, 'Bruno', AGORA);
    expect(ES.registro.estado).toBe('estimada');
    const A = await metaOficialDoCiclo(sql, op, '2026-08-01', HOJE); expect(A.oficial.estado).toBe('desconhecida'); expect(A.oficial.estimativas.length).toBe(1);
  });

  it('intervalo, ano e lista: agosto desconhecida deixa o período parcial; o ano separa meta final, acumulada, realizado e projeção', async () => {
    const I = await metaIntervalo(sql, op, '2026-09-01', '2026-10-31', HOJE);
    expect(I.estado).toBe('ok'); expect(I.v).toBeCloseTo(95000 + 80000); expect(I.itens.map(i => i.chave).join()).toBe('2026-09,2026-10');
    const P = await metaIntervalo(sql, op, '2026-08-01', '2026-09-30', HOJE); expect(P.estado).toBe('parcial'); expect(P.desconhecidos).toEqual(['2026-08']);
    const A = await metaDoAno(sql, op, HOJE);
    expect(A.ano).toBe(2026); expect(A.metaTotalEstado).toBe('parcial'); expect(A.realizado).toBe(105000); expect(A.projecao).toBeGreaterThan(105000); expect(A.atingAcum).toBeNull();
    const L = await metasHistoricas(sql, op, HOJE, 3);
    expect(L.map(x => x.chave)).toEqual(['2026-10', '2026-09', '2026-08']); expect(L[1]!.oficial.registrado).toBe(true);
  });

  it('rotina: observa a meta de hoje uma vez e registra ciclos encerrados sem registro', async () => {
    const t1 = await tiqueMetas(sql, op, AGORA); expect(t1['2026-10']).toBe('observada'); expect(t1['2026-07']).toBe('registrada');
    const t2 = await tiqueMetas(sql, op, AGORA); expect(t2['2026-10']).toBeUndefined();
    const [o] = await sql<{ receita: string; fonte: string }[]>`select receita, fonte from lab.meta_ciclo_obs where operacao_id = ${op.id} and dia = ${HOJE}::date`; expect(Number(o!.receita)).toBe(80000); expect(o!.fonte).toBe('plano');
  });

  it('quarter: leitura sem plano (revisão do Q3 com metas oficiais, diagnóstico, sugestões), rascunho com bloqueios, publicação com versão, metas levadas aos ciclos, acompanhamento', async () => {
    let E = await estrategiaDoQuarter(sql, op, HOJE, AGORA);
    expect(E.quarter.rotulo).toBe('Q4 2026'); expect(E.doc.existe).toBe(false); expect(E.faseSugerida).toBe('visao');
    const rec = E.revisao.linhas.find(l => l.ind === 'receita')!;
    expect(rec.meta.nota).toMatch(/conhecida em 1 de 3/); expect(rec.v).toBe(20000 + 22000 + 18000 + 24000); expect(rec.evolucao).toEqual([20000, 22000, 42000]);
    expect(E.revisao.lacunas.some(l => l.ind === 'margem')).toBe(true);
    expect(E.diagnostico.find(d => d.k === 'ticket')!.estado).toBe('sem_dado'); expect(E.objetivo.premissas.ticket.v).toBeCloseTo(21000);
    expect(E.aprovacao.ok).toBe(false); expect(E.aprovacao.bloqueios.some(b => /Objetivo/.test(b))).toBe(true);
    expect((await falha(publicarEstrategia(sql, op, HOJE, null, 'Bruno', AGORA)))?.status).toBe(404);
    /* fase a fase */
    await salvarEstrategia(sql, op, HOJE, { prioridades: { p1: { titulo: 'Conversão oportunidade → venda', st: 'aceita', crit: { impacto: 3, evidencia: 2 } } } }, 'Bruno');
    await salvarEstrategia(sql, op, HOJE, { objetivo: { texto: 'Crescer com previsibilidade', ind: 'receita', alvo: 300000 }, krs: { k1: { ind: 'receita', partida: 84000, alvo: 300000, resp: 'Bruno', criterio: '≥ meta', freq: 'semanal', tipo: 'resultado' }, k2: { ind: 'oportunidades', partida: 0, alvo: 30, resp: 'Ana', criterio: '≥ 10 por mês', freq: 'semanal', tipo: 'antecedente' } } }, 'Bruno');
    E = await estrategiaDoQuarter(sql, op, HOJE, AGORA);
    expect(E.faseSugerida).toBe('iniciativas'); expect(E.objetivo.metaVs && !('erro' in E.objetivo.metaVs) && E.objetivo.metaVs.meta).toBe(300000);
    expect(E.meses.map(m => Math.round(m.sugerida!)).reduce((a, b) => a + b, 0)).toBeGreaterThan(299990); expect(E.meses[0]!.metaNoCiclo).toBe(80000);
    await salvarEstrategia(sql, op, HOJE, { iniciativas: { novo1: { nome: 'Roteiro de qualificação antes da reunião', prio: 'p1', resp: 'Ana', problema: 'conversão caiu', hipotese: 'qualificar antes sobe a conversão', variavel: 'roteiro', ind: TX.oportVenda, inicial: 0.2, alvo: 0.3, minimo: 0.25, continuar: 'x', corrigir: 'y', interromper: 'z', horas: 10, meses: [0, 1], marcos: { novoA: { txt: 'Escrever o roteiro', prazo: '2026-10-10', st: 'previsto', mes: 0 }, novoB: { txt: 'Treinar o time', prazo: '2026-10-20', st: 'previsto', mes: 0 } } } } }, 'Bruno');
    E = await estrategiaDoQuarter(sql, op, HOJE, AGORA);
    const ini = E.iniciativas[0]!; expect(ini.id).not.toMatch(/^novo/); expect(Object.keys(ini.marcos!).every(k => !/^novo/.test(k))).toBe(true); expect(ini.lacunas).toEqual([]);
    expect(E.faseSugerida).toBe('meses'); expect(E.marcosAtrasados.length).toBe(1);
    await salvarEstrategia(sql, op, HOJE, { meses: { 0: { meta: 100000, resultado: 'roteiro em uso', criterio: 'conversão ≥ 25%' }, 1: { meta: 100000, resultado: 'x', criterio: 'y' }, 2: { meta: 100000, resultado: 'x', criterio: 'y' } }, gatilhos: { g1: { ind: TX.oportVenda, op: 'abaixo', limite: 0.2, acao: 'investigar a etapa' } }, riscos: { r1: { txt: 'Google para de gerar leads', resposta: 'ativar indicação' } } }, 'Bruno');
    E = await estrategiaDoQuarter(sql, op, HOJE, AGORA);
    expect(E.aprovacao.bloqueios).toEqual([]); expect(E.faseSugerida).toBe('publicar');
    const pub = await publicarEstrategia(sql, op, HOJE, null, 'Bruno', AGORA); expect(pub.versao).toBe(1);
    expect((await falha(publicarEstrategia(sql, op, HOJE, '', 'Bruno', AGORA)))?.message).toMatch(/motivo/);
    const lev = await levarMetasAosCiclos(sql, op, HOJE, 'Bruno', AGORA); expect(lev.gravadas).toEqual(['2026-10', '2026-11', '2026-12']);
    E = await estrategiaDoQuarter(sql, op, HOJE, AGORA);
    expect(E.doc.status).toBe('publicado'); expect(E.doc.versao).toBe(1); expect(E.meses[0]!.metaNoCiclo).toBe(100000);
    expect(E.programa!.ciclos[0]!.original.receita).toBe(100000); expect(E.programa!.ciclos[0]!.status).toBe('atual'); expect(E.programa!.realizado.receita).toBe(21000);
    expect(E.avisos.some(a => /^lq:marco:/.test(a.id))).toBe(true); expect(E.gatilhos[0]!.estado).toMatch(/sem_dado|amostra|ok|disparado/);
    expect(E.reprevisao.metaOriginal).toBe(300000); expect(E.encadeamento.ramos[0]!.iniciativas[0]!.nome).toMatch(/Roteiro/);
    const M = await marcosParaODia(sql, op, HOJE, 'Ana Souza'); expect(M.itens.map(x => x.situacao)).toEqual(['atrasado', 'semana']);
    /* o plano do ciclo de outubro recebeu a meta do quarter como nova versão vigente (a original de 100 mil segue intacta) */
    const P = await planoDoCiclo(sql, op, '2026-10-01'); expect(P.doc.metas!['receita:op']!.alvo).toBe(100000); expect(P.linha!.original!.metas.find(m => m.indicador === 'receita' && !m.pessoaId)!.valor).toBe(100000);
    /* fechamento do mês exige classificar todos; encerrar antes do fim é recusado; a versão publicada não muda */
    expect((await falha(fecharMesDoQuarter(sql, op, HOJE, { m: 0, classif: {} }, 'Bruno', AGORA)))?.message).toMatch(/classifique/);
    const marcos = Object.keys(ini.marcos!), F = await fecharMesDoQuarter(sql, op, HOJE, { m: 0, classif: { [marcos[0]!]: 'concluido', [marcos[1]!]: 'pendente' } }, 'Bruno', AGORA);
    expect(F.fechamento.seguem.length).toBe(1);
    expect((await falha(encerrarQuarter(sql, op, HOJE, 'Bruno', AGORA)))?.message).toMatch(/termina em/);
    await expect(sql`update lab.quarter_versao set snapshot = '{}'::jsonb where operacao_id = ${op.id}`).rejects.toThrow(/acréscimo/);
  });

  it('encerramento de um quarter passado publicado e fechamento do plano do ciclo', async () => {
    const D = '2026-08-15', AG = new Date('2026-08-15T12:00:00Z');
    await salvarEstrategia(sql, op, D, { objetivo: { texto: 'Q3', ind: 'receita', alvo: 90000 }, prioridades: { p1: { titulo: 'Ticket', st: 'propria', justificativa: 'ticket baixo' } }, krs: { k1: { ind: 'receita', partida: 0, alvo: 90000, resp: 'Bruno', criterio: 'x', freq: 'semanal', tipo: 'resultado' } },
      iniciativas: { i1: { nome: 'Proposta com dois pacotes para subir o ticket', prio: 'p1', resp: 'Ana', problema: 'x', hipotese: 'y', variavel: 'z', ind: 'ticket', inicial: 18000, alvo: 25000, minimo: 20000, continuar: 'a', corrigir: 'b', interromper: 'c', marcos: { m1: { txt: 'Modelo', st: 'concluido', mes: 0 } } } },
      meses: { 0: { meta: 30000, resultado: 'x', criterio: 'y' }, 1: { meta: 30000, resultado: 'x', criterio: 'y' }, 2: { meta: 30000, resultado: 'x', criterio: 'y' } } }, 'Bruno');
    await publicarEstrategia(sql, op, D, null, 'Bruno', AG);
    const enc = await encerrarQuarter(sql, op, D, 'Bruno', AGORA);
    expect(enc.resultado!.metaOriginal).toBe(90000); expect(enc.resultado!.real).toBe(84000); expect(enc.resultado!.desvio.abs).toBe(-6000);
    expect(enc.resultado!.avs[0]!.aval.k).toBe('sem_dado'); expect(enc.resultado!.avs[0]!.aval.texto).toMatch(/Amostra pequena \(n=4\)/); expect(enc.aprendizadosSugeridos[0]!.conclusao).toMatch(/Sem medida suficiente/);
    expect((await falha(salvarEstrategia(sql, op, D, { objetivo: { texto: 'x' } }, 'Bruno')))?.status).toBe(409);
    const E = await estrategiaDoQuarter(sql, op, HOJE, AGORA); expect(E.anterior.doc!.status).toBe('encerrado'); expect(E.iniciativasAnteriores[0]!.aval.k).toBe('sem_dado');
    const FP = await fecharPlano(sql, op, '2026-10-01', 'Bruno', AGORA); expect(FP.linha!.status).toBe('fechado'); expect(FP.registro.acao).toBe('gravar');
    expect((await metaOficialDoCiclo(sql, op, '2026-10-01', HOJE)).oficial.registrado).toBe(true);
    expect((await falha(replanejarCiclo(sql, op, '2026-10-01', { corte: '2026-10-20', motivo: 'tarde', metas: [{ indicador: 'receita', valor: 1 }] })))?.message).toMatch(/fechado/);
  });
});
