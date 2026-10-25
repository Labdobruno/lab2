import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@lab/nucleo': fileURLToPath(new URL('./packages/nucleo/src/index.ts', import.meta.url)),
      '@lab/conectores': fileURLToPath(new URL('./packages/conectores/src/index.ts', import.meta.url)),
      '@lab/metricas': fileURLToPath(new URL('./packages/metricas/src/index.ts', import.meta.url)),
      '@lab/planejamento': fileURLToPath(new URL('./packages/planejamento/src/index.ts', import.meta.url)),
      '@lab/ciclos': fileURLToPath(new URL('./packages/ciclos/src/index.ts', import.meta.url)),
      '@lab/hipoteses': fileURLToPath(new URL('./packages/hipoteses/src/index.ts', import.meta.url)),
      '@lab/studio': fileURLToPath(new URL('./packages/studio/src/index.ts', import.meta.url)),
      '@lab/dia': fileURLToPath(new URL('./packages/dia/src/index.ts', import.meta.url)),
      '@lab/estrategia': fileURLToPath(new URL('./packages/estrategia/src/index.ts', import.meta.url)),
    },
  },
  test: {
    include: ['packages/*/test/**/*.test.ts', 'apps/*/test/**/*.test.ts'],
    // testes de integração usam o Postgres local (DATABASE_URL); sem ele, são pulados
    fileParallelism: false,
  },
});
