import { expect, test } from "vitest";
import { emptyCharacter } from "./api";
import { dndPreset } from "./sheet";
test("D&D labels remain manual, stable and do not overwrite existing statistics or ruleset", () => {
  const data = emptyCharacter();
  data.systemId = "Sistema personale";
  data.stats = [
    {
      id: "keep",
      label: "Strength",
      group: "ability",
      value: "18",
      modifier: "+4",
    },
  ];
  const preset = dndPreset(data);
  expect(preset.stats).toHaveLength(30);
  expect(preset.stats[0]).toEqual(data.stats[0]);
  expect(preset.systemId).toBe("Sistema personale");
  expect(preset.hpMaximum).toBe(0);
  expect(dndPreset(preset)).toEqual(preset);
});
