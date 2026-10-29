#!/bin/sh
# M33: build the frontend twice from the current tree and compare every output file.
# Usage: scripts/trust/reproducible-frontend.sh   (exit 1 when the builds differ)
set -eu
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
for i in 1 2; do
  node node_modules/vite/bin/vite.js build --outDir "$work/dist$i" --emptyOutDir >/dev/null
  (cd "$work/dist$i" && find . -type f -exec shasum -a 256 {} \; | sort -k2) > "$work/sums$i"
done
diff "$work/sums1" "$work/sums2"
echo "Frontend build reproducible: $(wc -l < "$work/sums1" | tr -d ' ') identical files."
