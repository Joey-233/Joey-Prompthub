#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This icon preparation script must run on macOS." >&2
  exit 1
fi

for command_name in sips iconutil; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required macOS command: $command_name" >&2
    exit 1
  fi
done

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_png="$project_root/build/icon.png"
output_icns="$project_root/build/icon.icns"

if [[ ! -f "$source_png" ]]; then
  echo "Missing source icon: $source_png" >&2
  exit 1
fi

working_dir="$(mktemp -d "${TMPDIR:-/tmp}/joey-prompthub-icon.XXXXXX")"
trap 'rm -rf "$working_dir"' EXIT
iconset_dir="$working_dir/JoeyPrompthub.iconset"
mkdir -p "$iconset_dir"

create_icon() {
  local pixels="$1"
  local name="$2"
  sips -z "$pixels" "$pixels" "$source_png" --out "$iconset_dir/$name" >/dev/null
}

create_icon 16 icon_16x16.png
create_icon 32 icon_16x16@2x.png
create_icon 32 icon_32x32.png
create_icon 64 icon_32x32@2x.png
create_icon 128 icon_128x128.png
create_icon 256 icon_128x128@2x.png
create_icon 256 icon_256x256.png
create_icon 512 icon_256x256@2x.png
create_icon 512 icon_512x512.png
create_icon 1024 icon_512x512@2x.png

iconutil -c icns "$iconset_dir" -o "$output_icns"
echo "Created $output_icns"
