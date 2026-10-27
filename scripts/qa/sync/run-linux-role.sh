#!/bin/sh
# Runs one role of the sharing scenario inside the Linux QA container (docs/QA.md).
# Expects the built checkout in /work, the debug binary in /target/debug, the test
# deployment's root certificate in /qa/root.crt and CHRONEXUS_SYNC_* in the environment.
set -eu
cp /qa/root.crt /usr/local/share/ca-certificates/chronexus-qa.crt
update-ca-certificates >/dev/null
export DISPLAY=:99 WEBKIT_DISABLE_DMABUF_RENDERER=1 WEBKIT_DISABLE_COMPOSITING_MODE=1
Xvfb :99 -screen 0 1280x800x24 >/tmp/xvfb.log 2>&1 &
cd /work
node node_modules/vite/bin/vite.js --config scripts/qa/sync/vite.config.mjs >/tmp/vite.log 2>&1 &
for _ in $(seq 1 60); do
  curl -sf http://127.0.0.1:1420/ >/dev/null && break
  sleep 1
done
mkdir -p /tmp/profile /tmp/documents
NODEX_DEV_DATA_DIR=/tmp/profile NODEX_DEV_DOCUMENTS_DIR=/tmp/documents \
  dbus-run-session -- /target/debug/chronexus >/tmp/app.log 2>&1 &
app=$!
# The scenario reports through the board; keep the app up until the role says it is done.
for _ in $(seq 1 900); do
  kill -0 "$app" 2>/dev/null || { echo "app exited"; tail -40 /tmp/app.log; exit 1; }
  sleep 1
done
