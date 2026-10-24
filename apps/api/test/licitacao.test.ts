import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type postgres from 'postgres';
import { criarOperacao, importar } from '@lab/conectores';
import { relatorio } from '@lab/metricas';
import { operacao } from '@lab/planejamento';
import { avaliarHipoteses, checarQualidade, montarContexto } from '@lab/hipoteses';
import { packDaOperacao } from '@lab/conectores';
import { bancoLimpo, catalogo, novoConector, semBanco } from '../../../packages/conectores/test/ajuda.js';

const PASTA = join(import.meta.dirname, '../../../docs/exemplos/licitacao');
const HOJE = '2026-10-24';

describe.skipIf(semBanco)('segunda operação: assessoria de licitação (pack licitacao-b2b + planilhas)', () => {
  let sql: postgres.Sql, opId: string, conector: any;
  beforeAll(async () => {
    sql = await bancoLimpo();
    opId = (await criarOperacao(sql, { slug: 'lic', nome: 'Assessoria de licitação', packId: 'licitacao-b2b' }, catalogo())).id;
    conector = await novoConector(sql, opId, 'planilha');
  });
  afterAll(async () => { await sql?.end(); });

  it('importa as planilhas de exemplo sem nenhum erro', async () => {
    for (const arq of ['pessoas.csv', 'negocios.csv', 'atividades.csv', 'investimentos.csv', 'contratos.csv']) {
      const r = await importar({ sql, segredos: () => undefined }, conector, { nome: arq, conteudo: readFileSync(join(PASTA, arq), 'utf8') }) as any;
      expect(r, arq).toMatchObject({ ok: true, erros: 0 });
      expect(r.aplicados, arq).toBeGreaterThan(0);
    }
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from lab.negocio`;
    expect(n).toBe(14);
    /* nenhum canal, motivo ou condição teve de ser inventado: tudo casou com o pack */
    expect(await sql`select chave from lab.canal where a_revisar union all select chave from lab.motivo_perda where a_revisar union all select chave from lab.condicao_pagamento where a_revisar`).toEqual([]);
  });

  it('o funil e as métricas falam em papéis, igual a qualquer operação', async () => {
    const op = (await operacao(sql, 'lic'))!;
    expect(op.janelaHistoricaDias).toBe(365);
    const r = await relatorio(sql, op, { de: '2026-07-01', ate: '2026-11-01' });
    expect(r.coorte.coorte).toBe(14);
    expect(r.coorte.etapas.find(e => e.papel === 'ganho')).toMatchObject({ sucessos: 3 });
    expect(r.coorte.etapas.find(e => e.papel === 'proposta')!.sucessos).toBeGreaterThanOrEqual(5);   // quem ganhou, perdeu depois ou está em negociação passou por aqui
    expect(r.taxaDeGanho).toMatchObject({ sucessos: 3, total: 6 });
    expect(r.vendas).toMatchObject({ quantidade: 3, receita: 144000 });
    const pago = r.canais.find(c => c.canal === 'pago')!;
    expect(pago).toMatchObject({ investimento: 13000, leads: 4 });
    /* economia da venda L-001: referência 54.000, fechado 48.000, custo da equipe 21.000 */
    const l1 = r.vendas.economia.find(e => e.referencia === 54000)!;
    expect(l1.descontoSobreReferencia).toBeCloseTo(1 - 48000 / 54000, 6);
    expect(l1.margemContribuicao).toBe(27000);
    /* retenção: 2 contratos recorrentes ativos em 01/10, 1 cancelado em 30/09 antes disso; receita recorrente de 7.000 */
    const rr = await relatorio(sql, op, { de: '2026-10-01', ate: '2026-11-01' });
    expect(rr.retencao.mrrInicial).toBe(7000);
  });

  it('achados e qualidade rodam com a biblioteca da licitação (herdada + própria)', async () => {
    const op = (await operacao(sql, 'lic'))!;
    const pack = packDaOperacao('licitacao-b2b', undefined, catalogo()).pack!;
    expect(pack.hipoteses.map(h => h.chave)).toEqual(expect.arrayContaining(['desconto_alto', 'churn_alto', 'recorrencia_encolhendo', 'proposta_nao_avanca']));
    const ctx = await montarContexto(sql, op, HOJE, { amostraMinima: pack.parametros.amostraMinima });
    const r = avaliarHipoteses(pack.hipoteses, ctx, pack.parametros.orcamentoAtencao);
    expect(r.errosDeFormula).toEqual([]);
    expect(r.achados.length).toBeLessThanOrEqual(3);
    expect(ctx.taxa_ganho).toBe(0.5);
    const q = await checarQualidade(sql, op, HOJE);
    const por = Object.fromEntries(q.checagens.map(c => [c.chave, c]));
    expect(por.ganho_sem_valor!.ok).toBe(true);
    expect(por.ganho_sem_preco_fechado!.ok).toBe(true);
    expect(por.pessoas_sem_meta!.quantidade).toBe(3);        // ainda não há metas cadastradas
  });
});
