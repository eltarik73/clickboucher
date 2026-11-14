// @vitest-environment node
// Photos du formulaire produit : une photo en cours d'envoi ou en échec bloque l'enregistrement ;
// « Réessayer » renvoie le même fichier ; les événements d'une tuile retirée sont ignorés.
import { describe, expect, it } from "vitest";
import {
  initialPhotosState,
  isBlocking,
  photosReducer,
  tilesOf,
  type PhotosAction,
  type PhotosState,
} from "@/components/boucher/photos/photos-state";

const UPLOADED =
  "https://nzqbbcqekyom7ajd.public.blob.vercel-storage.com/shops/s1/product/0f8fad5b-d9cb-469f-a165-70867728950e.webp";

function run(state: PhotosState, ...actions: PhotosAction[]): PhotosState {
  return actions.reduce(photosReducer, state);
}

function startOne(): { state: PhotosState; key: string } {
  const base = initialPhotosState({ initialImages: [], initialImageUrl: null, allowCurrent: true });
  const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], "photo.jpg", { type: "image/jpeg" });
  const state = photosReducer(base, {
    type: "addUploading",
    files: [{ file, previewUrl: "blob:preview/photo.jpg" }],
  });
  return { state, key: state.own[state.own.length - 1].key };
}

describe("blocage de l'enregistrement", () => {
  it("is blocking while a tile is uploading (not retryable), and not after the upload succeeds", () => {
    const { state, key } = startOne();
    expect(isBlocking(state)).toBe(true);
    expect(run(state, { type: "retry", key })).toBe(state);
    expect(isBlocking(run(state, { type: "uploaded", key, url: UPLOADED }))).toBe(false);
  });

  it("is blocking with a failed tile, and not after a successful retry or a removal", () => {
    const { state: started, key } = startOne();
    const failed = run(started, { type: "failed", key, messageFr: "Erreur" });
    expect(isBlocking(failed)).toBe(true);
    expect(tilesOf(failed)[0]).toMatchObject({ kind: "failed", messageFr: "Erreur" });

    const retried = run(failed, { type: "retry", key });
    expect(tilesOf(retried)[0]).toMatchObject({
      kind: "uploading",
      progress: null,
      previewUrl: "blob:preview/photo.jpg",
    });
    expect((tilesOf(retried)[0] as { file: File }).file).toBe(
      (tilesOf(failed)[0] as { file: File }).file
    );
    expect(isBlocking(retried)).toBe(true);
    expect(isBlocking(run(retried, { type: "uploaded", key, url: UPLOADED }))).toBe(false);
    expect(isBlocking(run(failed, { type: "remove", key }))).toBe(false);
  });

  it("records upload progress, and ignores events for a tile that is gone", () => {
    const { state, key } = startOne();
    const halfway = run(state, { type: "progress", key, progress: 0.456 });
    expect(tilesOf(halfway)[0]).toMatchObject({ kind: "uploading", progress: 0.456 });
    expect(run(halfway, { type: "progress", key, progress: 0.4561 })).toBe(halfway);
    const removed = run(halfway, { type: "remove", key });
    expect(run(removed, { type: "uploaded", key, url: UPLOADED })).toBe(removed);
    expect(run(removed, { type: "failed", key, messageFr: "x" })).toBe(removed);
  });
});
