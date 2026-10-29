import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { command } from "../journal/api";
import { applyPreferences, loadLocale } from "../../i18n/store";
import { defaultPreferences, locales } from "../../i18n/locales";
import { demoText } from "./api";
import GettingStarted from "./GettingStarted";
import GuidedTour from "./GuidedTour";

vi.mock("../journal/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../journal/api")>()),
  command: vi.fn(),
}));
afterEach(() => {
  vi.resetAllMocks();
  applyPreferences(defaultPreferences);
});

test("the tour is keyboard operable and Escape counts as skipping", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  render(<GuidedTour onClose={onClose} />);
  const dialog = screen.getByRole("dialog", { name: "Welcome to Chronexus" });
  expect(screen.getByText("Step 1 of 7")).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "Welcome to Chronexus" }),
  ).toHaveFocus();
  expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByRole("heading", { name: "Journal" })).toHaveFocus();
  expect(dialog).toHaveAccessibleDescription(/Type \[\[ to mention/);
  for (let i = 0; i < 5; i++)
    await user.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByText("Step 7 of 7")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Finish" }));
  expect(onClose).toHaveBeenLastCalledWith(true);
  fireEvent(dialog, new Event("cancel", { cancelable: true }));
  expect(onClose).toHaveBeenLastCalledWith(false);
  await user.click(screen.getByRole("button", { name: "Skip tour" }));
  expect(onClose).toHaveBeenLastCalledWith(false);
});

test("demo creation and confirmed removal call the backend once each", async () => {
  const user = userEvent.setup();
  let demo: string | null = null;
  vi.mocked(command).mockImplementation(async (name) => {
    if (name === "get_first_start")
      return { demoCampaignId: demo, tourSeen: true };
    if (name === "create_demo_campaign") {
      demo = "demo-id";
      return { id: demo, name: "Demo", demo: true };
    }
    if (name === "remove_demo_campaign") {
      demo = null;
      return undefined;
    }
    throw Error(`unexpected ${name}`);
  });
  const onDemoChanged = vi.fn();
  render(
    <GettingStarted
      disabled={false}
      onOpenTour={vi.fn()}
      onDemoChanged={onDemoChanged}
    />,
  );
  await user.click(
    await screen.findByRole("button", { name: "Create the demo campaign" }),
  );
  await screen.findByText("Demo campaign created.");
  expect(onDemoChanged).toHaveBeenLastCalledWith("demo-id");
  const sent = vi
    .mocked(command)
    .mock.calls.find(([name]) => name === "create_demo_campaign")![1] as {
    text: Record<string, string>;
  };
  expect(sent.text.session1Claim).toContain("{0}");
  expect(sent.text.session1Claim).toContain("{1}");

  await user.click(
    screen.getByRole("button", { name: "Remove the demo campaign" }),
  );
  expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(
    vi
      .mocked(command)
      .mock.calls.some(([name]) => name === "remove_demo_campaign"),
  ).toBe(false);
  await user.click(
    screen.getByRole("button", { name: "Remove the demo campaign" }),
  );
  await user.click(screen.getByRole("button", { name: "Remove the demo" }));
  await screen.findByText("Demo campaign removed.");
  expect(vi.mocked(command)).toHaveBeenCalledWith("remove_demo_campaign", {
    campaignId: "demo-id",
  });
  expect(onDemoChanged).toHaveBeenLastCalledWith(null);
  expect(
    screen.getByRole("button", { name: "Create the demo campaign" }),
  ).toBeInTheDocument();
});

test("a refused demo shows the backend message and keeps the button", async () => {
  const user = userEvent.setup();
  vi.mocked(command).mockImplementation(async (name) => {
    if (name === "get_first_start")
      return { demoCampaignId: null, tourSeen: false };
    throw Error("Demo text is missing or too long. Nothing was created.");
  });
  render(
    <GettingStarted
      disabled={false}
      onOpenTour={vi.fn()}
      onDemoChanged={vi.fn()}
    />,
  );
  await user.click(
    await screen.findByRole("button", { name: "Create the demo campaign" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Demo text is missing or too long",
  );
  expect(
    screen.getByRole("button", { name: "Create the demo campaign" }),
  ).toBeEnabled();
});

test("every language translates the demo and keeps each mention marker", async () => {
  const markers = (text: string) => (text.match(/\{\d\}/g) ?? []).sort().join();
  applyPreferences({ ...defaultPreferences, locale: "en" });
  const english = demoText();
  for (const { id } of locales) {
    await loadLocale(id);
    applyPreferences({ ...defaultPreferences, locale: id });
    const text = demoText();
    for (const [key, value] of Object.entries(text)) {
      expect(value.trim(), `${id} ${key}`).not.toBe("");
      expect(markers(value), `${id} ${key}`).toBe(
        markers(english[key as keyof typeof english]),
      );
    }
    if (id !== "en")
      expect(text.session1Claim, id).not.toBe(english.session1Claim);
  }
  await waitFor(() => undefined);
});
