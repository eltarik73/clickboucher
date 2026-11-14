// Photo produit qui ne casse jamais : chaque candidate (photo principale, Product.imageUrl, photo
// locale) est demandée UNE fois ; un échec fait passer à la suivante, et la dernière étape est une
// icône en ligne, sans requête. Rien ne réassigne img.src (next/image le fait dès qu'on lui passe
// onError : une requête de plus par échec, la boucle de ProductCard).
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ImageProps } from "next/image";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { ProductPhoto } from "@/components/media/ProductPhoto";

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

const BLOB = "https://nzqbbcqekyom7ajd.public.blob.vercel-storage.com";
const PRIMARY = `${BLOB}/products/product-1772114082715-3e9f77cb76d4b0eb.webp`;
const SECONDARY = `${BLOB}/products/product-1772635498764-991836e0b6afda39.webp`;
const IMAGE_URL = "/img/products/kefta-maison.jpg";
const LOCAL = "/img/products/merguez.jpg";
const UPLOADED = `${BLOB}/shops/shop-1/product/0f8fad5b-d9cb-469f-a165-70867728950e.webp`;

const merguez = {
  name: "Merguez",
  category: "Saucisses",
  imageUrl: IMAGE_URL,
  images: [
    { url: SECONDARY, isPrimary: false, order: 0 },
    { url: PRIMARY, isPrimary: true, order: 1 },
  ],
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
let srcSetter: MockInstance<(value: string) => void>;
const nativeSetAttribute = Element.prototype.setAttribute;
const completeDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "complete");

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
  srcSetter = vi.spyOn(HTMLImageElement.prototype, "src", "set");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  if (completeDescriptor) {
    Object.defineProperty(HTMLImageElement.prototype, "complete", completeDescriptor);
  }
});

function shownImage(container: HTMLElement): HTMLImageElement {
  const images = container.querySelectorAll("img");
  expect(images).toHaveLength(1);
  return images[0];
}

function shownCandidate(container: HTMLElement): string {
  return candidateOf(shownImage(container).getAttribute("src") ?? "");
}

function failShownImage(container: HTMLElement) {
  fireEvent.error(shownImage(container));
}

describe("ProductPhoto", () => {
  it("passe de la photo principale à imageUrl, puis à la photo locale, puis à l'icône", () => {
    const { container } = render(<ProductPhoto product={merguez} width={56} height={56} />);

    expect(shownCandidate(container)).toBe(PRIMARY);
    failShownImage(container);
    expect(shownCandidate(container)).toBe(IMAGE_URL);
    failShownImage(container);
    expect(shownCandidate(container)).toBe(LOCAL);
    failShownImage(container);

    expect(container.querySelector("img")).toBeNull();
    const terminal = screen.getByRole("img", { name: "Merguez" });
    expect(terminal.tagName).toBe("DIV");
    expect(terminal.querySelector("svg.lucide-image-off")).not.toBeNull();
    expect(terminal).toHaveStyle({ width: "56px", height: "56px" });
    expect(requested).toEqual([PRIMARY, IMAGE_URL, LOCAL]);
  });

  // React 18.3 assigne lui-même img.src une fois au montage d'un <img> côté client (commitMount,
  // react-dom.development.js:11035-11038), avec la valeur de l'attribut qu'il vient de poser :
  // c'est la seule affectation permise. Avec onError, next/image en ajoute une (img.src = img.src)
  // à chaque montage ; l'ancienne ProductCard affectait un placeholder.
  it("ne réassigne jamais img.src et ne passe jamais onError à next/image", () => {
    const { container } = render(<ProductPhoto product={merguez} width={56} height={56} />);
    failShownImage(container);
    failShownImage(container);
    failShownImage(container);

    const assigned = srcSetter.mock.calls.map(([value]) => candidateOf(value));
    expect(assigned).toEqual([PRIMARY, IMAGE_URL, LOCAL]);
    expect(assigned).toEqual(requested);
    expect(imageProps.length).toBeGreaterThan(0);
    for (const props of imageProps) expect(props).not.toHaveProperty("onError");
  });

  it("une erreur répétée sur la même photo n'avance qu'une fois", () => {
    const { container } = render(<ProductPhoto product={merguez} width={56} height={56} />);
    const first = shownImage(container);
    fireEvent.error(first);
    fireEvent.error(first);

    expect(shownCandidate(container)).toBe(IMAGE_URL);
  });

  it("repart de la première photo quand le produit change", () => {
    const { container, rerender } = render(
      <ProductPhoto product={merguez} width={56} height={56} />
    );
    failShownImage(container);
    expect(shownCandidate(container)).toBe(IMAGE_URL);

    const gigot = { name: "Gigot d'agneau", imageUrl: "/img/products/epaule-agneau.jpg" };
    rerender(<ProductPhoto product={gigot} width={56} height={56} />);

    expect(shownCandidate(container)).toBe("/img/products/epaule-agneau.jpg");
    expect(screen.getByAltText("Gigot d'agneau")).toBeInTheDocument();
  });

  it("garde la photo affichée quand le parent recrée le même produit", () => {
    const { container, rerender } = render(
      <ProductPhoto product={merguez} width={56} height={56} />
    );
    failShownImage(container);
    rerender(
      <ProductPhoto product={{ ...merguez, images: [...merguez.images] }} width={56} height={56} />
    );

    expect(shownCandidate(container)).toBe(IMAGE_URL);
    expect(requested).toEqual([PRIMARY, IMAGE_URL]);
  });

  it("n'affiche « Photo indisponible » qu'avec unavailableBadge, une fois la photo propre en échec", () => {
    const withBadge = render(
      <ProductPhoto product={merguez} width={56} height={56} unavailableBadge />
    );
    expect(screen.queryByText("Photo indisponible")).toBeNull();
    failShownImage(withBadge.container);
    expect(screen.getByText("Photo indisponible")).toBeInTheDocument();
    withBadge.unmount();

    const withoutBadge = render(<ProductPhoto product={merguez} width={56} height={56} />);
    failShownImage(withoutBadge.container);
    expect(screen.queryByText("Photo indisponible")).toBeNull();
  });

  it("sans photo propre, l'échec de la photo locale n'affiche pas le badge", () => {
    const { container } = render(
      <ProductPhoto product={{ name: "Merguez" }} width={56} height={56} unavailableBadge />
    );
    expect(shownCandidate(container)).toBe(LOCAL);
    failShownImage(container);

    expect(screen.queryByText("Photo indisponible")).toBeNull();
    expect(screen.getByRole("img", { name: "Merguez" })).toBeInTheDocument();
  });

  it("une image déjà en échec avant l'hydratation (complete, naturalWidth 0) avance sans événement", () => {
    Object.defineProperty(HTMLImageElement.prototype, "complete", {
      configurable: true,
      get(this: HTMLImageElement) {
        return candidateOf(this.getAttribute("src") ?? "") === PRIMARY;
      },
    });
    const { container } = render(<ProductPhoto product={merguez} width={56} height={56} />);

    expect(shownCandidate(container)).toBe(IMAGE_URL);
    expect(requested).toEqual([PRIMARY, IMAGE_URL]);
  });

  it("le double montage de StrictMode ne saute aucune photo", () => {
    Object.defineProperty(HTMLImageElement.prototype, "complete", {
      configurable: true,
      get(this: HTMLImageElement) {
        return candidateOf(this.getAttribute("src") ?? "") === PRIMARY;
      },
    });
    const { container } = render(
      <StrictMode>
        <ProductPhoto product={merguez} width={56} height={56} />
      </StrictMode>
    );

    expect(shownCandidate(container)).toBe(IMAGE_URL);
  });

  it("une image chargée (naturalWidth > 0) reste affichée", () => {
    Object.defineProperty(HTMLImageElement.prototype, "complete", {
      configurable: true,
      get: () => true,
    });
    vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(640);
    const { container } = render(<ProductPhoto product={merguez} width={56} height={56} />);

    expect(shownCandidate(container)).toBe(PRIMARY);
  });

  it("variante vignette : la vignette -t d'une photo envoyée, servie sans optimisation", () => {
    const { container } = render(
      <ProductPhoto
        product={{ name: "Merguez", imageUrl: UPLOADED }}
        variant="thumb"
        width={56}
        height={56}
      />
    );

    expect(shownImage(container).getAttribute("src")).toBe(UPLOADED.replace(/\.webp$/, "-t.webp"));
  });

  it("variante vignette : une photo sans vignette passe par l'optimiseur", () => {
    const { container } = render(
      <ProductPhoto
        product={{ name: "Merguez", imageUrl: IMAGE_URL }}
        variant="thumb"
        width={28}
        height={28}
      />
    );

    expect(shownImage(container).getAttribute("src")).toMatch(/^\/_next\/image\?url=/);
    expect(shownCandidate(container)).toBe(IMAGE_URL);
  });

  it("une photo du magasin local est servie telle quelle", () => {
    const local = "/local-images/shops/shop-1/product/0f8fad5b-d9cb-469f-a165-70867728950e.webp";
    const { container } = render(
      <ProductPhoto product={{ name: "Merguez", imageUrl: local }} width={56} height={56} />
    );

    expect(shownImage(container).getAttribute("src")).toBe(local);
  });

  it("une URL qui expire n'est jamais demandée", async () => {
    const expiring = "https://replicate.delivery/xezq/abc/out-0.webp";
    const { container } = render(
      <ProductPhoto product={{ name: "Merguez", imageUrl: expiring }} fill sizes="25vw" />
    );
    await act(async () => undefined);

    expect(shownCandidate(container)).toBe(LOCAL);
    expect(requested).toEqual([LOCAL]);
  });
});
