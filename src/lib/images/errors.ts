// src/lib/images/errors.ts — Les deux échecs de l'enregistrement d'une image, avec leur message.
//
// ImageRejectedError : le fichier lui-même est refusé (trop lourd, format, HEIC, abîmé, trop de
// pixels). C'est une erreur de l'utilisateur : 422, message français, jamais journalisée en erreur.
// StoreUnavailableError : le stockage ne répond pas ou n'est pas configuré. C'est notre panne :
// 503, journalisée là où elle se produit (store.ts, ingest.ts).
import { UPLOAD_MESSAGES_FR } from "./upload-contract";

export type ImageRejectionReason =
  | "TOO_LARGE"
  | "UNSUPPORTED_FORMAT"
  | "HEIC"
  | "CORRUPT"
  | "TOO_MANY_PIXELS";

export class ImageRejectedError extends Error {
  readonly messageFr: string;

  constructor(readonly reason: ImageRejectionReason) {
    super(`Image refusée (${reason})`);
    this.name = "ImageRejectedError";
    this.messageFr = UPLOAD_MESSAGES_FR[reason];
  }
}

export class StoreUnavailableError extends Error {
  readonly messageFr: string = UPLOAD_MESSAGES_FR.STORE_UNAVAILABLE;

  constructor(cause?: unknown) {
    super("Stockage des images indisponible", cause === undefined ? undefined : { cause });
    this.name = "StoreUnavailableError";
  }
}
