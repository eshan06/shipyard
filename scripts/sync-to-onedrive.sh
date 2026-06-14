#!/usr/bin/env bash
# Deliver the fast-fs build tree back to the canonical OneDrive working tree so
# the user receives the code + git history. Excludes heavy/generated dirs (the
# user reinstalls deps). See the `fast-fs-build-location` memory note.
set -uo pipefail
SRC=/home/agent/build
DST=/c/Users/toesh/OneDrive/Documents/GitHub/shipyard
rsync -a --delete \
  --exclude='node_modules/' --exclude='.pnpm-store/' --exclude='dist/' \
  --exclude='.next/' --exclude='generated/' --exclude='coverage/' \
  --exclude='.turbo/' --exclude='.env' --exclude='*.tsbuildinfo' \
  "$SRC/" "$DST/"
echo "synced build -> OneDrive at $(date -u +%H:%M:%S)"
