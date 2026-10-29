# Verify your download

1. **Checksum.** Every release lists SHA-256 values (`SHA256SUMS.txt` for pre-releases, the
   release notes for signed Windows releases). Compare:
   - macOS / Linux: `shasum -a 256 FILE` or `sha256sum FILE`
   - Windows PowerShell: `Get-FileHash FILE -Algorithm SHA256`
2. **Updater signature (signed releases).** The `.sig` next to the installer is a minisign
   signature, base64-encoded; the public key is `plugins.updater.pubkey` in
   `src-tauri/tauri.conf.json`, also base64-encoded. With [minisign](https://jedisct1.github.io/minisign/):

   ```bash
   base64 -d < FILE.sig > FILE.minisig
   grep -o '"pubkey": "[^"]*"' src-tauri/tauri.conf.json | cut -d'"' -f4 | base64 -d > chronexus.pub
   minisign -Vm FILE -x FILE.minisig -p chronexus.pub
   ```

   The in-app updater performs this check itself and refuses unsigned files.
3. **Source.** The release notes name the source commit; the tag is annotated.
4. **Dependencies.** `chronexus-VERSION-sbom.cdx.json` and `-licenses.md`, when attached,
   list every crate and npm package. See [docs/TRUST.md](../TRUST.md).

There is no Authenticode or Apple notarization (no paid certificates): Windows SmartScreen and
macOS Gatekeeper warn on first start.
