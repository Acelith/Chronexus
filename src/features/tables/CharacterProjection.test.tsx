import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, test, expect, vi } from "vitest";
import CharacterProjection from "./CharacterProjection";
import { tablesApi } from "./api";
import { playerApi } from "../player/api";
import { applyPreferences } from "../../i18n/store";
import type { BoardWidget } from "../../../vendor/table-runtime/index.js";
vi.mock("./api", () => ({
  tablesApi: { character: vi.fn(), project: vi.fn() },
}));
vi.mock("../player/api", () => ({
  playerApi: { character: vi.fn(), saveCharacter: vi.fn() },
}));
beforeEach(() => {
  vi.resetAllMocks();
  applyPreferences({
    version: 2,
    locale: "en",
    script: "standard",
    showOriginal: false,
  });
  vi.mocked(tablesApi.character).mockResolvedValue({
    id: "character",
    revision: 4,
    name: "Synthetic hero",
    hp: 9,
    maxHp: 12,
    portraits: [{ id: "picture", caption: "Chosen picture" }],
  });
});
const widget = () =>
  ({
    selected: "token",
    snapshot: {
      revision: 7,
      activeScene: "scene",
      scenes: [{ id: "scene", grid: { conversion: "table" } }],
      tokens: [{ id: "token", characterId: "character" }],
      vitals: [{ tokenId: "token", hp: 3, maxHp: 12 }],
    },
    refresh: vi.fn().mockResolvedValue(undefined),
  }) as unknown as BoardWidget;
test("only reviewed selected character values are copied after confirmation", async () => {
  const ask = vi.fn().mockResolvedValue(true),
    w = widget();
  render(
    <CharacterProjection
      campaignId="campaign"
      tableId="table"
      online
      getWidget={() => w}
      ask={ask}
    />,
  );
  expect(tablesApi.character).not.toHaveBeenCalled();
  expect(tablesApi.project).not.toHaveBeenCalled();
  await userEvent.click(
    screen.getByRole("button", { name: "Review character values" }),
  );
  await screen.findByText("Synthetic hero · 9 / 12");
  expect(
    screen.getByRole("button", { name: "Copy selected values" }),
  ).toBeDisabled();
  await userEvent.click(screen.getByRole("checkbox", { name: "Name" }));
  await userEvent.click(
    screen.getByRole("button", { name: "Copy selected values" }),
  );
  await waitFor(() =>
    expect(tablesApi.project).toHaveBeenCalledWith(
      "campaign",
      "table",
      "token",
      7,
      {
        characterId: "character",
        characterRevision: 4,
        name: true,
        vitals: false,
        ac: null,
        portrait: null,
        speed: null,
      },
    ),
  );
  expect(ask).toHaveBeenCalledOnce();
  expect(playerApi.saveCharacter).not.toHaveBeenCalled();
});
test("declining a projection sends neither a portrait nor other values", async () => {
  const w = widget();
  render(
    <CharacterProjection
      campaignId="campaign"
      tableId="table"
      online
      getWidget={() => w}
      ask={async () => false}
    />,
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Review character values" }),
  );
  await screen.findByText("Synthetic hero · 9 / 12");
  await userEvent.selectOptions(screen.getByLabelText("Portrait"), "picture");
  await userEvent.click(
    screen.getByRole("button", { name: "Copy selected values" }),
  );
  expect(tablesApi.project).not.toHaveBeenCalled();
});
test("applying token HP to the sheet is a separate revision-guarded action", async () => {
  const local = {
    id: "character",
    campaignId: "campaign",
    revision: 5,
    data: {
      name: "Synthetic hero",
      hpCurrent: 9,
      hpMaximum: 12,
      notes: "PRIVATE NOTES",
      conditions: "Manual condition",
    },
  };
  vi.mocked(playerApi.character).mockResolvedValue(
    local as Awaited<ReturnType<typeof playerApi.character>>,
  );
  const w = widget();
  render(
    <CharacterProjection
      campaignId="campaign"
      tableId="table"
      online
      getWidget={() => w}
      ask={async () => true}
    />,
  );
  expect(playerApi.saveCharacter).not.toHaveBeenCalled();
  await userEvent.click(
    screen.getByRole("button", { name: "Apply token HP to the local sheet" }),
  );
  await waitFor(() =>
    expect(playerApi.saveCharacter).toHaveBeenCalledWith("campaign", local, {
      ...local.data,
      hpCurrent: 3,
      hpMaximum: 12,
    }),
  );
  expect(tablesApi.project).not.toHaveBeenCalled();
});
