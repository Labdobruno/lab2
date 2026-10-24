import { z } from 'zod';

/* tradução de chaves da fonte para as chaves da operação, igual em todo conector */
export const MapaSchema = z.object({
  etapas: z.record(z.string(), z.string()).optional(),
  atividades: z.record(z.string(), z.string()).optional(),
  funis: z.record(z.string(), z.string()).optional(),
  motivosPerda: z.record(z.string(), z.string()).optional(),
  condicoes: z.record(z.string(), z.string()).optional(),
}).strict();
