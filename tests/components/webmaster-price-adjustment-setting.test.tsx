// /webmaster/parametres, section « Politique d'ajustement des prix » : seul le plafond de sécurité
// d'un ajustement reste réglable. Il est lu par sa route dédiée et enregistré par l'unique écrivain
// de platform_config, PATCH /api/webmaster/config, dont la page montre le refus tel quel.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { toast } from "sonner";
import WebmasterParametresPage from "@/app/webmaster/parametres/page";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const CAP_URL = "/api/webmaster/config/price-adjustment";
const CONFIG_URL = "/api/webmaster/config";
const CAP_LABEL = "Plafond de sécurité d'un ajustement, en % du total de la commande";
const REFUSAL = "Le plafond est d'au moins 1 %";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  if (url === CONFIG_URL && init?.method === "PATCH") {
    const { key, value } = JSON.parse(String(init.body)) as { key: string; value: string };
    if (value === "0") {
      return json({ success: false, error: { code: "VALIDATION_ERROR", message: REFUSAL } }, 400);
    }
    return json({ success: true, data: { id: "cfg", key, value, updatedAt: "2026-11-16" } });
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

async function saveCap(value: string) {
  render(<WebmasterParametresPage />);
  const field = await screen.findByLabelText(CAP_LABEL);

  fireEvent.change(field, { target: { value } });
  await act(async () => {
    fireEvent.click(
      within(field.parentElement as HTMLElement).getByRole("button", { name: "Sauver" })
    );
  });
}

describe("/webmaster/parametres : ajustement des prix", () => {
  it("ne montre que le plafond, lu par sa route dédiée", async () => {
    render(<WebmasterParametresPage />);

    expect(await screen.findByLabelText(CAP_LABEL)).toHaveValue(50);
    expect(fetchMock).toHaveBeenCalledWith(CAP_URL);
    expect(document.body.textContent).not.toMatch(
      /auto-?(validation|approbation)|paliers?|Motif obligatoire|Motifs par défaut|Max ajustements/i
    );
  });

  it("enregistre le plafond sous sa clé par l'écrivain de la configuration", async () => {
    await saveCap("40");

    expect(fetchMock).toHaveBeenCalledWith(CONFIG_URL, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "pa_max_increase_pct", value: "40" }),
    });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Configuration sauvegardée"));
    const field = screen.getByLabelText(CAP_LABEL);
    expect(field).toHaveValue(40);
    expect(
      within(field.parentElement as HTMLElement).queryByRole("button", { name: "Sauver" })
    ).toBeNull();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("montre le refus du serveur et garde la saisie", async () => {
    await saveCap("0");

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(REFUSAL));
    expect(screen.getByLabelText(CAP_LABEL)).toHaveValue(0);
    expect(toast.success).not.toHaveBeenCalled();
  });
});
