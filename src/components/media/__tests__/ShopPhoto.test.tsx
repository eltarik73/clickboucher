// Photo de boutique : la photo de repli dépend de l'identifiant de la boutique, jamais de sa place
// dans une liste ; une photo propre morte passe à ce repli, puis à l'icône (aucune requête).
// ShopCard est rendue au build (pages ville) : une photo en échec avant l'hydratation doit aussi
// passer au repli, sans écart d'hydratation.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { ShopPhoto } from "@/components/media/ShopPhoto";

const SHOP_IDS = ["cm0shopalpha0001", "cm0shopbeta00002", "cm0shopgamma0003", "cm0shopdelta0004"];
const DEAD = "https://nzqbbcqekyom7ajd.public.blob.vercel-storage.com/shops/legacy/vitrine.webp";
const completeDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "complete");
let hydrated: { root: Root; container: HTMLElement } | null = null;

afterEach(() => {
  cleanup();
  if (hydrated) {
    const { root, container } = hydrated;
    act(() => root.unmount());
    container.remove();
    hydrated = null;
  }
  if (completeDescriptor) {
    Object.defineProperty(HTMLImageElement.prototype, "complete", completeDescriptor);
  }
});

function candidateOf(src: string): string {
  const optimizer = "/_next/image?";
  if (!src.startsWith(optimizer)) return src;
  const url = new URLSearchParams(src.slice(optimizer.length)).get("url");
  if (url === null) throw new Error(`URL d'optimisation sans paramètre url : ${src}`);
  return url;
}

/** Photo affichée pour chaque boutique d'une liste rendue dans l'ordre donné. */
function photosInOrder(ids: readonly string[]): Map<string, string> {
  const { container, unmount } = render(
    <ul>
      {ids.map((id) => (
        <li key={id} data-shop={id} className="relative h-24 w-24">
          <ShopPhoto shop={{ id, imageUrl: null }} alt={`Boutique ${id}`} fill sizes="96px" />
        </li>
      ))}
    </ul>
  );
  const photos = new Map<string, string>();
  for (const item of Array.from(container.querySelectorAll("li"))) {
    const img = item.querySelector("img");
    if (img === null) throw new Error(`Aucune photo pour ${item.dataset.shop}`);
    photos.set(item.dataset.shop ?? "", candidateOf(img.getAttribute("src") ?? ""));
  }
  unmount();
  return photos;
}

describe("ShopPhoto", () => {
  it("donne la même photo de repli à une boutique, quels que soient l'ordre et le montage", () => {
    const forward = photosInOrder(SHOP_IDS);
    const reversed = photosInOrder([...SHOP_IDS].reverse());
    const alone = photosInOrder([SHOP_IDS[2]]);

    expect(reversed).toEqual(forward);
    expect(alone.get(SHOP_IDS[2])).toBe(forward.get(SHOP_IDS[2]));
    for (const photo of Array.from(forward.values())) {
      expect(photo).toMatch(/^\/img\/shops\/shop-\d+\.jpg$/);
    }
  });

  it("une photo propre morte passe à la photo de repli de la boutique, puis à l'icône", () => {
    const id = SHOP_IDS[1];
    const fallback = photosInOrder([id]).get(id);
    const { container } = render(
      <div className="relative h-36">
        <ShopPhoto shop={{ id, imageUrl: DEAD }} alt="Boucherie Test" fill sizes="50vw" />
      </div>
    );

    const shown = () => candidateOf(container.querySelector("img")?.getAttribute("src") ?? "");
    expect(shown()).toBe(DEAD);
    fireEvent.error(container.querySelector("img")!);
    expect(shown()).toBe(fallback);
    fireEvent.error(container.querySelector("img")!);

    expect(container.querySelector("img")).toBeNull();
    const terminal = screen.getByRole("img", { name: "Boucherie Test" });
    expect(terminal.querySelector("svg.lucide-store")).not.toBeNull();
    expect(terminal).toHaveClass("absolute", "inset-0");
  });

  it("une photo déjà en échec dans le HTML du serveur passe au repli après l'hydratation", async () => {
    const id = SHOP_IDS[3];
    const fallback = photosInOrder([id]).get(id);
    const tree = (
      <div className="relative h-36">
        <ShopPhoto shop={{ id, imageUrl: DEAD }} alt="Boucherie Test" fill sizes="50vw" />
      </div>
    );
    const container = document.createElement("div");
    container.innerHTML = renderToString(tree);
    document.body.appendChild(container);
    expect(candidateOf(container.querySelector("img")?.getAttribute("src") ?? "")).toBe(DEAD);
    Object.defineProperty(HTMLImageElement.prototype, "complete", {
      configurable: true,
      get(this: HTMLImageElement) {
        return candidateOf(this.getAttribute("src") ?? "") === DEAD;
      },
    });
    const hydrationErrors: unknown[] = [];

    await act(async () => {
      const root = hydrateRoot(container, tree, {
        onRecoverableError: (error) => hydrationErrors.push(error),
      });
      hydrated = { root, container };
    });

    expect(hydrationErrors).toEqual([]);
    expect(candidateOf(container.querySelector("img")?.getAttribute("src") ?? "")).toBe(fallback);
  });
});
