#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Release verification must run on macOS." >&2
  exit 1
fi

release_dir="${1:-release}"
app_path="$(find "$release_dir" -maxdepth 3 -type d -name 'Joey Prompthub.app' -print -quit)"
dmg_path="$(find "$release_dir" -maxdepth 1 -type f -name 'Joey Prompthub-*-macOS-*.dmg' -print -quit)"

if [[ -z "$app_path" || -z "$dmg_path" ]]; then
  echo "Signed .app or DMG was not found in $release_dir." >&2
  exit 1
fi

codesign --verify --deep --strict --verbose=2 "$app_path"
spctl --assess --type execute --verbose=4 "$app_path"
xcrun stapler validate "$dmg_path"
shasum -a 256 "$dmg_path"

echo "macOS signature, Gatekeeper assessment, notarization ticket and SHA256 passed."
