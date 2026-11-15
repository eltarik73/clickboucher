// Le formulaire de campagne lit la réponse de l'envoi : quand le serveur refuse (e-mails commerciaux
// en pause, 409), il affiche la raison en français et dit que la campagne est enregistrée sans être
// envoyée ; il n'annonce jamais « Campagne envoyée ! » pour un envoi refusé.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { Toaster } from "@/components/ui/toaster";
import { CampaignForm } from "@/components/dashboard/marketing/CampaignForm";

const PAUSED_MESSAGE =
  "L'envoi des e-mails commerciaux est en pause. Activez-le dans Paramètres pour envoyer.";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Back-office simulé : création de la campagne acceptée, envoi répondu par `sendAnswer`. */
function stubBackOffice(sendAnswer: () => Response) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/dashboard/campaigns" && init?.method === "POST") {
      return json(201, { success: true, data: { id: "camp_itest" } });
    }
    if (url === "/api/dashboard/campaigns/camp_itest/send") return sendAnswer();
    return json(200, { success: true, data: null });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderAndSend(onCreated: () => void) {
  render(
    <ThemeProvider>
      <Toaster />
      <CampaignForm onClose={() => {}} onCreated={onCreated} />
    </ThemeProvider>
  );
  fireEvent.change(screen.getByPlaceholderText("Objet de votre email..."), {
    target: { value: "L'Aïd approche" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Envoyer" }));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("CampaignForm, envoi refusé par le serveur", () => {
  it("affiche la raison et « Campagne enregistrée, non envoyée », jamais « Campagne envoyée ! »", async () => {
    const fetchMock = stubBackOffice(() =>
      json(409, { success: false, error: { code: "CONFLICT", message: PAUSED_MESSAGE } })
    );
    const onCreated = vi.fn();

    renderAndSend(onCreated);

    expect(await screen.findByText(PAUSED_MESSAGE)).toBeInTheDocument();
    expect(screen.getByText("Campagne enregistrée, non envoyée")).toBeInTheDocument();
    expect(screen.queryByText("Campagne envoyée !")).not.toBeInTheDocument();
    expect(onCreated).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/dashboard/campaigns/camp_itest/send", {
      method: "POST",
    });
  });

  // Témoin : sans lui, un formulaire qui n'annonce plus jamais l'envoi passerait le cas ci-dessus.
  it("annonce « Campagne envoyée ! » quand le serveur a envoyé", async () => {
    stubBackOffice(() =>
      json(200, { success: true, data: { sent: 2, total: 2, message: "2 emails envoyés sur 2" } })
    );
    const onCreated = vi.fn();

    renderAndSend(onCreated);

    expect(await screen.findByText("Campagne envoyée !")).toBeInTheDocument();
    expect(onCreated).toHaveBeenCalledTimes(1);
  });
});
