import policy from "../../ai-models.json";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { applyPreferences, tr } from "../../i18n/store";
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
  model: policy.primary.name,
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
  applyPreferences({ ...defaultPreferences, locale: "it" });
  vi.mocked(command).mockReset();
  vi.mocked(command).mockResolvedValue(null);
});
afterEach(() => applyPreferences(defaultPreferences));

test("Gemma requires explicit selection and is not an automatic fallback", async () => {
  const user = userEvent.setup();
  vi.mocked(command).mockImplementation(async (name, args) => {
    if (name === "translate_wiki") {
      if (
        (args as { request: { model: string } }).request.model ===
        policy.primary.name
      )
        throw Error("Modello principale assente.");
      return { ...translated, model: policy.secondary.name } as never;
    }
    return null as never;
  });
  render(view());
  const button = screen.getByRole("button", { name: "Traduci in Italiano" });
  await waitFor(() => expect(button).toBeEnabled());
  await user.click(button);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Modello principale assente.",
  );
  expect(
    vi.mocked(command).mock.calls.filter(([n]) => n === "translate_wiki"),
  ).toHaveLength(1);
  await user.selectOptions(
    screen.getByLabelText(tr("Translation model")),
    policy.secondary.name,
  );
  const retry = screen.getByRole("button", { name: "Traduci in Italiano" });
  await waitFor(() => expect(retry).toBeEnabled());
  await user.click(retry);
  expect(await screen.findByText("Una luce per 1 minuto.")).toBeVisible();
  expect(command).toHaveBeenCalledWith(
    "translate_wiki",
    expect.objectContaining({
      request: expect.objectContaining({ model: policy.secondary.name }),
    }),
  );
});

test.each(["wikidot", "open5e"] as const)(
  "%s: reads only cache until explicit translation and preserves the original",
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
    await user.click(screen.getByText(tr("Show original")));
    expect(screen.getByText("A light for 1 minute.")).toBeVisible();
  },
);
test("reuses the offline copy without inference and language changes discard the old copy", async () => {
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
      screen.getByRole("button", { name: "Translate into Deutsch" }),
    ).toBeEnabled(),
  );
  expect(
    vi
      .mocked(command)
      .mock.calls.every(([name]) => name === "read_wiki_translation"),
  ).toBe(true);
});
test("cancels requests while keeping the source readable and discards late results after language changes", async () => {
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
  await user.click(
    screen.getByRole("button", { name: tr("Cancel translation") }),
  );
  expect(command).toHaveBeenCalledWith(
    "cancel_local_ai",
    expect.objectContaining({ id: expect.any(String) }),
  );
  act(() => applyPreferences({ ...defaultPreferences, locale: "en" }));
  await act(async () => finish(translated));
  expect(screen.queryByText("Una luce per 1 minuto.")).not.toBeInTheDocument();
  expect(screen.getByText("A light for 1 minute.")).toBeVisible();
});
test("missing model shows an error, preserves the original and allows retry", async () => {
  const user = userEvent.setup();
  vi.mocked(command).mockImplementation(async (name) => {
    if (name === "translate_wiki") throw Error("Ollama unavailable.");
    return null as never;
  });
  render(view());
  const button = screen.getByRole("button", { name: "Traduci in Italiano" });
  await waitFor(() => expect(button).toBeEnabled());
  await user.click(button);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Ollama unavailable.",
  );
  expect(button).toBeEnabled();
  expect(screen.getByText("A light for 1 minute.")).toBeVisible();
});
test("English default shows the original without inference or cache requests", () => {
  applyPreferences(defaultPreferences);
  render(view());
  expect(screen.getByText("A light for 1 minute.")).toBeVisible();
  expect(command).not.toHaveBeenCalled();
});
