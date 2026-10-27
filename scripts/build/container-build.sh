#!/bin/sh
# Builds release packages inside the dedicated build containers (docs/INSTALLERS.md).
# Runs INSIDE the container: copies the read-only checkout from /src into /work, installs
# the frontend dependencies, builds the frontend once and bundles the requested target.
#   linux:   .deb and AppImage for the container's own architecture
#   windows: NSIS installer for x86_64 Windows via cargo-xwin (WINDOWS_TARGETS overrides)
# Artifacts land in /out/<target>. Updater artifacts are not created: they need the
# production signing key, which never enters a container.
set -eu
target="$1"
mkdir -p /work /out
cd /src
tar --exclude=./node_modules --exclude=./src-tauri/target --exclude=./.git \
  --exclude=./.tools --exclude=./dist --exclude=./.claude -cf - . | (cd /work && tar -xf -)
cd /work
CI=true pnpm install --frozen-lockfile >/tmp/pnpm.log 2>&1 || { tail -30 /tmp/pnpm.log; exit 1; }
pnpm build >/tmp/frontend.log 2>&1 || { tail -30 /tmp/frontend.log; exit 1; }
config='{"build":{"beforeBuildCommand":""},"bundle":{"createUpdaterArtifacts":false}}'
case "$target" in
  linux)
    arch=$(uname -m)
    # LINUX_BUNDLES=deb under QEMU emulation: linuxdeploy (an AppImage itself) does not run there.
    bundles="${LINUX_BUNDLES:-deb,appimage}"
    pnpm tauri build --config "$config" --bundles "$bundles"
    mkdir -p "/out/linux-$arch"
    cp "$CARGO_TARGET_DIR"/release/bundle/deb/*.deb "/out/linux-$arch/"
    case "$bundles" in *appimage*) cp "$CARGO_TARGET_DIR"/release/bundle/appimage/*.AppImage "/out/linux-$arch/" ;; esac
    ;;
  windows)
    # aarch64 is blocked for now (docs/INSTALLERS.md): ring's ARM64 assembly receives
    # clang-cl's /imsvc flags, and cargo-xwin's clang mode breaks aws-lc-sys instead.
    for triple in ${WINDOWS_TARGETS:-x86_64-pc-windows-msvc}; do
      pnpm tauri build --config "$config" --runner cargo-xwin --target "$triple" --bundles nsis
      mkdir -p "/out/windows-${triple%%-*}"
      cp "$CARGO_TARGET_DIR/$triple"/release/bundle/nsis/*.exe "/out/windows-${triple%%-*}/"
    done
    ;;
  *)
    echo "usage: container-build.sh linux|windows" >&2
    exit 2
    ;;
esac
cd /out && find . -type f \( -name '*.deb' -o -name '*.AppImage' -o -name '*.exe' \) -exec sha256sum {} \;
