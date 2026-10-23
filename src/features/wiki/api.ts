import { command } from "../journal/api";
export const base = "https://api.open5e.com/v2/";
const categories = new Set([
  "spells",
  "creatures",
  "items",
  "classes",
  "species",
  "backgrounds",
  "feats",
  "rules",
  "conditions",
  "features",
  "documents",
]);
const safeId = (s: string) => /^[a-zA-Z0-9_-]{1,200}$/.test(s);
export interface Hit {
  object_pk: string;
  object_name: string;
  object_model: string;
  route: string;
  text: string;
  document: { key: string; name: string };
}
export interface Results {
  count: number;
  results: Hit[];
}
export interface Detail {
  entry: Record<string, unknown> & {
    key: string;
    name: string;
    desc?: string;
    document: { key: string };
  };
  document: Record<string, unknown> & {
    key: string;
    name: string;
    licenses?: { key: string; name: string }[];
  };
}
interface Cache<T> {
  payload: T;
  fetchedAt: string;
}
export interface Answer<T> {
  payload: T;
  fetchedAt: string;
  warning?: string;
}
export function category(hit: Hit): string | null {
  const match = /^v2\/([a-z-]+)\/$/.exec(hit.route);
  return match && categories.has(match[1]) && safeId(hit.object_pk)
    ? match[1]
    : null;
}
async function fetchJson(path: string): Promise<unknown> {
  const url = new URL(path, base);
  if (url.origin !== new URL(base).origin || !url.pathname.startsWith("/v2/"))
    throw Error("Percorso wiki non ammesso.");
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 12000);
  try {
    const r = await fetch(url, {
      signal: controller.signal,
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
      headers: { Accept: "application/json" },
    });
    if (!r.ok) throw Error(`Wiki non disponibile (${r.status}).`);
    if (Number(r.headers.get("content-length")) > 2097152)
      throw Error("Risposta wiki troppo grande.");
    const reader = r.body?.getReader();
    if (!reader) throw Error("Risposta wiki vuota.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 2097152) {
        await reader.cancel();
        throw Error("Risposta wiki troppo grande.");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let at = 0;
    for (const c of chunks) {
      bytes.set(c, at);
      at += c.length;
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  } finally {
    clearTimeout(timer);
  }
}
async function cached<T>(
  key: string,
  load: () => Promise<unknown>,
  refresh: boolean,
  validate: (v: unknown) => boolean,
): Promise<Answer<T>> {
  const old = await command<Cache<T> | null>("read_wiki_cache", { key });
  if (old && !refresh) return old;
  try {
    const payload = await load();
    if (!validate(payload)) throw Error("Risposta wiki non valida.");
    return await command<Cache<T>>("store_wiki_cache", { key, payload });
  } catch (e) {
    if (old)
      return {
        ...old,
        warning: "Aggiornamento non riuscito. Stai leggendo la copia locale.",
      };
    throw e;
  }
}
export function search(
  query: string,
  page = 1,
  refresh = false,
): Promise<Answer<Results>> {
  const q = query.trim().toLowerCase();
  if (
    q.length < 2 ||
    q.length > 100 ||
    !Number.isInteger(page) ||
    page < 1 ||
    page > 100
  )
    return Promise.reject(Error("Inserisci da 2 a 100 caratteri."));
  return cached(
    `search/${encodeURIComponent(q)}/${page}`,
    () =>
      fetchJson(`search/?query=${encodeURIComponent(q)}&limit=20&page=${page}`),
    refresh,
    (v) =>
      !!v &&
      typeof v === "object" &&
      Array.isArray((v as Results).results) &&
      (v as Results).results.length <= 20 &&
      typeof (v as Results).count === "number",
  );
}
export function detail(hit: Hit, refresh = false): Promise<Answer<Detail>> {
  const kind = category(hit);
  if (!kind || !safeId(hit.document.key))
    return Promise.reject(Error("Tipo di voce non supportato."));
  return cached(
    `entry/${kind}/${hit.object_pk}`,
    async () => {
      const [entry, document] = await Promise.all([
        fetchJson(`${kind}/${hit.object_pk}/`),
        fetchJson(`documents/${hit.document.key}/`),
      ]);
      return { entry, document };
    },
    refresh,
    (v) =>
      !!v &&
      typeof v === "object" &&
      (v as Detail).entry?.key === hit.object_pk &&
      (v as Detail).document?.key === (v as Detail).entry?.document?.key,
  );
}
export function plain(value: unknown, depth = 0): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  if (typeof value === "boolean") return value ? "Sì" : "No";
  if (depth > 4) return "";
  if (Array.isArray(value))
    return value
      .slice(0, 50)
      .map((v) => plain(v, depth + 1))
      .filter(Boolean)
      .join("\n");
  if (typeof value === "object")
    return Object.entries(value)
      .filter(([k]) => !["url", "key", "crossreferences"].includes(k))
      .map(
        ([k, v]) =>
          `${k === "name" || k === "desc" ? "" : k + ": "}${plain(v, depth + 1)}`,
      )
      .join("\n");
  return "";
}
