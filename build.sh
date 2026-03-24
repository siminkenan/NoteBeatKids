#!/usr/bin/env bash
set -e

echo "==> Building frontend (Vite)..."
npx vite build

echo "==> Compiling backend (esbuild)..."
npx esbuild server/index.ts \
  --bundle \
  --platform=node \
  --format=esm \
  --outfile=dist/server/index.js \
  --define:process.env.NODE_ENV=\"production\" \
  --packages=external \
  --tsconfig=tsconfig.json

# Also copy to dist/index.js so Replit deployment (run = ["node","dist/index.js"]) works
cp dist/server/index.js dist/index.js

echo "==> Build complete."
echo "    Frontend: dist/public/"
echo "    Backend:  dist/server/index.js  (+ dist/index.js)"
