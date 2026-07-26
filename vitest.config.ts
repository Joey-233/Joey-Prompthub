import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.test.{ts,tsx}', 'electron/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}', 'electron/**/*.ts'],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/*.d.ts',
        'src/browser/**',
        'src/main.tsx',
        'src/floating/main.tsx',
        'electron/db.ts',
        'electron/dbSmoke.ts',
        'electron/assetStore.ts',
        'electron/main.ts',
        'electron/mainWindow.ts',
        'electron/preload.ts',
        'electron/floatingPreload.ts',
        'electron/trayIcon.ts'
      ],
      thresholds: {
        statements: 60,
        branches: 55,
        functions: 60,
        lines: 60
      }
    }
  }
})
