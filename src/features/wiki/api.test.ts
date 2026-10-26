import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { command } from "../journal/api";
import { search, detail, category, type Hit } from "./api";
vi.mock("../journal/api", () => ({ command: vi.fn() }));
const fetchMock = vi.fn();
const hit: Hit = {
  object_pk: "srd_sample",
  object_name: "Sample",
  object_model: "Spell",
  route: "v2/spells/",
  text: "Example",
  document: { key: "srd", name: "Source" },
};
const payload = { count: 1, results: [hit] },
  cached = { payload, fetchedAt: "2026-10-23T12:00:00Z" };
beforeEach(() => {
  vi.mocked(command).mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());
test("wiki cache works offline and explicit refresh reports fallback", async () => {
  vi.mocked(command).mockResolvedValue(cached);
  expect((await search("Sample")).payload).toEqual(payload);
  expect(fetchMock).not.toHaveBeenCalled();
  fetchMock.mockRejectedValue(Error("offline"));
  expect((await search("Sample", 1, true)).warning).toContain("local copy");
});
test("wiki explicit search is bounded, credential-free and cached; storage failures remain errors", async () => {
  vi.mocked(command)
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce(7)
    .mockResolvedValueOnce(cached);
  fetchMock.mockImplementation(
    async () => new Response(JSON.stringify(payload)),
  );
  await search("Sample");
  expect(String(fetchMock.mock.calls[0][0])).toBe(
    "https://api.open5e.com/v2/search/?query=sample&limit=20&page=1",
  );
  expect(fetchMock.mock.calls[0][1]).toMatchObject({
    credentials: "omit",
    redirect: "error",
    referrerPolicy: "no-referrer",
  });
  expect(command).toHaveBeenLastCalledWith("store_wiki_cache", {
    key: "search/sample/1",
    payload,
    epoch: 7,
  });
  vi.mocked(command)
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce(7)
    .mockRejectedValueOnce(Error("Disk full"));
  await expect(search("Sample")).rejects.toThrow("Disk full");
});
test("wiki refuses unsafe routes, huge bodies and mismatched detail identities", async () => {
  expect(category({ ...hit, route: "https://evil.test/" })).toBeNull();
  await expect(detail({ ...hit, object_pk: "../secret" })).rejects.toThrow();
  vi.mocked(command).mockResolvedValue(null);
  fetchMock.mockResolvedValue(new Response(new Uint8Array(2097153)));
  await expect(search("Sample")).rejects.toThrow("too large");
  fetchMock.mockImplementation(
    async () =>
      new Response(
        JSON.stringify({ entry: { key: "wrong" }, document: { key: "srd" } }),
      ),
  );
  await expect(detail(hit)).rejects.toThrow("Invalid");
});
