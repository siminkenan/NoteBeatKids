#!/bin/bash
set -e

echo "[1/2] Frontend derleniyor..."
./node_modules/.bin/vite build

echo "[2/2] Sunucu derleniyor..."
./node_modules/.bin/esbuild server/index.ts \
  --platform=node \
  --packages=external \
  --bundle \
  --format=esm \
  "--define:process.env.NODE_ENV=\"production\"" \
  --outfile=dist/index.js

echo "Derleme tamamlandi."
