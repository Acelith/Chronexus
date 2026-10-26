import { afterEach, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LanguageSettings from "./LanguageSettings";
import { preferencesApi } from "../../i18n/preferencesApi";
import { applyPreferences, getPreferences } from "../../i18n/store";
import { defaultPreferences } from "../../i18n/locales";
import { Text } from "../../i18n/Text";
vi.mock("../../i18n/preferencesApi", () => ({
  preferencesApi: { save: vi.fn(), read: vi.fn() },
}));
afterEach(() => {
  applyPreferences(defaultPreferences);
  vi.resetAllMocks();
});
it("changes language immediately, saves and allows English recovery in every script", async () => {
  const user = userEvent.setup();
  vi.mocked(preferencesApi.save).mockImplementation(async (p) => p);
  render(<LanguageSettings />);
  await user.selectOptions(screen.getByLabelText("Interface language"), "ar");
  await waitFor(() => expect(document.documentElement.dir).toBe("rtl"));
  expect(getPreferences().locale).toBe("ar");
  expect(preferencesApi.save).toHaveBeenCalledWith(
    expect.objectContaining({ locale: "ar" }),
  );
  await user.click(
    screen.getByRole("button", {
      name: "English · Reset language and script",
    }),
  );
  await waitFor(() => expect(document.documentElement.dir).toBe("ltr"));
  expect(getPreferences()).toEqual(defaultPreferences);
});
it("failed saving preserves the previous language and shows an error", async () => {
  const user = userEvent.setup();
  vi.mocked(preferencesApi.save).mockRejectedValue(Error("Disk full"));
  render(<LanguageSettings />);
  await user.selectOptions(screen.getByLabelText("Interface language"), "it");
  expect(await screen.findByRole("alert")).toHaveTextContent("Disk full");
  expect(getPreferences().locale).toBe("en");
});
it("glyphs are decorative and the control has an ordinary semantic name", () => {
  applyPreferences({
    ...defaultPreferences,
    script: "morse",
    showOriginal: false,
  });
  render(
    <button>
      <Text source="Save" />
    </button>,
  );
  expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  expect(document.querySelector(".script-glyphs")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
});
it("Galactic keeps ordinary text visible when the font is unavailable", () => {
  applyPreferences({
    ...defaultPreferences,
    script: "galactic",
    showOriginal: false,
  });
  render(
    <button>
      <Text source="Save" />
    </button>,
  );
  expect(document.querySelector(".script-original")).toHaveTextContent("Save");
});

it.each(["espruar", "dethek"] as const)(
  "selects %s and saves v2 preferences without changing text",
  async (script) => {
    const user = userEvent.setup();
    vi.mocked(preferencesApi.save).mockImplementation(async (p) => p);
    render(<LanguageSettings />);
    const field = screen.getByLabelText("Text to transcribe");
    await user.clear(field);
    await user.type(field, "Oran 100 日本語");
    await user.selectOptions(screen.getByLabelText("Script mode"), script);
    await waitFor(() => expect(getPreferences().script).toBe(script));
    expect(getPreferences().version).toBe(2);
    expect(field).toHaveValue("Oran 100 日本語");
    expect(preferencesApi.save).toHaveBeenCalledWith(
      expect.objectContaining({ version: 2, script }),
    );
    await user.click(
      screen.getByRole("button", {
        name: "English · Reset language and script",
      }),
    );
    await waitFor(() => expect(getPreferences()).toEqual(defaultPreferences));
  },
);
