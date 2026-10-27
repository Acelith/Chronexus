#!/bin/sh
# Runs the IPC flows (scripts/qa/ipc) against a Linux debug build under Xvfb and fails when
# any step fails or the run does not finish (M30). Run from the repository root inside the
# chronexus-linux-qa image (or CI), after `cargo build` of src-tauri.
#   APP=<debug binary, default $CARGO_TARGET_DIR/debug/chronexus>  TIMEOUT=<seconds, 600>
set -eu
root=$(pwd)
out="${QA_OUT:-$root/.tools/ipc-linux}"
rm -rf "$out" && mkdir -p "$out/profile" "$out/documents"
export CHRONEXUS_IPC_REPORT="$out/report.json"
app="${APP:-${CARGO_TARGET_DIR:-$root/src-tauri/target}/debug/chronexus}"
export DISPLAY="${DISPLAY:-:99}" WEBKIT_DISABLE_DMABUF_RENDERER=1 WEBKIT_DISABLE_COMPOSITING_MODE=1
Xvfb "$DISPLAY" -screen 0 1280x800x24 >"$out/xvfb.log" 2>&1 &
xvfb=$!
node node_modules/vite/bin/vite.js --config scripts/qa/ipc/vite.config.mjs >"$out/vite.log" 2>&1 &
vite=$!
for _ in $(seq 1 60); do curl -sf http://127.0.0.1:1420/ >/dev/null && break; sleep 1; done
NODEX_DEV_DATA_DIR="$out/profile" NODEX_DEV_DOCUMENTS_DIR="$out/documents" \
  NODEX_DEV_BACKUP_FILE="$out/qa.nodex" NODEX_DEV_RESTORE_FILE="$out/qa.nodex" \
  NODEX_DEV_EXPORT_FILE="$out/qa-export.zip" \
  dbus-run-session -- "$app" >"$out/app.log" 2>&1 &
appid=$!
status=1
for _ in $(seq 1 "${TIMEOUT:-600}"); do
  if [ -f "$CHRONEXUS_IPC_REPORT" ] && grep -q '"done": true' "$CHRONEXUS_IPC_REPORT"; then
    status=0
    break
  fi
  kill -0 "$appid" 2>/dev/null || break
  sleep 1
done
kill "$appid" "$vite" "$xvfb" 2>/dev/null || true
if [ ! -f "$CHRONEXUS_IPC_REPORT" ]; then
  echo "IPC flows: no report"; tail -30 "$out/app.log"; exit 1
fi
node -e '
const r = require(process.argv[1]);
for (const s of r.steps) console.log(`${s.ok ? "PASS" : "FAIL"} ${s.step} ${s.ok ? "" : s.detail} (${Math.round(s.ms)} ms)`);
console.log(`IPC flows: ${r.steps.length - r.failed}/${r.steps.length} passed, done=${r.done}`);
process.exit(r.done && r.failed === 0 ? 0 : 1);
' "$CHRONEXUS_IPC_REPORT" || status=1
[ "$status" = 0 ] || { echo "IPC flows failed or did not finish"; exit 1; }
