#!/usr/bin/env python3
"""Attach the SBOM and licence report (M33) to an existing GitHub release.

usage: attach_sbom.py VERSION

For releases published by publish_app_update.py, whose signed updater set stays exactly
installer, signature and latest.json until finalization: run this after finalization.
The working tree must be clean and at the annotated tag VERSION, so the SBOM describes the
released lockfiles. Existing assets are never replaced; uploads are verified by SHA-256.
"""
import hashlib
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import sbom
from github_release import GitHubReleaseClient, authorization

ROOT = Path(__file__).resolve().parents[2]
REPO = "Acelith/Chronexus"


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True).strip()


def main():
    if len(sys.argv) != 2 or not re.fullmatch(r"\d+\.\d+\.\d+", sys.argv[1]):
        raise SystemExit(__doc__)
    version = sys.argv[1]
    tag = "v" + version
    if git("status", "--porcelain") or git("rev-parse", "HEAD") != git("rev-parse", tag + "^{commit}"):
        raise SystemExit(f"Check out a clean tree at {tag} first")
    client = GitHubReleaseClient(authorization(), REPO)
    release = client.api(f"{client.prefix}/releases/tags/{tag}")
    existing = {a["name"] for a in client.api(f"{client.prefix}/releases/{release['id']}/assets")}
    with tempfile.TemporaryDirectory() as directory:
        subprocess.run([sys.executable, sbom.__file__, version, directory], check=True)
        files = sorted(Path(directory).glob(f"chronexus-{version}-*"))
        clash = [f.name for f in files if f.name in existing]
        if clash:
            raise SystemExit(f"Already attached, never replaced: {', '.join(clash)}")
        for path in files:
            expected = {"size": path.stat().st_size,
                        "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
            uploaded = client.upload(release["id"], path)
            client.verify(client.asset_api_url(uploaded["id"]), expected)
            print("Attached and verified:", path.name, expected["sha256"])


if __name__ == "__main__":
    main()
