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
 def test_postbuild_changes_preserve_app_source(self):
  self.assertTrue(m.postbuild_only(['docs/STATUS.md','scripts/release/forgejo_release.py']))
  self.assertFalse(m.postbuild_only(['src/App.tsx']))
  self.assertFalse(m.postbuild_only(['src-tauri/tauri.conf.json']))
 def test_gateway_error_is_reported_without_credentials_in_arguments(self):
  from unittest.mock import patch
  from types import SimpleNamespace
  result=SimpleNamespace(returncode=0,stdout='{"http_code":502,"size_upload":297304064,"time_total":235}')
  with patch.object(m.subprocess,'run',return_value=result) as run:
   with self.assertRaisesRegex(RuntimeError,'HTTP 502'):m.Client('test-only-secret').upload(2,Path('Chronexus-0.2.0-Installer-Windows-x64.zip'))
   self.assertNotIn('test-only-secret',str(run.call_args.args))
   self.assertIn('test-only-secret',run.call_args.kwargs['input'])
if __name__=='__main__':unittest.main()
