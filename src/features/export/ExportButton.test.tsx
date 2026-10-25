import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import ExportButton from "./ExportButton";
import { command } from "../journal/api";
vi.mock("../journal/api", async (original) => ({
  ...(await original<typeof import("../journal/api")>()),
  command: vi.fn(),
}));
test("export reports cancellation and failures truthfully", async () => {
  const user = userEvent.setup();
  vi.mocked(command)
    .mockResolvedValueOnce(null)
    .mockRejectedValueOnce(Error("Disco non disponibile"));
  render(<ExportButton campaignId="campaign" busy={false} />);
  await user.click(screen.getByRole("button", { name: "Export campaign" }));
  expect(await screen.findByRole("status")).toHaveTextContent("cancelled");
  await user.click(screen.getByRole("button", { name: "Export campaign" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Disco non disponibile",
  );
  expect(command).toHaveBeenCalledWith("export_campaign", {
    campaignId: "campaign",
  });
});
