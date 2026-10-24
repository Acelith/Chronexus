"""Local invariants for release packing; no server writes."""
import importlib.util, tempfile, unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('package',Path(__file__).with_name('package.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class PackageTests(unittest.TestCase):
 def test_versions_agree(self): self.assertEqual(m.versions(),'0.2.0')
 def test_digest_stream(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'x';p.write_bytes(b'abc')
   self.assertEqual(m.sha(p),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
 def test_refuses_existing_output(self):
  with tempfile.TemporaryDirectory() as d:
   with self.assertRaises(ValueError):m.build(Path(d))
 def test_four_volumes_fit_server(self):
  self.assertGreater(m.CHUNK*4,7381383680)
  self.assertLess(m.CHUNK+1024**2,m.LIMIT)
if __name__=='__main__':unittest.main()
