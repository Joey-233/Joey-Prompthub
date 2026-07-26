import { spawnSync } from 'node:child_process'

import electronPath from 'electron'

const result = spawnSync(electronPath, ['out/main/dbSmoke.js'], {
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  stdio: 'inherit'
})

if (result.error) {
  throw result.error
}

process.exit(result.status ?? 1)
