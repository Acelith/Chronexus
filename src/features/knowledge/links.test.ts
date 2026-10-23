import { expect, test } from "vitest";
import { canCreatePage, matchingPages } from "./links";
import type { KnowledgePage } from "./api";
const pages = [
  { id: "v", title: "Varek", aliases: ["Custode"] },
  { id: "n", title: "Nara", aliases: ["Custode"] },
] as KnowledgePage[];
test("un alias ambiguo presenta entrambe le pagine senza crearne un'altra", () => {
  expect(matchingPages(pages, " custode]]").map((page) => page.id)).toEqual([
    "v",
    "n",
  ]);
  expect(canCreatePage(pages, "Custode")).toBe(false);
});
test("la ricerca ignora maiuscole e parentesi finali e permette una bozza sconosciuta", () => {
  expect(matchingPages(pages, "VAREK]]").map((page) => page.id)).toEqual(["v"]);
  expect(canCreatePage(pages, "VAREK]]")).toBe(false);
  expect(canCreatePage(pages, "Gilda]]")).toBe(true);
  expect(canCreatePage(pages, "")).toBe(false);
});
