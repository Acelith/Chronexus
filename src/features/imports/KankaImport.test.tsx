import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import KankaImport from "./KankaImport";
import { kankaApi, type KankaPreview } from "./kanka";
import { backupApi } from "../backup/api";
import { knowledgeApi } from "../knowledge/api";
import { graphApi } from "../graph/api";
import { command } from "../journal/api";
import { applyPreferences, loadLocale, tr } from "../../i18n/store";
import { defaultPreferences } from "../../i18n/locales";

vi.mock("../backup/api", () => ({ backupApi: { create: vi.fn() } }));
vi.mock("../knowledge/api", async (original) => ({
  ...(await original<typeof import("../knowledge/api")>()),
  knowledgeApi: { create: vi.fn(), save: vi.fn() },
}));
vi.mock("../graph/api", () => ({ graphApi: { save: vi.fn() } }));
vi.mock("../journal/api", () => ({ command: vi.fn(), errorMessage: String }));
const preview: KankaPreview = {
  version: "2.6.1",
  warnings: [],
  entities: ["1", "2"].map((id) => ({
    path: `characters/witness_${id}.json`,
    sourceId: id,
    name: `Witness ${id}`,
    kind: "npc",
    entry: "<p>A claim</p>",
    original: `{"id":${id}}`,
    relations:
      id === "1"
        ? [{ id: "4", mirrorId: "", targetId: "2", label: "claims to know" }]
        : [],
  })),
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(kankaApi, "inspect").mockResolvedValue(preview);
  vi.mocked(backupApi.create).mockResolvedValue({
    path: "/backup.nodex",
    counts: {},
  } as never);
  vi.mocked(knowledgeApi.create).mockImplementation(
    async (_, input) => ({ id: input.title, revision: 0 }) as never,
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  applyPreferences(defaultPreferences);
});

async function choose() {
  render(
    <KankaImport
      campaignId="campaign"
      existingTitles={[]}
      onImported={vi.fn()}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: tr("Choose Kanka export…") }),
  );
  await screen.findByText(
    tr("Kanka {0}: {1} pages, {2} relation candidates.", ["2.6.1", 2, 1]),
  );
  fireEvent.click(
    screen.getByRole("button", { name: tr("Back up and import") }),
  );
}
it.each(["en", "it", "ar"] as const)(
  "%s: imports only after backup and keeps original sources and unknown certainty",
  async (locale) => {
    await loadLocale(locale);
    applyPreferences({ ...defaultPreferences, locale });
    await choose();
    await screen.findByText(
      tr(
        "Kanka import finished: {0} pages, {1} unconfirmed relations.",
        [2, 1],
      ),
    );
    expect(knowledgeApi.create).toHaveBeenCalledTimes(2);
    expect(
      vi.mocked(backupApi.create).mock.invocationCallOrder[0],
    ).toBeLessThan(vi.mocked(knowledgeApi.create).mock.invocationCallOrder[0]);
    expect(command).toHaveBeenCalledWith(
      "add_import_source",
      expect.objectContaining({ content: '{"id":1}' }),
    );
    expect(graphApi.save).toHaveBeenCalledWith(
      "campaign",
      expect.objectContaining({ certainty: "unknown", sourceKind: "page" }),
    );
  },
);
it("cancelled or failed backup never writes campaign data", async () => {
  vi.mocked(backupApi.create).mockResolvedValue(null);
  await choose();
  await waitFor(() => expect(backupApi.create).toHaveBeenCalledOnce());
  expect(knowledgeApi.create).not.toHaveBeenCalled();
  expect(graphApi.save).not.toHaveBeenCalled();
});
it("stops after partial failure and shows the recovery backup without offering duplicate retry", async () => {
  vi.mocked(knowledgeApi.save).mockRejectedValue(Error("Disk full"));
  await choose();
  await screen.findByRole("alert");
  expect(
    screen.getByText("Pre-import backup: /backup.nodex"),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Back up and import" }),
  ).not.toBeInTheDocument();
  expect(graphApi.save).not.toHaveBeenCalled();
});
