#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This bootstrap script must run on macOS." >&2
  exit 1
fi

if ! xcode-select -p >/dev/null 2>&1; then
  echo "Xcode Command Line Tools are missing. Run: xcode-select --install" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js and npm are required. Install Node 24 LTS, then rerun this script." >&2
  exit 1
fi

node_major="$(node -p "Number(process.versions.node.split('.')[0])")"
if (( node_major < 22 )); then
  echo "Node.js 22.12 or newer is required; Node 24 LTS is recommended." >&2
  exit 1
fi

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"

echo "Installing Darwin-native dependencies (including better-sqlite3)..."
npm ci
npm run prepare:mac-icon
npm run verify

echo
echo "Mac development environment is ready."
echo "Start the app with: npm run dev"
echo "Create an unsigned local build with: npm run dist:mac:dev"
