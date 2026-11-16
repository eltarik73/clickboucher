// Fenêtre « Retoucher une photo » (jsdom) :
// - la photo du produit n'est proposée comme source que si c'est un fichier de notre magasin Blob ;
//   une « Photo actuelle » /img ouvre la fenêtre sur l'envoi, comme avant ;
// - une photo choisie passe par l'envoi commun (uploadImage(…, "RETOUCH_SOURCE"), simulé ici) puis
//   la retouche reçoit son URL ; un refus d'envoi ou une réponse text/plain donnent un message
//   français, jamais « Unexpected token ».
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UPLOAD_MESSAGES_FR, type UploadPurpose } from "@/lib/images/upload-contract";
import type { UploadOutcome } from "@/components/boucher/photos/upload-transport";

const transport = vi.hoisted(() => ({
  uploadImage:
    vi.fn<
      (
        file: File,
        purpose: UploadPurpose,
        onProgress: (ratio: number | null) => void
      ) => Promise<UploadOutcome>
    >(),
}));

vi.mock("@/components/boucher/photos/upload-transport", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/boucher/photos/upload-transport")>()),
  uploadImage: transport.uploadImage,
}));

import ImageRetouchModal from "@/components/boucher/ImageRetouchModal";

const STORE = "https://nzqbbcqekyom7ajd.public.blob.vercel-storage.com";
const PRODUCT_PHOTO = `${STORE}/shops/s1/product/0f8fad5b-d9cb-469f-a165-70867728950e.webp`;
const UPLOADED = `${STORE}/shops/s1/retouch-source/3f2b8c1e-9d4a-4b7e-8f21-0c5d6e7a8b9c.webp`;
const FILE = new File([new Uint8Array([0xff, 0xd8, 0xff])], "IMG_1.jpg", { type: "image/jpeg" });

// jsdom n'a pas URL.createObjectURL (aperçu de la photo choisie).
Object.defineProperty(URL, "createObjectURL", {
  value: () => "blob:http://localhost/preview",
  configurable: true,
});

function open(sourceImageUrl?: string) {
  return render(
    <ImageRetouchModal open onClose={vi.fn()} onSelect={vi.fn()} sourceImageUrl={sourceImageUrl} />
  );
}

function chooseFile(container: HTMLElement) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [FILE] } });
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_IMAGE_BLOB_HOST", "");
  transport.uploadImage.mockReset();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("source proposée d'emblée", () => {
  it("« Photo actuelle » /img : la fenêtre s'ouvre sur l'envoi d'une photo", () => {
    open("/img/products/merguez.jpg");
    expect(screen.getByText("Choisis ou glisse ta photo")).toBeTruthy();
    expect(screen.queryByAltText("source")).toBeNull();
  });

  it("photo de notre magasin Blob : proposée comme source", () => {
    open(PRODUCT_PHOTO);
    expect(screen.getByAltText("source")).toBeTruthy();
    expect(screen.queryByText("Choisis ou glisse ta photo")).toBeNull();
  });
});

describe("photo choisie : envoi commun, puis retouche", () => {
  it("un refus de l'envoi s'affiche en français, la retouche n'est pas demandée", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    transport.uploadImage.mockResolvedValue({
      ok: false,
      messageFr: UPLOAD_MESSAGES_FR.TOO_LARGE_AFTER_COMPRESSION,
    });
    const { container } = open();

    chooseFile(container);
    fireEvent.click(screen.getByRole("button", { name: /Générer 4 versions/ }));

    expect(await screen.findByText(UPLOAD_MESSAGES_FR.TOO_LARGE_AFTER_COMPRESSION)).toBeTruthy();
    expect(transport.uploadImage).toHaveBeenCalledWith(
      FILE,
      "RETOUCH_SOURCE",
      expect.any(Function)
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("l'URL envoyée part à la retouche ; un 504 text/plain donne un message français", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response("An error occurred\n\nFUNCTION_INVOCATION_TIMEOUT", {
          status: 504,
          headers: { "content-type": "text/plain" },
        })
    );
    vi.stubGlobal("fetch", fetchMock);
    transport.uploadImage.mockResolvedValue({
      ok: true,
      result: {
        id: "img1",
        url: UPLOADED,
        thumbUrl: UPLOADED.replace(".webp", "-t.webp"),
        width: 1200,
        height: 900,
      },
    });
    const { container } = open();

    chooseFile(container);
    fireEvent.click(screen.getByRole("button", { name: /Générer 4 versions/ }));

    expect(await screen.findByText(UPLOAD_MESSAGES_FR.TIMEOUT)).toBeTruthy();
    expect(screen.queryByText(/Unexpected token/)).toBeNull();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/boucher/images/retouch");
    expect(JSON.parse(String(init.body))).toMatchObject({
      imageUrl: UPLOADED,
      preset: "CLEAN_BACKGROUND",
      variations: 4,
    });

    // Une seconde demande réutilise la photo déjà envoyée : un seul envoi.
    fireEvent.click(screen.getByRole("button", { name: /Générer 4 versions/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(transport.uploadImage).toHaveBeenCalledTimes(1);
  });
});
