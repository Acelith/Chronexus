"""Publish a verified app-only updater release to the fixed Chronexus Forgejo origin.
No credential discovery: an interactive token or explicitly selected Git credential
helper supplies authorization in memory, exclusively for this repository/host.
"""
from __future__ import annotations
import argparse
import base64
import getpass
import hashlib
import json
import os
import re
import subprocess
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = "https://github.com"
API = "/api/v1/repos/acelith/Chronexus"
ORIGIN = BASE + "/acelith/Chronexus.git"
MAX_PACKAGE = 256 * 1024 * 1024

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs): return None


def git(*args):
    env = os.environ.copy()
    env.update(GIT_TERMINAL_PROMPT="0", GCM_INTERACTIVE="Never", GIT_TRACE="0", GIT_TRACE_CURL="0")
    return subprocess.check_output(["git", *args], cwd=ROOT, env=env, text=True, stderr=subprocess.PIPE).strip()


def sha(path):
    with path.open("rb") as stream: return hashlib.file_digest(stream, "sha256").hexdigest()


def authorized_git_header():
    """Use only the normal credential helper for the explicitly selected origin."""
    env = os.environ.copy()
    env.update(GIT_TERMINAL_PROMPT="0", GCM_INTERACTIVE="Never", GIT_TRACE="0", GIT_TRACE_CURL="0")
    result = subprocess.run(["git", "-c", "credential.interactive=never", "credential", "fill"], input=f"url={ORIGIN}\n\n", cwd=ROOT, env=env, text=True, capture_output=True)
    if result.returncode: raise ValueError("Git credentials unavailable; use an interactive Forgejo token")
    fields = dict(line.split("=", 1) for line in result.stdout.splitlines() if "=" in line)
    if fields.get("protocol") != "https" or fields.get("host") != "github.com" or not fields.get("username") or not fields.get("password"):
        raise ValueError("Credential helper did not return the selected Forgejo identity")
    return "Basic " + base64.b64encode((fields["username"] + ":" + fields["password"]).encode()).decode()


def allowed_download(url):
    p = urllib.parse.urlsplit(url)
    if p.scheme != "https" or p.netloc != "github.com" or p.username or p.password or p.query or p.fragment:
        raise ValueError("Unexpected download origin")
    if not (re.fullmatch(r"/attachments/[a-fA-F0-9-]+", p.path) or re.fullmatch(r"/acelith/Chronexus/releases/download/v[0-9]+\.[0-9]+\.[0-9]+/(?:Chronexus_[0-9]+\.[0-9]+\.[0-9]+_x64-setup\.exe(?:\.sig)?|latest\.json)", p.path)):
        raise ValueError("Unexpected release download path")
    return url


def validate(folder):
    folder = folder.resolve()
    if not folder.is_relative_to(ROOT / "installers") or folder.is_symlink() or folder.is_junction(): raise ValueError("Use a local installers/ directory")
    report = json.loads((folder / "package-report.json").read_text())
    version = report["version"]
    if not re.fullmatch(r"\d+\.\d+\.\d+", version): raise ValueError("Invalid stable version")
    expected = {f"Chronexus_{version}_x64-setup.exe", f"Chronexus_{version}_x64-setup.exe.sig", "latest.json"}
    if {a["name"] for a in report["assets"]} != expected or len(report["assets"]) != 3: raise ValueError("Unexpected release asset set")
    for a in report["assets"]:
        path = folder / a["name"]
        if path.is_symlink() or not 0 < path.stat().st_size <= MAX_PACKAGE or path.stat().st_size != a["size"] or sha(path) != a["sha256"]:
            raise ValueError("Local signed artifact changed")
    manifest = json.loads((folder / "latest.json").read_text())
    entry = manifest["platforms"]["windows-x86_64"]
    if manifest["version"] != version or list(manifest["platforms"]) != ["windows-x86_64"]:
        raise ValueError("Manifest version/target mismatch")
    installer = next(a for a in report["assets"] if a["name"].endswith(".exe"))
    if entry["url"] != f"{BASE}/acelith/Chronexus/releases/download/v{version}/{installer['name']}" or entry.get("sha256") != installer["sha256"] or entry.get("size") != installer["size"]:
        raise ValueError("Manifest artifact mismatch")
    if entry["signature"] != (folder / (installer["name"] + ".sig")).read_text().strip(): raise ValueError("Manifest signature mismatch")
    if git("status", "--porcelain") or git("remote", "get-url", "origin") != ORIGIN: raise ValueError("Clean tree and exact origin required")
    compiled = report["sourceCommit"]
    if git("rev-parse", f"v{version}^{{commit}}") != compiled: raise ValueError("Annotated source tag mismatch")
    git("merge-base", "--is-ancestor", compiled, "HEAD")
    changed = git("diff", "--name-only", compiled, "HEAD").splitlines()
    if any(not (p.startswith(("docs/", "scripts/release/")) or p in ["README.md", "ROADMAP.md"]) for p in changed): raise ValueError("Application changed after signing; rebuild")
    remote = {line.split()[1]:line.split()[0] for line in git("ls-remote", "origin", "refs/heads/main", f"refs/tags/v{version}^{{}}").splitlines()}
    if remote != {"refs/heads/main":git("rev-parse", "HEAD"), f"refs/tags/v{version}^{{}}":compiled}: raise ValueError("Remote source/tag mismatch")
    return folder, report


class Client:
    def __init__(self, authorization):
        self.authorization = authorization
        self.opener = urllib.request.build_opener(NoRedirect())

    def api(self, path, method="GET", body=None):
        if not (path == API or path.startswith(API + "/")) or ".." in path or "\\" in path: raise ValueError("Unexpected API path")
        req = urllib.request.Request(BASE + path, method=method, data=None if body is None else json.dumps(body).encode(), headers={"Authorization":self.authorization,"Content-Type":"application/json","Accept":"application/json"})
        with self.opener.open(req, timeout=60) as response:
            data=response.read(1_000_001)
            if len(data)>1_000_000: raise ValueError("API response too large")
            return json.loads(data)

    def upload(self, release, path):
        boundary="chronexus-"+uuid.uuid4().hex
        body=(f'--{boundary}\r\nContent-Disposition: form-data; name="attachment"; filename="{path.name}"\r\nContent-Type: application/octet-stream\r\n\r\n').encode()+path.read_bytes()+f"\r\n--{boundary}--\r\n".encode()
        req=urllib.request.Request(f"{BASE}{API}/releases/{int(release)}/assets?name={urllib.parse.quote(path.name)}",data=body,headers={"Authorization":self.authorization,"Content-Type":f"multipart/form-data; boundary={boundary}"},method="POST")
        with self.opener.open(req,timeout=300) as response: return json.loads(response.read(1_000_000))

    def verify(self, url, expected, anonymous=False):
        url=allowed_download(url)
        digest=hashlib.sha256();size=0
        for _ in range(6):
            req=urllib.request.Request(url,headers={} if anonymous else {"Authorization":self.authorization})
            try: response=self.opener.open(req,timeout=300)
            except urllib.error.HTTPError as error:
                if error.code in [301,302,303,307,308]: url=allowed_download(urllib.parse.urljoin(url,error.headers["Location"]));continue
                raise
            with response:
                while block:=response.read(1024*1024):
                    size+=len(block)
                    if size>expected["size"]: raise ValueError("Remote asset oversized")
                    digest.update(block)
            break
        else: raise ValueError("Too many asset redirects")
        if size!=expected["size"] or digest.hexdigest()!=expected["sha256"]: raise ValueError("Remote checksum mismatch")


def publish(authorization, directory, finalize=False):
    folder, report=validate(directory)
    client=Client(authorization)
    repository=client.api(API)
    if repository.get("full_name")!="acelith/Chronexus" or repository.get("private") or not repository.get("permissions",{}).get("push"): raise ValueError("Public owned repository with write access required")
    version=report["version"];tag="v"+version;receipt_path=folder/"forgejo-update-receipt.json"
    if receipt_path.exists():
        receipt=json.loads(receipt_path.read_text())
        if receipt.get("version")!=version or receipt.get("sourceCommit")!=report["sourceCommit"]: raise ValueError("Unknown publication receipt")
        release=client.api(f"{API}/releases/{int(receipt['releaseId'])}")
        if release.get("tag_name")!=tag: raise ValueError("Release identity mismatch")
    else:
        try: client.api(f"{API}/releases/tags/{tag}")
        except urllib.error.HTTPError as e:
            if e.code!=404: raise
            e.close()
        else: raise ValueError("An existing release will not be overwritten")
        notes=(ROOT/f"docs/releases/{tag}.md").read_text(encoding="utf-8")
        notes+=f"\n\nSorgente compilato: `{report['sourceCommit']}`.\n\nSHA-256:\n\n"+"\n".join(f"- `{a['name']}`: `{a['sha256']}`" for a in report["assets"])
        release=client.api(API+"/releases","POST",{"tag_name":tag,"target_commitish":report["sourceCommit"],"name":"Chronexus "+version,"body":notes,"draft":True,"prerelease":False})
        receipt={"version":version,"sourceCommit":report["sourceCommit"],"releaseId":release["id"],"assets":{}}
        receipt_path.write_text(json.dumps(receipt,indent=2)+"\n")
    release_id=int(release["id"])
    assets=client.api(f"{API}/releases/{release_id}/assets")
    known={int(v["id"]) for v in receipt["assets"].values()}
    if any(int(a["id"]) not in known for a in assets): raise ValueError("Unrecognized release attachments; nothing is overwritten")
    for expected in report["assets"]:
        name=expected["name"]
        if name not in receipt["assets"]:
            uploaded=client.upload(release_id,folder/name)
            if uploaded.get("name")!=name or uploaded.get("size")!=expected["size"]: raise ValueError("Unexpected upload response")
            receipt["assets"][name]={"id":uploaded["id"],"url":allowed_download(uploaded["browser_download_url"])}
            receipt_path.write_text(json.dumps(receipt,indent=2)+"\n")
        client.verify(receipt["assets"][name]["url"],expected)
        print("Verified draft asset: "+name,flush=True)
    if finalize:
        if release.get("draft"):
            release=client.api(f"{API}/releases/{release_id}","PATCH",{"draft":False})
        # Verify anonymous access to every asset, the static route and the stable API.
        for expected in report["assets"]: client.verify(receipt["assets"][expected["name"]]["url"],expected,anonymous=True)
        client.verify(f"{BASE}/acelith/Chronexus/releases/download/{tag}/latest.json",next(a for a in report["assets"] if a["name"]=="latest.json"),anonymous=True)
        public=urllib.request.build_opener(NoRedirect())
        with public.open(BASE+API+"/releases/latest",timeout=30) as response: latest=json.load(response)
        if latest.get("id")!=release_id or latest.get("draft") or latest.get("prerelease"): raise ValueError("Public stable channel mismatch")
        receipt["published"]=True
        receipt_path.write_text(json.dumps(receipt,indent=2)+"\n")
    print("Published and verified" if finalize else "Draft prepared and verified", f"{BASE}/acelith/Chronexus/releases/tag/{tag}",flush=True)
    return receipt


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("directory",type=Path)
    p.add_argument("--git-credentials",action="store_true",help="Explicitly use the already configured Git helper for this origin only")
    p.add_argument("--finalize",action="store_true",help="Publish after verifying all draft assets")
    args=p.parse_args()
    authorization=authorized_git_header() if args.git_credentials else "token "+getpass.getpass("Forgejo token (kept only in memory): ")
    publish(authorization,args.directory,args.finalize)

if __name__=="__main__":
    try: main()
    except urllib.error.HTTPError as error: raise SystemExit(f"Forgejo HTTP {error.code}; draft preserved, no credentials logged")
    except (ValueError,subprocess.CalledProcessError) as error: raise SystemExit(str(error) if isinstance(error,ValueError) else "Git validation failed; no credentials logged")
