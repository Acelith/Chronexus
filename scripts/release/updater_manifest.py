"""Generate the public Tauri updater manifest for one actually built artifact."""
from __future__ import annotations
import argparse
import base64
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote, urlsplit

MAX_PACKAGE = 256 * 1024 * 1024
SUFFIXES = {"windows-x86_64": ".exe", "windows-aarch64": ".exe", "darwin-x86_64": ".app.tar.gz", "darwin-aarch64": ".app.tar.gz", "linux-x86_64": ".AppImage", "linux-aarch64": ".AppImage"}

def manifest(version: str, target: str, artifact: Path, signature: Path, base_url: str, notes: str) -> dict:
    if not re.fullmatch(r"\d+\.\d+\.\d+", version):
        raise ValueError("Only stable SemVer releases are supported")
    if target not in SUFFIXES or not artifact.name.endswith(SUFFIXES[target]):
        raise ValueError("Unsupported target or artifact format")
    parsed = urlsplit(base_url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError("Public HTTPS URL without credentials required")
    if not artifact.is_file() or artifact.is_symlink() or not 0 < artifact.stat().st_size <= MAX_PACKAGE:
        raise ValueError("Missing, unsafe or oversized updater artifact")
    if not signature.is_file() or signature.is_symlink() or not 0 < signature.stat().st_size <= 16384:
        raise ValueError("Missing or unsafe updater signature")
    signed = signature.read_text(encoding="utf-8").strip()
    decoded = base64.b64decode(signed, validate=True).decode("utf-8")
    # Tauri signatures bind the announced version in an authenticated trusted comment.
    # Cryptographic verification remains mandatory in the Rust release test/client.
    trusted = next((line for line in decoded.splitlines() if line.startswith("trusted comment:")), "")
    if f"version:{version}" not in trusted.split("\t"):
        raise ValueError("Signature does not bind the requested app version")
    digest = hashlib.sha256()
    with artifact.open("rb") as stream:
        for chunk in iter(lambda: stream.read(65536), b""):
            digest.update(chunk)
    return {"version": version, "notes": notes, "pub_date": datetime.now(timezone.utc).isoformat(), "platforms": {target: {"url": base_url.rstrip("/") + "/" + quote(artifact.name), "signature": signed, "size": artifact.stat().st_size, "sha256": digest.hexdigest()}}}

def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--version", required=True)
    p.add_argument("--target", choices=SUFFIXES, required=True)
    p.add_argument("--artifact", type=Path, required=True)
    p.add_argument("--signature", type=Path, required=True)
    p.add_argument("--base-url", required=True)
    p.add_argument("--notes", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    args = p.parse_args()
    result = manifest(args.version, args.target, args.artifact, args.signature, args.base_url, args.notes.read_text(encoding="utf-8"))
    with args.output.open("x", encoding="utf-8", newline="\n") as output:
        json.dump(result, output, ensure_ascii=False, indent=2)
        output.write("\n")
    print(f"Created {args.output.name}; publish only after signature and anonymous-download verification")

if __name__ == "__main__":
    main()
