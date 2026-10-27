# Windows cross-build image for Chronexus (docs/INSTALLERS.md, "Building in containers").
# Builds the NSIS installer for x86_64 Windows from Linux with cargo-xwin, following
# Tauri's documented cross-compilation path (NSIS only; no MSI). The aarch64 target is
# installed but currently fails in ring/aws-lc-sys (docs/INSTALLERS.md).
# cargo-xwin downloads the Microsoft CRT and Windows SDK on first use and accepts the
# Microsoft license on your behalf: build with this image only after you accepted it.
# The result is unsigned for Authenticode (ROADMAP M29: no paid signing).
FROM node:24-bookworm AS node

FROM rust:1.97-bookworm
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
    && ln -s ../lib/node_modules/corepack/dist/corepack.js /usr/local/bin/corepack
# Tauri's NSIS template includes Win\RestartManager.nsh, which bookworm's NSIS 3.08 lacks:
# take NSIS 3.10+ from trixie (it needs nothing newer than zlib and libc).
RUN echo 'deb http://deb.debian.org/debian trixie main' > /etc/apt/sources.list.d/trixie.list \
    && printf 'Package: *\nPin: release n=trixie\nPin-Priority: 100\n' > /etc/apt/preferences.d/trixie \
    && apt-get update && apt-get install -y --no-install-recommends lld llvm clang \
    && apt-get install -y --no-install-recommends -t trixie nsis nsis-common \
    && makensis -VERSION \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/bin/llvm-rc-14 /usr/local/bin/llvm-rc 2>/dev/null || true
RUN rustup target add x86_64-pc-windows-msvc aarch64-pc-windows-msvc \
    && cargo install --locked cargo-xwin@0.18.6
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
ENV CARGO_TARGET_DIR=/target XWIN_CACHE_DIR=/xwin-cache
WORKDIR /work
