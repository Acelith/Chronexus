#!/bin/sh
# Proves which network connections the real app opens while sharing is not configured
# (server M25.8: "no server requests in that state"). Runs the IPC flows under strace and
# lists every connect() to a non-loopback address. Run inside chronexus-linux-qa with
# --cap-add SYS_PTRACE, from the repository root, after `cargo build` of src-tauri.
# Expected: no connection at all, or only the documented startup update check.
set -eu
command -v strace >/dev/null || { apt-get update >/dev/null && apt-get install -y --no-install-recommends strace >/dev/null; }
app="${CARGO_TARGET_DIR:-$(pwd)/src-tauri/target}/debug/chronexus"
wrapper=/tmp/chronexus-traced
cat >"$wrapper" <<EOF
#!/bin/sh
exec strace -f -qq -e trace=connect -o /tmp/connect.log "$app" "\$@"
EOF
chmod +x "$wrapper"
status=0
APP="$wrapper" QA_OUT=/tmp/ipc sh scripts/qa/ipc/run-linux.sh || status=$?
# connect() lines with an IPv4/IPv6 address outside loopback (127.0.0.0/8, ::1).
grep -E 'sin6?_addr|inet_addr' /tmp/connect.log \
  | grep -v -E 'inet_addr\("127\.|inet_pton\(AF_INET6, "::1"' >/tmp/external.log || true
echo "connect() calls traced: $(grep -c 'connect(' /tmp/connect.log || true)"
echo "connections outside loopback: $(wc -l </tmp/external.log | tr -d ' ')"
cat /tmp/external.log | sed -E 's/.*(inet_addr\("[^"]+"\)|inet_pton\(AF_INET6, "[^"]+").*/  \1/' | sort | uniq -c
exit "$status"
