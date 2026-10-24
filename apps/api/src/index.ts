/* Entrada do Cloudflare Worker. A conexão com o Postgres (Supabase) é aberta por requisição
   e fechada no fim; com Hyperdrive configurado, ele cuida do pool. */
import postgres from 'postgres';
import { criarApp, rodadaAgendada, type Ambiente } from './app.js';

interface Env extends Ambiente {
  DATABASE_URL?: string;
  HYPERDRIVE?: { connectionString: string };
}

function conectar(env: Env) {
  const url = env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL não configurada');
  /* prepare:false é necessário no pooler do Supabase (modo transação) */
  return postgres(url, { max: 4, prepare: false, fetch_types: false, onnotice: () => {} });
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    let sql;
    try { sql = conectar(env); } catch (e) { return new Response(JSON.stringify({ erro: (e as Error).message }), { status: 503 }); }
    try { return await criarApp({ sql, env })(req); }
    finally { ctx.waitUntil(sql.end({ timeout: 5 })); }
  },
  async scheduled(_ev: ScheduledController, env: Env, ctx: ExecutionContext) {
    const sql = conectar(env);
    ctx.waitUntil((async () => {
      try { console.log(JSON.stringify(await rodadaAgendada({ sql, env }))); }
      finally { await sql.end({ timeout: 5 }); }
    })());
  },
};
