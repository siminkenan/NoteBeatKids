#!/usr/bin/env bash
set -e

echo "==> Installing dependencies (including devDependencies for build)..."
npm install --include=dev

echo "==> Building frontend + backend via script/build.ts ..."
npx tsx script/build.ts

echo "==> Build complete."
echo "    Frontend: dist/public/"
echo "    Backend:  dist/index.cjs"
