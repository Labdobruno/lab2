/* Checagens de qualidade de dados: o que está faltando ou torto no modelo e distorce os números.
   Cada checagem diz quantos casos, dá até 5 exemplos (ids) e explica o efeito em português. */
import type { Sql } from 'postgres';
import { cicloDaOperacao, somarDias, type Operacao } from '@lab/planejamento';

export interface Checagem { chave: string; nome: string; severidade: 'alta' | 'media' | 'baixa'; quantidade: number; exemplos: string[]; efeito: string; ok: boolean }

export async function checarQualidade(sql: Sql, op: Operacao, hoje: string): Promise<{ checagens: Checagem[]; problemas: Checagem[]; tudoCerto: number }> {
  const id = op.id;
  const ciclo = cicloDaOperacao(op, hoje);
  const janelaDe = somarDias(hoje, -op.janelaHistoricaDias);
  const q = async (sqlTexto: Promise<any[]>) => { const l = await sqlTexto; return { n: Number(l[0]?.n ?? 0), ex: (Array.isArray(l[0]?.ex) ? l[0]!.ex : []) as string[] }; };
  const [semCanal, ganhoSemValor, ganhoSemPreco, abertoSemDono, fechaAntes, perdidoSemMotivo, atividadeSemPessoa, abertoSemValor, contratoSemPeriodo, pessoasSemMeta, pagoSemInvest, revisar, inferidas] = await Promise.all([
    q(sql`select count(*)::int as n, to_jsonb((array_agg(id::text))[1:5]) as ex from lab.negocio where operacao_id = ${id} and canal_id is null`),
    q(sql`select count(*)::int as n, to_jsonb((array_agg(id::text))[1:5]) as ex from lab.negocio where operacao_id = ${id} and status = 'ganho' and valor_fechado is null`),
    q(sql`select count(*)::int as n, to_jsonb((array_agg(n.id::text))[1:5]) as ex from lab.negocio n where n.operacao_id = ${id} and n.status = 'ganho' and n.tipo = 'novo'
          and not exists (select 1 from lab.preco_negocio p where p.negocio_id = n.id and p.momento = 'fechado')`),
    q(sql`select count(*)::int as n, to_jsonb((array_agg(id::text))[1:5]) as ex from lab.negocio where operacao_id = ${id} and status = 'aberto' and dono_id is null`),
    q(sql`select count(*)::int as n, to_jsonb((array_agg(id::text))[1:5]) as ex from lab.negocio where operacao_id = ${id} and fechado_em is not null and fechado_em < criado_em`),
    q(sql`select count(*)::int as n, to_jsonb((array_agg(id::text))[1:5]) as ex from lab.negocio where operacao_id = ${id} and status = 'perdido' and motivo_perda_id is null`),
    q(sql`select count(*)::int as n, to_jsonb((array_agg(id::text))[1:5]) as ex from lab.atividade where operacao_id = ${id} and pessoa_id is null`),
    q(sql`select count(*)::int as n, to_jsonb((array_agg(id::text))[1:5]) as ex from lab.negocio where operacao_id = ${id} and status = 'aberto' and tipo = 'novo' and valor_estimado is null`),
    q(sql`select count(*)::int as n, to_jsonb((array_agg(id::text))[1:5]) as ex from lab.contrato where operacao_id = ${id} and recorrente and periodicidade_meses is null`),
    q(sql`select count(*)::int as n, to_jsonb((array_agg(p.nome))[1:5]) as ex from lab.pessoa p where p.operacao_id = ${id} and p.ativa and p.funcao in ('sdr', 'closer', 'ambos')
          and not exists (select 1 from lab.meta m where m.operacao_id = ${id} and m.ciclo_inicio = ${ciclo.inicio}::date and m.pessoa_id = p.id)`),
    q(sql`select count(*)::int as n, to_jsonb((array_agg(c.chave))[1:5]) as ex from lab.canal c where c.operacao_id = ${id} and c.ativo and c.tipo = 'pago'
          and exists (select 1 from lab.negocio n where n.canal_id = c.id and (n.criado_em at time zone ${op.fuso})::date >= ${janelaDe}::date)
          and not exists (select 1 from lab.investimento_canal i where i.canal_id = c.id and i.mes >= date_trunc('month', ${janelaDe}::date))`),
    q(sql`select count(*)::int as n, to_jsonb((array_agg(chave))[1:5]) as ex from (
            select chave from lab.canal where operacao_id = ${id} and a_revisar
            union all select chave from lab.motivo_perda where operacao_id = ${id} and a_revisar
            union all select chave from lab.condicao_pagamento where operacao_id = ${id} and a_revisar) x`),
    q(sql`select count(*) filter (where origem = 'inferida')::int as n, '[]'::jsonb as ex, count(*)::int as total from lab.negocio_transicao where operacao_id = ${id}`),
  ]);
  const [{ total = 0 } = {}] = await sql<{ total: number }[]>`select count(*)::int as total from lab.negocio_transicao where operacao_id = ${id}`;
  const pctInferidas = total ? inferidas.n / total : 0;

  const c = (chave: string, nome: string, severidade: Checagem['severidade'], r: { n: number; ex: string[] }, efeito: string): Checagem =>
    ({ chave, nome, severidade, quantidade: r.n, exemplos: r.ex ?? [], efeito, ok: r.n === 0 });
  const checagens: Checagem[] = [
    c('ganho_sem_valor', 'Vendas ganhas sem valor fechado', 'alta', ganhoSemValor, 'A receita, o ticket médio e o CAC saem subestimados.'),
    c('fechamento_antes_da_criacao', 'Negócios fechados antes de serem criados', 'alta', fechaAntes, 'Conversões por coorte e tempos de ciclo ficam errados.'),
    c('ganho_sem_preco_fechado', 'Vendas ganhas sem custos informados', 'media', ganhoSemPreco, 'Sem isso não há margem de contribuição nem MC menos CAC dessas vendas.'),
    c('negocios_sem_canal', 'Negócios sem canal de origem', 'media', semCanal, 'Aparecem como "(sem canal)": CPL, CAC e ROI por canal perdem precisão.'),
    c('pago_sem_investimento', 'Canais pagos com leads e sem investimento lançado', 'media', pagoSemInvest, 'O CAC desses canais não pode ser calculado.'),
    c('perdido_sem_motivo', 'Perdas sem motivo', 'media', perdidoSemMotivo, 'Não dá para saber por que se perde (preço, timing, concorrência…).'),
    c('pessoas_sem_meta', 'Pessoas do time sem meta neste ciclo', 'media', pessoasSemMeta, 'Elas não entram no ritmo nem no Fechamento do dia.'),
    c('contrato_sem_periodicidade', 'Contratos recorrentes sem periodicidade', 'media', contratoSemPeriodo, 'O MRR, o churn e o LTV assumem mensal, o que pode estar errado.'),
    c('negocios_abertos_sem_dono', 'Negócios abertos sem responsável', 'baixa', abertoSemDono, 'Ninguém é cobrado por eles no ritmo do time.'),
    c('abertos_sem_valor', 'Negócios abertos sem valor estimado', 'baixa', abertoSemValor, 'O valor do pipeline e o parado ficam subestimados.'),
    c('atividades_sem_pessoa', 'Atividades sem pessoa', 'baixa', atividadeSemPessoa, 'Contam no total da operação, mas não no ritmo de ninguém.'),
    c('itens_a_revisar', 'Canais, motivos ou condições criados automaticamente', 'baixa', revisar, 'Confirme o tipo de cada um para as métricas por tipo ficarem certas.'),
    { chave: 'transicoes_inferidas', nome: 'Mudanças de etapa inferidas pelo sistema', severidade: 'baixa', quantidade: inferidas.n, exemplos: [],
      efeito: `${Math.round(pctInferidas * 100)}% do histórico de etapas foi deduzido, não recebido da fonte: datas de passagem podem ser aproximadas.`, ok: pctInferidas <= 0.3 },
  ];
  const ordem = { alta: 0, media: 1, baixa: 2 };
  const problemas = checagens.filter(x => !x.ok).sort((a, b) => ordem[a.severidade] - ordem[b.severidade] || b.quantidade - a.quantidade);
  return { checagens, problemas, tudoCerto: checagens.length - problemas.length };
}
