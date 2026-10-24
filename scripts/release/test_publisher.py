import importlib.util,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('publisher',Path(__file__).with_name('forgejo_release.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class PublisherTests(unittest.TestCase):
 def test_asset_allowlist(self):
  self.assertEqual(m.safe_asset('Chronexus-0.2.0-Windows-x64.zip'),'Chronexus-0.2.0-Windows-x64.zip')
  for x in ['../x.zip','campaign.zip','Chronexus-0.2.0-AI-pesi-5-di-4.zip','Chronexus-0.2.0-Windows-x64.exe']:
   with self.assertRaises(ValueError):m.safe_asset(x)
 def test_rejects_external_api_before_network(self):
  for p in ['https://example.org','/api/v1/user','/api/v1/repos/acelith/Chronexus/../other']:
   with self.assertRaises(ValueError):m.Client('unused').json(p)
 def test_rejects_external_download_before_network(self):
  for url in ['https://example.org/a','http://github.com/a','https://github.com.evil/a']:
   with self.assertRaises(ValueError):m.Client('unused').verify({'browser_download_url':url},{})
if __name__=='__main__':unittest.main()
