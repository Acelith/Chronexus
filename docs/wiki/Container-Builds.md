# Container builds

Linux and Windows packages are built in dedicated Docker images, created when missing.
macOS cannot run in a container (Docker shares a Linux kernel; the Apple toolchain needs
macOS), so macOS packages are built natively on a Mac.

| Image | Dockerfile | Produces |
| --- | --- | --- |
| `chronexus-linux-qa` | `scripts/qa/linux/Dockerfile` | `.deb` + AppImage for the host architecture; also runs apps under Xvfb for QA |
| `chronexus-windows-build` | `scripts/build/windows/Dockerfile` | NSIS installers for x86_64 and aarch64 Windows via `cargo-xwin` |

```sh
docker build -t chronexus-linux-qa scripts/qa/linux
docker build -t chronexus-windows-build scripts/build/windows

docker run --rm -v "$PWD":/src:ro -v "$PWD/out":/out \
  -v chronexus-cargo:/usr/local/cargo/registry \
  chronexus-linux-qa sh /src/scripts/build/container-build.sh linux
```

- On Apple Silicon the native Linux build is ARM64; add `--platform linux/amd64` for x64
  (QEMU emulation, much slower).
- `cargo-xwin` downloads the Microsoft CRT and Windows SDK and accepts their licence.
- Container builds never create updater artifacts: the signing key stays outside.
- Windows installers built this way are not Authenticode-signed (no paid certificate) and
  must still be tested on Windows.
