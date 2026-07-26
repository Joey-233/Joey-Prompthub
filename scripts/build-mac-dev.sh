#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "The macOS development package must be built on a Mac." >&2
  exit 1
fi

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"

architecture="${1:-arm64}"
if [[ "$architecture" != "arm64" && "$architecture" != "x64" ]]; then
  echo "Usage: npm run dist:mac:dev -- [arm64|x64]" >&2
  exit 1
fi

export CSC_IDENTITY_AUTO_DISCOVERY=false
npm run prepare:mac-icon
npm run build
npx electron-builder --config electron-builder.mac-dev.json --mac "--$architecture" --publish never
