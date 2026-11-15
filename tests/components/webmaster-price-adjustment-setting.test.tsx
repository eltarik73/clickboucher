// /webmaster/parametres, section « Politique d'ajustement des prix » : seul le plafond de sécurité
// d'un ajustement reste réglable, par sa route dédiée. Plus aucun interrupteur d'auto-validation
// (elle n'existe plus), ni motif obligatoire, ni motifs par défaut, ni nombre d'ajustements.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { toast } from "sonner";
import WebmasterParametresPage from "@/app/webmaster/parametres/page";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const CAP_URL = "/api/webmaster/config/price-adjustment";
const CAP_LABEL = "Plafond de sécurité d'un ajustement, en % du total actuel";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  if (url === CAP_URL && init?.method === "PATCH") {
    const { maxIncreasePct } = JSON.parse(String(init.body)) as { maxIncreasePct: number };
    return json({ success: true, data: { maxIncreasePct } });
  }
  if (url === CAP_URL) return json({ success: true, data: { maxIncreasePct: 50 } });
  if (url === "/api/webmaster/commercial-emails")
    return json({ success: true, data: { enabled: false } });
  return json({ success: true, data: [] });
});

beforeEach(() => {
  fetchMock.mockClear();
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("/webmaster/parametres : ajustement des prix", () => {
  it("ne montre que le plafond, lu par sa route dédiée", async () => {
    render(<WebmasterParametresPage />);

    expect(await screen.findByLabelText(CAP_LABEL)).toHaveValue(50);
    expect(fetchMock).toHaveBeenCalledWith(CAP_URL);
    expect(document.body.textContent).not.toMatch(
      /auto-?(validation|approbation)|paliers?|Motif obligatoire|Motifs par défaut|Max ajustements/i
    );
  });

  it("enregistre le plafond par PATCH de sa seule clé", async () => {
    render(<WebmasterParametresPage />);
    const field = await screen.findByLabelText(CAP_LABEL);

    fireEvent.change(field, { target: { value: "40" } });
    await act(async () => {
      fireEvent.click(
        within(field.parentElement as HTMLElement).getByRole("button", { name: "Sauver" })
      );
    });

    expect(fetchMock).toHaveBeenCalledWith(CAP_URL, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ maxIncreasePct: 40 }),
    });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Configuration sauvegardée"));
    expect(screen.getByLabelText(CAP_LABEL)).toHaveValue(40);
    expect(toast.error).not.toHaveBeenCalled();
  });
});
