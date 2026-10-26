import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import Dashboard from "./Dashboard";
import { playerApi } from "../player/api";
vi.mock("../player/api", () => ({ playerApi: { character: vi.fn() } }));
test("dashboard shows real counts and opens the latest session without placeholder data", async () => {
  vi.mocked(playerApi.character).mockResolvedValue(null);
  const user = userEvent.setup(),
    onSession = vi.fn();
  const session = {
    id: "s",
    campaignId: "c",
    sequence: 84,
    title: "The return",
    playedOn: null,
    document: { version: 1 as const, blocks: [] },
    revision: 0,
    updatedAt: "2026-10-23",
  };
  render(
    <Dashboard
      campaignId="c"
      sessions={[session]}
      pages={[]}
      onSession={onSession}
      onPage={vi.fn()}
      onCharacter={vi.fn()}
      onNewSession={vi.fn()}
    />,
  );
  await screen.findByText("No character created for this campaign.");
  await user.click(screen.getByRole("button", { name: /Session 84/ }));
  expect(onSession).toHaveBeenCalledWith(session);
  expect(
    screen.getByText(
      "The Codex is empty. Create pages or [[ links from the journal.",
    ),
  ).toBeInTheDocument();
});
