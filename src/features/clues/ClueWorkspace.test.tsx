import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { command } from "../journal/api";
import { applyPreferences, loadLocale, tr } from "../../i18n/store";
import { defaultPreferences } from "../../i18n/locales";
import { locales } from "../../i18n/locales";
import type { SaveGuard } from "../journal/Editor";
import type { Clue } from "./api";
import ClueWorkspace from "./ClueWorkspace";

vi.mock("../journal/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../journal/api")>()),
  command: vi.fn(),
}));
afterEach(() => {
  vi.resetAllMocks();
  applyPreferences(defaultPreferences);
});
const source = { kind: "session" as const, id: "session-1", blockId: "proof" };
const session = {
  id: "session-1",
  campaignId: "campaign",
  sequence: 1,
  title: "Bridge",
  playedOn: null,
  revision: 0,
  updatedAt: "",
  document: { version: 1 as const, blocks: [] },
};
const props = {
  campaignId: "campaign",
  pages: [],
  sessions: [session],
  initialSource: source,
  register: vi.fn(),
  onSource: vi.fn(),
  onPage: vi.fn(),
  busy: false,
  externalEpoch: 0,
};

test("selected block starts a guarded clue draft and failed save keeps its text", async () => {
  const user = userEvent.setup();
  vi.mocked(command).mockImplementation(async (name) => {
    if (name === "list_clues") return [];
    throw Error("Disk full");
  });
  const register = vi.fn();
  render(<ClueWorkspace {...props} register={register} />);
  await screen.findByRole("heading", { name: "New clue" });
  await user.type(screen.getByLabelText("Clue title"), "Who took the seal?");
  const guard = register.mock.calls[0][0] as SaveGuard;
  expect(guard.dirty()).toBe(true);
  await expect(guard.flush()).rejects.toThrow("Save or cancel");
  await user.click(screen.getByRole("button", { name: "Save clue" }));
  await screen.findByText("Disk full");
  expect(screen.getByLabelText("Clue title")).toHaveValue("Who took the seal?");
  const sent = vi
    .mocked(command)
    .mock.calls.find(([name]) => name === "save_clue")?.[1] as {
    input: { sources: (typeof source)[] };
  };
  expect(sent.input.sources).toEqual([source]);
});

test.each(["en", "it", "ar"])(
  "%s: filter and reopen a resolved clue",
  async (locale) => {
    await loadLocale(locale as "en" | "it" | "ar");
    applyPreferences({
      ...defaultPreferences,
      locale: locale as "en" | "it" | "ar",
    });
    const item: Clue = {
      id: "clue-1",
      campaignId: "campaign",
      kind: "lead",
      title: "The seal",
      details: "Witness claim",
      certainty: "suspected",
      status: "resolved",
      sources: [source],
      pageIds: [],
      resolutionSessionId: "session-1",
      revision: 2,
      updatedAt: "",
    };
    vi.mocked(command).mockImplementation(async (name) => {
      if (name === "list_clues") return [item];
      if (name === "save_clue")
        return {
          ...item,
          status: "open",
          resolutionSessionId: null,
          revision: 3,
        };
      throw Error(name);
    });
    const user = userEvent.setup();
    const onSource = vi.fn();
    render(
      <ClueWorkspace
        {...props}
        initialSource={undefined}
        onSource={onSource}
      />,
    );
    await screen.findByRole("heading", { name: "The seal" });
    await user.selectOptions(
      screen.getByLabelText(tr("Filter by status")),
      "open",
    );
    expect(
      screen.getByText(tr("No clues match these filters.")),
    ).toBeInTheDocument();
    await user.selectOptions(
      screen.getByLabelText(tr("Filter by status")),
      "resolved",
    );
    await user.click(screen.getByRole("button", { name: tr("Edit") }));
    await user.selectOptions(screen.getByLabelText(tr("Status")), "open");
    await user.click(screen.getByRole("button", { name: tr("Save clue") }));
    await waitFor(() =>
      expect(
        vi
          .mocked(command)
          .mock.calls.some(
            ([name, args]) =>
              name === "save_clue" &&
              (args as { input: { status: string } }).input.status === "open",
          ),
      ).toBe(true),
    );
    await user.selectOptions(
      screen.getByLabelText(tr("Filter by status")),
      "open",
    );
    await screen.findByRole("heading", { name: "The seal" });
    await user.click(screen.getByRole("button", { name: /Bridge/ }));
    expect(onSource).toHaveBeenCalledWith(source);
  },
);

test("new clue kinds and statuses are translated in every supported locale", async () => {
  for (const { id } of locales.filter((locale) => locale.id !== "en")) {
    await loadLocale(id);
    applyPreferences({ ...defaultPreferences, locale: id });
    for (const label of [
      "Clue board",
      "Lead",
      "Suspicion",
      "Rumour",
      "Open",
      "Resolved",
      "Disproven",
    ]) {
      expect(tr(label), `${id}: ${label}`).not.toBe(label);
    }
  }
});
