"""Deterministic worker tests; these do not claim real model training."""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import numpy as np
import gguf
from safetensors.numpy import save_file
from train import examples, merge_gguf, train, training_plan


class WorkerTests(unittest.TestCase):
    def test_all_fragments_are_covered_beyond_64_examples_and_overflow_fails(self):
        rows = examples([{"title":f"Pagina {i}","text":f"Informazione {i}"} for i in range(73)])
        plan = training_plan(rows)
        covered = {row[-1]["content"] for row in plan}
        self.assertEqual(covered,{row[-1]["content"] for row in rows})
        self.assertTrue(any("Informazione 72" in text for text in covered))
        with self.assertRaisesRegex(ValueError,"8000"):
            training_plan(rows*110)
        with self.assertRaisesRegex(ValueError,"approved excerpts"):
            training_plan([])

    def test_long_sources_preserve_the_tail_in_token_windows(self):
        class CharacterTokenizer:
            def __call__(self,text,**_):return {"input_ids":[ord(c) for c in text]}
            def decode(self,tokens,**_):return "".join(chr(c) for c in tokens)
        text="Appunti "*100+"Fine importante."
        rows=examples([{"title":"Pagina","text":text}],CharacterTokenizer())
        fragments=[json.loads(row[1]["content"])["sources"][0]["text"] for row in rows]
        self.assertEqual("".join(fragments),text)
    def test_missing_cuda_fails_before_loading_campaign_or_model(self):
        with patch("torch.cuda.is_available", return_value=False):
            with self.assertRaisesRegex(RuntimeError,"CUDA GPU unavailable"):
                train({},Path("unused"))

    def test_examples_preserve_claims_and_do_not_execute_document_text(self):
        rows = examples([{"title": "Mirna", "text": "Mirna dice di essere una maga."}])
        self.assertIn("dice di essere", rows[0][-1]["content"])
        self.assertIn("remain unverified", rows[0][-1]["content"])
        self.assertIn("[S1]", rows[0][-1]["content"])
        self.assertEqual(examples([{"title": "Vuoto", "text": "  "}]), [])

    def test_merge_changes_only_target_tensors_and_preserves_metadata(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            base = root / "base.gguf"
            w = gguf.GGUFWriter(str(base), "gemma4")
            w.add_name("Synthetic fixture")
            w.add_array("gemma4.test_array", [1, 2, 3])
            w.add_tensor("blk.44.attn_q.weight", np.ones((2, 32), dtype=np.float16))
            unchanged = np.arange(32, dtype=np.float32)
            w.add_tensor("output_norm.weight", unchanged)
            quantized = gguf.quantize(np.ones((2,32),dtype=np.float32),gguf.GGMLQuantizationType.Q4_0)
            w.add_tensor("blk.43.attn_q.weight",quantized,raw_dtype=gguf.GGMLQuantizationType.Q4_0)
            w.write_header_to_file(); w.write_kv_data_to_file(); w.write_tensors_to_file(); w.close()
            adapter = root / "adapter"; adapter.mkdir()
            (adapter / "adapter_config.json").write_text(json.dumps({"r": 4, "lora_alpha": 8}))
            save_file({"base_model.model.model.language_model.layers.44.self_attn.q_proj.lora_A.weight": np.ones((4, 32), dtype=np.float32), "base_model.model.model.language_model.layers.44.self_attn.q_proj.lora_B.weight": np.ones((2, 4), dtype=np.float32)}, str(adapter / "adapter_model.safetensors"))
            output = root / "merged.gguf"
            merge_gguf(base, adapter, output)
            r = gguf.GGUFReader(str(output))
            self.assertEqual(r.fields["general.name"].contents(), "Synthetic fixture")
            self.assertEqual(r.fields["gemma4.test_array"].contents(), [1, 2, 3])
            tensors = {t.name: t.data for t in r.tensors}
            np.testing.assert_array_equal(tensors["blk.44.attn_q.weight"], np.full((2, 32), 9, dtype=np.float16))
            np.testing.assert_array_equal(tensors["output_norm.weight"], unchanged)
            np.testing.assert_array_equal(tensors["blk.43.attn_q.weight"],quantized)
            q = next(t for t in r.tensors if t.name=="blk.43.attn_q.weight")
            self.assertEqual(tuple(q.shape),(32,2))
            r.data._mmap.close()


if __name__ == "__main__":
    unittest.main()
