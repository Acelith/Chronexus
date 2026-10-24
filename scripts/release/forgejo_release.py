"""Publish only the prevalidated Chronexus release to its fixed Forgejo origin.
Authorization is passed in RAM by the interactive session, never read from disk.
"""
import hashlib, http.client, json, re, subprocess, urllib.parse, urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
HOST='github.com'; BASE='https://'+HOST; REPO='/api/v1/repos/acelith/Chronexus'
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs): return None

def sha(path):
 with path.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT,text=True).strip()
def safe_asset(name):
 if not re.fullmatch(r'Chronexus-[0-9.]+-(Windows-x64|AI-pesi-[1-4]-di-4)\.zip',name):raise ValueError('Unexpected asset name')
 return name
class Client:
 def __init__(self,authorization):self.authorization=authorization;self.opener=urllib.request.build_opener(NoRedirect())
 def json(self,path,method='GET',body=None):
  if not path.startswith(REPO) or '\\' in path or '..' in path:raise ValueError('Unexpected API path')
  data=None if body is None else json.dumps(body).encode()
  req=urllib.request.Request(BASE+path,data=data,method=method,headers={'Authorization':self.authorization,'Content-Type':'application/json','Accept':'application/json'})
  with self.opener.open(req,timeout=60) as r:return json.load(r)
 def upload(self,release,path):
  name=safe_asset(path.name);boundary='ChronexusAssetBoundaryV020'
  first=(f'--{boundary}\r\nContent-Disposition: form-data; name="attachment"; filename="{name}"\r\nContent-Type: application/zip\r\n\r\n').encode()
  last=f'\r\n--{boundary}--\r\n'.encode()
  conn=http.client.HTTPSConnection(HOST,timeout=1800)
  try:
   conn.putrequest('POST',f'{REPO}/releases/{int(release)}/assets?name={urllib.parse.quote(name)}')
   conn.putheader('Authorization',self.authorization);conn.putheader('Content-Type','multipart/form-data; boundary='+boundary)
   conn.putheader('Content-Length',str(len(first)+path.stat().st_size+len(last)));conn.endheaders();conn.send(first)
   count=0;next_report=128*1024**2
   with path.open('rb') as f:
    while block:=f.read(8*1024**2):
     conn.send(block);count+=len(block)
     if count>=next_report:print(f'Upload {name}: {count//1024**2} MiB',flush=True);next_report+=128*1024**2
   conn.send(last);r=conn.getresponse()
   if r.status!=201:raise RuntimeError(f'Upload HTTP {r.status}; draft preserved')
   return json.loads(r.read(1024**2))
  finally:conn.close()
 def verify(self,asset,expected):
  url=asset['browser_download_url'];parsed=urllib.parse.urlparse(url)
  if parsed.scheme!='https' or parsed.netloc!=HOST:raise ValueError('Unexpected download host')
  req=urllib.request.Request(url,headers={'Authorization':self.authorization})
  digest=hashlib.sha256();size=0
  with self.opener.open(req,timeout=1800) as r:
   while block:=r.read(8*1024**2):digest.update(block);size+=len(block)
  if size!=expected['size'] or digest.hexdigest()!=expected['sha256']:raise ValueError('Remote checksum mismatch')
  print('Download e checksum verificati: '+expected['name'],flush=True)

def validate(plan):
 if git('status','--porcelain'):raise ValueError('Working tree must be clean')
 if git('remote','get-url','origin')!='https://github.com/Acelith/Chronexus.git':raise ValueError('Unexpected origin')
 if not re.fullmatch(r'\d+\.\d+\.\d+',plan['version']):raise ValueError('Invalid version')
 if git('rev-parse','HEAD')!=plan['commit'] or git('rev-parse',f"v{plan['version']}^{{commit}}")!=plan['commit']:raise ValueError('Tag/commit mismatch')
 remote=git('ls-remote','origin','refs/heads/main',f"refs/tags/v{plan['version']}^{{}}")
 if len(remote.splitlines())!=2 or any(line.split()[0]!=plan['commit'] for line in remote.splitlines()):raise ValueError('Remote commit/tag mismatch')
 folder=(ROOT/plan['directory']).resolve()
 if not folder.is_relative_to(ROOT/'installers'):raise ValueError('Unexpected package directory')
 report=json.loads((folder/'package-report.json').read_text())
 if report['version']!=plan['version'] or len(report['assets'])!=5:raise ValueError('Package report mismatch')
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
  body+='\n\n### SHA-256 dei cinque ZIP\n\n```text\n'+''.join(f"{a['sha256']}  {a['name']}\n" for a in report['assets'])+'```\n'
  r=client.json(REPO+'/releases','POST',{'tag_name':tag,'target_commitish':plan['commit'],'name':'Chronexus '+plan['version'],'body':body,'draft':True,'prerelease':False})
  receipt={'id':r['id'],'tag':tag,'commit':plan['commit'],'assets':{},'published':False};save()
 release=client.json(REPO+f"/releases/{receipt['id']}")
 if release['tag_name']!=tag:raise ValueError('Release identity mismatch')
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
 if release['draft'] or len(client.json(REPO+f"/releases/{receipt['id']}/assets"))!=5:raise ValueError('Publication not confirmed')
 receipt['published']=True;receipt['url']=release['html_url'];save()
 print('Release pubblicata e verificata: '+release['html_url'],flush=True)
