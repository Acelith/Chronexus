import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import CampaignSettings from "./CampaignSettings";
import { campaignAi, type Overview } from "./campaignApi";
import { assistantApi } from "./api";
vi.mock("./TrainingPanel", () => ({ default: () => null }));
vi.mock("./campaignApi", () => ({
  campaignAi: { get: vi.fn(), save: vi.fn(), refresh: vi.fn() },
}));
vi.mock("./api", () => ({
  assistantApi: { rules: vi.fn(), probe: vi.fn(), configure: vi.fn() },
}));
const initial: Overview = {
  profile: {
    settings: {
      enabled: false,
      model: "",
      digest: "",
      specialization: "multilingual-rag",
    },
    edition: "5e-2014",
    context: 8192,
    maxTokens: 512,
    includeKinds: ["page"],
    excludedIds: [],
    ruleKeys: [],
    indexedAt: null,
    manifest: [],
  },
  sources: [],
  added: 0,
  changed: 0,
  removed: 0,
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(campaignAi.get).mockResolvedValue(structuredClone(initial));
  vi.mocked(assistantApi.rules).mockResolvedValue([]);
});
test("loads only campaign data and saves edition preferences before refresh", async () => {
  const user = userEvent.setup();
  vi.mocked(campaignAi.save).mockResolvedValue(initial.profile);
  vi.mocked(campaignAi.refresh).mockResolvedValue(initial);
  render(<CampaignSettings campaignId="campaign-a" name="The campaign" />);
  await screen.findByText("Sources and resources");
  expect(campaignAi.get).toHaveBeenCalledWith("campaign-a");
  expect(assistantApi.probe).not.toHaveBeenCalled();
  await user.selectOptions(screen.getByLabelText("D&D edition"), "5e-2024");
  expect(
    screen.getByRole("button", { name: "Refresh knowledge" }),
  ).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Save preferences" }));
  await waitFor(() =>
    expect(campaignAi.save).toHaveBeenCalledWith(
      "campaign-a",
      expect.objectContaining({ edition: "5e-2024", ruleKeys: [] }),
    ),
  );
  await user.click(screen.getByRole("button", { name: "Refresh knowledge" }));
  await screen.findByText(/The model weights were not retrained/);
  expect(campaignAi.refresh).toHaveBeenCalledWith("campaign-a");
});
test("surfaces load errors without contacting Ollama", async () => {
  vi.mocked(campaignAi.get).mockRejectedValue(new Error("Archive unavailable"));
  render(<CampaignSettings campaignId="campaign-a" name="The campaign" />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Archive unavailable",
  );
  expect(assistantApi.probe).not.toHaveBeenCalled();
  expect(screen.queryByText("Loading settings…")).not.toBeInTheDocument();
  vi.mocked(campaignAi.get).mockResolvedValue(structuredClone(initial));
  await userEvent.click(screen.getByRole("button", { name: "Retry settings" }));
  await screen.findByText("Sources and resources");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
