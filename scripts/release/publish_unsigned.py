#!/usr/bin/env python3
"""Publish verified unsigned desktop packages as a GitHub pre-release only.

usage: publish_unsigned.py VERSION NOTES.md ASSET [ASSET...]
The annotated tag must already be on origin. Existing releases/assets are never
replaced. Draft downloads and public downloads must match the local SHA-256.
Unsigned packages never include latest.json and never enter the signed updater.
The SBOM and licence report (sbom.py, M33) are generated from the tagged tree and attached.
"""
import hashlib
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from github_release import GitHubReleaseClient, authorization
import sbom

ROOT = Path(__file__).resolve().parents[2]
REPO = "Acelith/Chronexus"
ORIGIN = "https://github.com/" + REPO + ".git"
ASSET = re.compile(r"Chronexus_\d+\.\d+\.\d+_(aarch64|x64|arm64|amd64)(\.dmg|\.deb|\.AppImage|-setup\.exe)")


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True, stderr=subprocess.PIPE).strip()


def sha(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def main():
    version, notes, *names = sys.argv[1:]
    if not re.fullmatch(r"\d+\.\d+\.\d+", version) or not names:
        raise ValueError("A version and at least one verified package are required")
    assets = [Path(name) for name in names]
    for asset in assets:
        if (not ASSET.fullmatch(asset.name) or f"_{version}_" not in asset.name
                or asset.is_symlink() or not asset.is_file() or not 0 < asset.stat().st_size < 2 * 1024**3):
            raise ValueError(f"Unexpected asset: {asset.name}")
    if len({asset.name for asset in assets}) != len(assets):
        raise ValueError("Duplicate asset names")
    if git("status", "--porcelain") or git("remote", "get-url", "origin") != ORIGIN:
        raise ValueError("Clean tree and exact GitHub origin required")
    tag = "v" + version
    commit = git("rev-parse", tag + "^{commit}")
    remote = {line.split()[1]: line.split()[0] for line in git("ls-remote", "origin", f"refs/tags/{tag}^{{}}").splitlines()}
    if remote != {f"refs/tags/{tag}^{{}}": commit}:
        raise ValueError("The annotated source tag must be pushed to GitHub first")
    client = GitHubReleaseClient(authorization(), REPO)
    repository = client.api(client.prefix)
    if repository.get("full_name") != REPO or repository.get("private") or not repository.get("permissions", {}).get("push"):
        raise ValueError("Public repository with write access required")
    if any(release["tag_name"] == tag for release in client.api(client.prefix + "/releases?per_page=100")):
        raise ValueError("Release already exists; it is never replaced")
    with tempfile.TemporaryDirectory() as directory:
        subprocess.run([sys.executable, str(Path(sbom.__file__)), version, directory], check=True)
        assets += sorted(Path(directory).glob(f"chronexus-{version}-*"))
        sums = Path(directory) / "SHA256SUMS.txt"
        sums.write_text("".join(f"{sha(asset)}  {asset.name}\n" for asset in assets), encoding="utf-8")
        assets.append(sums)
        release = client.api(client.prefix + "/releases", "POST", {
            "tag_name": tag, "target_commitish": commit, "name": "Chronexus " + version,
            "body": Path(notes).read_text(encoding="utf-8"), "draft": True, "prerelease": True,
        })
        uploaded = []
        for asset in assets:
            expected = {"size": asset.stat().st_size, "sha256": sha(asset)}
            remote_asset = client.upload(release["id"], asset)
            client.verify(client.asset_api_url(remote_asset["id"]), expected)
            uploaded.append((remote_asset, expected))
        client.api(f"{client.prefix}/releases/{release['id']}", "PATCH", {"draft": False, "prerelease": True})
        for asset, expected in uploaded:
            client.verify(asset["browser_download_url"], expected, anonymous=True)
        print("Published and verified:", release["html_url"])


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # HTTP errors can contain signed CDN URLs; never include them in diagnostics.
        print("GitHub publication failed:", str(error) if isinstance(error, ValueError) else type(error).__name__, file=sys.stderr)
        raise SystemExit(1)
