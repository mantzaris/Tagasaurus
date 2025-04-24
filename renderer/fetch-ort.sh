#!/usr/bin/env bash
set -euo pipefail

TF_VER="3.5.0"
FILES=(
  ort-wasm.wasm
  ort-wasm-simd.wasm
  ort-wasm-threaded.wasm
  ort-wasm-simd-threaded.wasm
)

# repo root = one directory above the script
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

DEST="$REPO_ROOT/renderer/assets/ort"   #stays the same
mkdir -p "$DEST"

CDN="https://cdn.jsdelivr.net/npm/@huggingface/transformers@${TF_VER}/dist"

for f in "${FILES[@]}"; do
  echo "↓ $f"
  curl -sSL -o "$DEST/$f" "$CDN/$f"
done

echo "✓ ORT WASM binaries saved to $DEST"
