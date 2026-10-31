import { render, screen, fireEvent } from "@testing-library/react";
import { it, expect, vi, afterEach } from "vitest";
import { applyPreferences, loadLocale, tr } from "../../i18n/store";
import { defaultPreferences } from "../../i18n/locales";
import PrintWorkspace from "./PrintWorkspace";
afterEach(() => applyPreferences(defaultPreferences));
for (const locale of ["en", "it", "ar"] as const)
  it(`${locale}: prints only explicitly selected sessions as inert text`, async () => {
    await loadLocale(locale);
    applyPreferences({ ...defaultPreferences, locale });
    const session = (id: string, title: string) => ({
      id,
      title,
      campaignId: "c",
      sequence: 1,
      playedOn: null,
      document: {
        version: 1 as const,
        blocks: [{ content: [{ text: "<img src=x onerror=alert(1)>" }] }],
      },
      revision: 1,
      updatedAt: "",
    });
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    render(
      <PrintWorkspace
        campaignId="c"
        sessions={[session("a", "Selected"), session("b", "Private secret")]}
        pages={[]}
      />,
    );
    fireEvent.click(screen.getByText(tr("Print and PDF")));
    expect(screen.getByRole("button", { name: tr("Preview") })).toBeDisabled();
    fireEvent.click(screen.getByLabelText("1: Selected"));
    fireEvent.click(screen.getByRole("button", { name: tr("Preview") }));
    await screen.findByRole("button", { name: tr("Print and PDF") });
    const output = document.querySelector(".chronexus-print")!;
    expect(output.textContent).toContain("Selected");
    expect(output.textContent).not.toContain("Private secret");
    expect(output.querySelector("img")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: tr("Print and PDF") }));
    expect(print).toHaveBeenCalled();
    print.mockRestore();
  });
