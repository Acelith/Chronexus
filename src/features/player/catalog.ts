import { tr } from "../../i18n/store";
import { localizeLabels } from "../../i18n/store";
import { command } from "../journal/api";
import { emptyAsset, type AbilityDetails } from "./api";

export const catalogCategories = localizeLabels({
  spells: "Spells",
  classes: "Classes",
  races: "Species and races",
  equipment: "Equipment",
  "magic-items": "Magic items",
  features: "Class features",
  traits: "Traits",
  skills: "Skills",
  conditions: "Conditions",
  rules: "Rules",
  "rule-sections": "Rules sections",
  backgrounds: "Background",
  feats: "Feats",
} as const);
export type CatalogCategory = keyof typeof catalogCategories;
export const catalogBase = "https://www.dnd5eapi.co/api/2014/";
export const srdAttribution =
  'This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode.';
export interface CatalogIndexEntry {
  index: string;
  name: string;
  level?: number;
}
export interface CatalogDocument {
  [key: string]: unknown;
  index: string;
  name: string;
}
interface CacheEntry {
  payload: unknown;
  fetchedAt: string;
}
export interface CatalogResult {
  payload: unknown;
  fetchedAt: string;
  cached: boolean;
  warning: string;
}
export function validCatalogPath(path: string): boolean {
  const parts = path.split("/");
  return (
    parts.length <= 2 &&
    Object.hasOwn(catalogCategories, parts[0]) &&
    parts.every((p) => /^[a-z0-9-]{1,160}$/.test(p))
  );
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function parseIndex(value: unknown): CatalogIndexEntry[] {
  if (
    !isRecord(value) ||
    !Array.isArray(value.results) ||
    value.results.length > 5000
  )
    throw Error(tr("Invalid catalog index."));
  return value.results.map((row) => {
    if (
      !isRecord(row) ||
      typeof row.index !== "string" ||
      !/^[a-z0-9-]{1,160}$/.test(row.index) ||
      typeof row.name !== "string" ||
      !row.name.trim() ||
      row.name.length > 200
    )
      throw Error(tr("Invalid index entry."));
    return {
      index: row.index,
      name: row.name,
      ...(typeof row.level === "number" ? { level: row.level } : {}),
    };
  });
}
export function parseDocument(path: string, value: unknown): CatalogDocument {
  if (
    !isRecord(value) ||
    value.index !== path.split("/")[1] ||
    typeof value.name !== "string" ||
    !value.name.trim() ||
    value.name.length > 200
  )
    throw Error(tr("The answer does not match the requested entry."));
  return value as CatalogDocument;
}
async function fetchJson(path: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(catalogBase + path, {
      method: "GET",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      redirect: "error",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok)
      throw Error(
        tr("The catalog answered with error {0}. Try again later.", [
          response.status,
        ]),
      );
    const reader = response.body?.getReader();
    if (!reader) throw Error(tr("Empty catalog response."));
    let size = 0;
    const chunks: Uint8Array[] = [];
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 2 * 1024 * 1024) {
          await reader.cancel();
          throw Error(tr("Catalog response too large."));
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } finally {
    clearTimeout(timeout);
  }
}
export async function loadCatalog(
  path: string,
  refresh = false,
): Promise<CatalogResult> {
  if (!validCatalogPath(path)) throw Error(tr("Catalog path not allowed."));
  const validate = (value: unknown) =>
    path.includes("/") ? parseDocument(path, value) : parseIndex(value);
  const cached = await command<CacheEntry | null>("read_catalog_cache", {
    path,
  });
  if (cached) validate(cached.payload);
  if (cached && !refresh) return { ...cached, cached: true, warning: "" };
  let payload: unknown;
  try {
    payload = await fetchJson(path);
    validate(payload);
  } catch (error) {
    if (cached)
      return {
        ...cached,
        cached: true,
        warning: "Refresh failed. You are viewing the local copy.",
      };
    const detail = error instanceof Error ? error.message : "";
    throw Error(
      tr("Catalog not available. Check the connection and try again. {0}", [
        detail,
      ]),
      { cause: error },
    );
  }
  const entry = await command<CacheEntry>("store_catalog_cache", {
    path,
    payload,
  });
  return { ...entry, cached: false, warning: "" };
}
export function textContent(value: unknown): string {
  return typeof value === "string"
    ? value
    : Array.isArray(value)
      ? value.filter((v) => typeof v === "string").join("\n\n")
      : "";
}
export function spellFromCatalog(doc: CatalogDocument): AbilityDetails {
  const base = emptyAsset("spell", "dnd5e-2014").details as AbilityDetails;
  const school = isRecord(doc.school) ? textContent(doc.school.name) : "";
  const description = [
    textContent(doc.desc),
    textContent(doc.higher_level)
      ? "At higher levels\n" + textContent(doc.higher_level)
      : "",
    textContent(doc.material) ? "Materials\n" + textContent(doc.material) : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const fields = {
    ...base,
    name: doc.name,
    rank: String(doc.level ?? ""),
    school,
    castingTime: textContent(doc.casting_time),
    duration: textContent(doc.duration),
    range: textContent(doc.range),
    components: Array.isArray(doc.components) ? doc.components.join(", ") : "",
    ritual: doc.ritual === true,
    concentration: doc.concentration === true,
    description,
    catalogSource: { path: `spells/${doc.index}`, name: doc.name },
  };
  if (
    [
      fields.castingTime,
      fields.duration,
      fields.range,
      fields.components,
      fields.school,
      fields.rank,
    ].some((v) => v.length > 200) ||
    description.length > 16000
  )
    throw Error(
      tr(
        "Entry too long to import. You can read it and create a custom entry.",
      ),
    );
  return fields;
}
