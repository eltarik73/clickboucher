// Carte « Préparez votre boutique » du tableau de bord boucher (jsdom, fetch simulé) :
// - elle ne met jamais la boutique en ligne : la publication est une décision de Klik&Go ;
// - son libellé suit la publication renvoyée par GET /api/boucher/onboarding ;
// - parcours terminé : la carte disparaît seulement quand la boutique est en ligne ou en vacances ;
//   une boutique suspendue ou pas encore validée la garde, avec son libellé ;
// - à 100 % elle envoie seulement { complete: true }.
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ShopPublication } from "@/lib/shop-publication";
import OnboardingChecklist from "@/components/boucher/OnboardingChecklist";

const ONBOARDING_URL = "/api/boucher/onboarding";

const STEPS = [
  { key: "account", label: "Compte créé", emoji: "✅", weight: 10, completed: true, href: "#" },
  {
    key: "products",
    label: "Ajouter au moins 5 produits",
    emoji: "🥩",
    weight: 20,
    completed: false,
    href: "/boucher/produits",
  },
];

type Onboarding = {
  progress: number;
  onboardingCompleted: boolean;
  visible: boolean;
  publication: ShopPublication;
};

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/** fetch answering the GET with this onboarding state and any PATCH with a success. */
function stubFetch(onboarding: Onboarding) {
  const fetchMock = vi.fn((_url: string, init?: RequestInit) =>
    Promise.resolve(
      init?.method === "PATCH"
        ? json({ success: true, data: { onboardingCompleted: true } })
        : json({ success: true, data: { steps: STEPS, ...onboarding } })
    )
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("publication de la boutique", () => {
  it("85 % sans validation : un seul appel (le GET), aucune mise en ligne, « En attente de validation par Klik&Go »", async () => {
    const fetchMock = stubFetch({
      progress: 85,
      visible: false,
      publication: "UNPUBLISHED",
      onboardingCompleted: false,
    });
    render(<OnboardingChecklist />);

    await screen.findByText("Préparez votre boutique");
    expect(fetchMock.mock.calls).toEqual([[ONBOARDING_URL]]);
    expect(screen.getByText("En attente de validation par Klik&Go")).toBeInTheDocument();
    expect(screen.queryByText(/visible|en ligne/i)).toBeNull();
  });

  it("moins de 80 % sans validation : aucun libellé de publication", async () => {
    stubFetch({
      progress: 60,
      visible: false,
      publication: "UNPUBLISHED",
      onboardingCompleted: false,
    });
    render(<OnboardingChecklist />);

    await screen.findByText("Préparez votre boutique");
    expect(screen.queryByText("En attente de validation par Klik&Go")).toBeNull();
  });

  it("boutique publiée : « Boutique en ligne » et « Votre boutique est en ligne ! »", async () => {
    stubFetch({
      progress: 85,
      visible: true,
      publication: "PUBLISHED",
      onboardingCompleted: false,
    });
    render(<OnboardingChecklist />);

    await screen.findByText("Préparez votre boutique");
    expect(screen.getByText("Boutique en ligne")).toBeInTheDocument();
    expect(screen.getByText("Votre boutique est en ligne !")).toBeInTheDocument();
  });

  it("boutique en vacances : « Boutique en vacances », sans célébration", async () => {
    stubFetch({
      progress: 85,
      visible: false,
      publication: "ON_VACATION",
      onboardingCompleted: false,
    });
    render(<OnboardingChecklist />);

    await screen.findByText("Préparez votre boutique");
    expect(screen.getByText("Boutique en vacances")).toBeInTheDocument();
    expect(screen.queryByText(/en ligne/i)).toBeNull();
  });

  it("boutique suspendue au parcours terminé : la carte reste, « Boutique suspendue par Klik&Go »", async () => {
    stubFetch({
      progress: 100,
      visible: false,
      publication: "SUSPENDED",
      onboardingCompleted: true,
    });
    render(<OnboardingChecklist />);

    expect(await screen.findByText("Boutique suspendue par Klik&Go")).toBeInTheDocument();
    expect(screen.queryByText(/en ligne/i)).toBeNull();
  });

  it("parcours terminé, boutique pas encore validée : la carte reste, « En attente de validation par Klik&Go », aucun PATCH", async () => {
    const fetchMock = stubFetch({
      progress: 100,
      visible: false,
      publication: "UNPUBLISHED",
      onboardingCompleted: true,
    });
    render(<OnboardingChecklist />);

    expect(await screen.findByText("En attente de validation par Klik&Go")).toBeInTheDocument();
    expect(fetchMock.mock.calls).toEqual([[ONBOARDING_URL]]);
  });

  it("parcours terminé, boutique en ligne : la carte ne s'affiche pas", async () => {
    const fetchMock = stubFetch({
      progress: 100,
      visible: true,
      publication: "PUBLISHED",
      onboardingCompleted: true,
    });
    const { container } = render(<OnboardingChecklist />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
    expect(container).toBeEmptyDOMElement();
  });
});

describe("fin du parcours", () => {
  it("100 % non terminé : un seul PATCH, de corps exactement { complete: true }", async () => {
    const fetchMock = stubFetch({
      progress: 100,
      visible: false,
      publication: "UNPUBLISHED",
      onboardingCompleted: false,
    });
    render(<OnboardingChecklist />);

    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(true)
    );
    const patches = fetchMock.mock.calls
      .filter(([, init]) => init?.method === "PATCH")
      .map(([url, init]) => [url, JSON.parse(String(init?.body))]);
    expect(patches).toEqual([[ONBOARDING_URL, { complete: true }]]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
