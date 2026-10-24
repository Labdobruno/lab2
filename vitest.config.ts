import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@lab/nucleo': fileURLToPath(new URL('./packages/nucleo/src/index.ts', import.meta.url)),
      '@lab/conectores': fileURLToPath(new URL('./packages/conectores/src/index.ts', import.meta.url)),
      '@lab/metricas': fileURLToPath(new URL('./packages/metricas/src/index.ts', import.meta.url)),
    },
  },
  test: {
    include: ['packages/*/test/**/*.test.ts', 'apps/*/test/**/*.test.ts'],
    // testes de integração usam o Postgres local (DATABASE_URL); sem ele, são pulados
    fileParallelism: false,
  },
});
