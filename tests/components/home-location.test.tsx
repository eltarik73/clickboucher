// The home page's position card (ReorderSection's LocationCard) and its shop list (NearbyShops)
// together, as the home renders them. A position cached by an earlier visit must not make the card
// announce it at mount: until 2026-11-15 the card re-dispatched « klikgo-location » whenever
// useGeolocation loaded the cache, so NearbyShops called /api/shops/nearby for an anonymous
// returning visitor (CLAUDE.md, « Coût CPU Vercel ») and twice for a signed-in one. Only an explicit
// action (GPS button, city typed by the visitor) announces a position.
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import NearbyShops from "@/app/(client)/decouvrir/NearbyShops";
import { ReorderSection } from "@/components/order/ReorderSection";
import type { ShopCardData } from "@/components/shop/ShopCard";

const auth = vi.hoisted(() => ({
  isLoaded: true,
  isSignedIn: false as boolean | undefined,
  userId: null as string | null,
}));
vi.mock("@clerk/nextjs", () => ({
  useAuth: () => auth,
  useUser: () => ({ isLoaded: auth.isLoaded, isSignedIn: auth.isSignedIn, user: null }),
}));
vi.mock("next/link", () => ({
  default: ({ prefetch, ...props }: ComponentProps<"a"> & { prefetch?: boolean | null }) => (
    <a data-prefetch={String(prefetch)} {...props} />
  ),
}));

const SERVER_SHOPS: ShopCardData[] = [
  {
    id: "alpha",
    slug: "boucherie-alpha",
    name: "Boucherie alpha",
    address: "1 rue de la Gare",
    city: "Chambéry",
    imageUrl: null,
    prepTimeMin: 15,
    busyMode: false,
    busyExtraMin: 0,
    status: "OPEN",
    verifiedRating: null,
    distance: null,
    activePromo: null,
    openingHours: null,
  },
];

const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>();

function reply(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}

function nearbyRequests(): string[] {
  return fetchMock.mock.calls
    .map(([input]) => String(input))
    .filter((url) => url.startsWith("/api/shops/nearby") || url.startsWith("/api/geo"));
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function mountHome() {
  render(
    <>
      <ReorderSection />
      <NearbyShops initialShops={SERVER_SHOPS} favoriteIds={[]} />
    </>
  );
  await settle();
}

function signIn() {
  auth.isSignedIn = true;
  auth.userId = "user_signed_in";
}

beforeEach(() => {
  auth.isLoaded = true;
  auth.isSignedIn = false;
  auth.userId = null;
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (input) => {
    if (input.startsWith("/api/shops/nearby")) return reply({ success: true, data: [] });
    if (input.includes("nominatim.openstreetmap.org/search")) {
      return reply([{ lat: "45.69", lon: "5.91", display_name: "Chambéry, Savoie, France" }]);
    }
    if (input.includes("nominatim.openstreetmap.org/reverse")) {
      return reply({ address: { city: "Chambéry" } });
    }
    return reply({ success: true, data: [] });
  });
  vi.stubGlobal("fetch", fetchMock);
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  Reflect.deleteProperty(navigator, "geolocation");
});

describe("home page: a cached position is never announced at mount", () => {
  beforeEach(() => {
    localStorage.setItem(
      "klikgo-geo",
      JSON.stringify({ lat: 45.57, lng: 5.92, city: "Chambéry", ts: Date.now() })
    );
  });

  it("anonymous visitor: no nearby request, the card still shows the cached city", async () => {
    await mountHome();

    expect(nearbyRequests()).toEqual([]);
    expect(screen.getAllByText("Chambéry").length).toBeGreaterThan(0);
  });

  it("signed-in visitor: exactly one nearby request, made by the shop list", async () => {
    signIn();

    await mountHome();

    expect(nearbyRequests()).toEqual(["/api/shops/nearby?lat=45.57&lng=5.92&radius=15"]);
  });
});

describe("home page: an explicit position sorts the list once", () => {
  it("GPS button: exactly one nearby request, with the position just obtained", async () => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (resolve: PositionCallback) =>
          resolve({ coords: { latitude: 45.69, longitude: 5.91 } } as GeolocationPosition),
      },
    });
    await mountHome();
    expect(nearbyRequests()).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: /Activer GPS/ }));
    await settle();

    expect(nearbyRequests()).toEqual(["/api/shops/nearby?lat=45.69&lng=5.91&radius=15"]);
  });

  it("city typed by the visitor: exactly one nearby request", async () => {
    await mountHome();

    fireEvent.click(screen.getByRole("button", { name: "Saisir ville" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Saisir une ville" }), {
      target: { value: "Chambéry" },
    });
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    await settle();

    expect(nearbyRequests()).toEqual(["/api/shops/nearby?lat=45.69&lng=5.91&radius=15"]);
  });
});
