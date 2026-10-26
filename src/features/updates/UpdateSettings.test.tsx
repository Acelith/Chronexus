import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import UpdateSettings from "./UpdateSettings";
import { heraldApi, updatesApi } from "./api";
vi.mock("./api", () => ({
  updatesApi: {
    overview: vi.fn(),
    save: vi.fn(),
    check: vi.fn(),
    download: vi.fn(),
    install: vi.fn(),
    cancel: vi.fn(),
  },
  heraldApi: { settings: vi.fn(), save: vi.fn() },
}));
const overview = {
  settings: { endpoint: "https://git.example/latest.json" },
  currentVersion: "0.4.0",
  backupDirectory: "C:/synthetic/update-backups",
};
const offer = {
  id: "update-1",
  version: "0.5.0",
  notes: "Note pubbliche <script>",
};
const run = async (action: () => Promise<void>) => action();
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(updatesApi.overview).mockResolvedValue(overview);
  vi.mocked(updatesApi.check).mockResolvedValue(offer);
  vi.mocked(updatesApi.download).mockResolvedValue(undefined);
  vi.mocked(heraldApi.settings).mockResolvedValue({
    startupCheck: true,
    sound: true,
  });
  vi.mocked(heraldApi.save).mockImplementation(async (s) => s);
});
test("the herald offer downloads and verifies without automatic installation", async () => {
  const user = userEvent.setup();
  const used = vi.fn();
  render(
    <UpdateSettings
      busy={false}
      run={run}
      initialOffer={offer}
      onHandoffUsed={used}
    />,
  );
  await waitFor(() =>
    expect(updatesApi.download).toHaveBeenCalledWith(
      "update-1",
      expect.any(Function),
    ),
  );
  expect(used).toHaveBeenCalledTimes(1);
  expect(
    await screen.findByRole("button", { name: "Create backup and install" }),
  ).toBeInTheDocument();
  expect(updatesApi.install).not.toHaveBeenCalled();
  expect(updatesApi.check).not.toHaveBeenCalled();
  await user.click(
    screen.getByRole("checkbox", { name: /Check once at every startup/ }),
  );
  expect(heraldApi.save).toHaveBeenCalledWith({
    startupCheck: false,
    sound: true,
  });
});
test("the herald offer waits during another operation", async () => {
  const { rerender } = render(
    <UpdateSettings busy run={run} initialOffer={offer} />,
  );
  await screen.findByText("0.4.0");
  expect(updatesApi.download).not.toHaveBeenCalled();
  rerender(<UpdateSettings busy={false} run={run} initialOffer={offer} />);
  await waitFor(() => expect(updatesApi.download).toHaveBeenCalledTimes(1));
  rerender(<UpdateSettings busy={false} run={run} initialOffer={offer} />);
  expect(updatesApi.download).toHaveBeenCalledTimes(1);
});
test("reads only local settings and checks the server on request", async () => {
  const user = userEvent.setup();
  render(<UpdateSettings busy={false} run={run} />);
  expect(await screen.findByText("0.4.0")).toBeInTheDocument();
  expect(updatesApi.check).not.toHaveBeenCalled();
  vi.mocked(updatesApi.check).mockResolvedValue(null);
  await user.click(screen.getByRole("button", { name: "Check for updates" }));
  expect(
    await screen.findByText(/No new version available/),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Create backup and install" }),
  ).not.toBeInTheDocument();
});
test("allows installation only after verified download and preserves backup errors", async () => {
  const user = userEvent.setup();
  render(<UpdateSettings busy={false} run={run} />);
  await user.click(
    await screen.findByRole("button", { name: "Check for updates" }),
  );
  expect(await screen.findByText(offer.notes)).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Create backup and install" }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Download update" }));
  vi.mocked(updatesApi.install).mockRejectedValue(
    Error("Backup failed: disk full."),
  );
  await user.click(
    await screen.findByRole("button", { name: "Create backup and install" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("disk full");
  expect(
    screen.getByRole("button", { name: "Create backup and install" }),
  ).toBeInTheDocument();
});
test("an Invalid signature prevents offering installation", async () => {
  const user = userEvent.setup();
  vi.mocked(updatesApi.download).mockRejectedValue(Error("Firma Invalid"));
  render(<UpdateSettings busy={false} run={run} />);
  await user.click(
    await screen.findByRole("button", { name: "Check for updates" }),
  );
  await user.click(
    await screen.findByRole("button", { name: "Download update" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("Firma Invalid");
  expect(
    screen.queryByRole("button", { name: "Create backup and install" }),
  ).not.toBeInTheDocument();
  expect(updatesApi.install).not.toHaveBeenCalled();
});
test("cancels a download and blocks concurrent operations", async () => {
  const user = userEvent.setup();
  let abort!: (error: Error) => void;
  vi.mocked(updatesApi.download).mockReturnValue(
    new Promise((_resolve, reject) => {
      abort = reject;
    }),
  );
  vi.mocked(updatesApi.cancel).mockImplementation(async () => {
    abort(Error("Download annullato"));
  });
  render(<UpdateSettings busy={false} run={run} />);
  await user.click(
    await screen.findByRole("button", { name: "Check for updates" }),
  );
  await user.click(
    await screen.findByRole("button", { name: "Download update" }),
  );
  expect(
    screen.getByRole("button", { name: "Check for updates" }),
  ).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Cancel download" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("annullato");
  expect(updatesApi.cancel).toHaveBeenCalledOnce();
});
test("a new channel must be saved and invalidates the previous offer", async () => {
  const user = userEvent.setup();
  render(<UpdateSettings busy={false} run={run} />);
  await user.click(
    await screen.findByRole("button", { name: "Check for updates" }),
  );
  await user.click(screen.getByText("Update server"));
  const input = screen.getByRole("textbox", {
    name: "Update channel address",
  });
  await user.clear(input);
  await user.type(input, "https://other.example/latest.json");
  expect(
    screen.getByRole("button", { name: "Check for updates" }),
  ).toBeDisabled();
  vi.mocked(updatesApi.save).mockResolvedValue({
    endpoint: "https://other.example/latest.json",
  });
  await user.click(screen.getByRole("button", { name: "Save update channel" }));
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "Download update" }),
    ).not.toBeInTheDocument(),
  );
  expect(updatesApi.save).toHaveBeenCalledWith({
    endpoint: "https://other.example/latest.json",
  });
});
