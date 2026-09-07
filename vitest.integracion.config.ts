import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

/**
 * Los tests de integración. Necesitan una base PostgreSQL de verdad.
 *
 *   DATABASE_URL=postgresql://… npm run test:integracion
 *
 * Van aparte de los unitarios a propósito: los unitarios tienen que poder
 * correr en cualquier sitio sin levantar nada.
 */
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['tests/integracion/**/*.test.ts'],
    // Comparten una base: no pueden correr a la vez.
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
})
