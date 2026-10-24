import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import { criarOperacao, importar, lerCSV } from '@lab/conectores';
import { bancoLimpo, catalogo, novoConector, semBanco } from './ajuda.js';

describe('lerCSV', () => {
  it('ponto e vírgula, aspas, quebra de linha dentro de aspas, BOM e CRLF', () => {
    const r = lerCSV('﻿id;nome;obs\r\n1;"Silva; Ana";"linha 1\nlinha 2"\r\n2;Bruno;"diz ""oi"""\r\n\r\n');
    expect(r.cabecalho).toEqual(['id', 'nome', 'obs']);
    expect(r.linhas).toEqual([['1', 'Silva; Ana', 'linha 1\nlinha 2'], ['2', 'Bruno', 'diz "oi"']]);
  });
  it('vírgula como separador', () => {
    expect(lerCSV('a,b\n1,2').linhas).toEqual([['1', '2']]);
  });
});

describe.skipIf(semBanco)('conector de planilha', () => {
  let sql: postgres.Sql, linha: any, op: string;
  const dep = () => ({ sql, segredos: () => undefined });

  beforeAll(async () => {
    sql = await bancoLimpo();
    op = (await criarOperacao(sql, { slug: 'b2b', nome: 'B2B', packId: 'base' }, catalogo())).id;
    linha = await novoConector(sql, op, 'planilha', { planilhas: { 'Pipeline Exportado': { tipo: 'negocios', colunas: { id: 'Código', cliente: 'Empresa', responsavel: 'Dono' } } } });
  });
  afterAll(async () => { await sql?.end(); });

  it('importa negócios com colunas padrão, números e datas brasileiras', async () => {
    const csv = [
      'id;cliente;canal;responsavel;etapa;valor_estimado;valor_fechado;criado_em;fechado_em;motivo_perda;preco_aprovado;custo_direto',
      'N-1;Acme Ltda;Indicação;Carla;negociacao;R$ 48.000,00;;01/09/2026;;;45.000,00;',
      'N-2;Beta SA;Prospecção ativa;Carla;ganho;;52.300,50;02/09/2026;30/09/2026;;;31.000',
      'N-3;Gama;Indicação;Diego;perdido;;;03/09/2026;20/09/2026;Preço;;',
    ].join('\n');
    const r = await importar(dep(), linha, { nome: 'negocios.csv', conteudo: csv });
    expect(r).toMatchObject({ ok: true, novos: 3, aplicados: 3, erros: 0 });
    const ns = await sql`select n.status, n.valor_fechado::float as vf, e.chave as etapa, c.chave as canal, p.nome as dono
      from lab.negocio n join lab.etapa e on e.id = n.etapa_id left join lab.canal c on c.id = n.canal_id left join lab.pessoa p on p.id = n.dono_id order by n.criado_em`;
    expect(ns.map(n => [n.etapa, n.canal, n.dono])).toEqual([['negociacao', 'indicacao', 'Carla'], ['ganho', 'outbound', 'Carla'], ['perdido', 'indicacao', 'Diego']]);
    expect(ns[1]!.vf).toBe(52300.5);
    const [c] = await sql`select linhas from lab.preco_negocio where momento = 'fechado'`;
    expect(c!.linhas).toEqual([{ chave: 'direto', valor: 31000 }]);
  });

  it('reimportar o mesmo arquivo não duplica; linha alterada é reaplicada', async () => {
    const csv = 'id;cliente;canal;responsavel;etapa;criado_em\nN-1;Acme Ltda;Indicação;Carla;proposta;01/09/2026';
    const r1 = await importar(dep(), linha, { nome: "negocios.csv", conteudo: csv }) as any;
    const r2 = await importar(dep(), linha, { nome: "negocios.csv", conteudo: csv }) as any;
    expect(r1.novos).toBe(1);
    expect(r2.novos).toBe(0);
    const [{ n }] = await sql`select count(*)::int as n from lab.negocio`;
    expect(n).toBe(3);
  });

  it('usa os nomes de coluna configurados e reconhece o arquivo pelo nome', async () => {
    const csv = 'Código;Empresa;Dono;etapa;criado_em\nX-9;Delta;Elisa;lead;2026-10-01';
    const r = await importar(dep(), linha, { nome: 'Pipeline Exportado - out.csv', conteudo: csv });
    expect(r).toMatchObject({ ok: true, aplicados: 1 });
  });

  it('atividades, investimentos, transições e erros por linha', async () => {
    const atv = 'data;pessoa;atividade;quantidade;negocio_id\n01/10/2026;Carla;tentativa;12;\n01/10/2026;Carla;agendamento;2;N-1\n01/10/2026;Carla;ligacao_x;1;';
    const r = await importar(dep(), linha, { nome: 'atividades.csv', conteudo: atv });
    expect(r).toMatchObject({ aplicados: 2, erros: 1 });
    expect((r as any).mensagens[0]).toMatch(/atividades\.csv, linha 4: .*ligacao_x/);
    const inv = 'mes;canal;valor;leads\n09/2026;Mídia paga;2.500,00;80\n2026-10;Mídia paga;3000;95';
    expect(await importar(dep(), linha, { nome: 'investimentos.csv', conteudo: inv })).toMatchObject({ aplicados: 2 });
    const tr = 'negocio_id;etapa;data\nN-2;agendada;05/09/2026\nN-2;proposta;12/09/2026';
    expect(await importar(dep(), linha, { nome: 'transicoes.csv', conteudo: tr })).toMatchObject({ aplicados: 2 });
    const ruim = 'id;cliente;criado_em\nN-7;Zeta;ontem';
    const rr = await importar(dep(), linha, { nome: 'negocios.csv', conteudo: ruim });
    expect((rr as any).mensagens.some((m: string) => /negocios\.csv, linha 2: .*criado_em.*não é uma data/.test(m))).toBe(true);
  });

  it('arquivo de tipo desconhecido falha com explicação', async () => {
    const r = await importar(dep(), linha, { nome: 'qualquer.csv', conteudo: 'a;b\n1;2' });
    expect(r).toMatchObject({ ok: false });
    expect((r as any).falha).toMatch(/comece o nome do arquivo/);
  });

  it('a execução fica registrada', async () => {
    const ex = await sql`select tipo, status from lab.execucao where conector_id = ${linha.id} order by id`;
    expect(ex.map(e => e.status)).toContain('parcial');
    expect(ex.every(e => e.tipo === 'importacao')).toBe(true);
  });
});
