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
  render(<CampaignSettings campaignId="campaign-a" name="La campagna" />);
  await screen.findByText("Fonti e risorse");
  expect(campaignAi.get).toHaveBeenCalledWith("campaign-a");
  expect(assistantApi.probe).not.toHaveBeenCalled();
  await user.selectOptions(screen.getByLabelText("Edizione D&D"), "5e-2024");
  expect(
    screen.getByRole("button", { name: "Aggiorna conoscenze" }),
  ).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Salva preferenze" }));
  await waitFor(() =>
    expect(campaignAi.save).toHaveBeenCalledWith(
      "campaign-a",
      expect.objectContaining({ edition: "5e-2024", ruleKeys: [] }),
    ),
  );
  await user.click(screen.getByRole("button", { name: "Aggiorna conoscenze" }));
  await screen.findByText(/I pesi del modello non sono stati riaddestrati/);
  expect(campaignAi.refresh).toHaveBeenCalledWith("campaign-a");
});
test("surfaces load errors without contacting Ollama", async () => {
  vi.mocked(campaignAi.get).mockRejectedValue(
    new Error("Archivio non disponibile"),
  );
  render(<CampaignSettings campaignId="campaign-a" name="La campagna" />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Archivio non disponibile",
  );
  expect(assistantApi.probe).not.toHaveBeenCalled();
});
