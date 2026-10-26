import { beforeEach, afterEach, expect, test, vi } from "vitest";
import { command } from "../journal/api";
import {
  loadCatalog,
  parseDocument,
  parseIndex,
  spellFromCatalog,
  validCatalogPath,
} from "./catalog";
vi.mock("../journal/api", () => ({ command: vi.fn() }));
const entry = {
  payload: { results: [{ index: "test-spell", name: "Test Spell", level: 1 }] },
  fetchedAt: "2026-10-23T00:00:00Z",
};
const fetchMock = vi.fn();
beforeEach(() => {
  vi.mocked(command).mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());
test("cached index works offline without network and paths cannot escape the API", async () => {
  vi.mocked(command).mockResolvedValue(entry);
  const result = await loadCatalog("spells");
  expect(result.cached).toBe(true);
  expect(parseIndex(result.payload)[0].name).toBe("Test Spell");
  expect(fetchMock).not.toHaveBeenCalled();
  for (const path of [
    "../spells",
    "https://evil.test",
    "spells/a?b=1",
    "spells/a/b",
    "__proto__",
  ]) {
    expect(validCatalogPath(path)).toBe(false);
    await expect(loadCatalog(path)).rejects.toThrow("not allowed");
  }
});
test("explicit lookup performs bounded GET then persists response and refresh falls back visibly", async () => {
  vi.mocked(command).mockResolvedValueOnce(null).mockResolvedValueOnce(entry);
  fetchMock.mockResolvedValue(new Response(JSON.stringify(entry.payload)));
  expect((await loadCatalog("spells")).cached).toBe(false);
  expect(fetchMock).toHaveBeenCalledWith(
    "https://www.dnd5eapi.co/api/2014/spells",
    expect.objectContaining({
      method: "GET",
      credentials: "omit",
      redirect: "error",
    }),
  );
  expect(command).toHaveBeenLastCalledWith("store_catalog_cache", {
    path: "spells",
    payload: entry.payload,
  });
  vi.mocked(command).mockResolvedValue(entry);
  fetchMock.mockRejectedValue(Error("Offline"));
  expect((await loadCatalog("spells", true)).warning).toContain("local copy");
});
test("bad responses and storage errors never masquerade as saved results", async () => {
  vi.mocked(command).mockResolvedValue(null);
  fetchMock.mockResolvedValue(new Response("{}", { status: 503 }));
  await expect(loadCatalog("spells")).rejects.toThrow("503");
  fetchMock.mockResolvedValue(
    new Response(new Uint8Array(2 * 1024 * 1024 + 1)),
  );
  await expect(loadCatalog("spells")).rejects.toThrow("too large");
  fetchMock.mockResolvedValue(new Response(JSON.stringify(entry.payload)));
  vi.mocked(command)
    .mockResolvedValueOnce(null)
    .mockRejectedValueOnce(Error("Disk full"));
  await expect(loadCatalog("spells")).rejects.toThrow("Disk full");
  expect(() =>
    parseDocument("spells/test-spell", { index: "wrong", name: "Wrong" }),
  ).toThrow();
});
test("spell import preserves mechanics, materials, higher levels and original identity without making it known", () => {
  const doc = parseDocument("spells/test-spell", {
    index: "test-spell",
    name: "Test Spell",
    level: 2,
    school: { name: "Test" },
    desc: ["Test text"],
    higher_level: ["Other text"],
    components: ["V", "M"],
    material: "Cristallo",
    ritual: true,
    concentration: true,
  });
  const spell = spellFromCatalog(doc);
  expect(spell).toMatchObject({
    kind: "spell",
    systemId: "dnd5e-2014",
    rank: "2",
    ritual: true,
    concentration: true,
    known: false,
    prepared: false,
    catalogSource: { path: "spells/test-spell", name: "Test Spell" },
  });
  expect(spell.description).toContain("Cristallo");
  expect(spell.description).toContain("Other text");
});
