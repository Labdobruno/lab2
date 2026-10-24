import { describe, expect, it } from 'vitest';
import { criarApp } from '../src/app.js';

const ENV = { SUPABASE_URL: 'https://abc123.supabase.co', SUPABASE_ANON_KEY: 'chave-publica', ADMIN_EMAIL: 'Bruno@Exemplo.com' };
const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } });

/* Supabase de mentira */
function supabase() {
  const chamadas: string[] = [];
  const f = (async (url: string, init?: RequestInit) => {
    chamadas.push(`${init?.method ?? 'GET'} ${url}`);
    const corpo = init?.body ? JSON.parse(init.body as string) : {};
    if (url.includes('grant_type=password')) {
      if (corpo.password !== 'senha-certa') return json({ error: 'invalid' }, 400);
      return json({ access_token: 'jwt-do-bruno', refresh_token: 'r1', expires_in: 3600, user: { email: corpo.email } });
    }
    if (url.includes('grant_type=refresh_token')) return corpo.refresh_token === 'r1' ? json({ access_token: 'jwt-novo', refresh_token: 'r2', expires_in: 3600, user: { email: 'bruno@exemplo.com' } }) : json({}, 400);
    if (url.endsWith('/auth/v1/user')) {
      const t = (init?.headers as Record<string, string>).authorization;
      if (t === 'Bearer jwt-do-bruno' || t === 'Bearer jwt-novo') return json({ email: 'bruno@exemplo.com', email_confirmed_at: '2026-01-01' });
      if (t === 'Bearer jwt-de-outro') return json({ email: 'outro@exemplo.com', email_confirmed_at: '2026-01-01' });
      return json({}, 401);
    }
    return json({}, 404);
  }) as unknown as typeof fetch;
  return { f, chamadas };
}
const chamar = (app: (r: Request) => Promise<Response>, metodo: string, caminho: string, corpo?: unknown, token?: string) =>
  app(new Request(`https://lab.teste${caminho}`, { method: metodo, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(corpo ? { body: JSON.stringify(corpo) } : {}) }));

describe('login do administrador pelo Supabase', () => {
  const novo = (env: object = ENV) => { const s = supabase(); return { ...s, app: criarApp({ sql: undefined as never, env, fetch: s.f }) }; };

  it('sem configuração, o login fica desligado e o ADMIN_TOKEN segue valendo', async () => {
    const { app } = novo({ ADMIN_TOKEN: 'token-de-teste-com-mais-de-24-caracteres' });
    expect(await (await chamar(app, 'GET', '/auth/config')).json()).toEqual({ login: false });
    expect((await chamar(app, 'POST', '/auth/entrar', { email: 'a@b.c', senha: 'x' })).status).toBe(404);
    expect((await chamar(app, 'GET', '/admin/metricas/dicionario', undefined, 'token-de-teste-com-mais-de-24-caracteres')).status).toBe(200);
  });

  it('entra com e-mail e senha certos e usa a sessão no /admin', async () => {
    const { app } = novo();
    expect(await (await chamar(app, 'GET', '/auth/config')).json()).toEqual({ login: true });
    const r = await chamar(app, 'POST', '/auth/entrar', { email: 'bruno@exemplo.com', senha: 'senha-certa' });
    expect(r.status).toBe(200);
    const s = await r.json() as any;
    expect(s.accessToken).toBe('jwt-do-bruno');
    expect((await chamar(app, 'GET', '/admin/metricas/dicionario', undefined, s.accessToken)).status).toBe(200);
  });

  it('senha errada, e-mail de outra pessoa e token de outro usuário não passam', async () => {
    const { app, chamadas } = novo();
    expect((await chamar(app, 'POST', '/auth/entrar', { email: 'bruno@exemplo.com', senha: 'errada' })).status).toBe(401);
    const antes = chamadas.length;
    expect((await chamar(app, 'POST', '/auth/entrar', { email: 'outro@exemplo.com', senha: 'senha-certa' })).status).toBe(401);
    expect(chamadas.length).toBe(antes);                       // nem chega a perguntar ao Supabase
    expect((await chamar(app, 'GET', '/admin/metricas/dicionario', undefined, 'jwt-de-outro')).status).toBe(401);
    expect((await chamar(app, 'GET', '/admin/metricas/dicionario', undefined, 'qualquer-coisa')).status).toBe(401);
    expect((await chamar(app, 'GET', '/admin/metricas/dicionario')).status).toBe(401);
  });

  it('renova a sessão', async () => {
    const { app } = novo();
    expect(((await (await chamar(app, 'POST', '/auth/renovar', { refreshToken: 'r1' })).json()) as any).accessToken).toBe('jwt-novo');
    expect((await chamar(app, 'POST', '/auth/renovar', { refreshToken: 'velho' })).status).toBe(401);
  });

  it('endereço do Supabase fora do padrão desliga o login', async () => {
    const { app } = novo({ ...ENV, SUPABASE_URL: 'https://malicioso.exemplo.com' });
    expect(await (await chamar(app, 'GET', '/auth/config')).json()).toEqual({ login: false });
  });
});
