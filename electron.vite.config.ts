import { resolve } from 'node:path'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'electron/main.ts'),
          dbSmoke: resolve(__dirname, 'electron/dbSmoke.ts')
        }
      }
    }
  },
  preload: {
    build: {
      rollupOptions: {
        input: {
          preload: resolve(__dirname, 'electron/preload.ts'),
          floatingPreload: resolve(__dirname, 'electron/floatingPreload.ts')
        },
        output: {
          format: 'cjs',
          entryFileNames: '[name].js'
        }
      }
    }
  },
  renderer: {
    root: '.',
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'index.html'),
          floatingBall: resolve(__dirname, 'floating-ball.html')
        }
      }
    }
  }
})
