// Champ « Photos » branché sur useProductPhotos (jsdom), avec un envoi simulé à la frontière
// uploadImage (upload-transport) : file d'attente une photo à la fois (aussi en StrictMode), « Réessayer » renvoie
// le même fichier, une tuile retirée pendant l'envoi est oubliée, aperçus révoqués, et retirer une
// photo n'appelle jamais le réseau (le formulaire ne supprime plus rien du stockage). « Principale »
// est sur la photo que la charge utile marque isPrimary ; addExisting dit ce qu'il a fait.
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProductPhotosField } from "@/components/boucher/photos/ProductPhotosField";
import {
  useProductPhotos,
  type ProductPhotosController,
} from "@/components/boucher/photos/useProductPhotos";
import type { UploadOutcome } from "@/components/boucher/photos/upload-transport";
import { UPLOAD_MESSAGES_FR } from "@/lib/images/upload-contract";

const uploads = vi.hoisted(() => ({
  calls: [] as {
    file: File;
    onProgress: (ratio: number | null) => void;
    resolve: (outcome: UploadOutcome) => void;
  }[],
}));

vi.mock("@/components/boucher/photos/upload-transport", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/boucher/photos/upload-transport")>()),
  uploadImage: (file: File, _purpose: string, onProgress: (ratio: number | null) => void) =>
    new Promise<UploadOutcome>((resolve) => uploads.calls.push({ file, onProgress, resolve })),
}));

const BLOB = "https://nzqbbcqekyom7ajd.public.blob.vercel-storage.com/shops/s1/product";
const UPLOADED = `${BLOB}/0f8fad5b-d9cb-469f-a165-70867728950e.webp`;
const SECOND = `${BLOB}/7c9e6679-7425-40de-944b-e07fc1f90ae7.webp`;
const LEGACY = "https://images.unsplash.com/photo-1588168333986-5078d3ae3976";
const CATALOGUE = "/img/products/filet-dinde.jpg";
const BLOCKING_LINE = "Terminez ou retirez les photos en erreur avant d'enregistrer.";

const jpeg = (name: string) => new File([new Uint8Array(3)], name, { type: "image/jpeg" });
const sent = (url: string): UploadOutcome => ({
  ok: true,
  result: { id: url.slice(-12), url, thumbUrl: url, width: 10, height: 10 },
});

/** Le contrôleur du dernier rendu, pour appeler addExisting comme le font les fenêtres du studio. */
const rendered: { photos: ProductPhotosController | null } = { photos: null };

function latestPhotos(): ProductPhotosController {
  if (rendered.photos === null) throw new Error("Harness non rendu");
  return rendered.photos;
}

function Harness({ initialImageUrl = null }: { initialImageUrl?: string | null }) {
  const photos = useProductPhotos({
    initialImages: [],
    initialImageUrl,
    purpose: "PRODUCT",
    productName: "Merguez",
    allowCurrent: true,
  });
  rendered.photos = photos;
  return (
    <>
      <ProductPhotosField photos={photos} productName="Merguez" appearance="stone" />
      <div data-testid="payload">{JSON.stringify(photos.payload())}</div>
      <div data-testid="blocking">{String(photos.isBlocking)}</div>
    </>
  );
}

const created: string[] = [];
const revoked: string[] = [];
const original = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
const fetchSpy = vi.fn();

beforeEach(() => {
  uploads.calls.length = 0;
  created.length = 0;
  revoked.length = 0;
  URL.createObjectURL = (file: Blob) => {
    const url = `blob:preview/${created.length + 1}-${(file as File).name}`;
    created.push(url);
    return url;
  };
  URL.revokeObjectURL = (url: string) => {
    revoked.push(url);
  };
  vi.stubGlobal("fetch", fetchSpy);
});

afterEach(() => {
  cleanup();
  rendered.photos = null;
  URL.createObjectURL = original.create;
  URL.revokeObjectURL = original.revoke;
  vi.unstubAllGlobals();
  fetchSpy.mockReset();
});

function choose(...files: File[]) {
  fireEvent.change(screen.getByLabelText("Ajouter une photo"), { target: { files } });
}

describe("useProductPhotos dans le champ « Photos »", () => {
  it("uploads one photo at a time, replaces « Photo actuelle », and unblocks once all are sent", async () => {
    const [a, b] = [jpeg("a.jpg"), jpeg("b.jpg")];
    render(<Harness initialImageUrl={LEGACY} />);
    expect(screen.getByText("Photo actuelle")).toBeInTheDocument();

    choose(a, b);
    expect(screen.queryByText("Photo actuelle")).toBeNull();
    expect(uploads.calls.map((call) => call.file)).toEqual([a]);
    expect(screen.getByTestId("blocking")).toHaveTextContent("true");

    await act(async () => uploads.calls[0].onProgress(0.5));
    expect(screen.getByRole("progressbar", { name: "Envoi de la photo 1" })).toHaveAttribute(
      "aria-valuenow",
      "50"
    );
    await act(async () => uploads.calls[0].resolve(sent(UPLOADED)));
    expect(uploads.calls.map((call) => call.file)).toEqual([a, b]);
    expect(revoked).toEqual([created[0]]);

    await act(async () => uploads.calls[1].resolve(sent(SECOND)));
    expect(screen.getByTestId("blocking")).toHaveTextContent("false");
    expect(JSON.parse(screen.getByTestId("payload").textContent ?? "")).toEqual({
      images: [
        { url: UPLOADED, alt: "Merguez", order: 0, isPrimary: true },
        { url: SECOND, alt: "Merguez", order: 1, isPrimary: false },
      ],
    });
    expect(revoked).toEqual(created);
  });

  it("starts each upload once under StrictMode", async () => {
    render(
      <StrictMode>
        <Harness />
      </StrictMode>
    );
    choose(jpeg("a.jpg"), jpeg("b.jpg"));
    expect(uploads.calls).toHaveLength(1);
    await act(async () => uploads.calls[0].resolve(sent(UPLOADED)));
    expect(uploads.calls).toHaveLength(2);
    await act(async () => uploads.calls[1].resolve(sent(SECOND)));
    expect(uploads.calls).toHaveLength(2);
  });

  it("a failed upload shows the French message; Réessayer re-sends the same file", async () => {
    const file = jpeg("IMG_1.jpg");
    render(<Harness />);
    choose(file);
    await act(async () =>
      uploads.calls[0].resolve({ ok: false, messageFr: UPLOAD_MESSAGES_FR.TIMEOUT })
    );
    expect(screen.getByRole("alert")).toHaveTextContent(UPLOAD_MESSAGES_FR.TIMEOUT);
    expect(screen.getByRole("status")).toHaveTextContent(BLOCKING_LINE);
    expect(revoked).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: "Réessayer (photo 1)" }));
    expect(uploads.calls).toHaveLength(2);
    expect(uploads.calls[1].file).toBe(file);
    await act(async () => uploads.calls[1].resolve(sent(UPLOADED)));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByTestId("blocking")).toHaveTextContent("false");
  });

  it("a tile removed during its upload is forgotten, and the queue moves on", async () => {
    const [a, b] = [jpeg("a.jpg"), jpeg("b.jpg")];
    render(<Harness />);
    choose(a, b);
    fireEvent.click(screen.getByRole("button", { name: "Retirer (photo 1)" }));
    expect(revoked).toEqual([created[0]]);
    await act(async () => uploads.calls[0].resolve(sent(UPLOADED)));
    expect(uploads.calls.map((call) => call.file)).toEqual([a, b]);
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("removing photos never calls the network, and « Photo actuelle » removed sends clearImageUrl", async () => {
    render(<Harness initialImageUrl={LEGACY} />);
    fireEvent.click(screen.getByRole("button", { name: "Retirer (photo 1)" }));
    expect(JSON.parse(screen.getByTestId("payload").textContent ?? "")).toEqual({
      images: [],
      clearImageUrl: true,
    });
    choose(jpeg("a.jpg"));
    await act(async () => uploads.calls[0].resolve(sent(UPLOADED)));
    fireEvent.click(screen.getByRole("button", { name: "Retirer (photo 1)" }));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("« Principale » is on the photo the payload marks isPrimary, never on one uploading or failed", async () => {
    render(<Harness />);
    choose(jpeg("a.jpg"));
    expect(screen.queryByText("Principale")).toBeNull();

    act(() => {
      latestPhotos().addExisting(CATALOGUE, "Catalogue");
    });
    const badgeOn = () =>
      screen.getAllByRole("listitem").map((li) => within(li).queryByText("Principale") !== null);
    expect(badgeOn()).toEqual([false, true]);
    expect(JSON.parse(screen.getByTestId("payload").textContent ?? "").images).toEqual([
      { url: CATALOGUE, alt: "Catalogue", order: 0, isPrimary: true },
    ]);

    await act(async () =>
      uploads.calls[0].resolve({ ok: false, messageFr: UPLOAD_MESSAGES_FR.TIMEOUT })
    );
    expect(badgeOn()).toEqual([false, true]);
  });

  it("addExisting says whether the photo was added, already there, or refused at 5 photos", () => {
    render(<Harness />);
    const outcomes: string[] = [];
    const add = (url: string) =>
      act(() => {
        outcomes.push(latestPhotos().addExisting(url, ""));
      });
    add(CATALOGUE);
    add(CATALOGUE);
    for (const name of ["a", "b", "c", "d", "e"]) add(`/img/products/${name}.jpg`);

    expect(outcomes).toEqual(["added", "duplicate", "added", "added", "added", "added", "full"]);
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
  });

  it("revokes the remaining previews on unmount", () => {
    const { unmount } = render(<Harness />);
    choose(jpeg("a.jpg"));
    unmount();
    expect(revoked).toEqual(created);
  });
});
