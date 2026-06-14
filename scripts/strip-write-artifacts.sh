#!/usr/bin/env bash
# Surgically remove a trailing tool-serialization artifact (</content> or
# </parameter>) that some editor harnesses append as the LAST line of a file on
# this mount. Only the final line is checked, so legitimate code is never
# touched. Prunes node_modules/.git/etc. for speed. Pass paths to override.
set -uo pipefail
cd "$(dirname "$0")/.."

if [ "$#" -gt 0 ]; then
  mapfile -t files < <(printf '%s\n' "$@")
else
  mapfile -t files < <(
    find . \
      \( -path ./node_modules -o -path ./.git -o -path ./.pnpm-store \
         -o -path '*/node_modules' -o -name dist -o -name .next \
         -o -name generated \) -prune -o \
      -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' \
         -o -name '*.mjs' -o -name '*.cjs' -o -name '*.json' -o -name '*.md' \
         -o -name '*.css' -o -name '*.sh' -o -name '*.yml' -o -name '*.yaml' \
         -o -name '*.prisma' -o -name '*.example' -o -name '*.mts' \) -print 2>/dev/null
  )
fi

stripped=0
for f in "${files[@]}"; do
  [ -f "$f" ] || continue
  last="$(tail -n 1 "$f" 2>/dev/null)"
  if [ "$last" = "</content>" ] || [ "$last" = "</parameter>" ]; then
    sed -i '$ d' "$f"
    echo "stripped artifact from: $f"
    stripped=$((stripped + 1))
  fi
done
echo "strip-write-artifacts: cleaned $stripped file(s)"
