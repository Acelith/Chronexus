#!/bin/sh
# One local runner for the M30 checks, equivalent to .forgejo/workflows/ci.yml.
# It always tests a committed revision: the revision is exported from Git into a clean folder,
# so unfinished work in the checkout (yours or another agent's) is never included.
#
#   sh scripts/qa/run-all.sh [REVISION] [STAGES]
#     REVISION  default HEAD
#     STAGES    comma list, default checks,ipc,package,install
#       checks   lint, typecheck, format, i18n, Vitest, automation, Rust fmt/clippy/test
#       ipc      debug app under Xvfb: the scripts/qa/ipc flows
#       package  .deb (and AppImage) for this machine's Linux architecture
#       install  install the .deb on clean Debian 12 and Ubuntu 24.04 and start it
#
# Everything runs in the chronexus-linux-qa image (scripts/qa/linux/Dockerfile), built when
# missing. Output: .tools/run-all/<revision>/ (ignored by Git). Exit code 1 on any failure.
# The multi-device sharing scenario needs a server deployment; see docs/QA.md.
set -eu
root=$(git rev-parse --show-toplevel)
rev=$(git -C "$root" rev-parse --short "${1:-HEAD}")
stages=",${2:-checks,ipc,package,install},"
out="$root/.tools/run-all/$rev"
src="$out/src"
image=chronexus-linux-qa:local
rm -rf "$out" && mkdir -p "$src" "$out/shots"
git -C "$root" archive "$rev" | tar -x -C "$src"
docker image inspect "$image" >/dev/null 2>&1 || docker build -t "$image" "$root/scripts/qa/linux"

failed=""
run() { # name, command inside the container
  echo "== $1"
  if docker run --rm -v "$src":/src:ro -v "$out":/out \
      -v chronexus-runall-target:/target -v chronexus-cargo:/usr/local/cargo/registry \
      "$image" sh -c "cp -a /src/. /work && cd /work && CI=true pnpm install --frozen-lockfile >/out/pnpm-$1.log 2>&1 && pnpm icons >/dev/null && $2" \
      >"$out/$1.log" 2>&1; then
    echo "   passed"
  else
    echo "   FAILED (see $out/$1.log)"; tail -15 "$out/$1.log"; failed="$failed $1"
  fi
}
case "$stages" in *,checks,*) run checks '
  pnpm i18n:check && pnpm lint && pnpm typecheck && pnpm format:check && pnpm test &&
  pnpm test:automation &&
  python3 -m unittest discover -s scripts/release -p test_updater_manifest.py &&
  rustup component add rustfmt clippy >/dev/null 2>&1 &&
  cargo fmt --manifest-path src-tauri/Cargo.toml -- --check &&
  cargo clippy --locked --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings &&
  cargo test --locked --manifest-path src-tauri/Cargo.toml' ;; esac
case "$stages" in *,ipc,*) run ipc '
  cargo build --locked --manifest-path src-tauri/Cargo.toml && QA_OUT=/tmp/ipc sh scripts/qa/ipc/run-linux.sh' ;; esac
case "$stages" in *,package,*) run package '
  sh /src/scripts/build/container-build.sh linux' ;; esac
case "$stages" in *,install,*)
  for distro in debian:bookworm ubuntu:24.04; do
    pkgdir=$(find "$out" -path '*/linux-*' -name '*.deb' -exec dirname {} \; | head -1)
    name="install-$(echo "$distro" | tr ':.' '--')"
    echo "== $name"
    if [ -n "$pkgdir" ] && docker run --rm -v "$pkgdir":/pkg:ro -v "$out/shots":/out \
        -v "$src/scripts/qa/linux/install-smoke.sh":/smoke.sh:ro "$distro" sh /smoke.sh deb \
        >"$out/$name.log" 2>&1; then
      echo "   passed (screenshot in $out/shots)"
    else
      echo "   FAILED (see $out/$name.log)"; failed="$failed $name"
    fi
  done ;;
esac
if [ -n "$failed" ]; then echo "Revision $rev: FAILED:$failed"; exit 1; fi
echo "Revision $rev: all selected stages passed"
