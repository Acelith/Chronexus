import { expect, it } from "vitest";
import {
  entryText,
  kankaRelations,
  kankaTitles,
  type KankaEntity,
} from "./kanka";

const entity = (sourceId: string, name: string, relations = []) =>
  ({
    path: `characters/${name}_${sourceId}.json`,
    sourceId,
    name,
    kind: "npc",
    entry: "",
    original: "{}",
    relations,
  }) as KankaEntity;

it("keeps entry text inert and readable", () => {
  window.__kankaRan = false;
  const text = entryText(
    '<p>Hello <b>there</b></p><script>window.__kankaRan=true</script><ul><li>One</li><li>Two</li></ul><img src="x" onerror="window.__kankaRan=true">Line<br>Next',
  );
  expect(text).toBe("Hello there\n- One\n- Two\nLine\nNext");
  expect(window.__kankaRan).toBe(false);
});

it("disambiguates conflicting and repeated names without merging", () => {
  const titles = kankaTitles(
    [
      entity("1", "Guard"),
      entity("2", "Guard"),
      entity("3", "Port"),
      entity("4", "Mira"),
    ],
    ["port"],
  );
  expect([...titles.values()]).toEqual([
    "Guard (Kanka 1)",
    "Guard (Kanka 2)",
    "Port (Kanka 3)",
    "Mira",
  ]);
});

it("keeps one side of mirrored relations and drops unknown targets", () => {
  const a = entity("1", "A");
  const b = entity("2", "B");
  a.relations = [
    { id: "10", targetId: "2", label: "ally of", mirrorId: "11" },
    { id: "12", targetId: "99", label: "fears", mirrorId: "" },
  ];
  b.relations = [{ id: "11", targetId: "1", label: "ally of", mirrorId: "10" }];
  expect(kankaRelations([a, b])).toEqual({
    kept: [{ from: "1", to: "2", label: "ally of" }],
    missing: 1,
  });
});

declare global {
  interface Window {
    __kankaRan?: boolean;
  }
}
