import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

// vite-tsconfig-paths reads `paths` z tsconfig.json automatycznie — single source of truth,
// bez ręcznego utrzymywania `alias: { '@': ... }` (które drift z `@/*` w tsconfig).
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: false,
  },
})
