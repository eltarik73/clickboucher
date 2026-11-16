// @vitest-environment node
// Photos du formulaire produit : réducteur pur. Règles A16 (« Photo actuelle »), photo principale,
// plafond de 5, charge utile envoyée au serveur (blocage de l'enregistrement :
// photos-state-blocking.test.ts).
import { describe, expect, it } from "vitest";
import {
  addExistingOutcome,
  initialPhotosState,
  ownCount,
  photosReducer,
  primaryTileKey,
  primaryUrlOf,
  tilesOf,
  toPayload,
  type PhotosAction,
  type PhotosState,
} from "@/components/boucher/photos/photos-state";

const BLOB = "https://nzqbbcqekyom7ajd.public.blob.vercel-storage.com/shops/s1/product";
const UPLOADED = `${BLOB}/0f8fad5b-d9cb-469f-a165-70867728950e.webp`;
const UPLOADED_2 = `${BLOB}/7c9e6679-7425-40de-944b-e07fc1f90ae7.webp`;
const LEGACY = "https://images.unsplash.com/photo-1588168333986-5078d3ae3976";
const CATALOGUE = "/img/products/filet-dinde.jpg";

function file(name = "photo.jpg"): File {
  return new File([new Uint8Array([0xff, 0xd8, 0xff])], name, { type: "image/jpeg" });
}

function run(state: PhotosState, ...actions: PhotosAction[]): PhotosState {
  return actions.reduce(photosReducer, state);
}

function imageUrlOnly(url = LEGACY): PhotosState {
  return initialPhotosState({ initialImages: [], initialImageUrl: url, allowCurrent: true });
}

function empty(): PhotosState {
  return initialPhotosState({ initialImages: [], initialImageUrl: null, allowCurrent: true });
}

/** Choisit une photo : tuile en cours d'envoi, aperçu blob:preview/<nom>. */
function startUpload(state: PhotosState, name = "photo.jpg"): PhotosState {
  const files = [{ file: file(name), previewUrl: `blob:preview/${name}` }];
  return photosReducer(state, { type: "addUploading", files });
}

/** Ajoute une photo envoyée (tuile en cours d'envoi, puis réponse du serveur). */
function uploaded(state: PhotosState, url: string, name = "photo.jpg"): PhotosState {
  const next = startUpload(state, name);
  const key = next.own[next.own.length - 1].key;
  return photosReducer(next, { type: "uploaded", key, url });
}

function keyOfUrl(state: PhotosState, url: string): string {
  const tile = tilesOf(state).find((t) => "url" in t && t.url === url);
  if (!tile) throw new Error(`Aucune tuile pour ${url}`);
  return tile.key;
}

describe("« Photo actuelle » (A16)", () => {
  it("shows Product.imageUrl as a 'current' tile when the product has no ProductImage", () => {
    const state = imageUrlOnly();
    expect(tilesOf(state)).toEqual([{ kind: "current", key: "current", url: LEGACY }]);
    expect(ownCount(state)).toBe(0);
    expect(primaryUrlOf(state)).toBe(LEGACY);
    expect(toPayload(state, "Filet")).toEqual({ images: [] });
  });

  it("has no 'current' tile when the product has its own images, when not allowed or without imageUrl", () => {
    const withImages = initialPhotosState({
      initialImages: [{ url: UPLOADED, alt: "Filet", order: 0, isPrimary: true }],
      initialImageUrl: UPLOADED,
      allowCurrent: true,
    });
    expect(tilesOf(withImages).map((t) => t.kind)).toEqual(["saved"]);
    const reference = initialPhotosState({
      initialImages: [],
      initialImageUrl: CATALOGUE,
      allowCurrent: false,
    });
    expect(tilesOf(reference)).toEqual([]);
    expect(tilesOf(empty())).toEqual([]);
  });

  it("an own photo replaces the 'current' tile from the start of its upload, and becomes the primary", () => {
    expect(tilesOf(startUpload(imageUrlOnly())).map((t) => t.kind)).toEqual(["uploading"]);
    const state = uploaded(imageUrlOnly(), UPLOADED);
    expect(tilesOf(state).map((t) => t.kind)).toEqual(["saved"]);
    expect(toPayload(state, "Filet")).toEqual({
      images: [{ url: UPLOADED, alt: "Filet", order: 0, isPrimary: true }],
    });
  });

  it("removing the 'current' tile alone sends clearImageUrl: true", () => {
    const state = run(imageUrlOnly(), { type: "remove", key: "current" });
    expect(tilesOf(state)).toEqual([]);
    expect(primaryUrlOf(state)).toBeNull();
    expect(toPayload(state, "Filet")).toEqual({ images: [], clearImageUrl: true });
  });

  it("removing the 'current' tile then adding an own photo sends no clearImageUrl", () => {
    const state = uploaded(run(imageUrlOnly(), { type: "remove", key: "current" }), UPLOADED);
    expect(toPayload(state, "Filet")).toEqual({
      images: [{ url: UPLOADED, alt: "Filet", order: 0, isPrimary: true }],
    });
  });

  it("removing the only replacing photo brings « Photo actuelle » back, so the saved product keeps it", () => {
    const replaced = uploaded(imageUrlOnly(), UPLOADED);
    const state = run(replaced, { type: "remove", key: keyOfUrl(replaced, UPLOADED) });
    expect(tilesOf(state)).toEqual([{ kind: "current", key: "current", url: LEGACY }]);
    expect(toPayload(state, "Filet")).toEqual({ images: [] });
  });

  it("a failed replacement that is removed brings « Photo actuelle » back", () => {
    const started = startUpload(imageUrlOnly());
    const key = started.own[0].key;
    const state = run(
      started,
      { type: "failed", key, messageFr: "Photo trop lourde" },
      { type: "remove", key }
    );
    expect(tilesOf(state).map((t) => t.kind)).toEqual(["current"]);
    expect(toPayload(state, "Filet")).toEqual({ images: [] });
  });
});

describe("photo principale", () => {
  it("defaults to the first own tile", () => {
    const state = uploaded(uploaded(empty(), UPLOADED, "a.jpg"), UPLOADED_2, "b.jpg");
    expect(primaryUrlOf(state)).toBe(UPLOADED);
    expect(toPayload(state, "Merguez").images.map((i) => i.isPrimary)).toEqual([true, false]);
  });

  it("setPrimary moves the flag; removing the primary promotes the next one", () => {
    let state = uploaded(uploaded(empty(), UPLOADED, "a.jpg"), UPLOADED_2, "b.jpg");
    state = photosReducer(state, { type: "addExisting", url: CATALOGUE, alt: "Catalogue" });
    state = photosReducer(state, { type: "setPrimary", key: keyOfUrl(state, UPLOADED_2) });
    expect(primaryUrlOf(state)).toBe(UPLOADED_2);
    const flags = toPayload(state, "Merguez").images.map((i) => i.isPrimary);
    expect(flags).toEqual([false, true, false]);

    state = photosReducer(state, { type: "remove", key: keyOfUrl(state, UPLOADED_2) });
    expect(state.primaryKey).toBe(keyOfUrl(state, UPLOADED));
    expect(primaryUrlOf(state)).toBe(UPLOADED);
    state = photosReducer(state, { type: "remove", key: keyOfUrl(state, UPLOADED) });
    expect(primaryUrlOf(state)).toBe(CATALOGUE);
    expect(toPayload(state, "Merguez").images).toEqual([
      { url: CATALOGUE, alt: "Catalogue", order: 0, isPrimary: true },
    ]);
  });

  it("keeps the stored primary and the stored order on edit", () => {
    const state = initialPhotosState({
      initialImages: [
        { url: UPLOADED_2, alt: null, order: 1, isPrimary: true },
        { url: UPLOADED, alt: "Côte", order: 0, isPrimary: false },
      ],
      initialImageUrl: UPLOADED_2,
      allowCurrent: true,
    });
    expect(tilesOf(state).map((t) => ("url" in t ? t.url : null))).toEqual([UPLOADED, UPLOADED_2]);
    expect(primaryUrlOf(state)).toBe(UPLOADED_2);
    expect(toPayload(state, "Côte de bœuf").images).toEqual([
      { url: UPLOADED, alt: "Côte", order: 0, isPrimary: false },
      { url: UPLOADED_2, alt: "Côte de bœuf", order: 1, isPrimary: true },
    ]);
  });

  it("ranks duplicate stored photos like the server: first occurrence kept, then sorted", () => {
    const state = initialPhotosState({
      initialImages: [
        { url: UPLOADED, order: 5 },
        { url: UPLOADED_2, order: 1 },
        { url: UPLOADED, order: 0 },
      ],
      initialImageUrl: null,
      allowCurrent: true,
    });
    expect(tilesOf(state).map((t) => ("url" in t ? t.url : null))).toEqual([UPLOADED_2, UPLOADED]);
    expect(primaryUrlOf(state)).toBe(UPLOADED_2);
  });

  it("is always a saved tile: an upload in progress never takes it, and the payload marks the same tile", () => {
    expect(primaryTileKey(startUpload(empty()))).toBeNull();
    const state = photosReducer(startUpload(empty()), {
      type: "addExisting",
      url: CATALOGUE,
      alt: "",
    });
    expect(tilesOf(state).map((t) => t.kind)).toEqual(["uploading", "saved"]);
    expect(primaryTileKey(state)).toBe(keyOfUrl(state, CATALOGUE));
    expect(toPayload(state, "Merguez").images).toEqual([
      { url: CATALOGUE, alt: "Merguez", order: 0, isPrimary: true },
    ]);
  });

  it("ignores setPrimary on the 'current' tile or a tile still uploading", () => {
    const started = startUpload(empty());
    const withSaved = photosReducer(started, { type: "addExisting", url: CATALOGUE, alt: "" });
    const state = run(withSaved, { type: "setPrimary", key: "current" });
    expect(state).toBe(withSaved);
    expect(run(withSaved, { type: "setPrimary", key: withSaved.own[0].key })).toBe(withSaved);
  });
});

describe("plafond de 5 photos", () => {
  it("never holds more than 5 own tiles, whatever the source", () => {
    let state = empty();
    for (let i = 0; i < 4; i++)
      state = uploaded(state, `${BLOB}/0f8fad5b-d9cb-469f-a165-7086772895${i}e.webp`);
    state = photosReducer(state, {
      type: "addUploading",
      files: [
        { file: file("5.jpg"), previewUrl: "blob:preview/5" },
        { file: file("6.jpg"), previewUrl: "blob:preview/6" },
      ],
    });
    expect(ownCount(state)).toBe(5);
    expect(addExistingOutcome(state, CATALOGUE)).toBe("full");
    expect(run(state, { type: "addExisting", url: CATALOGUE, alt: "" })).toBe(state);
  });

  it("replaceAll keeps at most 5 photos and drops duplicates", () => {
    const state = photosReducer(empty(), {
      type: "replaceAll",
      images: [
        UPLOADED,
        UPLOADED,
        "/img/products/a.jpg",
        "/img/products/b.jpg",
        "/img/products/c.jpg",
        "/img/products/d.jpg",
        "/img/products/e.jpg",
      ].map((url) => ({ url })),
    });
    expect(ownCount(state)).toBe(5);
    expect(new Set(toPayload(state, "x").images.map((i) => i.url)).size).toBe(5);
  });

  it("addExisting reports 'added', then 'duplicate' for a photo already in the list, and ignores it", () => {
    expect(addExistingOutcome(empty(), CATALOGUE)).toBe("added");
    const state = photosReducer(empty(), { type: "addExisting", url: CATALOGUE, alt: "" });
    expect(addExistingOutcome(state, CATALOGUE)).toBe("duplicate");
    expect(photosReducer(state, { type: "addExisting", url: CATALOGUE, alt: "" })).toBe(state);
  });
});

describe("charge utile", () => {
  it("keeps a reference-catalogue /img photo (no URL prefix filter)", () => {
    const state = photosReducer(empty(), {
      type: "replaceAll",
      images: [{ url: CATALOGUE, alt: "Filet de dinde", isPrimary: true }],
    });
    expect(toPayload(state, "Filet de dinde")).toEqual({
      images: [{ url: CATALOGUE, alt: "Filet de dinde", order: 0, isPrimary: true }],
    });
  });

  it("sends saved tiles only, in display order, with the alt fallback chain", () => {
    let state = photosReducer(empty(), { type: "addExisting", url: CATALOGUE, alt: "" });
    state = startUpload(state);
    expect(toPayload(state, "").images).toEqual([
      { url: CATALOGUE, alt: "Produit", order: 0, isPrimary: true },
    ]);
  });

  it("cuts an alt text to the 200 characters the product route accepts", () => {
    const state = photosReducer(empty(), {
      type: "addExisting",
      url: CATALOGUE,
      alt: "a".repeat(260),
    });
    expect(toPayload(state, "Filet").images[0].alt).toHaveLength(200);
  });

  it("replaceAll with photos replaces the 'current' tile; with none keeps it", () => {
    const replaced = photosReducer(imageUrlOnly(), {
      type: "replaceAll",
      images: [{ url: CATALOGUE }],
    });
    expect(tilesOf(replaced).map((t) => t.kind)).toEqual(["saved"]);
    const kept = photosReducer(imageUrlOnly(), { type: "replaceAll", images: [] });
    expect(tilesOf(kept).map((t) => t.kind)).toEqual(["current"]);
  });
});
