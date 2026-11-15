// Home shop list (NearbyShops): an anonymous view calls no API at mount (CLAUDE.md, « Coût CPU
// Vercel »): no IP lookup through /api/geo, and a cached position sorts the list through
// /api/shops/nearby only for a signed-in visitor or a test session. A « klikgo-location » event
// (explicit position chosen by the visitor) sorts it once, and the loader never moves the list.
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import NearbyShops from "@/app/(client)/decouvrir/NearbyShops";
import type { ShopCardData } from "@/components/shop/ShopCard";

const auth = vi.hoisted(() => ({
  isLoaded: true,
  isSignedIn: false as boolean | undefined,
  userId: null as string | null,
}));
vi.mock("@clerk/nextjs", () => ({ useAuth: () => auth }));
vi.mock("next/link", () => ({
  default: ({ prefetch, ...props }: ComponentProps<"a"> & { prefetch?: boolean | null }) => (
    <a data-prefetch={String(prefetch)} {...props} />
  ),
}));

const GEO_CACHE_KEY = "klikgo-geo";
const TEST_MODE_COOKIE = "klikgo-test-activated";

function shop(id: string, status: string): ShopCardData {
  return {
    id,
    slug: `boucherie-${id}`,
    name: `Boucherie ${id}`,
    address: "1 rue de la Gare",
    city: "Chambéry",
    imageUrl: null,
    prepTimeMin: 15,
    busyMode: false,
    busyExtraMin: 0,
    status,
    rating: 0,
    ratingCount: 0,
    distance: null,
    activePromo: null,
    openingHours: null,
  };
}

const SERVER_SHOPS = [shop("alpha", "OPEN"), shop("beta", "CLOSED")];
const NEAR_SHOPS = [{ ...shop("gamma", "OPEN"), distance: 1.2 }];

function reply(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}

const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>();

function requestedUrls(): string[] {
  return fetchMock.mock.calls.map(([input]) => String(input));
}

function nearbyRequests(): string[] {
  return requestedUrls().filter((url) => url.startsWith("/api/shops/nearby"));
}

function geoRequests(): string[] {
  return requestedUrls().filter((url) => url.startsWith("/api/geo"));
}

function cachePosition(lat: number, lng: number) {
  localStorage.setItem(
    GEO_CACHE_KEY,
    JSON.stringify({ lat, lng, city: "Chambéry", ts: Date.now() })
  );
}

/** Lets the mount effects and the promises they start settle. */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function mount() {
  const view = render(<NearbyShops initialShops={SERVER_SHOPS} favoriteIds={[]} />);
  await settle();
  return view;
}

beforeEach(() => {
  auth.isLoaded = true;
  auth.isSignedIn = false;
  auth.userId = null;
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (input) => {
    if (input.startsWith("/api/shops/nearby")) return reply({ success: true, data: NEAR_SHOPS });
    if (input.startsWith("/api/favorites")) return reply({ success: true, data: [] });
    return reply({ success: true, data: { lat: 45.57, lng: 5.92 } });
  });
  vi.stubGlobal("fetch", fetchMock);
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  document.cookie = `${TEST_MODE_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
});

describe("NearbyShops — anonymous visitor", () => {
  it("calls no API at mount without a cached position", async () => {
    await mount();

    expect(geoRequests()).toEqual([]);
    expect(nearbyRequests()).toEqual([]);
    expect(screen.getByText("Boucherie alpha")).toBeInTheDocument();
  });

  it("calls no API at mount with a cached position, and keeps the server order", async () => {
    cachePosition(45.57, 5.92);

    await mount();

    expect(geoRequests()).toEqual([]);
    expect(nearbyRequests()).toEqual([]);
    expect(screen.getByRole("heading", { name: "Boucheries ouvertes" })).toBeInTheDocument();
    expect(screen.getByText("Boucherie alpha")).toBeInTheDocument();
  });

  it("waits for Clerk: no call while auth is loading, one call once the visitor is signed in", async () => {
    cachePosition(45.57, 5.92);
    auth.isLoaded = false;
    auth.isSignedIn = undefined;
    const view = await mount();
    expect(nearbyRequests()).toEqual([]);

    auth.isLoaded = true;
    auth.isSignedIn = true;
    auth.userId = "user_signed_in";
    view.rerender(<NearbyShops initialShops={SERVER_SHOPS} favoriteIds={[]} />);
    await settle();

    expect(nearbyRequests()).toEqual(["/api/shops/nearby?lat=45.57&lng=5.92&radius=15"]);
  });

  it("sorts the list once on an explicit « klikgo-location » event", async () => {
    await mount();

    act(() => {
      window.dispatchEvent(
        new CustomEvent("klikgo-location", { detail: { lat: 45.69, lng: 5.91 } })
      );
    });
    await settle();

    expect(nearbyRequests()).toEqual(["/api/shops/nearby?lat=45.69&lng=5.91&radius=15"]);
    expect(geoRequests()).toEqual([]);
    expect(screen.getByText("Boucherie gamma")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Boucheries ouvertes proches" })
    ).toBeInTheDocument();
  });
});

describe("NearbyShops — signed-in visitor or test session", () => {
  it("sorts the list with exactly one nearby request when a position is cached", async () => {
    auth.isSignedIn = true;
    auth.userId = "user_signed_in";
    cachePosition(45.57, 5.92);

    await mount();

    expect(nearbyRequests()).toEqual(["/api/shops/nearby?lat=45.57&lng=5.92&radius=15"]);
    expect(geoRequests()).toEqual([]);
    expect(screen.getByText("Boucherie gamma")).toBeInTheDocument();
  });

  it("makes no nearby request without a cached position", async () => {
    auth.isSignedIn = true;
    auth.userId = "user_signed_in";

    await mount();

    expect(nearbyRequests()).toEqual([]);
    expect(geoRequests()).toEqual([]);
  });

  it("ignores an expired cached position", async () => {
    auth.isSignedIn = true;
    auth.userId = "user_signed_in";
    localStorage.setItem(
      GEO_CACHE_KEY,
      JSON.stringify({ lat: 45.57, lng: 5.92, ts: Date.now() - 2 * 86_400_000 })
    );

    await mount();

    expect(nearbyRequests()).toEqual([]);
  });

  it("treats a test session like a signed-in visitor", async () => {
    document.cookie = `${TEST_MODE_COOKIE}=true; path=/`;
    cachePosition(45.57, 5.92);

    await mount();

    expect(nearbyRequests()).toEqual(["/api/shops/nearby?lat=45.57&lng=5.92&radius=15"]);
  });
});

describe("NearbyShops — loader", () => {
  it("overlays the list in an absolutely positioned status, without moving the content", async () => {
    let answer: (response: Response) => void = () => undefined;
    fetchMock.mockImplementation(
      (input) =>
        new Promise<Response>((resolve) => {
          if (input.startsWith("/api/shops/nearby")) answer = resolve;
          else resolve(reply({ success: true, data: [] }));
        })
    );
    const empty = [shop("delta", "CLOSED")];
    render(<NearbyShops initialShops={empty} favoriteIds={[]} />);
    await settle();
    const emptyState = screen.getByText("Aucune boucherie ouverte en ce moment");

    fireEvent(window, new CustomEvent("klikgo-location", { detail: { lat: 45.69, lng: 5.91 } }));
    await settle();

    const loader = screen.getByRole("status");
    expect(loader).toHaveClass("absolute");
    expect(loader).toHaveTextContent("Recherche des boucheries proches");
    expect(loader.parentElement).toHaveClass("relative");
    // The blocks under the loader stay in place while it shows.
    expect(emptyState).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Boucheries ouvertes" })).toBeInTheDocument();

    await act(async () => {
      answer(reply({ success: true, data: NEAR_SHOPS }));
    });
    await settle();

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText("Boucherie gamma")).toBeInTheDocument();
  });
});
