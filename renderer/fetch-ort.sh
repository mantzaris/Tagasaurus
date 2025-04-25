#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ORT_SRC="$REPO_ROOT/node_modules/onnxruntime-web/dist"
ORT_DEST="$REPO_ROOT/renderer/public/assets/ort"

mkdir -p "$ORT_DEST"
for f in ort-wasm-simd-threaded.wasm ort-wasm-simd-threaded.jsep.mjs; do
  cp "$ORT_SRC/$f" "$ORT_DEST/"
  echo "✔ copied $f"
done

# model snapshot step unchanged …
