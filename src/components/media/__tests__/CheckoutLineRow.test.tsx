// Ligne du panier (/panier) : la photo enregistrée dans la ligne est la photo propre du produit,
// qui peut être morte. Elle doit passer à la photo locale du produit (une seule requête par
// candidate, sans onError sur next/image), jamais rester une image cassée.
import { cleanup, fireEvent, render } from "@testing-library/react";
import type { ImageProps } from "next/image";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CheckoutLineRow } from "@/components/cart/CheckoutLineRow";
import type { CartItem } from "@/lib/cart/cart-line";

const imageProps = vi.hoisted(() => [] as Record<string, unknown>[]);

vi.mock("next/image", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/image")>();
  const { createElement, forwardRef } = await import("react");
  const RealImage = actual.default;
  const RecordingImage = forwardRef<HTMLImageElement, ImageProps>(
    function RecordingImage(props, ref) {
      imageProps.push({ ...props });
      return createElement(RealImage, { ...props, ref });
    }
  );
  return { ...actual, default: RecordingImage };
});

const DEAD =
  "https://nzqbbcqekyom7ajd.public.blob.vercel-storage.com/e2e/dead-0f8fad5b-d9cb-469f-a165-70867728950e.webp";
const KEYWORD_PHOTO = "/img/products/merguez.jpg";

const line: CartItem = {
  id: "line-merguez",
  productId: "prod-merguez",
  name: "Merguez",
  imageUrl: DEAD,
  priceCents: 450,
  quantity: 2,
  unit: "PIECE",
  category: "Saucisses",
};

/** La photo demandée par un <img> : le paramètre url de /_next/image, sinon la source brute. */
function candidateOf(src: string): string {
  const optimizer = "/_next/image?";
  if (!src.startsWith(optimizer)) return src;
  const url = new URLSearchParams(src.slice(optimizer.length)).get("url");
  if (url === null) throw new Error(`URL d'optimisation sans paramètre url : ${src}`);
  return url;
}

let requested: string[] = [];
const nativeSetAttribute = Element.prototype.setAttribute;

beforeEach(() => {
  requested = [];
  imageProps.length = 0;
  vi.spyOn(Element.prototype, "setAttribute").mockImplementation(function (
    this: Element,
    name: string,
    value: string
  ) {
    if (this instanceof HTMLImageElement && name === "src") requested.push(candidateOf(value));
    nativeSetAttribute.call(this, name, value);
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function shownImage(container: HTMLElement): HTMLImageElement {
  const images = container.querySelectorAll("img");
  expect(images).toHaveLength(1);
  return images[0];
}

describe("CheckoutLineRow", () => {
  it("une photo propre morte passe à la photo locale du produit, sans nouvelle requête vers elle", () => {
    const { container } = render(
      <CheckoutLineRow
        item={line}
        lineTotalCents={900}
        refusal={undefined}
        onUpdateQty={() => undefined}
        onRemove={() => undefined}
      />
    );

    expect(candidateOf(shownImage(container).getAttribute("src") ?? "")).toBe(DEAD);
    fireEvent.error(shownImage(container));

    const next = shownImage(container);
    expect(candidateOf(next.getAttribute("src") ?? "")).toBe(KEYWORD_PHOTO);
    expect(next).toHaveAttribute("alt", "Merguez");
    expect(requested.filter((url) => url === DEAD)).toHaveLength(1);
    expect(requested).toEqual([DEAD, KEYWORD_PHOTO]);
    expect(imageProps.length).toBeGreaterThan(0);
    for (const props of imageProps) expect(props).not.toHaveProperty("onError");
  });
});
