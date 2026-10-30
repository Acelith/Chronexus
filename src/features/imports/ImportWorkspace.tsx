import { useRef, useState } from "react";
import { tr } from "../../i18n/store";
import { backupApi } from "../backup/api";
import { command, errorMessage } from "../journal/api";
import { knowledgeApi } from "../knowledge/api";
import {
  document,
  linkNames,
  readPage,
  resolver,
  type SourcePage,
} from "./markdown";

type Prepared = {
  pages: SourcePage[];
  files: Map<string, File>;
  warnings: string[];
  logseq: boolean;
};
const normalized = (value: string) =>
  value.normalize("NFC").trim().toLocaleLowerCase();
function imageFile(
  pagePath: string,
  image: string,
  files: Map<string, File>,
): File | undefined {
  const path = pagePath.split("/").slice(0, -1);
  for (const part of image.split("/")) {
    if (part === "..") path.pop();
    else if (part !== ".") path.push(part);
  }
  const direct = files.get(path.join("/"));
  if (direct) return direct;
  const basename = image.split("/").at(-1);
  const matches = [...files].filter(
    ([name]) => name.split("/").at(-1) === basename,
  );
  return matches.length === 1 ? matches[0][1] : undefined;
}
const excluded = (path: string) =>
  path
    .split("/")
    .some(
      (part) =>
        part.startsWith(".") ||
        ["assets", "plugins", "config", "logseq", "node_modules"].includes(
          part.toLowerCase(),
        ),
    );

export default function ImportWorkspace({
  campaignId,
  existingTitles,
  onImported,
}: {
  campaignId: string;
  existingTitles: string[];
  onImported: () => Promise<unknown>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState("");
  const [done, setDone] = useState(false);
  async function prepare(files: FileList | null) {
    setPrepared(null);
    setError("");
    setDone(false);
    setReceipt("");
    if (!files?.length) return;
    setPending(true);
    try {
      const all = [...files];
      if (
        all.length > 5000 ||
        all.reduce((n, f) => n + f.size, 0) > 200_000_000
      )
        throw Error(tr("Import too large."));
      const byPath = new Map(
        all.map((f) => [f.webkitRelativePath.replace(/\\/g, "/"), f]),
      );
      const logseq =
        [...byPath.keys()].some((path) =>
          /(^|\/)journals\/[^/]+\.md$/i.test(path),
        ) ||
        [...byPath.keys()].some((path) =>
          /(^|\/)logseq\/config\.edn$/i.test(path),
        );
      const markdown = [...byPath].filter(
        ([path, file]) =>
          file.name.toLowerCase().endsWith(".md") &&
          (logseq ? /(^|\/)(pages|journals)\//i.test(path) : !excluded(path)),
      );
      if (!markdown.length || markdown.length > 2000)
        throw Error(tr("Select a vault with 1–2000 Markdown pages."));
      const pages: SourcePage[] = [];
      for (const [path, file] of markdown) {
        if (file.size > 1_000_000 || path.length > 512)
          throw Error(tr("A Markdown page exceeds the import limit."));
        const raw = new TextDecoder("utf-8", {
          fatal: true,
          ignoreBOM: true,
        }).decode(await file.arrayBuffer());
        const page = readPage(path, raw, logseq);
        if (page.body.split(/\r?\n/).length > 5000)
          throw Error(tr("A Markdown page exceeds the import limit."));
        pages.push(page);
      }
      const titles = new Set(existingTitles.map(normalized));
      for (const page of pages) {
        if (
          !page.title.trim() ||
          page.title.length > 200 ||
          titles.has(normalized(page.title))
        )
          throw Error(tr("An imported title conflicts with an existing page."));
        titles.add(normalized(page.title));
      }
      const aliasOwners = new Map<string, string>();
      const warnings: string[] = [];
      for (const page of pages) {
        page.aliases = page.aliases.filter((alias) => {
          const name = normalized(alias),
            owner = aliasOwners.get(name);
          if (
            !alias ||
            alias.length > 200 ||
            (titles.has(name) && name !== normalized(page.title)) ||
            (owner && owner !== page.path)
          ) {
            warnings.push(`${page.title}: ${alias}`);
            return false;
          }
          aliasOwners.set(name, page.path);
          return true;
        });
      }
      const resolve = resolver(pages);
      warnings.push(
        ...pages
          .flatMap((page) =>
            linkNames(page.body)
              .filter((name) => !resolve(name))
              .map((name) => `${page.title}: [[${name}]]`),
          )
          .slice(0, 40),
      );
      for (const page of pages)
        for (const image of page.images) {
          const file = imageFile(page.path, image, byPath);
          if (
            !file ||
            file.size > 20 * 1024 * 1024 ||
            !/\.(png|jpe?g|webp)$/i.test(file.name)
          )
            warnings.push(`${page.title}: ${image}`);
        }
      setPrepared({
        pages,
        files: byPath,
        warnings: warnings.slice(0, 40),
        logseq,
      });
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setPending(false);
    }
  }
  async function importPages() {
    if (!prepared || pending) return;
    setPending(true);
    setError("");
    try {
      const backup = await backupApi.create();
      if (!backup) return;
      setReceipt(backup.path);
      const ids = new Map<string, string>();
      const created = new Map<
        string,
        Awaited<ReturnType<typeof knowledgeApi.create>>
      >();
      for (const page of prepared.pages) {
        const saved = await knowledgeApi.create(campaignId, {
          title: page.title,
          kind: "note",
          status: "active",
          aliases: [],
        });
        ids.set(page.path, saved.id);
        created.set(page.path, saved);
      }
      const resolve = resolver(prepared.pages);
      for (const page of prepared.pages) {
        const id = ids.get(page.path);
        if (!id)
          throw Error(tr("Import stopped. Restore the backup to undo it."));
        const saved = created.get(page.path);
        if (!saved)
          throw Error(tr("Import stopped. Restore the backup to undo it."));
        const updated = await knowledgeApi.save(
          saved,
          saved.revision,
          document(page.body, ids, resolve, prepared.logseq),
        );
        await command("add_import_source", {
          campaignId,
          kind: "page",
          id,
          name: page.path,
          content: page.markdown,
        });
        if (page.aliases.length) {
          await knowledgeApi.update(
            campaignId,
            id,
            {
              title: updated.title,
              kind: updated.kind,
              status: updated.status,
              aliases: page.aliases,
            },
            updated,
          );
        }
        for (const image of new Set(page.images)) {
          const file = imageFile(page.path, image, prepared.files);
          if (
            !file ||
            file.size > 20 * 1024 * 1024 ||
            !/\.(png|jpe?g|webp)$/i.test(file.name)
          )
            continue;
          const dataBase64 = await new Promise<string>(
            (resolveBase64, reject) => {
              const reader = new FileReader();
              reader.onload = () =>
                resolveBase64(String(reader.result).split(",")[1] ?? "");
              reader.onerror = () => reject(reader.error);
              reader.readAsDataURL(file);
            },
          );
          await command("add_image", {
            campaignId,
            target: { kind: "page", id },
            caption: file.name.slice(0, 200),
            role: "image",
            dataBase64,
          });
        }
      }
      setDone(true);
      setPrepared(null);
      await onImported();
    } catch (reason) {
      setError(
        `${errorMessage(reason)} ${tr("Restore the backup to undo this import.")}`,
      );
      await onImported();
    } finally {
      setPending(false);
    }
  }
  return (
    <section aria-label={tr("Import notes")} className="language-settings">
      <h4>{tr("Import notes")}</h4>
      <p>
        {tr(
          "Choose an Obsidian or Logseq folder. Review the pages before importing; a backup is required before any change.",
        )}
      </p>
      <input
        ref={(node) => {
          input.current = node;
          if (node) node.setAttribute("webkitdirectory", "");
        }}
        type="file"
        multiple
        aria-label={tr("Choose notes folder")}
        disabled={pending}
        onChange={(event) => void prepare(event.target.files)}
      />
      {pending && <p role="status">{tr("Import in progress…")}</p>}
      {prepared && (
        <div>
          <p>
            {tr("Pages ready: {0}", [prepared.pages.length])} ·{" "}
            {prepared.logseq ? "Logseq" : "Obsidian"}
          </p>
          <ul>
            {prepared.pages.slice(0, 20).map((page) => (
              <li key={page.path}>
                <bdi>{page.title}</bdi>
              </li>
            ))}
          </ul>
          {prepared.pages.length > 20 && (
            <p>{tr("Additional pages: {0}", [prepared.pages.length - 20])}</p>
          )}
          {prepared.warnings.length > 0 && (
            <details>
              <summary>
                {tr("Import warnings: {0}", [prepared.warnings.length])}
              </summary>
              <ul>
                {prepared.warnings.map((w) => (
                  <li key={w}>
                    <bdi>{w}</bdi>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <button
            type="button"
            onClick={() => void importPages()}
            disabled={pending}
          >
            {tr("Back up and import")}
          </button>
        </div>
      )}
      {receipt && (
        <p role="status">{tr("Pre-import backup: {0}", [receipt])}</p>
      )}
      {done && <p role="status">{tr("Notes imported.")}</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  );
}
