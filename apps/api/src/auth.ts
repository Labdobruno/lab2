/* Login do administrador pelo Supabase Auth. O Worker repassa e-mail e senha ao Supabase (a página nunca fala
   com ele) e, a cada chamada de /admin, pergunta ao Supabase de quem é o token. Só o ADMIN_EMAIL entra. */

export interface AmbienteAuth { SUPABASE_URL?: string; SUPABASE_ANON_KEY?: string; ADMIN_EMAIL?: string }
export interface Sessao { accessToken: string; refreshToken: string; expiraEm: number }

const URL_SUPABASE = /^https:\/\/[a-z0-9-]+\.supabase\.co$/;

export function loginAtivo(env: AmbienteAuth): boolean {
  return !!(env.SUPABASE_URL && URL_SUPABASE.test(env.SUPABASE_URL) && env.SUPABASE_ANON_KEY && env.ADMIN_EMAIL);
}

const igual = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

async function pedirSessao(env: AmbienteAuth, f: typeof fetch, grant: 'password' | 'refresh_token', corpo: Record<string, string>): Promise<Sessao | null> {
  const r = await f(`${env.SUPABASE_URL}/auth/v1/token?grant_type=${grant}`, {
    method: 'POST', headers: { apikey: env.SUPABASE_ANON_KEY!, 'content-type': 'application/json' }, body: JSON.stringify(corpo),
  });
  if (!r.ok) return null;
  const s = await r.json() as { access_token?: string; refresh_token?: string; expires_at?: number; expires_in?: number; user?: { email?: string } };
  if (!s.access_token || !s.refresh_token) return null;
  if (!s.user?.email || !igual(s.user.email, env.ADMIN_EMAIL!)) return null;
  return { accessToken: s.access_token, refreshToken: s.refresh_token, expiraEm: s.expires_at ?? Math.floor(Date.now() / 1000) + (s.expires_in ?? 3600) };
}

export const entrar = (env: AmbienteAuth, f: typeof fetch, email: string, senha: string) =>
  igual(email, env.ADMIN_EMAIL ?? '') ? pedirSessao(env, f, 'password', { email, password: senha }) : Promise.resolve(null);
export const renovar = (env: AmbienteAuth, f: typeof fetch, refreshToken: string) => pedirSessao(env, f, 'refresh_token', { refresh_token: refreshToken });

/* o token é do administrador? Confere com o Supabase (vale para qualquer tipo de chave) e guarda o "sim" por 60 s. */
const cache = new Map<string, number>();
export async function tokenDoAdmin(env: AmbienteAuth, f: typeof fetch, token: string, agora = Date.now()): Promise<boolean> {
  if (!loginAtivo(env) || !token) return false;
  const ate = cache.get(token);
  if (ate && ate > agora) return true;
  const r = await f(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: env.SUPABASE_ANON_KEY!, authorization: `Bearer ${token}` } });
  if (!r.ok) { cache.delete(token); return false; }
  const u = await r.json() as { email?: string; email_confirmed_at?: string | null };
  const ok = !!u.email && igual(u.email, env.ADMIN_EMAIL!) && !!u.email_confirmed_at;
  if (ok) { if (cache.size > 50) cache.clear(); cache.set(token, agora + 60_000); } else cache.delete(token);
  return ok;
}
