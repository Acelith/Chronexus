import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { it, expect, vi, beforeEach } from "vitest";
import Recap from "./Recap";
import { assistantApi } from "../assistant/api";
import { knowledgeApi } from "../knowledge/api";
vi.mock("../assistant/api", () => ({
  assistantApi: {
    settings: vi.fn(),
    ask: vi.fn(),
    cancel: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("../clues/api", () => ({
  clueApi: { list: vi.fn().mockResolvedValue([]) },
}));
vi.mock("../graph/api", () => ({
  graphApi: {
    graph: vi
      .fn()
      .mockResolvedValue({ nodes: [], edges: [], truncated: false }),
  },
  defaultQuery: {},
  certainties: {},
}));
vi.mock("../player/api", () => ({
  playerApi: { character: vi.fn().mockResolvedValue(null) },
}));
vi.mock("../knowledge/api", () => ({ knowledgeApi: { create: vi.fn() } }));
const session = {
  id: "s",
  campaignId: "c",
  sequence: 2,
  title: "Latest",
  playedOn: null,
  document: { version: 1 as const, blocks: [] },
  revision: 1,
  updatedAt: "",
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(assistantApi.settings).mockResolvedValue({
    enabled: false,
    model: "",
    digest: "",
    specialization: "",
  });
});
it("works without inference and creates a persistent manual recap", async () => {
  const onPage = vi.fn();
  vi.mocked(knowledgeApi.create).mockResolvedValue({ id: "note" } as never);
  render(
    <Recap
      campaignId="c"
      sessions={[session]}
      pages={[]}
      onPage={onPage}
      onSession={vi.fn()}
    />,
  );
  await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  expect(
    screen.getByRole("button", { name: "Draft recap with local AI" }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Write recap" }));
  await waitFor(() => expect(onPage).toHaveBeenCalled());
  expect(assistantApi.ask).not.toHaveBeenCalled();
});
it("shows immutable citations without writing the AI answer to the archive", async () => {
  vi.mocked(assistantApi.settings).mockResolvedValue({
    enabled: true,
    model: "qualified",
    digest: "x",
    specialization: "",
  });
  vi.mocked(assistantApi.ask).mockResolvedValue({
    answer: "Unreviewed answer",
    sources: [
      { key: "S1", title: "Original session", text: "Exact original excerpt" },
    ],
  } as never);
  render(
    <Recap
      campaignId="c"
      sessions={[session]}
      pages={[]}
      onPage={vi.fn()}
      onSession={vi.fn()}
    />,
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Draft recap with local AI" }),
    ).toBeEnabled(),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Draft recap with local AI" }),
  );
  await screen.findByText("Unreviewed answer");
  expect(screen.getByText("Exact original excerpt")).toBeInTheDocument();
  expect(knowledgeApi.create).not.toHaveBeenCalled();
});
it("cancels an active inference on navigation", async () => {
  vi.mocked(assistantApi.settings).mockResolvedValue({
    enabled: true,
    model: "qualified",
    digest: "x",
    specialization: "",
  });
  vi.mocked(assistantApi.ask).mockImplementation(() => new Promise(() => {}));
  const view = render(
    <Recap
      campaignId="c"
      sessions={[session]}
      pages={[]}
      onPage={vi.fn()}
      onSession={vi.fn()}
    />,
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Draft recap with local AI" }),
    ).toBeEnabled(),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Draft recap with local AI" }),
  );
  view.unmount();
  expect(assistantApi.cancel).toHaveBeenCalledWith(expect.any(String));
});
