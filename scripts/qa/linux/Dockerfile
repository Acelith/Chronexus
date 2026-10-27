# Linux build and desktop-QA image for Chronexus (docs/QA.md, "Linux in Docker").
# Builds the app and the .deb, and runs debug or installed builds under Xvfb.
# The architecture is the Docker host's (arm64 on Apple Silicon); amd64 needs emulation.
FROM node:24-bookworm AS node

FROM rust:1.97-bookworm
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
    && ln -s ../lib/node_modules/corepack/dist/corepack.js /usr/local/bin/corepack
RUN apt-get update && apt-get install -y --no-install-recommends \
      libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev \
      libssl-dev patchelf file xdg-utils \
      xvfb xauth dbus-x11 x11-utils xdotool imagemagick fonts-dejavu-core \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
ENV CARGO_TARGET_DIR=/target
WORKDIR /work
