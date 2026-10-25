import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { applyPreferences } from "../../i18n/store";
import { defaultPreferences } from "../../i18n/locales";
import { command } from "../journal/api";
import WikiTranslation from "./WikiTranslation";

vi.mock("../journal/api", async (original) => ({
  ...(await original<typeof import("../journal/api")>()),
  command: vi.fn(),
}));
const translated = {
  locale: "it",
  title: "Luce di prova",
  model: "qwen3:4b-instruct",
  sourceHash: "a".repeat(64),
  blocks: [{ kind: "paragraph", text: "Una luce per 1 minuto." }],
};
const view = (provider: "wikidot" | "open5e" = "wikidot") => (
  <WikiTranslation
    provider={provider}
    sourceKey={provider === "wikidot" ? "spell:light" : "entry/spells/light"}
    sourceVersion="2026-10-25"
  >
    <p>A light for 1 minute.</p>
  </WikiTranslation>
);
beforeEach(() => {
  applyPreferences(defaultPreferences);
  vi.mocked(command).mockReset();
  vi.mocked(command).mockResolvedValue(null);
});
afterEach(() => applyPreferences(defaultPreferences));

test.each(["wikidot", "open5e"] as const)(
  "%s: legge solo cache finché l’utente non traduce e conserva l’originale",
  async (provider) => {
    const user = userEvent.setup();
    vi.mocked(command).mockImplementation(
      async (name) => (name === "translate_wiki" ? translated : null) as never,
    );
    render(view(provider));
    const button = screen.getByRole("button", { name: "Traduci in Italiano" });
    await waitFor(() => expect(button).toBeEnabled());
    expect(command).toHaveBeenCalledTimes(1);
    expect(command).toHaveBeenCalledWith(
      "read_wiki_translation",
      expect.objectContaining({ provider, locale: "it" }),
    );
    expect(screen.getByText("A light for 1 minute.")).toBeVisible();
    await user.click(button);
    expect(await screen.findByText("Una luce per 1 minuto.")).toBeVisible();
    expect(screen.getByText(/Bozza automatica/)).toBeVisible();
    await user.click(screen.getByText("Mostra originale"));
    expect(screen.getByText("A light for 1 minute.")).toBeVisible();
  },
);
test("riutilizza la copia offline senza inferenza e il cambio lingua elimina quella vecchia", async () => {
  vi.mocked(command).mockImplementation(
    async (name, args) =>
      (name === "read_wiki_translation" &&
      (args as { locale: string }).locale === "it"
        ? translated
        : null) as never,
  );
  render(view());
  expect(await screen.findByText("Una luce per 1 minuto.")).toBeVisible();
  act(() => applyPreferences({ ...defaultPreferences, locale: "de" }));
  expect(screen.queryByText("Una luce per 1 minuto.")).not.toBeInTheDocument();
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Traduci in Deutsch" }),
    ).toBeEnabled(),
  );
  expect(
    vi
      .mocked(command)
      .mock.calls.every(([name]) => name === "read_wiki_translation"),
  ).toBe(true);
});
test("annulla la richiesta lasciando leggibile la fonte e scarta risultati tardivi al cambio lingua", async () => {
  const user = userEvent.setup();
  let finish: (value: unknown) => void = () => undefined;
  vi.mocked(command).mockImplementation(async (name) => {
    if (name === "translate_wiki")
      return new Promise((resolve) => {
        finish = resolve;
      }) as never;
    return null as never;
  });
  render(view());
  const button = screen.getByRole("button", { name: "Traduci in Italiano" });
  await waitFor(() => expect(button).toBeEnabled());
  await user.click(button);
  expect(screen.getByText("A light for 1 minute.")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Annulla traduzione" }));
  expect(command).toHaveBeenCalledWith(
    "cancel_local_ai",
    expect.objectContaining({ id: expect.any(String) }),
  );
  act(() => applyPreferences({ ...defaultPreferences, locale: "en" }));
  await act(async () => finish(translated));
  expect(screen.queryByText("Una luce per 1 minuto.")).not.toBeInTheDocument();
  expect(screen.getByText("A light for 1 minute.")).toBeVisible();
});
test("modello assente: errore visibile, originale e possibilità di riprovare", async () => {
  const user = userEvent.setup();
  vi.mocked(command).mockImplementation(async (name) => {
    if (name === "translate_wiki") throw Error("Ollama non disponibile.");
    return null as never;
  });
  render(view());
  const button = screen.getByRole("button", { name: "Traduci in Italiano" });
  await waitFor(() => expect(button).toBeEnabled());
  await user.click(button);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Ollama non disponibile.",
  );
  expect(button).toBeEnabled();
  expect(screen.getByText("A light for 1 minute.")).toBeVisible();
});
test.each(["tlh", "art-x-rihan"] as const)(
  "%s: fallback dichiarato senza chiamate al traduttore",
  (locale) => {
    applyPreferences({ ...defaultPreferences, locale });
    render(view());
    expect(screen.getByText(/Traduzione wiki non disponibile/)).toBeVisible();
    expect(command).not.toHaveBeenCalled();
  },
);
