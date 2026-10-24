"""Exercise the actual Windows offline installer with small synthetic ZIP volumes."""
import hashlib,json,subprocess,tempfile,unittest,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
class InstallerTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory(dir=ROOT/'.tools/m11-m13');self.root=Path(self.temp.name)
  self.source=self.root/'payload/AI';self.source.mkdir(parents=True);self.target=self.root/'installed'
  files=[]
  for i in range(5):
   p=self.source/f'runtime/file{i}.txt';p.parent.mkdir(exist_ok=True);p.write_text('fixture-'+str(i))
   files.append({'path':p.relative_to(self.source).as_posix(),'size':p.stat().st_size,'sha256':sha(p)})
  weight=b'one-two-three-four';volumes=[]
  for i in range(4):
   name=f'Chronexus-0.2.0-AI-pesi-{i+1}-di-4.zip';entry=f'AI/chunks/test/part{i}';chunk=weight[i*4:(i+1)*4] if i<3 else weight[12:]
   p=self.source.parent/name
   with zipfile.ZipFile(p,'w') as z:z.writestr(entry,chunk)
   volumes.append({'name':name,'entry':entry,'size':len(chunk),'sha256':sha(p)})
  self.bundle={'formatVersion':2,'bundleId':'chronexus-ai-ollama-0.40.10-gemma4-12b','files':files,'volumes':volumes,'weight':{'path':'models/blobs/weight','size':len(weight),'sha256':hashlib.sha256(weight).hexdigest()}}
  # The production payload already creates the blob parent through its smaller blobs.
  files[0]['path']='models/blobs/small';p=self.source/files[0]['path'];p.parent.mkdir(parents=True);p.write_text('fixture-0')
  # Exercise a component stored beside a weight chunk inside the fourth valid ZIP.
  f=files[1];f['volume']=volumes[3]['name'];f['entry']='AI/extra'
  with zipfile.ZipFile(self.source.parent/f['volume'],'a') as z:z.write(self.source/f['path'],f['entry'])
  volumes[3]['sha256']=sha(self.source.parent/f['volume'])
  self.save()
 def save(self):(self.source/'bundle.json').write_text(json.dumps(self.bundle))
 def run_install(self):return subprocess.run(['powershell.exe','-NoProfile','-ExecutionPolicy','Bypass','-File',str(ROOT/'scripts/release/Install-AI.ps1'),'-Source',str(self.source),'-Destination',str(self.target)],capture_output=True,text=True,errors='replace')
 def tearDown(self):self.temp.cleanup()
 def test_install_and_idempotence(self):
  r=self.run_install();self.assertEqual(r.returncode,0,r.stderr)
  self.assertEqual((self.target/'models/blobs/weight').read_bytes(),b'one-two-three-four')
  self.assertEqual(self.run_install().returncode,0)
 def test_refuses_corrupt_volume_before_copy(self):
  (self.source.parent/self.bundle['volumes'][2]['name']).write_bytes(b'bad')
  self.assertNotEqual(self.run_install().returncode,0);self.assertFalse(self.target.exists())
 def test_refuses_unrelated_destination(self):
  self.target.mkdir();p=self.target/'personal.txt';p.write_text('keep')
  self.assertNotEqual(self.run_install().returncode,0);self.assertEqual(p.read_text(),'keep')
 def test_rejects_path_traversal(self):
  self.bundle['files'][0]['path']='../escape';self.save()
  self.assertNotEqual(self.run_install().returncode,0);self.assertFalse(self.target.exists())
if __name__=='__main__':unittest.main()
