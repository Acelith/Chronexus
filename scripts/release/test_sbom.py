import unittest

import sbom


def metadata():
    package = lambda name, version, licence: {"id": f"{name} {version}", "name": name,
                                              "version": version, "license": licence}
    edge = lambda target, *kinds: {"pkg": target, "dep_kinds": [{"kind": k} for k in kinds]}
    return {
        "packages": [package("chronexus", "0.12.0", "MIT"), package("serde", "1.0.0", "MIT/Apache-2.0"),
                     package("cc", "1.0.0", "MIT OR Apache-2.0"), package("tempfile", "3.0.0", None),
                     package("itoa", "1.0.0", "MIT")],
        "resolve": {"root": "chronexus 0.12.0", "nodes": [
            {"id": "chronexus 0.12.0", "deps": [edge("serde 1.0.0", None), edge("cc 1.0.0", "build"),
                                                 edge("tempfile 3.0.0", "dev")]},
            {"id": "serde 1.0.0", "deps": [edge("itoa 1.0.0", None)]},
            {"id": "cc 1.0.0", "deps": []}, {"id": "tempfile 3.0.0", "deps": []},
            {"id": "itoa 1.0.0", "deps": []}]},
    }


class SbomTest(unittest.TestCase):
    def test_cargo_scope_follows_normal_and_build_edges_only(self):
        version, components = sbom.cargo_components(metadata())
        self.assertEqual(version, "0.12.0")
        scopes = {c["name"]: c["scope"] for c in components}
        self.assertEqual(scopes, {"serde": "required", "cc": "required", "itoa": "required",
                                  "tempfile": "optional"})
        serde = next(c for c in components if c["name"] == "serde")
        self.assertEqual(serde["licenses"], [{"expression": "MIT OR Apache-2.0"}])
        self.assertEqual(serde["purl"], "pkg:cargo/serde@1.0.0")
        self.assertEqual(next(c for c in components if c["name"] == "tempfile")["licenses"], [])

    def test_npm_scope_licence_purl_and_no_local_paths(self):
        everything = {"MIT": [{"name": "@scope/pkg", "versions": ["1.0.0"], "license": "MIT",
                               "paths": ["/Users/someone/project/node_modules/x"]},
                              {"name": "vitest", "versions": ["4.0.0"], "license": "MIT"}],
                      "MPL-2.0": [{"name": "@blocknote/core", "versions": ["0.56.0"], "license": "MPL-2.0"}]}
        production = {"MIT": [everything["MIT"][0]], "MPL-2.0": everything["MPL-2.0"]}
        components = sbom.npm_components(everything, production)
        scopes = {c["name"]: c["scope"] for c in components}
        self.assertEqual(scopes, {"@scope/pkg": "required", "vitest": "optional", "@blocknote/core": "required"})
        self.assertEqual(components[1]["purl"], "pkg:npm/%40scope/pkg@1.0.0")
        bom = sbom.document("0.12.0", components, "2026-10-29T00:00:00Z", "urn:uuid:x")
        self.assertEqual((bom["bomFormat"], bom["specVersion"]), ("CycloneDX", "1.5"))
        self.assertNotIn("/Users/", str(bom))
        report = sbom.licence_report("0.12.0", components)
        self.assertIn("@blocknote/core 0.56.0 (npm): MPL-2.0", report)
        self.assertIn("## Development only (1 packages)", report)


if __name__ == "__main__":
    unittest.main()
