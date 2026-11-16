// src/components/boucher/photos/photos-state.ts — État des photos du formulaire produit.
//
// Réducteur pur (aucun DOM, aucun appel réseau) : useProductPhotos le fait tourner, les tests le
// lisent directement. Les tuiles propres (« own ») sont les photos du produit : enregistrées,
// en cours d'envoi ou en échec. La tuile « Photo actuelle » montre Product.imageUrl quand le
// produit n'a aucune ProductImage ; elle n'est pas une photo du produit (A16) :
// - ajouter une photo propre la remplace (à l'enregistrement, le serveur fait de la nouvelle
//   photo principale le miroir Product.imageUrl) ; retirer toutes les photos propres la fait
//   revenir, puisque le produit enregistré la garde ;
// - la retirer envoie clearImageUrl: true, tant qu'aucune photo propre ne la remplace.
// Le serveur reste l'autorité (planProductImageWrite) : ce module ne décide que de l'écran.
import { MAX_PRODUCT_PHOTOS } from "@/lib/images/product-image-write";
import { rankProductPhotos, type RankablePhoto } from "@/lib/images/rank";

const CURRENT_TILE_KEY = "current";

/** Longueur maximale du texte alternatif acceptée par la route produit (productPhotoInputSchema). */
const PHOTO_ALT_MAX = 200;

export type PhotoTile =
  | { kind: "current"; key: string; url: string }
  | { kind: "saved"; key: string; url: string; alt: string }
  | { kind: "uploading"; key: string; previewUrl: string; file: File; progress: number | null }
  | { kind: "failed"; key: string; previewUrl: string; file: File; messageFr: string };

export type OwnTile = Exclude<PhotoTile, { kind: "current" }>;

export interface PhotosPayload {
  images: { url: string; alt: string; order: number; isPrimary: boolean }[];
  clearImageUrl?: true;
}

export interface InitialPhoto extends RankablePhoto {
  alt?: string | null;
}

/** Ce qu'a fait addExisting : photo ajoutée, déjà présente, ou refusée (MAX_PRODUCT_PHOTOS atteint). */
export type AddExistingOutcome = "added" | "full" | "duplicate";

export interface PhotosState {
  /** Photos du produit, dans l'ordre d'affichage (au plus MAX_PRODUCT_PHOTOS). */
  readonly own: readonly OwnTile[];
  /** Principale choisie parmi own, envoyée ou non ; écran et charge utile lisent primaryTileKey. */
  readonly primaryKey: string | null;
  /** Product.imageUrl d'un produit sans ProductImage (tuile « Photo actuelle »), sinon null. */
  readonly currentUrl: string | null;
  /** Le boucher a retiré la tuile « Photo actuelle ». */
  readonly currentRemoved: boolean;
  /** Compteur des clés de tuiles (déterministe, sans hasard). */
  readonly seq: number;
}

export type PhotosAction =
  | {
      type: "init";
      images: readonly InitialPhoto[];
      imageUrl: string | null;
      allowCurrent: boolean;
    }
  | { type: "addUploading"; files: readonly { file: File; previewUrl: string }[] }
  | { type: "progress"; key: string; progress: number | null }
  | { type: "uploaded"; key: string; url: string }
  | { type: "failed"; key: string; messageFr: string }
  | { type: "retry"; key: string }
  | { type: "addExisting"; url: string; alt: string }
  | { type: "replaceAll"; images: readonly InitialPhoto[] }
  | { type: "remove"; key: string }
  | { type: "setPrimary"; key: string };

const EMPTY: PhotosState = {
  own: [],
  primaryKey: null,
  currentUrl: null,
  currentRemoved: false,
  seq: 0,
};

export function initialPhotosState(opts: {
  initialImages: readonly InitialPhoto[];
  initialImageUrl: string | null;
  allowCurrent: boolean;
}): PhotosState {
  return photosReducer(EMPTY, {
    type: "init",
    images: opts.initialImages,
    imageUrl: opts.initialImageUrl,
    allowCurrent: opts.allowCurrent,
  });
}

/** Photos ordered as the server stores them (rankProductPhotos), at most MAX_PRODUCT_PHOTOS. */
function savedTiles(
  images: readonly InitialPhoto[],
  seq: number
): { tiles: OwnTile[]; primaryKey: string | null; seq: number } {
  const { photos, primary } = rankProductPhotos(images);
  const shown = photos.slice(0, MAX_PRODUCT_PHOTOS);
  let next = seq;
  const tiles: OwnTile[] = shown.map((image) => ({
    kind: "saved",
    key: `photo-${++next}`,
    url: image.url,
    alt: image.alt ?? "",
  }));
  const primaryIndex = primary === null ? -1 : shown.indexOf(primary);
  const primaryTile = tiles[primaryIndex === -1 ? 0 : primaryIndex];
  return { tiles, primaryKey: primaryTile ? primaryTile.key : null, seq: next };
}

function withOwn(state: PhotosState, own: readonly OwnTile[]): PhotosState {
  const primaryKey =
    state.primaryKey !== null && own.some((tile) => tile.key === state.primaryKey)
      ? state.primaryKey
      : own.length > 0
        ? own[0].key
        : null;
  return { ...state, own, primaryKey };
}

function updateTile(
  state: PhotosState,
  key: string,
  update: (tile: OwnTile) => OwnTile | null
): PhotosState {
  const tile = state.own.find((candidate) => candidate.key === key);
  if (!tile) return state;
  const next = update(tile);
  if (next === null || next === tile) return state;
  return {
    ...state,
    own: state.own.map((candidate) => (candidate.key === key ? next : candidate)),
  };
}

const percentOf = (ratio: number): number => Math.floor(ratio * 100);

export function photosReducer(state: PhotosState, action: PhotosAction): PhotosState {
  switch (action.type) {
    case "init": {
      const { tiles, primaryKey, seq } = savedTiles(action.images, state.seq);
      const currentUrl =
        action.allowCurrent && tiles.length === 0 && action.imageUrl ? action.imageUrl : null;
      return { own: tiles, primaryKey, currentUrl, currentRemoved: false, seq };
    }
    case "addUploading": {
      const room = MAX_PRODUCT_PHOTOS - state.own.length;
      if (room <= 0 || action.files.length === 0) return state;
      let seq = state.seq;
      const added: OwnTile[] = action.files.slice(0, room).map(({ file, previewUrl }) => ({
        kind: "uploading",
        key: `photo-${++seq}`,
        previewUrl,
        file,
        progress: null,
      }));
      return withOwn({ ...state, seq }, [...state.own, ...added]);
    }
    case "progress": {
      const progress = action.progress === null ? null : Math.min(1, Math.max(0, action.progress));
      return updateTile(state, action.key, (tile) => {
        if (tile.kind !== "uploading") return null;
        const unchanged =
          tile.progress === progress ||
          (tile.progress !== null &&
            progress !== null &&
            percentOf(tile.progress) === percentOf(progress));
        return unchanged ? null : { ...tile, progress };
      });
    }
    case "uploaded":
      return updateTile(state, action.key, (tile) =>
        tile.kind === "uploading"
          ? { kind: "saved", key: tile.key, url: action.url, alt: "" }
          : null
      );
    case "failed":
      return updateTile(state, action.key, (tile) =>
        tile.kind === "uploading"
          ? {
              kind: "failed",
              key: tile.key,
              previewUrl: tile.previewUrl,
              file: tile.file,
              messageFr: action.messageFr,
            }
          : null
      );
    case "retry":
      return updateTile(state, action.key, (tile) =>
        tile.kind === "failed"
          ? {
              kind: "uploading",
              key: tile.key,
              previewUrl: tile.previewUrl,
              file: tile.file,
              progress: null,
            }
          : null
      );
    case "addExisting": {
      if (addExistingOutcome(state, action.url) !== "added") return state;
      const seq = state.seq + 1;
      const tile: OwnTile = {
        kind: "saved",
        key: `photo-${seq}`,
        url: action.url,
        alt: action.alt,
      };
      return withOwn({ ...state, seq }, [...state.own, tile]);
    }
    case "replaceAll": {
      const { tiles, primaryKey, seq } = savedTiles(action.images, state.seq);
      return { ...state, own: tiles, primaryKey, seq };
    }
    case "remove":
      if (action.key === CURRENT_TILE_KEY) {
        return currentVisible(state) ? { ...state, currentRemoved: true } : state;
      }
      if (!state.own.some((tile) => tile.key === action.key)) return state;
      return withOwn(
        state,
        state.own.filter((tile) => tile.key !== action.key)
      );
    case "setPrimary": {
      const target = state.own.find((tile) => tile.key === action.key);
      if (!target || target.kind !== "saved" || state.primaryKey === action.key) return state;
      return { ...state, primaryKey: action.key };
    }
  }
}

/** Issue d'un addExisting sur cet état ; le réducteur n'ajoute la photo que pour « added ». */
export function addExistingOutcome(state: PhotosState, url: string): AddExistingOutcome {
  if (state.own.some((tile) => tile.kind === "saved" && tile.url === url)) return "duplicate";
  return state.own.length >= MAX_PRODUCT_PHOTOS ? "full" : "added";
}

function currentVisible(state: PhotosState): boolean {
  return state.currentUrl !== null && !state.currentRemoved && state.own.length === 0;
}

/** Tuiles affichées : « Photo actuelle » (quand elle a lieu d'être), puis les photos du produit. */
export function tilesOf(state: PhotosState): readonly PhotoTile[] {
  if (currentVisible(state) && state.currentUrl !== null) {
    return [{ kind: "current", key: CURRENT_TILE_KEY, url: state.currentUrl }];
  }
  return state.own;
}

export function ownCount(state: PhotosState): number {
  return state.own.length;
}

/** Une photo est en cours d'envoi ou en échec : l'enregistrement doit attendre. */
export function isBlocking(state: PhotosState): boolean {
  return state.own.some((tile) => tile.kind === "uploading" || tile.kind === "failed");
}

function savedOf(state: PhotosState): Extract<OwnTile, { kind: "saved" }>[] {
  return state.own.filter(
    (tile): tile is Extract<OwnTile, { kind: "saved" }> => tile.kind === "saved"
  );
}

/**
 * Seule règle de la photo principale, pour l'écran (« Principale ») et toPayload (isPrimary) : la
 * choisie si elle est envoyée, sinon la première envoyée, jamais une photo en cours ou en échec.
 */
export function primaryTileKey(state: PhotosState): string | null {
  const saved = savedOf(state);
  if (saved.some((tile) => tile.key === state.primaryKey)) return state.primaryKey;
  return saved.length > 0 ? saved[0].key : null;
}

/** URL de la photo que verra le client : la principale enregistrée, sinon « Photo actuelle ». */
export function primaryUrlOf(state: PhotosState): string | null {
  const key = primaryTileKey(state);
  const primary = savedOf(state).find((tile) => tile.key === key);
  if (primary) return primary.url;
  return currentVisible(state) ? state.currentUrl : null;
}

/** Corps « images » (et « clearImageUrl ») de POST / PATCH /api/products. */
export function toPayload(state: PhotosState, productName: string): PhotosPayload {
  const primaryKey = primaryTileKey(state);
  const images = savedOf(state).map((tile, order) => ({
    url: tile.url,
    alt: (tile.alt || productName || "Produit").slice(0, PHOTO_ALT_MAX),
    order,
    isPrimary: tile.key === primaryKey,
  }));
  return state.currentRemoved && images.length === 0 ? { images, clearImageUrl: true } : { images };
}
