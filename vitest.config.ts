import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Testes de fumaça das regras críticas (cobrança, permissões). Rodam antes do
// build (script "build" = vitest run && next build) — um teste vermelho BARRA o
// deploy na Vercel, então bug nessas regras nunca chega ao cliente.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
})
