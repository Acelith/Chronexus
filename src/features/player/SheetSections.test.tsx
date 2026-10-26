import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { applyPreferences } from "../../i18n/store";
import { defaultPreferences } from "../../i18n/locales";
import { emptySheet } from "./sheet";
import { SheetEditor, SheetSummary } from "./SheetSections";

afterEach(() => applyPreferences(defaultPreferences));

test("Italian combat sections keep their controls and read-only summary", async () => {
  applyPreferences({ ...defaultPreferences, locale: "it" });
  const value = {
    ...emptySheet(),
    inspiration: true,
    deathSuccesses: 2,
    deathFailures: 1,
  };
  const before = JSON.stringify(value);
  const editor = render(<SheetEditor value={value} onChange={vi.fn()} />);
  const user = userEvent.setup();
  const combat = screen.getByText("Combattimento e sensi").closest("details")!;
  await user.click(within(combat).getByText("Combattimento e sensi"));
  expect(
    within(combat).getByRole("checkbox", { name: "Ispirazione" }),
  ).toBeChecked();
  editor.unmount();
  render(<SheetSummary value={value} />);
  const summary = screen.getByText("Combattimento e sensi").closest("details")!;
  expect(summary).toHaveAttribute("open");
  expect(within(summary).getByText(/Ispirazione:/)).toHaveTextContent(
    "1 fallimenti",
  );
  expect(JSON.stringify(value)).toBe(before);
});
