import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, vi, test, expect } from "vitest";
import AppSettings from "./AppSettings";
import type { UpdateOffer } from "../updates/api";
import { defaultPreferences } from "../../i18n/locales";
import { applyPreferences, loadLocale, tr } from "../../i18n/store";

vi.mock("./LanguageSettings", () => ({
  default: () => <section>Language pane</section>,
}));
vi.mock("../backup/BackupSettings", () => ({
  default: () => (
    <section>
      Backup pane <input aria-label="Draft location" />
    </section>
  ),
}));
vi.mock("../wiki/WikiSettings", () => ({
  default: () => <section>Wiki pane</section>,
}));
vi.mock("../ai-setup/AiSetupSettings", () => ({
  default: () => <section>AI pane</section>,
}));
vi.mock("../sync/SyncSettings", () => ({
  default: () => <section>Sharing pane</section>,
}));
vi.mock("../updates/UpdateSettings", () => ({
  default: ({ onHandoffUsed }: { onHandoffUsed: () => void }) => (
    <section>
      Update pane
      <button onClick={onHandoffUsed}>Accept handoff</button>
    </section>
  ),
}));

const props = {
  busy: false,
  run: async (action: () => Promise<void>) => action(),
  initialOffer: null,
  onHandoffUsed: vi.fn(),
  onCampaignAdded: vi.fn(),
};
afterEach(() => applyPreferences(defaultPreferences));

test("shows one category and preserves an unfinished form across navigation", async () => {
  const user = userEvent.setup();
  render(<AppSettings {...props} />);
  expect(
    screen.getByRole("region", { name: "Language and script" }),
  ).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Backup" }));
  await user.type(
    screen.getByRole("textbox", { name: "Draft location" }),
    "folder",
  );
  await user.click(screen.getByRole("button", { name: "D&D sources / Wiki" }));
  expect(
    screen.getByRole("region", { name: "D&D sources / Wiki" }),
  ).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Backup" }));
  expect(screen.getByRole("textbox", { name: "Draft location" })).toHaveValue(
    "folder",
  );
  expect(screen.getByRole("button", { name: "Backup" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("opens updates when the herald passes an offer", async () => {
  const user = userEvent.setup();
  const onHandoffUsed = vi.fn();
  const { rerender } = render(
    <AppSettings {...props} onHandoffUsed={onHandoffUsed} />,
  );
  rerender(
    <AppSettings
      {...props}
      initialOffer={{ id: "offer-1" } as UpdateOffer}
      onHandoffUsed={onHandoffUsed}
    />,
  );
  expect(screen.getByRole("region", { name: "App updates" })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Accept handoff" }));
  rerender(<AppSettings {...props} onHandoffUsed={onHandoffUsed} />);
  expect(onHandoffUsed).toHaveBeenCalledOnce();
  expect(screen.getByRole("region", { name: "App updates" })).toBeVisible();
});

test.each([
  "it",
  "de",
  "fr",
  "es",
  "pt-BR",
  "ja",
  "ko",
  "zh-Hans",
  "ar",
] as const)("uses the %s catalog for section navigation", async (locale) => {
  await loadLocale(locale);
  applyPreferences({ ...defaultPreferences, locale });
  render(<AppSettings {...props} />);
  expect(document.documentElement.dir).toBe(locale === "ar" ? "rtl" : "ltr");
  expect(
    screen.getByRole("button", { name: tr("D&D sources / Wiki") }),
  ).toBeInTheDocument();
  expect(tr("D&D sources / Wiki")).not.toBe("D&D sources / Wiki");
});
