"""Developer translator privacy preflight; no model or network required."""
import importlib.util
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('translate_local', Path(__file__).with_name('translate-local.py'))
translator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(translator)

class TranslatorTests(unittest.TestCase):
 def setUp(self): translator._checked = False
 def test_primary_uses_shared_qualified_policy(self):
  self.assertEqual(translator.MODEL, translator.POLICY['primary']['name'])
  self.assertEqual(translator.SPEC['gpuLayers'], 48)
 def test_cloud_active_stops_before_any_model_or_strings(self):
  with patch.object(translator, 'local_json', return_value={'cloud': {'disabled': False}}) as call:
   with self.assertRaises(ValueError): translator.verify_runtime()
   call.assert_called_once_with('/api/status')
 def test_changed_weights_stop_before_warmup_or_text(self):
  with patch.object(translator, 'local_json', side_effect=[{'cloud': {'disabled': True}}, {'details': {'format': 'gguf'}, 'modelfile': 'FROM unknown'}]) as call:
   with self.assertRaises(ValueError): translator.verify_runtime()
   self.assertEqual([c.args[0] for c in call.call_args_list], ['/api/status','/api/show'])
 def test_cpu_only_stops_before_strings(self):
  show={'details': {'format': 'gguf'}, 'modelfile': 'FROM sha256-'+translator.SPEC['weightDigest']}
  with patch.object(translator, 'local_json', side_effect=[{'cloud': {'disabled': True}}, show, {'done': True}, {'models': []}]) as call:
   with self.assertRaises(ValueError): translator.verify_runtime()
   self.assertNotIn('/api/chat', [c.args[0] for c in call.call_args_list])
 def test_no_download_or_other_runtime_path(self):
  with self.assertRaises(ValueError): translator.local_json('/api/pull', {'model': translator.MODEL})

if __name__ == '__main__': unittest.main()
