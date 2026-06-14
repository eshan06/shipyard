#!/usr/bin/env bash
# Robust `pnpm install` for filesystems that intermittently reject rename()
# (e.g. OneDrive-backed / network mounts), which can make pnpm fail with
# ERR_PNPM_EACCES mid-link. Cleans leftover temp dirs and retries a few times.
#
# Usage: bash scripts/robust-install.sh [extra pnpm install args...]
set -uo pipefail

cd "$(dirname "$0")/.."

ATTEMPTS="${INSTALL_ATTEMPTS:-5}"
for i in $(seq 1 "$ATTEMPTS"); do
  echo "[install] attempt $i/$ATTEMPTS"
  # Remove half-written rename targets from a previous failed attempt.
  find node_modules packages/*/node_modules apps/*/node_modules \
    -maxdepth 2 -name '*_tmp_*' -exec rm -rf {} + 2>/dev/null || true

  if pnpm install "$@"; then
    echo "[install] success on attempt $i"
    exit 0
  fi
  echo "[install] attempt $i failed; cleaning and retrying…"
  sleep 3
done

echo "[install] FAILED after $ATTEMPTS attempts" >&2
exit 1
