import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['node_modules/**', 'out/**', 'release/**', 'coverage/**', '.worktrees/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}', 'electron/**/*.ts', '*.config.ts'],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: { ...globals.browser, ...globals.node, ...globals.es2025 }
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh
    },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      'react-refresh/only-export-components': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    }
  },
  {
    files: ['**/*.test.{ts,tsx}', 'src/test/**/*.ts'],
    languageOptions: { globals: { ...globals.browser, ...globals.node, ...globals.vitest } },
    rules: { 'react-refresh/only-export-components': 'off' }
  },
  {
    files: ['scripts/**/*.mjs', 'eslint.config.js'],
    languageOptions: { globals: globals.node }
  }
)
