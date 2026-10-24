import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import { comandosDoEvento, comandosDoNegocio, conectorAmicta, criarOperacao, hmacSha256, receberWebhook, sincronizar } from '@lab/conectores';
import { bancoLimpo, catalogo, novoConector, semBanco } from './ajuda.js';

const cfg = conectorAmicta.config.parse({});
const negocio = (x: object = {}) => ({
  id: '1936c9b7a9be4e', cliente: { nome: 'Ana Lima', telefone: '5511977776666', email: 'ana@exemplo.com', pessoa: 'pf', conta_luz: 850 },
  endereco: { rua: 'Rua X', numero: '10', cidade: 'Curitiba', uf: 'PR', cep: '80000000' }, consultor: 'Marina', canal: 'Meta Ads',
  pipeline: 'solar', etapa: 'lead', etapa_desde: '2026-10-15T14:03:12.000Z', valor_estimado: null, valor_fechado: null, fechado_em: null, perda: null,
  forma_pagamento: null, externo_id: 'fb-lead-118223', proposta_status: 'nenhuma', orcamento: null,
  criado_em: '2026-10-15T14:03:12.000Z', atualizado_em: '2026-10-15T14:03:12.000Z', ...x,
});

describe('tradução Amicta → LAB', () => {
  it('nunca leva telefone, e-mail, endereço ou conta de luz', async () => {
    const cmds = await comandosDoNegocio(negocio() as never, cfg);
    const txt = JSON.stringify(cmds);
    for (const proibido of ['977776666', 'ana@exemplo.com', 'Rua X', '80000000', '850']) expect(txt).not.toContain(proibido);
    expect(cmds.find(c => c.tipo === 'conta.upsert')).toMatchObject({ nome: 'Ana Lima', cidade: 'Curitiba', uf: 'PR', ref: expect.stringMatching(/^conta:tel:/) });
  });

  it('modo "nenhum" também esconde o nome do cliente', async () => {
    const cmds = await comandosDoNegocio(negocio() as never, conectorAmicta.config.parse({ dadosPessoais: 'nenhum' }));
    expect(JSON.stringify(cmds)).not.toContain('Ana Lima');
  });

  it('mesmo telefone = mesma conta (expansão para o mesmo cliente)', async () => {
    const a = (await comandosDoNegocio(negocio() as never, cfg)).find(c => c.tipo === 'conta.upsert')!;
    const b = (await comandosDoNegocio(negocio({ id: 'outro' }) as never, cfg)).find(c => c.tipo === 'conta.upsert')!;
    expect(a.ref).toBe(b.ref);
  });

  it('etapa alterada vira transição explícita; ganho registra preço fechado', async () => {
    const ev = { id: 'evt_1', evento: 'negocio.etapa_alterada', criado_em: '2026-10-16T10:00:00Z',
      dados: { negocio: negocio({ etapa: 'ganho', valor_fechado: 21334.68, fechado_em: '2026-10-16T10:00:00Z', forma_pagamento: { tipo: 'c6040' } }), de: 'negociacao', para: 'ganho' } };
    const cmds = await comandosDoEvento(ev as never, cfg);
    expect(cmds.find(c => c.tipo === 'negocio.transicao')).toMatchObject({ para: 'ganho', de: 'negociacao', em: '2026-10-16T10:00:00Z' });
    expect(cmds.find(c => c.tipo === 'preco.registrar')).toMatchObject({ momento: 'fechado', valor: 21334.68, condicao: 'c6040' });
  });

  it('título a receber vira recebimento; a pagar é ignorado; nota não leva o texto', async () => {
    const receber = { id: 'e2', evento: 'financeiro.titulo_baixado', criado_em: '2026-10-20T10:00:00Z',
      dados: { titulo: { id: 't8', tipo: 'receber', status: 'pago', valor: 9000, vencimento: '2026-10-20', negocio_id: 'n1', baixa: { data: '2026-10-20', valor: 8000 } } } };
    expect(await comandosDoEvento(receber as never, cfg)).toEqual([expect.objectContaining({ tipo: 'recebimento.upsert', status: 'parcial', valorRecebido: 8000 })]);
    const pagar = { ...receber, dados: { titulo: { ...receber.dados.titulo, tipo: 'pagar' } } };
    expect(await comandosDoEvento(pagar as never, cfg)).toEqual([]);
    const nota = { id: 'e3', evento: 'atividade.registrada', criado_em: '2026-10-20T10:00:00Z', dados: { negocio_id: 'n1', atividade: { id: 'a1', texto: 'Ligar para Ana no 11 97777-6666', autor: 'Marina', em: '2026-10-20T09:00:00Z' } } };
    const c = await comandosDoEvento(nota as never, cfg);
    expect(JSON.stringify(c)).not.toContain('97777');
    expect(await comandosDoEvento({ id: 'e4', evento: 'teste', criado_em: '2026-10-20T10:00:00Z', dados: {} } as never, cfg)).toEqual([]);
  });
});

describe('assinatura do webhook', () => {
  const corpo = JSON.stringify({ id: 'evt_9', evento: 'teste', criado_em: '2026-10-15T14:03:12.000Z', dados: {} });
  const agora = new Date('2026-10-15T14:03:20Z');
  const ts = String(Math.floor(agora.getTime() / 1000) - 8);
  const seg = (n?: string) => (n === 'webhook' ? 'whsec_teste' : undefined);
  const req = async (s: string, t = ts) => ({ cabecalhos: new Headers({ 'x-amicta-timestamp': t, 'x-amicta-assinatura': `sha256=${await hmacSha256(s, `${t}.${corpo}`)}` }), corpo });

  it('aceita assinatura correta', async () => expect(await conectorAmicta.webhook!.verificar(await req('whsec_teste'), seg, agora)).toEqual({ ok: true }));
  it('recusa segredo errado', async () => expect((await conectorAmicta.webhook!.verificar(await req('outro'), seg, agora)).ok).toBe(false));
  it('recusa timestamp velho (reenvio)', async () => {
    const velho = String(Number(ts) - 600);
    expect(await conectorAmicta.webhook!.verificar(await req('whsec_teste', velho), seg, agora)).toMatchObject({ ok: false, motivo: expect.stringMatching(/janela/) });
  });
});

describe.skipIf(semBanco)('Amicta de ponta a ponta (CRM simulado)', () => {
  let sql: postgres.Sql, linha: any;
  const chamadas: string[] = [];
  const respostas: Record<string, (u: URL) => unknown> = {
    '/api/v1/usuarios': () => ({ dados: [{ nome: 'Marina', email: 'marina@amicta.com', papel: 'vendedor', ativo: true }] }),
    '/api/v1/negocios': u => u.searchParams.get('pagina') === '1'
      ? { dados: [negocio({ etapa: 'reuniao_ag', atualizado_em: '2026-10-16T09:00:00Z' })], pagina: 1, limite: 200, tem_mais: true }
      : { dados: [negocio({ id: 'n2', cliente: { nome: 'Bia', telefone: '5541999990000' }, etapa: 'perdido', perda: { motivo: 'Financiamento negado' } })], pagina: 2, limite: 200, tem_mais: false },
    '/api/v1/eventos': () => ({ dados: [
      { id: 'evt_a', evento: 'negocio.etapa_alterada', criado_em: '2026-10-16T09:00:00Z', dados: { negocio: negocio({ etapa: 'reuniao_ag', atualizado_em: '2026-10-16T09:00:00Z' }), de: 'lead', para: 'reuniao_ag' } },
      { id: 'evt_b', evento: 'teste', criado_em: '2026-10-16T09:01:00Z', dados: {} },
    ], proximo_desde: '2026-10-16T09:01:00.000Z' }),
  };
  const fetchFalso: typeof fetch = async (entrada, init) => {
    const u = new URL(String(entrada));
    chamadas.push(u.pathname + u.search);
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer amk_teste');
    const f = respostas[u.pathname];
    return f ? new Response(JSON.stringify(f(u)), { status: 200 }) : new Response('{"erro":"Rota não existe"}', { status: 404 });
  };
  const dep = () => ({ sql, segredos: (r: string) => ({ AMICTA_CHAVE: 'amk_teste', AMICTA_WEBHOOK: 'whsec_teste' } as Record<string, string>)[r], fetch: fetchFalso, agora: () => new Date('2026-10-16T12:00:00Z') });

  beforeAll(async () => {
    sql = await bancoLimpo();
    const op = (await criarOperacao(sql, { slug: 'amicta', nome: 'Amicta', packId: 'solar-b2c' }, catalogo())).id;
    linha = await novoConector(sql, op, 'amicta-crm-v1', { pausaMs: 0, mapa: { motivosPerda: { 'Financiamento negado': 'financiamento' } } }, 'AMICTA');
  });
  afterAll(async () => { await sql?.end(); });

  it('sincroniza equipe, negócios paginados e eventos; guarda o cursor', async () => {
    const r = await sincronizar(dep(), linha);
    expect(r).toMatchObject({ ok: true, erros: 0 });
    expect(chamadas.filter(c => c.startsWith('/api/v1/negocios'))).toHaveLength(2);
    const [c] = await sql`select cursor from lab.conector where id = ${linha.id}`;
    expect(c!.cursor).toEqual({ negociosDesde: '2026-10-16T12:00:00.000Z', eventosDesde: '2026-10-16T09:01:00.000Z' });
    const ns = await sql`select e.chave as etapa, m.chave as motivo, p.funcao from lab.negocio n join lab.etapa e on e.id = n.etapa_id
      left join lab.motivo_perda m on m.id = n.motivo_perda_id left join lab.pessoa p on p.id = n.dono_id order by n.criado_em, e.chave`;
    expect(ns.map(n => n.etapa).sort()).toEqual(['perdido', 'reuniao_ag']);
    expect(ns.find(n => n.etapa === 'perdido')!.motivo).toBe('financiamento');
    expect(ns.find(n => n.etapa === 'reuniao_ag')!.funcao).toBe('closer');
    const tr = await sql`select origem from lab.negocio_transicao t join lab.etapa e on e.id = t.para_etapa_id where e.chave = 'reuniao_ag'`;
    expect(tr.map(t => t.origem)).toContain('evento');
    const ign = await sql`select count(*)::int as n from lab.entrada_bruta where status = 'ignorado'`;
    expect(ign[0]!.n).toBe(1);   // o evento "teste"
  });

  it('segunda sincronização não duplica nada', async () => {
    const r = await sincronizar(dep(), { ...linha, cursor: (await sql`select cursor from lab.conector where id = ${linha.id}`)[0]!.cursor });
    expect(r.novos).toBe(0);
    const [{ n }] = await sql`select count(*)::int as n from lab.negocio`;
    expect(n).toBe(2);
  });

  it('webhook assinado entra; repetido não duplica; sem assinatura é recusado', async () => {
    const corpo = JSON.stringify({ id: 'evt_w', evento: 'negocio.etapa_alterada', criado_em: '2026-10-16T11:59:00Z',
      dados: { negocio: negocio({ etapa: 'reuniao_ok', atualizado_em: '2026-10-16T11:59:00Z' }), de: 'reuniao_ag', para: 'reuniao_ok' } });
    const ts = String(Math.floor(new Date('2026-10-16T12:00:00Z').getTime() / 1000));
    const cab = new Headers({ 'x-amicta-timestamp': ts, 'x-amicta-assinatura': `sha256=${await hmacSha256('whsec_teste', `${ts}.${corpo}`)}` });
    const r1 = await receberWebhook(dep(), linha, { cabecalhos: cab, corpo });
    expect(r1).toMatchObject({ http: 200, corpo: { novos: 1, aplicados: 1 } });
    const r2 = await receberWebhook(dep(), linha, { cabecalhos: cab, corpo });
    expect(r2.corpo).toMatchObject({ novos: 0 });
    const r3 = await receberWebhook(dep(), linha, { cabecalhos: new Headers(), corpo });
    expect(r3.http).toBe(401);
    const [n] = await sql`select e.chave from lab.negocio n join lab.etapa e on e.id = n.etapa_id join lab.vinculo v on v.interno_id = n.id where v.ref = 'negocio:1936c9b7a9be4e'`;
    expect(n!.chave).toBe('reuniao_ok');
  });

  it('erro da API do CRM vira falha registrada, sem perder o que já entrou', async () => {
    const quebrado: typeof fetch = async () => new Response('{"erro":"Chave revogada"}', { status: 401 });
    const r = await sincronizar({ ...dep(), fetch: quebrado }, linha);
    expect(r).toMatchObject({ ok: false, falha: expect.stringMatching(/HTTP 401 — Chave revogada/) });
    const [ex] = await sql`select status from lab.execucao where conector_id = ${linha.id} order by id desc limit 1`;
    expect(ex!.status).toBe('falhou');
  });
});
