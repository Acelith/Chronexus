import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { command } from "../journal/api";
import WikiSettings from "./WikiSettings";
import { WIKI_CHANGED } from "./provider";
vi.mock("../journal/api", async (original) => ({
  ...(await original<typeof import("../journal/api")>()),
  command: vi.fn(),
}));
const summary = {
  open5e: { entries: 3, bytes: 4096, aiSources: 0 },
  wikidot: { entries: 5, bytes: 10240, aiSources: 2 },
};
const empty = {
  open5e: { entries: 3, bytes: 4096, aiSources: 0 },
  wikidot: { entries: 0, bytes: 0, aiSources: 0 },
};
beforeEach(() => {
  vi.mocked(command).mockReset();
  vi.mocked(command).mockImplementation(
    async (name: string, args?: unknown) => {
      switch (name) {
        case "get_wiki_provider":
          return { provider: "wikidot", explicit: false } as never;
        case "wiki_cache_summary":
          return summary as never;
        case "save_wiki_provider":
          return { ...(args as object), explicit: true } as never;
        case "clear_wiki_cache":
          return empty as never;
        default:
          throw Error(`Comando non previsto: ${name}`);
      }
    },
  );
});
test("mostra il default Wikidot e salva una scelta esplicita senza campagna", async () => {
  const user = userEvent.setup();
  const changed = vi.fn();
  window.addEventListener(WIKI_CHANGED, changed);
  render(<WikiSettings disabled={false} />);
  expect(
    await screen.findByText(
      /Nessuna scelta salvata: è attiva la fonte predefinita Wikidot/,
    ),
  ).toBeVisible();
  expect(screen.getByRole("radio", { name: /Wikidot D&D 5e/ })).toBeChecked();
  await user.click(screen.getByRole("radio", { name: /Open5e/ }));
  expect(command).toHaveBeenCalledWith("save_wiki_provider", {
    provider: "open5e",
  });
  expect(await screen.findByText("Fonte wiki salvata: Open5e.")).toBeVisible();
  expect(changed).toHaveBeenCalledTimes(1);
  window.removeEventListener(WIKI_CHANGED, changed);
});
test("svuotare la cache richiede conferma, avvisa sulle fonti AI e può essere annullato", async () => {
  const user = userEvent.setup();
  render(<WikiSettings disabled={false} />);
  await screen.findByText(/Wikidot D&D 5e · voci in cache: 5/);
  const open = screen.getByRole("button", { name: "Svuota cache offline…" });
  await user.click(open);
  const dialog = screen.getByRole("alertdialog", {
    name: "Svuotare Wikidot D&D 5e?",
  });
  expect(dialog).toHaveTextContent("5 copie consultate");
  expect(dialog).toHaveTextContent("2 fonti regole approvate");
  expect(screen.getByRole("button", { name: "Svuota cache" })).toHaveFocus();
  await user.click(screen.getByRole("button", { name: "Annulla" }));
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  expect(open).toHaveFocus();
  await user.click(open);
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  expect(
    vi.mocked(command).mock.calls.some(([n]) => n === "clear_wiki_cache"),
  ).toBe(false);
  await user.click(open);
  await user.click(screen.getByRole("button", { name: "Svuota cache" }));
  expect(command).toHaveBeenCalledWith("clear_wiki_cache", {
    provider: "wikidot",
  });
  expect(
    await screen.findByText("Cache svuotata: Wikidot D&D 5e."),
  ).toBeVisible();
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Svuota cache offline…" }),
    ).toBeDisabled(),
  );
  expect(screen.getByText("La cache selezionata è già vuota.")).toBeVisible();
  await user.selectOptions(screen.getByLabelText("Cache da svuotare"), "all");
  expect(
    screen.getByRole("button", { name: "Svuota cache offline…" }),
  ).toBeEnabled();
});
test("un errore di svuotamento resta visibile e non cambia il riepilogo", async () => {
  const user = userEvent.setup();
  const base = vi.mocked(command).getMockImplementation()!;
  vi.mocked(command).mockImplementation(async (name, args) => {
    if (name === "clear_wiki_cache") throw Error("Archivio occupato.");
    return base(name, args);
  });
  render(<WikiSettings disabled={false} />);
  await screen.findByText(/Wikidot D&D 5e · voci in cache: 5/);
  await user.click(
    screen.getByRole("button", { name: "Svuota cache offline…" }),
  );
  await user.click(screen.getByRole("button", { name: "Svuota cache" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Archivio occupato.",
  );
  expect(screen.getByText(/Wikidot D&D 5e · voci in cache: 5/)).toBeVisible();
});
