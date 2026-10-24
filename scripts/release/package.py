"""Build five valid ZIP assets for Forgejo's 2 GiB attachment limit. No private data."""
import argparse, hashlib, json, re, subprocess, zipfile
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
DIGEST = '6114515d63c17436a7c0417d82820ac65ad643e2806c5a3c89cb62846436ed0b'
WEIGHT = 'bb722270d54346adc198f213851dbe0207e87c3ecf2a0aff4d92262726215391'
LIMIT = 2048 * 1024**2
CHUNK = 1800 * 1024**2
PROJECTOR = '0cb0cd0a5c499d92942caa22fe5abb98f6e8874868d590e2b094ece4ac8e6d28'

def sha(path):
    with Path(path).open('rb') as f: return hashlib.file_digest(f, 'sha256').hexdigest()

def safe_files(root):
    for p in sorted(root.rglob('*')):
        if p.is_symlink() or p.is_junction(): raise ValueError('Symbolic runtime path')
        if p.is_file(): yield p

def versions():
    a = json.loads((ROOT/'package.json').read_text())['version']
    b = json.loads((ROOT/'src-tauri/tauri.conf.json').read_text())['version']
    c = re.search(r'^version = "([^"]+)"', (ROOT/'src-tauri/Cargo.toml').read_text(), re.M)[1]
    if a != b or b != c or not re.fullmatch(r'\d+\.\d+\.\d+', a): raise ValueError('Version mismatch')
    return a

def build(output):
    version = versions()
    if output.exists() or not output.resolve().is_relative_to(ROOT/'installers'): raise ValueError('Choose a new installers subdirectory')
    runtime = ROOT/'.tools/m7-runtime/ollama'
    models = ROOT/'.tools/m7-runtime/models'
    descriptor = models/f'blobs/sha256-{DIGEST}'
    if sha(descriptor) != DIGEST: raise ValueError('Model descriptor changed')
    model = json.loads(descriptor.read_text())
    blobs = [model['config'], *model['layers']]
    sources = {}
    for item in blobs:
        digest = item['digest']
        if not re.fullmatch(r'sha256:[a-f0-9]{64}', digest): raise ValueError('Invalid digest')
        p = models/('blobs/'+digest.replace(':','-'))
        if p.stat().st_size != item['size'] or sha(p) != digest[7:]: raise ValueError('Invalid model blob')
        sources['models/blobs/'+p.name] = p
    installer = ROOT/f'src-tauri/target/release/bundle/nsis/Chronexus_{version}_x64-setup.exe'
    if not installer.is_file(): raise ValueError('Build app installer first')
    for p in safe_files(runtime): sources['runtime/'+p.relative_to(runtime).as_posix()] = p
    sources['licenses/OLLAMA_LICENSE.txt'] = ROOT/'.tools/m7-runtime/OLLAMA_LICENSE'
    license_blob = next(x for x in model['layers'] if x['mediaType'].endswith('.license'))
    sources['licenses/GEMMA4_APACHE_2.txt'] = models/('blobs/'+license_blob['digest'].replace(':','-'))
    sources['Start-AI.ps1'] = ROOT/'scripts/release/Start-AI.ps1'
    output.mkdir(parents=True)
    volumes = []
    weight = sources.pop(f'models/blobs/sha256-{WEIGHT}')
    projector = sources.pop(f'models/blobs/sha256-{PROJECTOR}')
    volume_files = []
    with weight.open('rb') as src:
        for index in range(4):
            filename = f'Chronexus-{version}-AI-pesi-{index+1}-di-4.zip'
            entry = f'AI/chunks/{WEIGHT}/part{index+1:04d}'
            size = 0
            with zipfile.ZipFile(output/filename,'x',compression=zipfile.ZIP_STORED,allowZip64=True) as z:
                with z.open(entry,'w',force_zip64=True) as dest:
                    while size < CHUNK:
                        block=src.read(min(8*1024**2,CHUNK-size))
                        if not block: break
                        dest.write(block); size+=len(block)
                if index == 3:
                    extra_entry=f'AI/models/blobs/sha256-{PROJECTOR}'
                    z.write(projector,extra_entry)
                    volume_files.append({'path':f'models/blobs/sha256-{PROJECTOR}','size':projector.stat().st_size,'sha256':PROJECTOR,'volume':filename,'entry':extra_entry})
            if not size or (output/filename).stat().st_size >= LIMIT: raise ValueError('Volume size invalid')
            volumes.append({'name':filename,'sha256':sha(output/filename),'entry':entry,'size':size})
            print(f'Volume {index+1}/4 pronto',flush=True)
        if src.read(1): raise ValueError('Weight exceeds four volumes')
    files=[{'path':path,'size':p.stat().st_size,'sha256':sha(p)} for path,p in sources.items()]+volume_files
    manifest_path='models/manifests/registry.ollama.ai/library/gemma4/12b'
    files.append({'path':manifest_path,'size':descriptor.stat().st_size,'sha256':DIGEST})
    bundle={'formatVersion':2,'bundleId':'chronexus-ai-ollama-0.40.10-gemma4-12b',
      'model':'gemma4:12b','modelDigest':DIGEST,'runtimeVersion':'0.40.10',
      'weight':{'path':f'models/blobs/sha256-{WEIGHT}','sha256':WEIGHT,'size':weight.stat().st_size},
      'volumes':volumes,'files':files}
    core=output/f'Chronexus-{version}-Windows-x64.zip'
    with zipfile.ZipFile(core,'x',compression=zipfile.ZIP_DEFLATED,compresslevel=6,allowZip64=True) as z:
        z.write(installer,installer.name)
        z.write(ROOT/'scripts/release/Install-AI.ps1','AI/Install-AI.ps1')
        z.writestr('AI/bundle.json',json.dumps(bundle,ensure_ascii=False,indent=2)+'\n')
        for path,p in sources.items(): z.write(p,'AI/'+path)
        z.write(descriptor,'AI/'+manifest_path)
        z.write(ROOT/'scripts/release/LEGGIMI.txt','LEGGIMI.txt')
        for notice in sorted((ROOT/'assets').rglob('*')):
            if notice.is_file() and notice.suffix.lower() in ['.txt','.md','.json']:
                z.write(notice,'Licenze-app/'+notice.relative_to(ROOT/'assets').as_posix())
        if (ROOT/'LICENSE').is_file(): z.write(ROOT/'LICENSE','Licenze-app/LICENSE.txt')
        z.writestr('Installa-AI.cmd','@echo off\r\npowershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0AI\\Install-AI.ps1" -Source "%~dp0AI" -Destination "%LOCALAPPDATA%\\Chronexus\\AI\\ollama-0.40.10-gemma4-12b"\r\npause\r\n')
    if core.stat().st_size >= LIMIT: raise ValueError('Core exceeds server limit; do not publish')
    assets=[{'name':p.name,'size':p.stat().st_size,'sha256':sha(p)} for p in sorted(output.glob('*.zip'))]
    (output/'SHA256SUMS.txt').write_text(''.join(f"{x['sha256']}  {x['name']}\n" for x in assets))
    receipt={'version':version,'assets':assets,'modelManifest':DIGEST,'weight':WEIGHT}
    (output/'package-report.json').write_text(json.dumps(receipt,indent=2)+'\n')
    print(json.dumps(receipt,indent=2),flush=True)
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('output',type=Path)
    build(parser.parse_args().output.resolve())
