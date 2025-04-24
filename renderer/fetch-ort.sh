#!/usr/bin/env bash
# fetch-ort.sh — download ONNX-Runtime WASM runtimes + model repo once

set -euo pipefail

TF_VER="3.5.0"   # keep in sync with your package.json dependency
MODEL_ID="sentence-transformers/all-MiniLM-L6-v2"


#resolve repository root (folder that holds package.json)
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"


DEST_ORT="$REPO_ROOT/renderer/assets/ort"
mkdir -p "$DEST_ORT"

CDN="https://cdn.jsdelivr.net/npm/@huggingface/transformers@${TF_VER}/dist"
ORT_FILES=(
  ort-wasm.wasm
  ort-wasm-simd.wasm
  ort-wasm-threaded.wasm
  ort-wasm-simd-threaded.wasm
  ort-wasm.jsep.mjs
  ort-wasm-simd.jsep.mjs
  ort-wasm-threaded.jsep.mjs
  ort-wasm-simd-threaded.jsep.mjs
)

echo "Downloading ORT runtime files → $DEST_ORT"
for f in "${ORT_FILES[@]}"; do
  echo "   $f"
  curl -sSL -o "$DEST_ORT/$f" "$CDN/$f"
done
echo "ORT runtime files complete"

# Model repository
DEST_MODEL="$REPO_ROOT/renderer/assets/models/$MODEL_ID"
if [ -d "$DEST_MODEL" ]; then
  echo "Model repo already exists at $DEST_MODEL (skipping)"
else
  echo " Downloading model repo -> $DEST_MODEL"
  npx -y @huggingface/hub-cli snapshot_download \
    "$MODEL_ID" \
    --local-dir "$DEST_MODEL" \
    --local-dir-use-symlinks False
  echo "Model repo downloaded"
fi

echo "all assets ready for offline packaging"
