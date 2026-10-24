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
it("cambia lingua subito, salva e permette recupero italiano in ogni scrittura", async () => {
  const user = userEvent.setup();
  vi.mocked(preferencesApi.save).mockImplementation(async (p) => p);
  render(<LanguageSettings />);
  await user.selectOptions(
    screen.getByLabelText("Lingua dell’interfaccia"),
    "ar",
  );
  await waitFor(() => expect(document.documentElement.dir).toBe("rtl"));
  expect(getPreferences().locale).toBe("ar");
  expect(preferencesApi.save).toHaveBeenCalledWith(
    expect.objectContaining({ locale: "ar" }),
  );
  await user.click(
    screen.getByRole("button", {
      name: "Italiano · Ripristina lingua e scrittura",
    }),
  );
  await waitFor(() => expect(document.documentElement.dir).toBe("ltr"));
  expect(getPreferences()).toEqual(defaultPreferences);
});
it("salvataggio fallito conserva lingua precedente e presenta errore", async () => {
  const user = userEvent.setup();
  vi.mocked(preferencesApi.save).mockRejectedValue(Error("Disco pieno"));
  render(<LanguageSettings />);
  await user.selectOptions(
    screen.getByLabelText("Lingua dell’interfaccia"),
    "en",
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("Disco pieno");
  expect(getPreferences().locale).toBe("it");
});
it("i glifi sono decorativi, il comando ha nome semantico ordinario", () => {
  applyPreferences({
    ...defaultPreferences,
    script: "morse",
    showOriginal: false,
  });
  render(
    <button>
      <Text source="Salva" />
    </button>,
  );
  expect(screen.getByRole("button", { name: "Salva" })).toBeInTheDocument();
  expect(document.querySelector(".script-glyphs")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
});
it("Galattico senza font disponibile mantiene il testo ordinario visibile", () => {
  applyPreferences({
    ...defaultPreferences,
    script: "galactic",
    showOriginal: false,
  });
  render(
    <button>
      <Text source="Salva" />
    </button>,
  );
  expect(document.querySelector(".script-original")).toHaveTextContent("Salva");
});
