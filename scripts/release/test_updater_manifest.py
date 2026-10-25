import base64
import tempfile
import unittest
from pathlib import Path
from updater_manifest import manifest

class UpdaterManifestTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.root = Path(self.folder.name)
        self.artifact = self.root / "Chronexus_0.4.0_x64-setup.exe"
        self.artifact.write_bytes(b"synthetic artifact")
        self.signature = self.root / "installer.sig"
        self.signature.write_text(base64.b64encode(b"untrusted comment: test\nnot-a-real-signature\ntrusted comment: timestamp:1\tfile:installer\tversion:0.4.0\nsignature\n").decode())

    def build(self, **overrides):
        args = dict(version="0.4.0", target="windows-x86_64", artifact=self.artifact, signature=self.signature, base_url="https://git.example/repo/releases/download/v0.4.0", notes="Public release notes")
        return manifest(**(args | overrides))

    def test_only_built_platform_is_advertised_with_size_checksum_and_signature(self):
        result = self.build()
        self.assertEqual(list(result["platforms"]), ["windows-x86_64"])
        entry = result["platforms"]["windows-x86_64"]
        self.assertEqual(len(entry["sha256"]), 64)
        self.assertEqual(entry["size"], self.artifact.stat().st_size)
        self.assertTrue(entry["url"].endswith(self.artifact.name))

    def test_rejects_insecure_or_authenticated_urls_and_preview_versions(self):
        for url in ["http://git.example/release", "https://user:password@git.example/release", "https://git.example/release?token=secret"]:
            with self.assertRaises(ValueError): self.build(base_url=url)
        with self.assertRaises(ValueError): self.build(version="0.4.0-preview")

    def test_rejects_missing_signature_and_wrong_signed_version(self):
        with self.assertRaises(ValueError): self.build(version="0.5.0")
        self.signature.unlink()
        with self.assertRaises(ValueError): self.build()

    def test_rejects_target_artifact_mismatch(self):
        with self.assertRaises(ValueError): self.build(target="linux-x86_64")

if __name__ == "__main__": unittest.main()
