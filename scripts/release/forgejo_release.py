"""Publish only the prevalidated Chronexus release to its fixed Forgejo origin.
Authorization is passed in RAM by the interactive session, never read from disk.
"""
import hashlib, json, re, subprocess, urllib.parse, urllib.request, uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
HOST='github.com'; BASE='https://'+HOST; REPO='/api/v1/repos/acelith/Chronexus'
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs): return None

def sha(path):
 with path.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT,text=True).strip()
def safe_asset(name):
 if not re.fullmatch(r'Chronexus-[0-9.]+-(Windows-x64|Installer-Windows-x64|AI-pesi-[1-4]-di-4)\.zip',name):raise ValueError('Unexpected asset name')
 return name
class Client:
 def __init__(self,authorization):self.authorization=authorization;self.opener=urllib.request.build_opener(NoRedirect())
 def json(self,path,method='GET',body=None):
  if not path.startswith(REPO) or '\\' in path or '..' in path:raise ValueError('Unexpected API path')
  data=None if body is None else json.dumps(body).encode()
  req=urllib.request.Request(BASE+path,data=data,method=method,headers={'Authorization':self.authorization,'Content-Type':'application/json','Accept':'application/json'})
  with self.opener.open(req,timeout=60) as r:return json.load(r)
 def upload(self,release,path):
  name=safe_asset(path.name)
  response=ROOT/'.tools/m11-m13'/('upload-'+uuid.uuid4().hex+'.json')
  url=BASE+f'{REPO}/releases/{int(release)}/assets?name={urllib.parse.quote(name)}'
  print('Caricamento: '+name,flush=True)
  # Curl handles Expect: 100-continue and reports final HTTP errors even when
  # the gateway rejects a body during transfer. Authorization travels via stdin.
  result=subprocess.run(['curl.exe','--config','-','--silent','--show-error',
    '--expect100-timeout','2','--connect-timeout','20','--max-time','7200',
    '--form',f'attachment=@{path.resolve()};type=application/zip;filename={name}',
    '--output',str(response),'--write-out','%{json}',url],
    input=f'header = "Authorization: {self.authorization}"\n',capture_output=True,text=True)
  try:stats=json.loads(result.stdout)
  except json.JSONDecodeError:raise RuntimeError('Trasferimento interrotto prima della risposta HTTP; bozza conservata') from None
  status=stats.get('http_code',0)
  print(f'HTTP {status}; inviati {stats.get("size_upload",0)} byte; {stats.get("time_total",0)} secondi',flush=True)
  if result.returncode or status!=201:raise RuntimeError(f'Upload HTTP {status}, client {result.returncode}; bozza conservata')
  return json.loads(response.read_text(encoding='utf-8'))
 def verify(self,asset,expected):
  url=asset['browser_download_url'];parsed=urllib.parse.urlparse(url)
  if parsed.scheme!='https' or parsed.netloc!=HOST:raise ValueError('Unexpected download host')
  req=urllib.request.Request(url,headers={'Authorization':self.authorization})
  digest=hashlib.sha256();size=0
  with self.opener.open(req,timeout=1800) as r:
   while block:=r.read(8*1024**2):digest.update(block);size+=len(block)
  if size!=expected['size'] or digest.hexdigest()!=expected['sha256']:raise ValueError('Remote checksum mismatch')
  print('Download e checksum verificati: '+expected['name'],flush=True)

def postbuild_only(paths):
 return all(p.startswith(('docs/','scripts/release/')) or p in ['README.md','ROADMAP.md'] for p in paths)

def validate(plan):
 if git('status','--porcelain'):raise ValueError('Working tree must be clean')
 if git('remote','get-url','origin')!='https://github.com/Acelith/Chronexus.git':raise ValueError('Unexpected origin')
 if not re.fullmatch(r'\d+\.\d+\.\d+',plan['version']):raise ValueError('Invalid version')
 head=git('rev-parse','HEAD')
 if head!=plan.get('publicationCommit',plan['commit']) or git('rev-parse',f"v{plan['version']}^{{commit}}")!=plan['commit']:raise ValueError('Tag/commit mismatch')
 git('merge-base','--is-ancestor',plan['commit'],head)
 changes=git('diff','--name-only',plan['commit'],head).splitlines()
 if not postbuild_only(changes):raise ValueError('Application source changed after build: rebuild under a new version')
 remote={line.split()[1]:line.split()[0] for line in git('ls-remote','origin','refs/heads/main',f"refs/tags/v{plan['version']}^{{}}").splitlines()}
 if remote!={'refs/heads/main':head,f"refs/tags/v{plan['version']}^{{}}":plan['commit']}:raise ValueError('Remote commit/tag mismatch')
 folder=(ROOT/plan['directory']).resolve()
 if not folder.is_relative_to(ROOT/'installers'):raise ValueError('Unexpected package directory')
 report=json.loads((folder/'package-report.json').read_text())
 if report['version']!=plan['version'] or len(report['assets'])!=6:raise ValueError('Package report mismatch')
 for asset in report['assets']:
  p=folder/safe_asset(asset['name'])
  if p.is_symlink() or p.stat().st_size!=asset['size'] or sha(p)!=asset['sha256'] or asset['size']>=2048*1024**2:raise ValueError('Local asset changed')
 return folder,report

def publish(authorization):
 plan=json.loads((ROOT/'.tools/m11-m13/release-plan.json').read_text());folder,report=validate(plan)
 client=Client(authorization);tag='v'+plan['version']
 receipt_path=ROOT/'.tools/m11-m13/publication.json'
 receipt=json.loads(receipt_path.read_text()) if receipt_path.exists() else None
 if receipt and (receipt['tag']!=tag or receipt['commit']!=plan['commit']):raise ValueError('Receipt belongs to another release')
 def save():receipt_path.write_text(json.dumps(receipt,indent=2)+'\n')
 if receipt is None:
  releases=client.json(REPO+'/releases?limit=50')
  if any(r['tag_name']==tag for r in releases):raise ValueError('Existing release: never overwrite')
  body=(ROOT/'docs/releases'/f'{tag}.md').read_text(encoding='utf-8')
  body+='\n\n### SHA-256 dei sei ZIP\n\n```text\n'+''.join(f"{a['sha256']}  {a['name']}\n" for a in report['assets'])+'```\n'
  r=client.json(REPO+'/releases','POST',{'tag_name':tag,'target_commitish':plan['commit'],'name':'Chronexus '+plan['version'],'body':body,'draft':True,'prerelease':False})
  receipt={'id':r['id'],'tag':tag,'commit':plan['commit'],'assets':{},'published':False};save()
 release=client.json(REPO+f"/releases/{receipt['id']}")
 if release['tag_name']!=tag:raise ValueError('Release identity mismatch')
 if release['draft']:
  body=(ROOT/'docs/releases'/f'{tag}.md').read_text(encoding='utf-8')
  body+='\n\n### SHA-256 dei sei ZIP\n\n```text\n'+''.join(f"{a['sha256']}  {a['name']}\n" for a in report['assets'])+'```\n'
  client.json(REPO+f"/releases/{receipt['id']}",'PATCH',{'body':body})
 remote=client.json(REPO+f"/releases/{receipt['id']}/assets")
 for asset in report['assets']:
  existing=next((a for a in remote if a['name']==asset['name']),None)
  if existing:
   if receipt['assets'].get(asset['name'])!=existing['id']:raise ValueError('Existing asset is not owned by this run')
  else:
   if not release['draft']:raise ValueError('Refusing upload to published release')
   existing=client.upload(receipt['id'],folder/asset['name']);receipt['assets'][asset['name']]=existing['id'];save()
  client.verify(existing,asset)
 if release['draft']:release=client.json(REPO+f"/releases/{receipt['id']}",'PATCH',{'draft':False})
 if release['draft'] or len(client.json(REPO+f"/releases/{receipt['id']}/assets"))!=len(report['assets']):raise ValueError('Publication not confirmed')
 receipt['published']=True;receipt['url']=release['html_url'];save()
 print('Release pubblicata e verificata: '+release['html_url'],flush=True)
