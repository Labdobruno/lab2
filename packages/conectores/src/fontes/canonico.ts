/* Conector canônico: qualquer ferramenta (n8n, Make, Zapier, um script) manda os comandos
   já no formato do LAB. É a porta para fontes que ainda não têm conector próprio.
   Webhook: POST /entrada/<id-do-conector>  com  Authorization: Bearer <segredo>
   Corpo: { "id": "lote-123", "comandos": [ { "tipo": "negocio.upsert", ... } ] }
   Arquivo: o mesmo JSON (ou uma lista de comandos). */
import { z } from 'zod';
import { MapaSchema } from '../mapa.js';
import { sha256, iguaisSeguro } from '../cripto.js';
import { ErroDeEntrada, type Conector, type EntradaBruta } from '../tipos.js';

const Config = z.object({
  mapa: MapaSchema.optional(),
}).strict();
type Config = z.infer<typeof Config>;

async function lote(corpo: unknown): Promise<EntradaBruta> {
  const obj = Array.isArray(corpo) ? { comandos: corpo } : corpo;
  if (!obj || typeof obj !== 'object' || !Array.isArray((obj as { comandos?: unknown }).comandos)) {
    throw new ErroDeEntrada('o corpo precisa ser { "comandos": [ ... ] } ou uma lista de comandos');
  }
  const o = obj as { id?: unknown; comandos: unknown[] };
  const chave = typeof o.id === 'string' && o.id ? `lote:${o.id}` : `hash:${await sha256(JSON.stringify(o.comandos))}`;
  return { chave, tipo: 'lote', payload: { comandos: o.comandos } };
}

export const conectorCanonico: Conector<Config> = {
  tipo: 'canonico',
  nome: 'Comandos do LAB (webhook ou arquivo)',
  descricao: 'Recebe comandos já no formato do LAB. Use com n8n/Make/Zapier ou scripts.',
  config: Config,
  webhook: {
    async verificar(req, lerSegredo) {
      const segredo = lerSegredo();
      if (!segredo) return { ok: false, motivo: 'o conector não tem segredo configurado' };
      const h = req.cabecalhos.get('authorization') ?? '';
      const token = h.replace(/^Bearer\s+/i, '') || req.cabecalhos.get('x-lab-chave') || '';
      return iguaisSeguro(token, segredo) ? { ok: true } : { ok: false, motivo: 'chave inválida' };
    },
    async extrair(req) {
      let corpo: unknown;
      try { corpo = JSON.parse(req.corpo); } catch { throw new ErroDeEntrada('JSON inválido'); }
      return [await lote(corpo)];
    },
  },
  async importar(arquivo) {
    let corpo: unknown;
    try { corpo = JSON.parse(arquivo.conteudo); } catch { throw new ErroDeEntrada(`${arquivo.nome}: JSON inválido`); }
    return [await lote(corpo)];
  },
  async normalizar(e) {
    const p = e.payload as { comandos?: unknown[] };
    return (p.comandos ?? []) as never;    // a validação de cada comando acontece no pipeline
  },
};
