import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import ImportWorkspace from "./ImportWorkspace";
import { backupApi } from "../backup/api";
import { knowledgeApi } from "../knowledge/api";

vi.mock("../backup/api", () => ({ backupApi: { create: vi.fn() } }));
vi.mock("../knowledge/api", () => ({
  knowledgeApi: { create: vi.fn(), save: vi.fn(), update: vi.fn() },
}));
vi.mock("../journal/api", () => ({
  command: vi.fn(),
  errorMessage: (error: unknown) => String(error),
}));

beforeEach(() => vi.clearAllMocks());

it("requires a completed backup before creating imported pages", async () => {
  vi.mocked(backupApi.create).mockResolvedValue(null);
  render(
    <ImportWorkspace
      campaignId="campaign"
      existingTitles={[]}
      onImported={vi.fn()}
    />,
  );
  const file = new File(["A [[Friend]] note"], "One.md", {
    type: "text/markdown",
  });
  Object.defineProperty(file, "webkitRelativePath", { value: "vault/One.md" });
  fireEvent.change(screen.getByLabelText("Choose notes folder"), {
    target: { files: [file] },
  });
  await screen.findByText("Pages ready: 1", { exact: false });
  fireEvent.click(screen.getByRole("button", { name: "Back up and import" }));
  await waitFor(() => expect(backupApi.create).toHaveBeenCalledOnce());
  expect(knowledgeApi.create).not.toHaveBeenCalled();
});
