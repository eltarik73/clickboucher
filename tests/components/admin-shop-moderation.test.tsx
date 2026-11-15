// Écrans d'administration d'une boutique (C1-FAILLES-CRITIQUES, D3, D14), fetch simulé :
// - « Boutique suspendue », son motif et « Réactiver » suivent Shop.suspendedAt ; « Valider » ne
//   s'affiche que pour une boutique jamais publiée (ni suspendue, ni en congés) ;
// - la commission passe par la route auditée, jamais par PATCH /api/shops/[id] ;
// - un refus de l'API affiche son message français.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Toaster } from "sonner";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useParams: () => ({ shopId: "s1" }),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/components/webmaster/ShopAdjustmentsTab", () => ({ default: () => null }));

import AdminShopsPage from "@/app/(admin)/admin/shops/page";
import AdminShopDetailPage from "@/app/(admin)/admin/shops/[shopId]/page";
import WebmasterShopDetailPage from "@/app/webmaster/boutiques/[shopId]/page";

const SUSPENDED_ADMIN = "Boutique suspendue : réactivez-la d'abord";
const SUSPENDED_AT = "2026-11-15T09:00:00.000Z";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const ok = (data: unknown) => () => json({ success: true, data });
const refused = (code: string, message: string, status: number) => () =>
  json({ success: false, error: { code, message } }, status);

/** What the edit dialog of /admin/shops sends back unchanged with the name. */
const IDENTITY = { address: "1 rue A", city: "Chambéry", phone: "0600000000" };

const LIST_SHOP = {
  id: "s1",
  name: "Boucherie Test",
  slug: "boucherie-test",
  ...IDENTITY,
  description: null,
  imageUrl: null,
  status: "OPEN",
  rating: 4.5,
  ratingCount: 2,
  commissionPct: 5,
  ownerId: "u1",
  ownerName: "Ali B",
  ownerEmail: null,
  productCount: 1,
  orderCount: 2,
  reviewCount: 0,
};

/** GET /api/admin/shops/s1: checklist done, never published, unless `over` says otherwise. */
function detail(over: Record<string, unknown>) {
  return {
    ...LIST_SHOP,
    email: null,
    featured: false,
    visible: false,
    commissionEnabled: true,
    defaultBusyDurationMin: 15,
    createdAt: "2026-11-01T10:00:00.000Z",
    suspendedAt: null,
    suspendReason: null,
    vacationMode: false,
    onboardingCompleted: true,
    owner: null,
    stats: {
      totalRevenue: 0,
      totalCommission: 0,
      completedOrders: 0,
      productCount: 0,
      orderCount: 0,
      reviewCount: 0,
      ticketCount: 0,
    },
    recentOrders: [],
    ...over,
  };
}

/** Answers by "METHOD url"; a request without an answer fails the test. */
type Answers = Record<string, () => Response>;

function stubFetch(answers: Answers) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const answer = answers[`${init?.method ?? "GET"} ${url}`];
    if (!answer) throw new Error(`unexpected ${init?.method ?? "GET"} ${url}`);
    return Promise.resolve(answer());
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const LIST: Answers = { "GET /api/admin/shops": ok([LIST_SHOP]), "POST /api/admin/shops": ok([]) };
const detailOf = (over: Record<string, unknown>): Answers => ({
  "GET /api/admin/shops/s1": ok(detail(over)),
});

/** Renders a page with the toast container, where refusals are shown. */
const show = (page: ReactElement) =>
  render(
    <>
      <Toaster />
      {page}
    </>
  );

const writes = (fetchMock: ReturnType<typeof stubFetch>) =>
  fetchMock.mock.calls
    .filter(([, init]) => init?.method === "PATCH")
    .map(([url, init]) => [url, JSON.parse(String(init?.body))]);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("/admin/shops", () => {
  it("modifier le nom seul : un PATCH /api/shops/s1 sans commission, aucun appel à la route commission", async () => {
    const fetchMock = stubFetch({ ...LIST, "PATCH /api/shops/s1": ok({}) });
    show(<AdminShopsPage />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Modifier" }))[0]);
    fireEvent.change(screen.getByDisplayValue("Boucherie Test"), {
      target: { value: "Boucherie Test 2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(writes(fetchMock)).toEqual([
      ["/api/shops/s1", { name: "Boucherie Test 2", ...IDENTITY }],
    ]);
  });

  it("modifier la commission : la fiche par /api/shops/s1, la commission par la route auditée", async () => {
    const fetchMock = stubFetch({
      ...LIST,
      "PATCH /api/shops/s1": ok({}),
      "PATCH /api/admin/shops/s1/commission": ok({}),
    });
    show(<AdminShopsPage />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Modifier" }))[0]);
    fireEvent.change(screen.getByDisplayValue("5"), { target: { value: "7.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(writes(fetchMock)).toEqual([
      ["/api/shops/s1", { name: "Boucherie Test", ...IDENTITY }],
      ["/api/admin/shops/s1/commission", { commissionPct: 7.5 }],
    ]);
  });

  it("modification refusée : le message français du serveur s'affiche", async () => {
    stubFetch({
      ...LIST,
      "PATCH /api/shops/s1": refused(
        "VALIDATION_ERROR",
        "Ce champ ne peut pas être modifié ici",
        400
      ),
    });
    show(<AdminShopsPage />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Modifier" }))[0]);
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(await screen.findByText("Ce champ ne peut pas être modifié ici")).toBeInTheDocument();
  });

  it("« Mettre en pause » envoie { status: PAUSED } ; un 409 affiche le message du serveur", async () => {
    const fetchMock = stubFetch({
      ...LIST,
      "PATCH /api/shops/s1/status": refused("CONFLICT", SUSPENDED_ADMIN, 409),
    });
    show(<AdminShopsPage />);
    const buttons = await screen.findAllByRole("button", { name: /Mettre en pause/ });
    expect(screen.queryByRole("button", { name: /Suspendre/ })).toBeNull();
    fireEvent.click(buttons[0]);

    expect(await screen.findByText(SUSPENDED_ADMIN)).toBeInTheDocument();
    expect(writes(fetchMock)).toEqual([["/api/shops/s1/status", { status: "PAUSED" }]]);
  });
});

describe("/admin/shops/[shopId]", () => {
  it("boutique suspendue : badge, motif, « Réactiver » qui la remet en ligne, sans « Valider »", async () => {
    let suspendedAt: string | null = SUSPENDED_AT;
    const fetchMock = stubFetch({
      "GET /api/admin/shops/s1": () =>
        ok(detail({ suspendedAt, suspendReason: suspendedAt && "Hygiène" }))(),
      "PATCH /api/admin/shops/s1/suspend": () => {
        suspendedAt = null;
        return ok({ suspended: false })();
      },
    });
    show(<AdminShopDetailPage params={{ shopId: "s1" }} />);

    expect(await screen.findByText("Boutique suspendue")).toBeInTheDocument();
    expect(screen.getByText(/^Raison.:.Hygiène$/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Valider/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Réactiver/ }));

    expect(await screen.findByRole("button", { name: /Suspendre/ })).toBeInTheDocument();
    expect(screen.queryByText("Boutique suspendue")).toBeNull();
    expect(writes(fetchMock)).toEqual([["/api/admin/shops/s1/suspend", { suspended: false }]]);
  });

  it("réactivation refusée : le message du serveur s'affiche", async () => {
    stubFetch({
      ...detailOf({ suspendedAt: SUSPENDED_AT }),
      "PATCH /api/admin/shops/s1/suspend": refused(
        "CONFLICT",
        "La boutique n'est pas suspendue",
        409
      ),
    });
    show(<AdminShopDetailPage params={{ shopId: "s1" }} />);
    fireEvent.click(await screen.findByRole("button", { name: /Réactiver/ }));

    expect(await screen.findByText("La boutique n'est pas suspendue")).toBeInTheDocument();
  });

  it.each([
    ["jamais publiée (parcours terminé)", "affiché", {}, true],
    ["en congés", "absent", { vacationMode: true }, false],
  ])("boutique %s : « Valider » %s", async (_label, _expected, over, shown) => {
    stubFetch(detailOf(over));
    show(<AdminShopDetailPage params={{ shopId: "s1" }} />);

    expect(await screen.findByText("Informations")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Valider/ }) !== null).toBe(shown);
    expect(screen.queryByText("Boutique suspendue")).toBeNull();
  });
});

describe("/webmaster/boutiques/[shopId]", () => {
  it("boutique suspendue : bandeau, motif, « Réactiver », pas « Boutique non validée », œil désactivé", async () => {
    stubFetch(
      detailOf({ suspendedAt: SUSPENDED_AT, suspendReason: "Hygiène", onboardingCompleted: false })
    );
    show(<WebmasterShopDetailPage />);

    expect(await screen.findAllByText("Boutique suspendue")).toHaveLength(2);
    expect(screen.getByText(/^Raison.:.Hygiène$/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Réactiver la boutique" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Réactiver" })).toBeInTheDocument();
    expect(screen.queryByText("Boutique non validée")).toBeNull();
    expect(screen.getByTitle("Rendre visible")).toBeDisabled();
  });

  it("jamais publiée : « Boutique non validée » ; une validation refusée affiche le message", async () => {
    stubFetch({
      ...detailOf({}),
      "PATCH /api/admin/shops/s1/validate": refused("CONFLICT", SUSPENDED_ADMIN, 409),
    });
    show(<WebmasterShopDetailPage />);
    expect(await screen.findByText("Boutique non validée")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Approuver/ }));

    expect(await screen.findByText(SUSPENDED_ADMIN)).toBeInTheDocument();
  });

  it("boutique validée en congés : aucun bandeau de validation", async () => {
    stubFetch(detailOf({ vacationMode: true }));
    show(<WebmasterShopDetailPage />);

    expect(await screen.findByRole("heading", { name: "Commission" })).toBeInTheDocument();
    expect(screen.queryByText(/non valid/)).toBeNull();
  });

  it("masquage refusé : l'œil revient à son état et le message s'affiche", async () => {
    stubFetch({
      ...detailOf({ visible: true }),
      "PATCH /api/admin/shops/s1": refused("CONFLICT", "Refus du serveur", 409),
    });
    show(<WebmasterShopDetailPage />);
    fireEvent.click(await screen.findByTitle("Masquer"));

    expect(await screen.findByText("Refus du serveur")).toBeInTheDocument();
    expect(screen.getByTitle("Masquer")).toBeInTheDocument();
  });
});
