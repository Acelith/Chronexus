import { expect, test } from "vitest";
import { canCreatePage, matchingPages } from "./links";
import type { KnowledgePage } from "./api";
const pages = [
  { id: "v", title: "Varek", aliases: ["Custode"] },
  { id: "n", title: "Nara", aliases: ["Custode"] },
] as KnowledgePage[];
test("an ambiguous alias presents both pages without creating another", () => {
  expect(matchingPages(pages, " custode]]").map((page) => page.id)).toEqual([
    "v",
    "n",
  ]);
  expect(canCreatePage(pages, "Custode")).toBe(false);
});
test("search ignores case and trailing brackets and allows an unknown draft", () => {
  expect(matchingPages(pages, "VAREK]]").map((page) => page.id)).toEqual(["v"]);
  expect(canCreatePage(pages, "VAREK]]")).toBe(false);
  expect(canCreatePage(pages, "Gilda]]")).toBe(true);
  expect(canCreatePage(pages, "")).toBe(false);
});
