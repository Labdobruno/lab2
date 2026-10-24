import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import type postgres from 'postgres';
import { criarApp, lerSegredo, rodadaAgendada } from '../src/app.js';
import { CATALOGO } from '../src/catalogo.js';
import { bancoLimpo, semBanco } from '../../../packages/conectores/test/ajuda.js';

const TOKEN = 'token-de-teste-com-mais-de-24-caracteres';

it('todo pack da pasta packs/ está no catálogo do Worker', () => {
  const naPasta = readdirSync(join(import.meta.dirname, '../../../packs')).filter(f => f.endsWith('.json') && f !== 'pack.schema.json').map(f => f.replace(/\.json$/, ''));
  expect(Object.keys(CATALOGO).sort()).toEqual(naPasta.sort());
});

it('a tela é pública, não carrega dados e vai com política de segurança', async () => {
  const app = criarApp({ sql: undefined as never, env: {} });
  const r = await app(new Request('https://lab.teste/app'));
  expect(r.status).toBe(200);
  expect(r.headers.get('content-security-policy')).toContain("default-src 'none'");
  const html = await r.text();
  expect(html).not.toMatch(/innerHTML/);
  const js = html.match(/<script>([\s\S]*)<\/script>/)![1]!;
  expect(() => new Function(js)).not.toThrow();
});

it('conectores não alcançam os segredos do próprio LAB', () => {
  const s = lerSegredo({ ADMIN_TOKEN: 'x', DATABASE_URL: 'y', AMICTA_CHAVE: 'amk' });
  expect(s('ADMIN_TOKEN')).toBeUndefined();
  expect(s('DATABASE_URL')).toBeUndefined();
  expect(s('amicta_chave')).toBeUndefined();
  expect(s('AMICTA_CHAVE')).toBe('amk');
});

describe.skipIf(semBanco)('API', () => {
  let sql: postgres.Sql, app: (r: Request) => Promise<Response>;
  const chamar = (metodo: string, caminho: string, corpo?: unknown, cab: Record<string, string> = {}) =>
    app(new Request(`https://lab.teste${caminho}`, {
      method: metodo, headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json', ...cab },
      ...(corpo !== undefined ? { body: typeof corpo === 'string' ? corpo : JSON.stringify(corpo) } : {}),
    }));

  beforeAll(async () => {
    sql = await bancoLimpo();
    app = criarApp({ sql, env: { ADMIN_TOKEN: TOKEN, LIC_N8N: 'segredo-n8n' } });
  });
  afterAll(async () => { await sql?.end(); });

  it('saúde', async () => {
    const r = await app(new Request('https://lab.teste/saude'));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true, banco: 'ok' });
  });

  it('admin exige token', async () => {
    expect((await app(new Request('https://lab.teste/admin/operacoes'))).status).toBe(401);
    const semToken = criarApp({ sql, env: {} });
    expect((await semToken(new Request('https://lab.teste/admin/operacoes'))).status).toBe(503);
  });

  it('métricas: dicionário, período inválido e operação inexistente', async () => {
    expect(((await (await chamar('GET', '/admin/metricas/dicionario')).json()) as any[]).some(m => m.chave === 'cac')).toBe(true);
    expect((await chamar('GET', '/admin/operacoes/nao-existe/metricas?de=2026-10-01&ate=2026-11-01')).status).toBe(404);
  });

  it('equipe e metas pela API', async () => {
    await chamar('POST', '/admin/operacoes', { slug: 'eq', nome: 'Equipe', packId: 'base' });
    expect((await chamar('POST', '/admin/operacoes/eq/pessoas', { nome: 'Sara', funcao: 'chefe' })).status).toBe(400);
    expect((await chamar('POST', '/admin/operacoes/eq/pessoas', { nome: '  ', funcao: 'sdr' })).status).toBe(400);
    const p = await (await chamar('POST', '/admin/operacoes/eq/pessoas', { nome: ' Sara ', funcao: 'sdr' })).json() as any;
    expect(p).toMatchObject({ nome: 'Sara', funcao: 'sdr', ativa: true });
    expect((await (await chamar('POST', `/admin/operacoes/eq/pessoas/${p.id}`, { ativa: false })).json() as any).ativa).toBe(false);
    expect((await chamar('POST', '/admin/operacoes/eq/pessoas/00000000-0000-4000-8000-000000000000', { ativa: false })).status).toBe(404);
    expect((await chamar('POST', '/admin/operacoes/eq/metas?data=2026-10-10', { metas: [{ indicador: 'tentativa', pessoaId: p.id, valor: 4000 }] })).status).toBe(201);
    const c = await (await chamar('GET', '/admin/operacoes/eq/ciclo?data=2026-10-10')).json() as any;
    expect(c.metas).toEqual([{ indicador: 'tentativa', pessoaId: p.id, valor: 4000 }]);
    expect((await chamar('GET', '/admin/operacoes/nao-existe/pessoas')).status).toBe(404);
  });

  it('plano do dia pela API: pessoa, rituais, nota, lançamento, ausência, capacidade e equipe', async () => {
    const appDia = criarApp({ sql, env: { ADMIN_TOKEN: TOKEN }, agora: () => new Date('2026-10-14T11:00:00Z') });   // 8h em São Paulo
    const dia = (metodo: string, caminho: string, corpo?: unknown) => appDia(new Request(`https://lab.teste${caminho}`, { method: metodo, headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json', 'x-lab-por': 'bruno' }, ...(corpo !== undefined ? { body: JSON.stringify(corpo) } : {}) }));
    await dia('POST', '/admin/operacoes', { slug: 'dia', nome: 'Dia', packId: 'base' });
    const p = await (await dia('POST', '/admin/operacoes/dia/pessoas', { nome: 'Sara', funcao: 'sdr' })).json() as any;
    await dia('POST', '/admin/operacoes/dia/metas?data=2026-10-14', { metas: [{ indicador: 'tentativa', pessoaId: p.id, valor: 220 }, { indicador: 'agendamento', pessoaId: p.id, valor: 22 }] });
    const [opl] = await sql`select id from lab.operacao where slug = 'dia'`;
    const [tipo] = await sql`select id from lab.tipo_atividade where operacao_id = ${opl!.id} and papel = 'tentativa' limit 1`;
    await sql`insert into lab.atividade (operacao_id, tipo_id, pessoa_id, em, quantidade) values (${opl!.id}, ${tipo!.id}, ${p.id}, '2026-10-14T10:30:00Z', 4)`;

    expect((await dia('GET', '/admin/operacoes/dia/dia')).status).toBe(400);
    expect((await dia('GET', `/admin/operacoes/dia/dia?pessoa=${p.id}&ritual=noite`)).status).toBe(400);
    expect((await dia('GET', `/admin/operacoes/dia/dia?pessoa=00000000-0000-4000-8000-000000000000`)).status).toBe(404);
    const D = await (await dia('GET', `/admin/operacoes/dia/dia?pessoa=${p.id}`)).json() as any;
    expect(D).toMatchObject({ data: '2026-10-14', ritual: 'manha', fracaoHoje: 0 });   // ritual pela hora local
    const t = D.prod.find((x: any) => x.k === 'tentativa');
    expect(t).toMatchObject({ diario: true, metaTotal: 220, feito: 4 });
    expect(D.sucesso.some((s: any) => s.k === 'prod:tentativa')).toBe(true);
    expect((await (await dia('GET', `/admin/operacoes/dia/dia?pessoa=${p.id}&data=2026-10-13`)).json() as any).ritual).toBe('fim');   // outro dia: leitura de fim do dia

    const f = await dia('POST', '/admin/operacoes/dia/dia/foto', { pessoa: p.id });
    expect(f.status).toBe(201); expect(await f.json()).toMatchObject({ gravada: true, ritual: 'manha' });
    expect((await dia('POST', '/admin/operacoes/dia/dia/foto', { pessoa: p.id })).status).toBe(200);
    expect((await (await dia('GET', `/admin/operacoes/dia/dia/fotos?pessoa=${p.id}`)).json() as any[]).map(x => x.ritual)).toEqual(['manha']);

    expect((await dia('POST', '/admin/operacoes/dia/dia/nota', { pessoa: p.id, chave: 'prod:tentativa', motivo: 'x' })).status).toBe(400);
    expect((await dia('POST', '/admin/operacoes/dia/dia/nota', { pessoa: p.id, chave: 'prod:tentativa', motivo: 'sistema de telefonia caiu', terceiro: true })).status).toBe(201);
    expect((await dia('POST', '/admin/operacoes/dia/dia/nota', { pessoa: p.id, chave: 'sem:agendamento', feito: true })).status).toBe(201);
    const D2 = await (await dia('GET', `/admin/operacoes/dia/dia?pessoa=${p.id}&ritual=tarde`)).json() as any;
    expect(D2.acoes.find((a: any) => a.chave === 'prod:tentativa').justificativa).toMatchObject({ motivo: 'sistema de telefonia caiu', terceiro: true, por: 'bruno' });
    expect(D2.sucesso.find((s: any) => s.k === 'sem:agendamento')).toMatchObject({ ok: true, marcado: { por: 'bruno' } });

    expect((await dia('POST', '/admin/operacoes/dia/dia/lancamentos', { pessoa: p.id, indicador: 'tentativa', delta: 5, motivo: 'oi' })).status).toBe(400);
    const l = await (await dia('POST', '/admin/operacoes/dia/dia/lancamentos', { pessoa: p.id, indicador: 'tentativa', delta: 5, motivo: 'ligações feitas no celular' })).json() as any;
    expect((await (await dia('GET', `/admin/operacoes/dia/dia?pessoa=${p.id}`)).json() as any).prod.find((x: any) => x.k === 'tentativa').feito).toBe(9);
    expect((await dia('POST', `/admin/operacoes/dia/dia/lancamentos/${l.id}/desfazer`)).status).toBe(200);
    expect((await dia('POST', `/admin/operacoes/dia/dia/lancamentos/${l.id}/desfazer`)).status).toBe(409);
    expect((await dia('POST', `/admin/operacoes/dia/dia/lancamentos/abc/desfazer`)).status).toBe(404);
    expect((await (await dia('GET', `/admin/operacoes/dia/dia/lancamentos?pessoa=${p.id}`)).json() as any[]).length).toBe(2);

    expect((await dia('POST', '/admin/operacoes/dia/ausencias', { pessoa: p.id, data: '2026-10-15', motivo: 'médico' })).status).toBe(200);
    expect((await (await dia('GET', '/admin/operacoes/dia/ausencias')).json() as any[])).toEqual([expect.objectContaining({ pessoa: 'Sara', data: '2026-10-15', motivo: 'médico' })]);
    expect((await (await dia('GET', `/admin/operacoes/dia/dia?pessoa=${p.id}`)).json() as any).ciclo.amanha).toBe('2026-10-16');
    expect((await dia('POST', '/admin/operacoes/dia/ausencias', { pessoa: p.id, data: '2026-10-15', remover: true })).status).toBe(200);

    expect((await dia('POST', `/admin/operacoes/dia/pessoas/${p.id}/capacidade`, { capacidade: -3 })).status).toBe(400);
    expect((await dia('POST', `/admin/operacoes/dia/pessoas/${p.id}/capacidade`, { capacidade: 45 })).status).toBe(200);
    expect((await (await dia('GET', '/admin/operacoes/dia/pessoas')).json() as any[])[0].capacidadeDia).toBe(45);
    expect((await (await dia('GET', `/admin/operacoes/dia/dia?pessoa=${p.id}`)).json() as any).cap).toMatchObject({ v: 45, fonte: 'apontada' });

    const E = await (await dia('GET', '/admin/operacoes/dia/dia/equipe')).json() as any;
    expect(E).toMatchObject({ data: '2026-10-14', ritual: 'manha', pessoas: 1 });
    expect(E.quadro[0]).toMatchObject({ pessoa: 'Sara', funcao: 'Pré-vendas' });
    expect((await dia('GET', '/admin/operacoes/nao-existe/dia/equipe')).status).toBe(404);
  });

  it('hipóteses: biblioteca, achados, qualidade, decisão e experimento', async () => {
    expect(Object.keys(await (await chamar('GET', '/admin/hipoteses/variaveis')).json() as object)).toContain('taxa_ganho');
    await chamar('POST', '/admin/operacoes', { slug: 'hip', nome: 'Hip', packId: 'base' });
    /* operação criada antes da fase 6: o pack guardado não tem a biblioteca, e ela vem do catálogo */
    await sql`update lab.operacao set pack = pack - 'hipoteses' where slug = 'hip'`;
    const lib = await (await chamar('GET', '/admin/operacoes/hip/hipoteses')).json() as any[];
    expect(lib.length).toBeGreaterThanOrEqual(8);
    const a = await (await chamar('GET', '/admin/operacoes/hip/achados?data=2026-10-24')).json() as any;
    expect(a).toMatchObject({ orcamento: 3, achados: [], errosDeFormula: [] });
    expect(a.semDados.length).toBeGreaterThan(0);
    expect(a.contexto.vendas).toBe(0);
    const q = await (await chamar('GET', '/admin/operacoes/hip/qualidade')).json() as any;
    expect(q.checagens.length).toBeGreaterThan(10);
    expect((await chamar('POST', '/admin/operacoes/hip/decisoes', { pergunta: 'x' })).status).toBe(400);
    const d = await (await chamar('POST', '/admin/operacoes/hip/decisoes', { pergunta: 'Mudar o canal?', escolha: 'Sim', opcoes: ['Sim', 'Não'] })).json() as any;
    expect(await (await chamar('GET', '/admin/operacoes/hip/decisoes')).json()).toHaveLength(1);
    const e = await (await chamar('POST', '/admin/operacoes/hip/experimentos', { titulo: 'Testar', metrica: 'vendas', alvo: 0, decisaoId: d.id })).json() as any;
    expect(e.status).toBe('rodando');
    expect((await chamar('POST', '/admin/operacoes/hip/experimentos', { titulo: 'Testar', metrica: 'nada', alvo: 1 })).status).toBe(400);
    const c = await (await chamar('POST', `/admin/operacoes/hip/experimentos/${e.id}/concluir`, { conclusao: 'ok' })).json() as any;
    expect(c).toMatchObject({ status: 'concluido', atingiu: true });
    expect((await chamar('POST', `/admin/operacoes/hip/experimentos/${e.id}/concluir`, {})).status).toBe(409);
    expect((await chamar('GET', '/admin/operacoes/nao-existe/achados')).status).toBe(404);
  });

  it('studio: funil observado, simulação, funis versionados e campanhas', async () => {
    await chamar('POST', '/admin/operacoes', { slug: 'stu', nome: 'Studio', packId: 'base' });
    const obs = await (await chamar('GET', '/admin/operacoes/stu/studio/observado?data=2026-10-24')).json() as any;
    expect(obs.grafo.entrada).toBe('lead');
    expect(obs.grafo.nos.length).toBeGreaterThan(5);
    expect(obs.simulacao.ok).toBe(false);                     // sem histórico: não inventa
    const grafo = { entrada: 'a', nos: [{ id: 'a', nome: 'Lead', tipo: 'etapa' }, { id: 'g', nome: 'Venda', tipo: 'ganho' }, { id: 'p', nome: 'Perdido', tipo: 'perdido' }], arestas: [{ de: 'a', para: 'g', taxa: 0.2 }, { de: 'a', para: 'p', taxa: 0.8 }] };
    const sim = await (await chamar('POST', '/admin/operacoes/stu/studio/simular', { grafo, entrada: 100, ticketMedio: 1000 })).json() as any;
    expect(sim.ok).toBe(true);
    expect(sim.simulacao).toMatchObject({ vendas: 20, receita: 20000 });
    expect(sim.alavancas[0]).toMatchObject({ aresta: 'a>g', ganhoVendas: 5 });
    const alt = await (await chamar('POST', '/admin/operacoes/stu/studio/simular', { grafo, entrada: 100, ticketMedio: 1000, alteracoes: { 'a>g': 0.5, 'a>p': 0.5 } })).json() as any;
    expect(alt.simulacao.vendas).toBe(50);
    expect((await chamar('POST', '/admin/operacoes/stu/studio/simular', { grafo: { ...grafo, arestas: [{ de: 'a', para: 'a', taxa: 1 }] } })).status).toBe(400);
    expect((await chamar('POST', '/admin/operacoes/stu/studio/funis', { nome: 'Funil enxuto', grafo })).status).toBe(201);
    expect(((await (await chamar('POST', '/admin/operacoes/stu/studio/funis', { nome: 'Funil enxuto', grafo })).json()) as any).versao).toBe(2);
    expect(await (await chamar('GET', '/admin/operacoes/stu/studio/funis')).json()).toHaveLength(1);
    expect((await chamar('POST', '/admin/operacoes/stu/studio/funis', { nome: 'Ruim', grafo: { ...grafo, entrada: 'zzz' } })).status).toBe(400);

    const c = await chamar('POST', '/admin/operacoes/stu/studio/campanhas', { nome: 'Campanha A', canal: 'pago', fim: '2026-12-31', orcamento: 5000, funil: 'Funil enxuto', cpl: 50, ticketMedio: 1000 });
    expect(c.status).toBe(201);
    const { id, projecao } = await c.json() as any;
    expect(projecao).toMatchObject({ leads: 100, vendas: 20, cac: 250, roi: 3 });
    expect((await chamar('POST', '/admin/operacoes/stu/studio/campanhas', { nome: 'Sem CPL', canal: 'pago', fim: '2026-12-31', orcamento: 5000, funil: 'Funil enxuto' })).status).toBe(409);
    expect((await chamar('POST', `/admin/operacoes/stu/studio/campanhas/${id}/iniciar`)).status).toBe(200);
    const enc = await (await chamar('POST', `/admin/operacoes/stu/studio/campanhas/${id}/encerrar`, { investimentoReal: 4000 })).json() as any;
    expect(enc).toMatchObject({ status: 'encerrada', realizado: { leads: 0, vendas: 0, investimento: 4000 } });
    expect((await chamar('POST', `/admin/operacoes/stu/studio/campanhas/${id}/encerrar`, {})).status).toBe(409);
    const lista = await (await chamar('GET', '/admin/operacoes/stu/studio/campanhas')).json() as any[];
    expect(lista.map(x => x.status)).toEqual(['encerrada']);
    expect((await chamar('GET', '/admin/operacoes/nao-existe/studio/observado')).status).toBe(404);
  });

  it('lista packs válidos', async () => {
    const r = await (await chamar('GET', '/admin/packs')).json() as any[];
    expect(r.every(p => p.ok)).toBe(true);
  });

  it('cria operação e recusa duplicada', async () => {
    expect((await chamar('POST', '/admin/operacoes', { slug: 'licitacao', nome: 'Assessoria de licitação', packId: 'base' })).status).toBe(201);
    expect((await chamar('POST', '/admin/operacoes', { slug: 'licitacao', nome: 'De novo', packId: 'base' })).status).toBe(409);
    expect((await chamar('POST', '/admin/operacoes', { slug: 'x', nome: 'X', packId: 'nao-existe' })).status).toBe(400);
  });

  it('cria conectores validando config e segredo', async () => {
    const ruim = await chamar('POST', '/admin/conectores', { operacao: 'licitacao', tipo: 'amicta-crm-v1', nome: 'crm', config: { dadosPessoais: 'todos' } });
    expect(ruim.status).toBe(400);
    expect((await ruim.json() as any).erro).toMatch(/dadosPessoais/);
    expect((await chamar('POST', '/admin/conectores', { operacao: 'licitacao', tipo: 'canonico', nome: 'n8n', segredoRef: 'ADMIN_TOKEN' })).status).toBe(400);
    const ok = await chamar('POST', '/admin/conectores', { operacao: 'licitacao', tipo: 'canonico', nome: 'n8n', segredoRef: 'LIC_N8N' });
    expect(ok.status).toBe(201);
    expect((await ok.json() as any).webhook).toMatch(/^\/entrada\//);
    expect((await chamar('POST', '/admin/conectores', { operacao: 'licitacao', tipo: 'planilha', nome: 'planilhas' })).status).toBe(201);
  });

  it('webhook público entra pelo conector, com a chave dele', async () => {
    const [c] = await sql`select id from lab.conector where nome = 'n8n'`;
    const corpo = { id: 'l1', comandos: [{ tipo: 'negocio.upsert', ref: 'E-1', etapa: 'agendada', criadoEm: '2026-10-01', canalRef: 'outbound' }] };
    const r = await app(new Request(`https://lab.teste/entrada/${c!.id}`, { method: 'POST', headers: { authorization: 'Bearer segredo-n8n' }, body: JSON.stringify(corpo) }));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ aplicados: 1 });
    expect((await app(new Request('https://lab.teste/entrada/nao-e-uuid', { method: 'POST', body: '{}' }))).status).toBe(404);
  });

  it('importa planilha pela API e mostra a saúde do conector', async () => {
    const [c] = await sql`select id from lab.conector where nome = 'planilhas'`;
    const csv = 'id;cliente;canal;responsavel;etapa;criado_em\nE-2;Prefeitura X;Evento Setorial;Bruno;proposta;10/10/2026';
    const r = await chamar('POST', `/admin/conectores/${c!.id}/importar?nome=negocios.csv`, csv, { 'content-type': 'text/csv' });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true, aplicados: 1 });
    const s = await (await chamar('GET', `/admin/conectores/${c!.id}/saude`)).json() as any;
    expect(s.entradas.aplicado).toBe(1);
    expect(s.revisar).toEqual([expect.objectContaining({ o_que: 'canal', chave: 'evento_setorial' })]);
  });

  it('rodada agendada processa todos os conectores ativos', async () => {
    const r = await rodadaAgendada({ sql, env: { ADMIN_TOKEN: TOKEN } });
    expect(Object.keys(r).sort()).toEqual(['n8n', 'planilhas']);
  });
});
