#!/usr/bin/env python3
"""Publish an unsigned Chronexus pre-release (ROADMAP M29) to the fixed Forgejo origin.

usage: publish_unsigned.py VERSION NOTES.md ASSET [ASSET...]

- The annotated tag vVERSION must already be on origin; assets must be built from it.
- Always a *pre-release* without latest.json: Forgejo's releases/latest, which the in-app
  updater reads, keeps pointing at the last signed release.
- SHA256SUMS.txt is generated and uploaded with the assets. Existing releases, tags and
  assets are never replaced. Every asset is downloaded back anonymously and verified.
- Credentials come from the configured Git credential helper, in memory, for this host only.
"""
import base64, hashlib, json, os, re, subprocess, sys, tempfile, urllib.error, urllib.parse, urllib.request, uuid
from pathlib import Path

BASE = "https://github.com"
REPO = "acelith/Chronexus"
API = f"/api/v1/repos/{REPO}"
ROOT = Path(__file__).resolve().parents[2]
ASSET = re.compile(r"Chronexus_\d+\.\d+\.\d+_(aarch64|x64|arm64|amd64)(\.dmg|\.deb|\.AppImage|-setup\.exe)")


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


opener = urllib.request.build_opener(NoRedirect())


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True, stderr=subprocess.PIPE).strip()


def authorization():
    result = subprocess.run(
        ["git", "-c", "credential.interactive=never", "credential", "fill"],
        input=f"url={BASE}/{REPO}.git\n\n", cwd=ROOT, text=True, capture_output=True,
        env={**os.environ, "GIT_TERMINAL_PROMPT": "0", "GCM_INTERACTIVE": "Never"},
    )
    fields = dict(l.split("=", 1) for l in result.stdout.splitlines() if "=" in l)
    if result.returncode or fields.get("host") != "github.com" or not fields.get("password"):
        raise SystemExit("Git credentials for github.com are unavailable.")
    return "Basic " + base64.b64encode(f"{fields['username']}:{fields['password']}".encode()).decode()


def call(auth, path, method="GET", body=None, raw=None, headers=None):
    if not (path == API or path.startswith(API + "/")):
        raise SystemExit("Unexpected API path.")
    request = urllib.request.Request(
        BASE + path, method=method,
        data=raw if raw is not None else (None if body is None else json.dumps(body).encode()),
        headers={"Authorization": auth, "Accept": "application/json",
                 **({"Content-Type": "application/json"} if body is not None else {}), **(headers or {})},
    )
    with opener.open(request, timeout=600) as response:
        return json.loads(response.read(2_000_000) or b"null")


def sha(path):
    digest = hashlib.sha256()
    with open(path, "rb") as stream:
        while block := stream.read(1 << 20):
            digest.update(block)
    return digest.hexdigest()


def download_digest(url):
    for _ in range(4):
        try:
            digest = hashlib.sha256()
            with opener.open(url, timeout=600) as response:
                while block := response.read(1 << 20):
                    digest.update(block)
            return digest.hexdigest()
        except urllib.error.HTTPError as error:
            target = urllib.parse.urljoin(url, error.headers.get("Location", ""))
            if error.code in (301, 302, 303, 307, 308) and urllib.parse.urlsplit(target).netloc == "github.com":
                url = target
                continue
            raise
    raise SystemExit("Too many redirects.")


def main():
    version, notes, *names = sys.argv[1:]
    tag = f"v{version}"
    assets = [Path(n) for n in names]
    for asset in assets:
        if not ASSET.fullmatch(asset.name) or f"_{version}_" not in asset.name or not asset.is_file():
            raise SystemExit(f"Unexpected asset: {asset}")
    if len({a.name for a in assets}) != len(assets):
        raise SystemExit("Duplicate asset names.")
    if git("remote", "get-url", "origin") != f"{BASE}/{REPO}.git":
        raise SystemExit("Exact origin required.")
    commit = git("rev-parse", f"{tag}^{{commit}}")
    remote = {l.split()[1]: l.split()[0] for l in git("ls-remote", f"{BASE}/{REPO}.git", f"refs/tags/{tag}^{{}}").splitlines()}
    if remote != {f"refs/tags/{tag}^{{}}": commit}:
        raise SystemExit("The annotated tag must be pushed to github.com first.")
    sums = Path(tempfile.mkdtemp()) / "SHA256SUMS.txt"
    sums.write_text("".join(f"{sha(a)}  {a.name}\n" for a in assets), encoding="utf-8")
    assets.append(sums)
    auth = authorization()
    repo = call(auth, API)
    if repo.get("full_name") != REPO or repo.get("private") or not repo.get("permissions", {}).get("push"):
        raise SystemExit("Public owned repository with write access required.")
    if any(r["tag_name"] == tag for r in call(auth, f"{API}/releases?limit=50")):
        raise SystemExit(f"Release {tag} already exists; it is never replaced.")
    release = call(auth, f"{API}/releases", "POST", {
        "tag_name": tag, "name": f"Chronexus {version}",
        "body": Path(notes).read_text(encoding="utf-8"), "draft": True, "prerelease": True,
    })
    for asset in assets:
        boundary = "chronexus-" + uuid.uuid4().hex
        data = (f'--{boundary}\r\nContent-Disposition: form-data; name="attachment"; filename="{asset.name}"\r\n'
                'Content-Type: application/octet-stream\r\n\r\n').encode() + asset.read_bytes() + f"\r\n--{boundary}--\r\n".encode()
        call(auth, f"{API}/releases/{release['id']}/assets?name={urllib.parse.quote(asset.name)}", "POST",
             raw=data, headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
        print("uploaded:", asset.name)
    final = call(auth, f"{API}/releases/{release['id']}", "PATCH", {"draft": False, "prerelease": True})
    print("Published pre-release:", final["html_url"])
    for asset in assets:
        listed = next(a for a in final["assets"] if a["name"] == asset.name)
        if download_digest(listed["browser_download_url"]) != sha(asset):
            raise SystemExit(f"Checksum mismatch for {asset.name}.")
        print("verified anonymously:", asset.name)


if __name__ == "__main__":
    try:
        main()
    except urllib.error.HTTPError as error:
        raise SystemExit(f"Forgejo HTTP {error.code}; no credentials logged.")
