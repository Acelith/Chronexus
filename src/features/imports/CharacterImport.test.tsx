import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import CharacterImport from "./CharacterImport";
import { backupApi } from "../backup/api";
import { knowledgeApi } from "../knowledge/api";
import { playerApi } from "../player/api";
import { command } from "../journal/api";
vi.mock("../backup/api", () => ({ backupApi: { create: vi.fn() } }));
vi.mock("../knowledge/api", () => ({ knowledgeApi: { create: vi.fn() } }));
vi.mock("../player/api", async (original) => ({
  ...(await original<typeof import("../player/api")>()),
  playerApi: { character: vi.fn(), saveCharacter: vi.fn() },
}));
vi.mock("../journal/api", () => ({ command: vi.fn(), errorMessage: String }));
const raw = JSON.stringify({
  name: "Arin",
  player: { name: "Player" },
  race: { name: "Elf" },
  ability_scores: { dex: 15 },
  hit_points: { max: 12, current: 7 },
});
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(playerApi.character).mockResolvedValue(null);
  vi.mocked(backupApi.create).mockResolvedValue({
    path: "/backup.nodex",
    counts: {},
  } as never);
  vi.mocked(knowledgeApi.create).mockResolvedValue({ id: "source" } as never);
});
async function prepare() {
  render(<CharacterImport campaignId="campaign" onImported={vi.fn()} />);
  const file = new File([raw], "character.json");
  file.arrayBuffer = async () => new TextEncoder().encode(raw).buffer;
  fireEvent.change(screen.getByLabelText("Choose character JSON"), {
    target: { files: [file] },
  });
  await screen.findByText("Arin");
  fireEvent.click(
    screen.getByRole("button", { name: "Back up and import character" }),
  );
}
it("imports into an empty campaign after backup and preserves the exact original", async () => {
  await prepare();
  await screen.findByText("Character imported.");
  expect(playerApi.saveCharacter).toHaveBeenCalledWith(
    "campaign",
    null,
    expect.objectContaining({ name: "Arin", hpCurrent: 7, hpMaximum: 12 }),
  );
  expect(vi.mocked(backupApi.create).mock.invocationCallOrder[0]).toBeLessThan(
    vi.mocked(playerApi.saveCharacter).mock.invocationCallOrder[0],
  );
  expect(command).toHaveBeenCalledWith(
    "add_import_source",
    expect.objectContaining({ content: raw, name: "character.json" }),
  );
});
it("never replaces an existing character", async () => {
  vi.mocked(playerApi.character).mockResolvedValue({ id: "existing" } as never);
  await prepare();
  await screen.findByRole("alert");
  expect(backupApi.create).not.toHaveBeenCalled();
  expect(playerApi.saveCharacter).not.toHaveBeenCalled();
});
it("does not write when backup is cancelled", async () => {
  vi.mocked(backupApi.create).mockResolvedValue(null);
  await prepare();
  await waitFor(() => expect(backupApi.create).toHaveBeenCalledOnce());
  expect(playerApi.saveCharacter).not.toHaveBeenCalled();
});
