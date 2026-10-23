import type { KnowledgePage } from "./api";
export function normalizeQuery(value: string) {
  return value
    .replace(/\]\]$/, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("it");
}
export function matchingPages(pages: KnowledgePage[], query: string) {
  const key = normalizeQuery(query);
  return pages.filter((page) =>
    [page.title, ...page.aliases].some((name) =>
      normalizeQuery(name).includes(key),
    ),
  );
}
export function canCreatePage(pages: KnowledgePage[], query: string) {
  const key = normalizeQuery(query);
  return (
    !!key &&
    query.replace(/\]\]$/, "").trim().length <= 200 &&
    !pages.some((page) =>
      [page.title, ...page.aliases].some(
        (name) => normalizeQuery(name) === key,
      ),
    )
  );
}
