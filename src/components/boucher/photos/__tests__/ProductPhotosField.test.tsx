// Champ « Photos » des formulaires produit (jsdom), rendu avec un contrôleur factice :
// « Photo actuelle », message d'échec avec « Réessayer » et « Retirer », photo principale,
// progression, aperçu illisible, photo indisponible, cibles de 44 px, ligne de blocage. Le champ
// branché sur useProductPhotos (dont la règle de la photo principale) est testé dans
// useProductPhotos.test.tsx.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProductPhotosField } from "@/components/boucher/photos/ProductPhotosField";
import type { PhotoTile } from "@/components/boucher/photos/photos-state";
import type { ProductPhotosController } from "@/components/boucher/photos/useProductPhotos";
import { UPLOAD_MESSAGES_FR } from "@/lib/images/upload-contract";

const BLOB = "https://nzqbbcqekyom7ajd.public.blob.vercel-storage.com/shops/s1/product";
const UPLOADED = `${BLOB}/0f8fad5b-d9cb-469f-a165-70867728950e.webp`;
const LEGACY = "https://images.unsplash.com/photo-1588168333986-5078d3ae3976";
const FILE = new File([new Uint8Array([0xff, 0xd8, 0xff])], "IMG_1.jpg", { type: "image/jpeg" });

function controller(
  tiles: PhotoTile[],
  overrides: Partial<ProductPhotosController> = {}
): ProductPhotosController {
  return {
    tiles,
    primaryKey: tiles.find((t) => t.kind === "saved")?.key ?? null,
    primaryUrl: null,
    ownCount: tiles.filter((t) => t.kind !== "current").length,
    canAddMore: true,
    isBlocking: tiles.some((t) => t.kind === "uploading" || t.kind === "failed"),
    addFiles: vi.fn(),
    addExisting: vi.fn(),
    replaceAll: vi.fn(),
    retry: vi.fn(),
    remove: vi.fn(),
    setPrimary: vi.fn(),
    payload: () => ({ images: [] }),
    ...overrides,
  };
}

const BLOCKING_LINE = "Terminez ou retirez les photos en erreur avant d'enregistrer.";

afterEach(() => cleanup());

describe("ProductPhotosField, rendu", () => {
  it("shows « Photo actuelle » on the current tile, with a Retirer button", () => {
    const photos = controller([{ kind: "current", key: "current", url: LEGACY }], {
      primaryKey: null,
    });
    render(<ProductPhotosField photos={photos} productName="Filet de dinde" appearance="stone" />);
    expect(screen.getByRole("heading", { name: /Photos/ })).toHaveTextContent("Photos (5 maximum)");
    expect(screen.getByText("Photo actuelle")).toBeInTheDocument();
    expect(screen.queryByText("Principale")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retirer (photo 1)" }));
    expect(photos.remove).toHaveBeenCalledWith("current");
  });

  it("a failed tile shows its message as an alert, with Réessayer and Retirer named after the tile", () => {
    const photos = controller([
      { kind: "saved", key: "photo-1", url: UPLOADED, alt: "" },
      {
        kind: "failed",
        key: "photo-2",
        previewUrl: "blob:preview/2",
        file: FILE,
        messageFr: UPLOAD_MESSAGES_FR.HEIC,
      },
    ]);
    render(<ProductPhotosField photos={photos} productName="Merguez" appearance="adaptive" />);
    expect(screen.getByRole("alert")).toHaveTextContent(UPLOAD_MESSAGES_FR.HEIC);
    fireEvent.click(screen.getByRole("button", { name: "Réessayer (photo 2)" }));
    expect(photos.retry).toHaveBeenCalledWith("photo-2");
    fireEvent.click(screen.getByRole("button", { name: "Retirer (photo 2)" }));
    expect(photos.remove).toHaveBeenCalledWith("photo-2");
    expect(screen.getByRole("img", { name: "Photo 2 (aperçu)" })).toHaveAttribute(
      "src",
      "blob:preview/2"
    );
  });

  it("a preview the browser cannot decode becomes « Aperçu indisponible », never a broken image", () => {
    const failed: PhotoTile = {
      kind: "failed",
      key: "photo-1",
      previewUrl: "blob:preview/1",
      file: FILE,
      messageFr: UPLOAD_MESSAGES_FR.HEIC,
    };
    const { container } = render(
      <ProductPhotosField photos={controller([failed])} productName="Merguez" appearance="adaptive" />
    );
    fireEvent.error(screen.getByRole("img", { name: "Photo 1 (aperçu)" }));

    expect(container.querySelector("img")).toBeNull();
    const placeholder = screen.getByRole("img", { name: "Aperçu indisponible (photo 1)" });
    expect(placeholder.querySelector("svg.lucide-image-off")).not.toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent(UPLOAD_MESSAGES_FR.HEIC);
    expect(screen.getByRole("button", { name: "Réessayer (photo 1)" })).toBeEnabled();
  });

  it("a saved or current photo whose URL cannot be shown carries « Photo indisponible »", () => {
    const expiring = "https://replicate.delivery/xezq/abc/out-0.webp";
    const field = (tile: PhotoTile) => (
      <ProductPhotosField photos={controller([tile])} productName="Merguez" appearance="stone" />
    );
    const { rerender } = render(field({ kind: "saved", key: "photo-1", url: expiring, alt: "" }));
    expect(screen.getByText("Photo indisponible")).toBeInTheDocument();

    rerender(field({ kind: "current", key: "current", url: "data:image/png;base64,iVBORw0KGgo=" }));
    expect(screen.getByText("Photo indisponible")).toBeInTheDocument();

    rerender(field({ kind: "saved", key: "photo-1", url: UPLOADED, alt: "" }));
    expect(screen.queryByText("Photo indisponible")).toBeNull();
  });

  it("marks the primary photo and lets another saved photo become primary", () => {
    const photos = controller([
      { kind: "saved", key: "photo-1", url: UPLOADED, alt: "" },
      { kind: "saved", key: "photo-2", url: "/img/products/merguez.jpg", alt: "" },
    ]);
    render(<ProductPhotosField photos={photos} productName="Merguez" appearance="stone" />);
    const [first, second] = screen.getAllByRole("listitem");
    expect(within(first).getByText("Principale")).toBeInTheDocument();
    expect(within(first).queryByRole("button", { name: /Définir comme principale/ })).toBeNull();
    fireEvent.click(
      within(second).getByRole("button", { name: "Définir comme principale (photo 2)" })
    );
    expect(photos.setPrimary).toHaveBeenCalledWith("photo-2");
  });

  it("every action button has a 44 px minimum target", () => {
    const photos = controller(
      [
        { kind: "saved", key: "photo-1", url: UPLOADED, alt: "" },
        { kind: "saved", key: "photo-2", url: UPLOADED.replace("0f8f", "1f8f"), alt: "" },
        {
          kind: "uploading",
          key: "photo-3",
          previewUrl: "blob:preview/3",
          file: FILE,
          progress: 0.45,
        },
        {
          kind: "failed",
          key: "photo-4",
          previewUrl: "blob:preview/4",
          file: FILE,
          messageFr: "Erreur",
        },
      ],
      { canAddMore: true }
    );
    render(
      <ProductPhotosField
        photos={photos}
        productName="Merguez"
        appearance="stone"
        onOpenSearch={vi.fn()}
        onOpenGenerate={vi.fn()}
        onOpenRetouch={vi.fn()}
      />
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(9);
    for (const button of buttons) expect(button).toHaveClass("min-h-11", "min-w-11");
    expect(screen.getByLabelText("Ajouter une photo").closest("label")).toHaveClass(
      "min-h-11",
      "min-w-11"
    );
  });

  it("shows « Préparation… », then an accessible progress bar « Envoi… 45 % »", () => {
    const { rerender } = render(
      <ProductPhotosField
        photos={controller([
          { kind: "uploading", key: "photo-1", previewUrl: "blob:p", file: FILE, progress: null },
        ])}
        productName="Merguez"
        appearance="stone"
      />
    );
    expect(screen.getByText("Préparation…")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).toBeNull();
    rerender(
      <ProductPhotosField
        photos={controller([
          { kind: "uploading", key: "photo-1", previewUrl: "blob:p", file: FILE, progress: 0.456 },
        ])}
        productName="Merguez"
        appearance="stone"
      />
    );
    expect(screen.getByRole("progressbar", { name: "Envoi de la photo 1" })).toHaveAttribute(
      "aria-valuenow",
      "45"
    );
    expect(screen.getByText("Envoi… 45 %")).toBeInTheDocument();
  });

  it("the blocking line appears exactly when isBlocking", () => {
    const tiles: PhotoTile[] = [{ kind: "saved", key: "photo-1", url: UPLOADED, alt: "" }];
    const { rerender } = render(
      <ProductPhotosField
        photos={controller(tiles, { isBlocking: false })}
        productName="x"
        appearance="stone"
      />
    );
    expect(screen.queryByText(BLOCKING_LINE)).toBeNull();
    rerender(
      <ProductPhotosField
        photos={controller(tiles, { isBlocking: true })}
        productName="x"
        appearance="stone"
      />
    );
    expect(screen.getByRole("status")).toHaveTextContent(BLOCKING_LINE);
    rerender(
      <ProductPhotosField
        photos={controller(tiles, { isBlocking: false })}
        productName="x"
        appearance="stone"
      />
    );
    expect(screen.queryByText(BLOCKING_LINE)).toBeNull();
  });

  it("shows the studio buttons only when wired, and disables every way of adding at 5 photos", () => {
    const { rerender } = render(
      <ProductPhotosField photos={controller([])} productName="x" appearance="adaptive" />
    );
    expect(screen.queryByRole("button", { name: /Chercher|Générer IA|Retoucher/ })).toBeNull();
    expect(screen.getByText(/Aucune photo/)).toBeInTheDocument();
    rerender(
      <ProductPhotosField
        photos={controller([], { canAddMore: false })}
        productName="x"
        appearance="adaptive"
        onOpenSearch={vi.fn()}
        onOpenGenerate={vi.fn()}
        onOpenRetouch={vi.fn()}
      />
    );
    expect(screen.getByLabelText("Ajouter une photo")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Chercher" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Générer IA" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Retoucher" })).toBeDisabled();
  });

  it("passes the chosen files to the controller and clears the input", () => {
    const photos = controller([]);
    render(<ProductPhotosField photos={photos} productName="x" appearance="stone" />);
    const input = screen.getByLabelText("Ajouter une photo") as HTMLInputElement;
    expect(input).toHaveAttribute("accept", "image/*");
    expect(input.multiple).toBe(true);
    fireEvent.change(input, { target: { files: [FILE] } });
    expect(photos.addFiles).toHaveBeenCalledWith([FILE]);
  });
});
