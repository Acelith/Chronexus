import { applyPreferences, loadLocale, tr } from "../../i18n/store";
import { defaultPreferences } from "../../i18n/locales";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import TimelineWorkspace from "./TimelineWorkspace";
import { timelineApi } from "./api";

vi.mock("./api", () => ({
  timelineApi: {
    calendar: vi.fn(),
    saveCalendar: vi.fn(),
    list: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
  },
}));
vi.mock("../clues/api", () => ({
  clueApi: { list: vi.fn().mockResolvedValue([]) },
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(timelineApi.calendar).mockResolvedValue(null);
  vi.mocked(timelineApi.list).mockResolvedValue([]);
});

afterEach(() => applyPreferences(defaultPreferences));
it.each(["en", "it", "ar"] as const)(
  "%s: starts without inferred dates and saves only an explicit calendar",
  async (locale) => {
    await loadLocale(locale);
    applyPreferences({ ...defaultPreferences, locale });
    vi.mocked(timelineApi.saveCalendar).mockResolvedValue({
      months: [{ name: "Dawn", days: 30 }],
      weekdays: ["Firstday"],
      eras: ["Age"],
    });
    render(
      <TimelineWorkspace
        campaignId="campaign"
        sessions={[]}
        pages={[]}
        onSession={vi.fn()}
        onPage={vi.fn()}
        onClue={vi.fn()}
      />,
    );
    await screen.findByText(tr("World calendar"));
    fireEvent.change(
      screen.getByLabelText(tr("Months and days (one name:days per line)")),
      { target: { value: "Dawn:30" } },
    );
    fireEvent.change(screen.getByLabelText(tr("Weekdays (comma-separated)")), {
      target: { value: "Firstday" },
    });
    fireEvent.change(screen.getByLabelText(tr("Eras (comma-separated)")), {
      target: { value: "Age" },
    });
    fireEvent.click(screen.getByRole("button", { name: tr("Save calendar") }));
    await waitFor(() =>
      expect(timelineApi.saveCalendar).toHaveBeenCalledWith("campaign", {
        months: [{ name: "Dawn", days: 30 }],
        weekdays: ["Firstday"],
        eras: ["Age"],
      }),
    );
    expect(timelineApi.save).not.toHaveBeenCalled();
  },
);
