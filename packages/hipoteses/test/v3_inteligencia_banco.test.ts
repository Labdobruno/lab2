import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import { criarOperacao, packDaOperacao } from '@lab/conectores';
import { operacao } from '@lab/planejamento';
import { acuraciaDaOperacao, apagarContexto, avaliarOperacao, calibrarRegra, carregarBase, contextoEventos, marcarAchado, medidorDe, registrarContexto, saudeDaOperacao, waterfallDoCiclo, type HipoteseV3 } from '../src/index.js';
import { bancoLimpo, catalogo, semBanco } from '../../conectores/test/ajuda.js';

const DIA = 86_400_000, AGORA = Date.UTC(2026, 9, 24, 15);
describe.skipIf(semBanco)('inteligência no banco', () => {
  let sql: postgres.Sql, opId: string;
  beforeAll(async () => {
    sql = await bancoLimpo();
    ({ id: opId } = await criarOperacao(sql, { slug: 'int', nome: 'Int', packId: 'base' }, catalogo()));
    const et = async (papel: string) => (await sql<{ id: string }[]>`select id from lab.etapa where operacao_id = ${opId} and papel = ${papel} limit 1`)[0]!.id;
    const [funil] = await sql<{ id: string }[]>`select id from lab.funil where operacao_id = ${opId} and principal`;
    const [canal] = await sql<{ id: string }[]>`select id from lab.canal where operacao_id = ${opId} and ativo limit 1`;
    const E = { lead: await et('lead'), oportunidade: await et('proposta'), ganho: await et('ganho') };
    /* linha de base (120–30 dias atrás): 30 leads/30 d, 60% viram oportunidade, 50% fecham; desconto 4% (ref 12.500 → 12.000), custo 7.200 (MC 40%)
       janela atual (últimos 30 d): mesmo volume, mas desconto 10% (ref 13.333 → 12.000) e MC menor */
    const planta = async (t0: number, dias: number, leadsPorMes: number, pOport: number, pFech: number, ref: number, custo: number) => {
      const n = Math.round((leadsPorMes * dias) / 30);
      for (let i = 0; i < n; i++) {
        const criado = new Date(t0 + (i / n) * dias * DIA), op_ = i % 10 < pOport * 10, g = op_ && i % 10 < pFech * pOport * 10;
        const [x] = await sql<{ id: string }[]>`insert into lab.negocio (operacao_id, funil_id, canal_id, etapa_id, status, valor_fechado, criado_em, fechado_em)
          values (${opId}, ${funil!.id}, ${canal!.id}, ${g ? E.ganho : op_ ? E.oportunidade : E.lead}, ${g ? 'ganho' : 'aberto'}, ${g ? 12000 : null}, ${criado.toISOString()}, ${g ? new Date(criado.getTime() + 1 * DIA).toISOString() : null}) returning id`;
        if (op_) await sql`insert into lab.negocio_transicao (operacao_id, negocio_id, para_etapa_id, em, origem) values (${opId}, ${x!.id}, ${E.oportunidade}, ${new Date(criado.getTime() + 3 * DIA).toISOString()}, 'evento')`;
        if (g) {
          await sql`insert into lab.negocio_transicao (operacao_id, negocio_id, para_etapa_id, em, origem) values (${opId}, ${x!.id}, ${E.ganho}, ${new Date(criado.getTime() + 1 * DIA).toISOString()}, 'evento')`;
          await sql`insert into lab.preco_negocio (operacao_id, negocio_id, momento, valor, em) values (${opId}, ${x!.id}, 'referencia', ${ref}, ${criado.toISOString()})`;
          await sql`insert into lab.preco_negocio (operacao_id, negocio_id, momento, valor, linhas, em) values (${opId}, ${x!.id}, 'fechado', 12000, ${sql.json([{ chave: 'custo', valor: custo }])}, ${new Date(criado.getTime() + 1 * DIA).toISOString()})`;
        }
      }
    };
    await planta(AGORA - 150 * DIA, 118, 40, 0.6, 0.5, 12500, 7200);   // base: 157 leads, 60% oport, 50% fecham
    await planta(AGORA - 29 * DIA, 27, 40, 0.6, 0.5, 13333, 8400);     // atual: 36 leads, desconto 10%, MC 30%
  });
  afterAll(async () => { await sql?.end(); });

  it('o medidor mede volumes, coorte, economia e aponta o que não tem fonte', async () => {
    const op = (await operacao(sql, 'int'))!, B = await carregarBase(sql, op, AGORA), medir = medidorDe(B);
    const leads = medir('leads', AGORA - 30 * DIA, AGORA)!; expect(leads.v).toBe(36);
    const base = medir('leads', AGORA - 120 * DIA, AGORA - 30 * DIA)!; expect(base.v).toBeGreaterThanOrEqual(110);
    const tx = medir('tx_fech', AGORA - 150 * DIA, AGORA - 30 * DIA)!; expect(tx.estado).toBe('ok'); expect(tx.v).toBeCloseTo(0.5, 1);
    const d1 = medir('desconto_medio', AGORA - 30 * DIA, AGORA)!, d0 = medir('desconto_medio', AGORA - 150 * DIA, AGORA - 30 * DIA)!; expect(d1.v).toBeCloseTo(0.1, 2); expect(d0.v).toBeCloseTo(0.04, 2);
    const m1 = medir('margem_contrib', AGORA - 30 * DIA, AGORA)!, m0 = medir('margem_contrib', AGORA - 150 * DIA, AGORA - 30 * DIA)!; expect(m1.v).toBeCloseTo(0.3, 2); expect(m0.v).toBeCloseTo(0.4, 2);
    expect(medir('recebiveis', 0, AGORA)!.estado).toBe('ausente'); expect(medir('recebiveis', 0, AGORA)!.nota).toContain('financeiro');
    expect(medir('contatos', 0, AGORA)!.estado).toBe('ausente'); expect(medir('investimento', AGORA - 30 * DIA, AGORA)!.estado).toBe('ausente');
    expect(medir('valor_aberto', AGORA - 30 * DIA, AGORA)!.estado).toBe('ok'); expect(medir('valor_aberto', AGORA - 60 * DIA, AGORA - 30 * DIA)!.estado).toBe('ausente');
  });
  it('avalia a biblioteca do pack: desconto comprando crescimento dispara, persiste histerese e observações, marca e expira', async () => {
    const op = (await operacao(sql, 'int'))!, pack = packDaOperacao('base', undefined, catalogo()).pack!;
    const bib = { hipoteses: pack.hipoteses as HipoteseV3[], intervencoes: pack.intervencoes, compostos: pack.compostos, orcamento: 5 };
    const R = await avaliarOperacao(sql, op, bib, AGORA);
    const d = R.achados.find(a => a.codigo === 'crescimento_com_desconto')!;
    expect(d.conds.find(c => c.met === 'desconto_medio')!.estado).toBe('verdadeiro'); expect(d.conds.find(c => c.met === 'margem_contrib')!.estado).toBe('verdadeiro');
    expect(['ativo', 'parcial']).toContain(d.estado); expect(d.impacto!.valor).toBeGreaterThan(0); expect(d.impacto!.dimensao).toBe('contribuicao');
    expect(R.achados.find(a => a.codigo === 'crescimento_consumindo_caixa')!.estado).toBe('nao_avaliavel');
    expect(R.achados.find(a => a.codigo === 'crescimento_consumindo_caixa')!.faltando).toContain('recebiveis');
    expect(R.margemRef).toBeCloseTo(0.4, 1);
    const est = await sql<any[]>`select codigo, ultimo_estado from lab.inteligencia_estado where operacao_id = ${opId}`; expect(est.length).toBe(bib.hipoteses.length);
    const obs = await sql<any[]>`select count(*)::int as n from lab.inteligencia_obs where operacao_id = ${opId}`; expect(obs[0]!.n).toBe(bib.hipoteses.length);
    const R2 = await avaliarOperacao(sql, op, bib, AGORA + DIA); expect((await sql<any[]>`select count(*)::int as n from lab.inteligencia_obs where operacao_id = ${opId}`)[0]!.n).toBe(bib.hipoteses.length);   // sem mudança, sem nova observação
    expect(R2.achados.find(a => a.codigo === 'crescimento_com_desconto')!.novo).toBe(false);
    /* marca "não procede" com o impacto de hoje: sai do visível; com referência pequena, expira (1,5×) e volta */
    await marcarAchado(sql, op, { codigo: 'crescimento_com_desconto', estado: 'naoprocede', motivo: 'promoção combinada', ref: d.impacto!.valor, por: 'Bruno' });
    let R3 = await avaliarOperacao(sql, op, bib, AGORA + DIA, undefined, { persistir: false });
    expect(R3.orcamento.tratados.some(a => a.codigo === 'crescimento_com_desconto')).toBe(true);
    await marcarAchado(sql, op, { codigo: 'crescimento_com_desconto', estado: 'naoprocede', ref: d.impacto!.valor / 3 });
    R3 = await avaliarOperacao(sql, op, bib, AGORA + DIA, undefined, { persistir: false });
    expect(R3.orcamento.tratados.some(a => a.codigo === 'crescimento_com_desconto')).toBe(false);
    /* sombra e calibração */
    await calibrarRegra(sql, op, 'crescimento_com_desconto', { estado: 'sombra' });
    expect((await avaliarOperacao(sql, op, bib, AGORA + DIA, undefined, { persistir: false })).achados.find(a => a.codigo === 'crescimento_com_desconto')!.sombra).toBe(true);
    await calibrarRegra(sql, op, 'crescimento_com_desconto', { estado: 'ativa', params: { desconto_medio: { limiar: 20 } } });
    expect((await avaliarOperacao(sql, op, bib, AGORA + DIA, undefined, { persistir: false })).achados.find(a => a.codigo === 'crescimento_com_desconto')!.conds.find(c => c.met === 'desconto_medio')!.estado).toBe('falso');
    await expect(calibrarRegra(sql, op, 'x', { params: { nao_existe: { limiar: 1 } } })).rejects.toThrow(/métrica desconhecida/);
    const S = await saudeDaOperacao(sql, op, R.achados); expect(S.regras).toBe(bib.hipoteses.length); expect(S.naoAvaliaveis).toBeGreaterThan(0);
  });
  it('diário de contexto entra na avaliação pela área; acurácia e waterfall do ciclo', async () => {
    const op = (await operacao(sql, 'int'))!, pack = packDaOperacao('base', undefined, catalogo()).pack!;
    const bib = { hipoteses: pack.hipoteses as HipoteseV3[], intervencoes: pack.intervencoes, compostos: pack.compostos };
    const ev = await registrarContexto(sql, op, { data: '2026-10-20', areas: ['Comercial', 'Inexistente'], descricao: 'Promoção de fim de mês com 10% para fechar no dia', por: 'Bruno' });
    expect(ev.areas).toEqual(['Comercial']);
    await expect(registrarContexto(sql, op, { data: '20/10/2026', descricao: 'x' })).rejects.toThrow(/AAAA-MM-DD/);
    const R = await avaliarOperacao(sql, op, bib, AGORA, undefined, { persistir: false });
    expect(R.contexto.length).toBe(1); expect(R.achados.find(a => a.codigo === 'crescimento_com_desconto')!.contexto.length).toBe(1);
    await apagarContexto(sql, op, ev.id); expect((await contextoEventos(sql, op, '2026-10-01', '2026-10-31')).length).toBe(0);
    const A = await acuraciaDaOperacao(sql, op, '2026-10-24'); expect(A.geral).toBeNull(); expect(A.nota).toContain('ainda não há');
    const W = await waterfallDoCiclo(sql, op, '2026-10-24'); expect(W.atual.vendas).toBeGreaterThan(0); expect(W.receita.total).toBe(W.atual.receita - W.anterior.receita); expect(W.margem).not.toBeNull(); expect(Math.abs(W.margem!.semExplicacao)).toBeLessThan(1); expect(W.anterior.comEconomia).toBeGreaterThan(0);
  });
});
