import { it, expect } from "vitest";
import { applyPreset } from "./presets";
import { emptyCharacter } from "./api";
it("preserves custom values and IDs while switching and reapplying presets", () => {
  const data = {
    ...emptyCharacter(),
    stats: [
      { id: "stable", label: "Custom", value: "7", group: "other" as const },
    ],
  };
  const core = applyPreset(data, "fate-core"),
    accelerated = applyPreset(core, "fate-accelerated"),
    back = applyPreset(accelerated, "fate-core");
  expect(back.stats[0]).toEqual(data.stats[0]);
  expect(back.stats).toEqual(accelerated.stats);
  expect(back.systemId).toBe("fate-core");
  expect(back.hpMaximum).toBe(0);
  expect(back.resources).toEqual([]);
});
it("refuses overflow rather than dropping fields", () => {
  const data = emptyCharacter();
  data.stats = Array.from({ length: 100 }, (_, i) => ({
    id: String(i),
    label: String(i),
    value: "",
    group: "other",
  }));
  expect(() => applyPreset(data, "fate-core")).toThrow();
});
