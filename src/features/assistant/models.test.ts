import { expect, test } from "vitest";
import policy from "../../ai-models.json";
import { preferredModel, usableModels, retiredQwen } from "./models";
import type { Model } from "./api";
const model = (name: string, weightDigest: string): Model => ({
  name,
  weightDigest,
  digest: "a".repeat(64),
  quantization: "Q4_K_M",
  dndSpecialized: false,
  residentBytes: 0,
  gpuBytes: 0,
});
test("Qwen3.8 precede Gemma e il vecchio Qwen non è selezionabile", () => {
  const available = [
    model(policy.secondary.name, policy.secondary.weightDigest),
    model("qwen3:4b-instruct", "old"),
    model(policy.primary.name, policy.primary.weightDigest),
  ];
  expect(usableModels(available).map((m) => m.name)).toEqual([
    policy.primary.name,
    policy.secondary.name,
  ]);
  expect(preferredModel(available, "qwen3:4b-instruct")).toBe(
    policy.primary.name,
  );
  expect(preferredModel(available, policy.secondary.name)).toBe(
    policy.secondary.name,
  );
  expect(retiredQwen("qwen3:4b-instruct")).toBe(true);
  expect(usableModels([model(policy.primary.name, "wrong")])).toEqual([]);
});
