// Ratings a visitor reads (C1-SEO, IND-2): a shop card and the review list of a shop page show
// the verified rating only (src/lib/reviews/verified-rating.ts), rounded as the JSON-LD rounds it,
// and nothing at all without one. The seeded Shop.rating / ratingCount (4.7 / 89 on the demo
// shops) never reaches the screen, and the review list asks no API at mount.
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { ShopCard, type ShopCardData } from "@/components/shop/ShopCard";
import { ReviewList } from "@/components/shop/ReviewList";
import type { ReviewData } from "@/components/shop/ReviewCard";

vi.mock("next/link", () => ({
  default: (props: ComponentProps<"a">) => <a {...props} />,
}));

const CARD: ShopCardData = {
  id: "cm0shopalpha0001",
  slug: "boucherie-alpha",
  name: "Boucherie alpha",
  address: "1 rue de la Gare",
  city: "Chambéry",
  imageUrl: null,
  prepTimeMin: 15,
  busyMode: false,
  busyExtraMin: 0,
  status: "OPEN",
  openingHours: null,
};

// What the database and the nearby API still carry for a demo shop: never displayed.
const SEEDED = { rating: 4.7, ratingCount: 89 };

const REVIEWS: ReviewData[] = [
  {
    id: "r2",
    rating: 2,
    comment: "Attente au retrait.",
    createdAt: "2026-10-03T09:00:00.000Z",
    user: { firstName: "Client", lastInitial: "" },
  },
  {
    id: "r1",
    rating: 5,
    comment: "Accueil chaleureux.",
    createdAt: "2026-10-01T09:00:00.000Z",
    user: { firstName: "Amina", lastInitial: "K." },
  },
];

const fetchMock = vi.fn(async () => new Response("{}"));

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ShopCard", () => {
  it.each(["default", "compact"] as const)(
    "%s: shows no rating without a verified one, whatever the shop row carries",
    (variant) => {
      const seededRow = { ...CARD, ...SEEDED } as ShopCardData;
      const { container } = render(
        <>
          <ShopCard shop={seededRow} variant={variant} showFavorite={false} />
          <ShopCard
            shop={{ ...CARD, id: "cm0shopbeta00002", verifiedRating: null }}
            variant={variant}
            showFavorite={false}
          />
        </>
      );

      expect(container.textContent).not.toMatch(/4[.,]7|\(89\)/);
      expect(container.querySelector(".fill-yellow-500")).toBeNull();
    }
  );

  it.each(["default", "compact"] as const)(
    "%s: shows the verified rating, rounded to one decimal, with its count",
    (variant) => {
      const shop = { ...CARD, ...SEEDED, verifiedRating: { average: 3.45, count: 2 } };
      render(<ShopCard shop={shop} variant={variant} showFavorite={false} />);

      expect(screen.getByText("3.5")).toBeInTheDocument();
      expect(screen.getByText("(2)")).toBeInTheDocument();
      expect(screen.queryByText("4.7")).not.toBeInTheDocument();
    }
  );
});

describe("ReviewList", () => {
  it("shows the verified figure and the verified reviews, without any request", async () => {
    render(<ReviewList rating={{ average: 3.5, count: 2 }} reviews={REVIEWS} />);

    expect(screen.getByText("3.5")).toBeInTheDocument();
    expect(screen.getByText("(2)")).toBeInTheDocument();
    expect(await screen.findByText("Attente au retrait.")).toBeInTheDocument();
    expect(screen.getByText("Accueil chaleureux.")).toBeInTheDocument();
    expect(screen.getByText(/Amina\s+K\./)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows neither a figure nor a review for a shop without a verified review", () => {
    const { container } = render(<ReviewList rating={null} reviews={[]} />);

    expect(screen.getByText("Aucun avis pour le moment")).toBeInTheDocument();
    expect(container.querySelector(".fill-yellow-400")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("renders the review cards after mount only: the server HTML carries no relative date", () => {
    const html = renderToString(
      <ReviewList rating={{ average: 3.5, count: 2 }} reviews={REVIEWS} />
    );

    expect(html).toContain("3.5");
    expect(html).not.toContain("Attente au retrait.");
    expect(html).not.toMatch(/il y a/);
  });
});
