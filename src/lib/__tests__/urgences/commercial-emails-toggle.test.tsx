// Interrupteur « Envoi des e-mails commerciaux » de /webmaster/parametres : il montre l'état
// enregistré sur le serveur (aussi après un rechargement), ne change qu'à la réponse du serveur,
// signale un échec en français et n'affiche jamais un interrupteur dans une position devinée.
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { Toaster } from "@/components/ui/toaster";
import { CommercialEmailsToggle } from "@/components/webmaster/CommercialEmailsToggle";

const ENDPOINT = "/api/webmaster/commercial-emails";
const LABEL = "Envoi des e-mails commerciaux";

type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function saved(enabled: boolean): Response {
  return json(200, { success: true, data: { enabled } });
}

function refused(status: number, code: string, message: string): Response {
  return json(status, { success: false, error: { code, message } });
}

function stubFetch(impl: FetchImpl) {
  const fetchMock = vi.fn(impl);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Serveur simulé qui garde la valeur reçue par PUT et la renvoie au GET suivant. */
function savingServer(initial: boolean): FetchImpl {
  let enabled = initial;
  return async (_url, init) => {
    if (init?.method === "PUT") {
      enabled = (JSON.parse(String(init.body)) as { enabled: boolean }).enabled;
    }
    return saved(enabled);
  };
}

function renderToggle() {
  return render(
    <ThemeProvider>
      <Toaster />
      <CommercialEmailsToggle />
    </ThemeProvider>
  );
}

function findSwitch() {
  return screen.findByRole("switch", { name: LABEL });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("CommercialEmailsToggle", () => {
  it("montre l'état enregistré « En pause », interrupteur non coché et décrit", async () => {
    const fetchMock = stubFetch(async () => saved(false));

    renderToggle();

    const toggle = await findSwitch();
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(toggle).toHaveAccessibleDescription(
      expect.stringContaining("Campagnes, relances de panier abandonné et e-mails aux prospects.")
    );
    expect(screen.getByText("En pause")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(ENDPOINT);
    expect(fetchMock.mock.calls[0][1]?.method ?? "GET").toBe("GET");
  });

  it("n'affiche aucun interrupteur tant que l'état enregistré n'est pas connu", async () => {
    stubFetch(() => new Promise<Response>(() => {}));

    renderToggle();

    expect(await screen.findByRole("status")).toHaveTextContent("Chargement du réglage");
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("un clic envoie PUT { enabled: true } et n'affiche « Activé » qu'à la réponse du serveur", async () => {
    let answerPut: (response: Response) => void = () => {};
    const fetchMock = stubFetch((_url, init) =>
      init?.method === "PUT"
        ? new Promise<Response>((resolve) => {
            answerPut = resolve;
          })
        : Promise.resolve(saved(false))
    );
    renderToggle();
    const toggle = await findSwitch();

    fireEvent.click(toggle);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe(ENDPOINT);
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(String(init?.body))).toEqual({ enabled: true });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(toggle).toBeDisabled();
    expect(screen.getByText("En pause")).toBeInTheDocument();
    expect(screen.queryByText("Activé")).not.toBeInTheDocument();

    await act(async () => answerPut(saved(true)));

    expect(await screen.findByText("Activé")).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(toggle).toBeEnabled();
  });

  it("affiche l'état renvoyé par le serveur, pas celui demandé", async () => {
    const fetchMock = stubFetch(async () => saved(false));
    renderToggle();
    const toggle = await findSwitch();

    fireEvent.click(toggle);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(
      await screen.findByText("Envoi des e-mails commerciaux mis en pause")
    ).toBeInTheDocument();
    expect(toggle).toBeEnabled();
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("En pause")).toBeInTheDocument();
  });

  it("après rechargement, l'interrupteur montre l'état enregistré", async () => {
    const fetchMock = stubFetch(savingServer(false));
    const first = renderToggle();
    fireEvent.click(await findSwitch());
    expect(await screen.findByText("Activé")).toBeInTheDocument();
    first.unmount();

    renderToggle();

    const toggle = await findSwitch();
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("Activé")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("un enregistrement refusé laisse l'interrupteur tel quel et dit pourquoi en français", async () => {
    stubFetch((_url, init) =>
      Promise.resolve(
        init?.method === "PUT"
          ? refused(403, "FORBIDDEN", "Accès réservé aux administrateurs")
          : saved(false)
      )
    );
    renderToggle();
    const toggle = await findSwitch();

    fireEvent.click(toggle);

    expect(await screen.findByText("Accès réservé aux administrateurs")).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(toggle).toBeEnabled();
    expect(screen.getByText("En pause")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("[object Object]");
  });

  it("un enregistrement sans réponse (coupure réseau) laisse l'interrupteur tel quel et le dit", async () => {
    stubFetch((_url, init) =>
      init?.method === "PUT"
        ? Promise.reject(new TypeError("Failed to fetch"))
        : Promise.resolve(saved(true))
    );
    renderToggle();
    const toggle = await findSwitch();

    fireEvent.click(toggle);

    expect(await screen.findByText("Connexion impossible. Réessayez.")).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(toggle).toBeEnabled();
  });

  it.each([
    [
      "une réponse d'erreur",
      () => Promise.resolve(refused(500, "INTERNAL_ERROR", "Erreur interne")),
    ],
    ["une coupure réseau", () => Promise.reject(new TypeError("Failed to fetch"))],
    ["une réponse sans état", () => Promise.resolve(json(200, { success: true, data: {} }))],
  ])(
    "un chargement en échec (%s) affiche l'erreur et « Réessayer », jamais un interrupteur",
    async (_label, failingLoad) => {
      const fetchMock = stubFetch(failingLoad);

      renderToggle();

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Le réglage n'a pas pu être chargé."
      );
      expect(screen.queryByRole("switch")).not.toBeInTheDocument();

      fetchMock.mockImplementation(async () => saved(true));
      fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));

      expect(await findSwitch()).toHaveAttribute("aria-checked", "true");
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    }
  );
});
