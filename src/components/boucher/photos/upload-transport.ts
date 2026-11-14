// src/components/boucher/photos/upload-transport.ts — Envoi d'une photo à POST /api/uploads/image.
//
// XMLHttpRequest plutôt que fetch : lui seul donne la progression de l'envoi.
// interpretApiResponse (pure) transforme toute réponse d'une route photo en issue affichable : le
// corps n'est lu comme JSON que si le serveur le déclare et qu'il se lit ; un 413 ou un 504
// text/plain de Vercel, une page HTML ou une coupure réseau donnent un message français, jamais
// « Unexpected token ». interpretUploadResponse l'applique à la réponse d'un envoi.
import type { z } from "zod";
import {
  buildUploadForm,
  UPLOAD_ENDPOINT,
  UPLOAD_MAX_BYTES,
  UPLOAD_MESSAGES_FR,
  uploadResultSchema,
  type UploadPurpose,
  type UploadResult,
} from "@/lib/images/upload-contract";

export type ApiOutcome<T> = { ok: true; result: T } | { ok: false; messageFr: string };
export type UploadOutcome = ApiOutcome<UploadResult>;

const failure = (messageFr: string): { ok: false; messageFr: string } => ({ ok: false, messageFr });

/** Le corps JSON, ou undefined quand le type annoncé n'est pas JSON ou que le texte ne se lit pas. */
function jsonBody(contentType: string | null, bodyText: string): unknown {
  if (contentType === null || !/[/+]json\b/i.test(contentType)) return undefined;
  try {
    return JSON.parse(bodyText) as unknown;
  } catch {
    // Corps tronqué ou mal formé : traité comme une réponse non JSON, selon son statut.
    return undefined;
  }
}

function field(value: unknown, name: string): unknown {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)[name]
    : undefined;
}

/** error.message de l'enveloppe { success: false, error: { code, message } } de src/lib/api/errors.ts. */
function serverMessage(body: unknown): string | null {
  const message = field(field(body, "error"), "message");
  return typeof message === "string" && message.trim() !== "" ? message : null;
}

/** Issue d'une réponse { success, data | error } : `data` lu par `dataSchema`, ou un message français. */
export function interpretApiResponse<T>(
  status: number,
  contentType: string | null,
  bodyText: string,
  dataSchema: z.ZodType<T>
): ApiOutcome<T> {
  if (status === 0) return failure(UPLOAD_MESSAGES_FR.NETWORK);
  const body = jsonBody(contentType, bodyText);
  if (status >= 200 && status < 300) {
    const parsed = dataSchema.safeParse(field(body, "data"));
    return parsed.success
      ? { ok: true, result: parsed.data }
      : failure(UPLOAD_MESSAGES_FR.UNEXPECTED);
  }
  // Une session absente ou expirée se règle en se reconnectant, quel que soit le texte du serveur.
  if (status === 401) return failure(UPLOAD_MESSAGES_FR.SESSION);
  const fromServer = serverMessage(body);
  if (fromServer !== null) return failure(fromServer);
  if (status === 413) return failure(UPLOAD_MESSAGES_FR.HTTP_413);
  if (status === 502 || status === 503 || status === 504)
    return failure(UPLOAD_MESSAGES_FR.TIMEOUT);
  if (status === 403) return failure(UPLOAD_MESSAGES_FR.SESSION);
  return failure(UPLOAD_MESSAGES_FR.GENERIC(status));
}

export function interpretUploadResponse(
  status: number,
  contentType: string | null,
  bodyText: string
): UploadOutcome {
  return interpretApiResponse(status, contentType, bodyText, uploadResultSchema);
}

/**
 * Envoie la photo préparée. La promesse ne rejette jamais : toute réponse, et toute coupure,
 * devient une UploadOutcome. Lève une RangeError, avant toute requête, au-delà de UPLOAD_MAX_BYTES :
 * prepareUpload ne doit jamais produire un tel fichier.
 */
export function sendUpload(
  blob: Blob,
  filename: string,
  purpose: UploadPurpose,
  onProgress: (ratio: number) => void
): Promise<UploadOutcome> {
  if (blob.size > UPLOAD_MAX_BYTES) {
    throw new RangeError(
      `Photo de ${blob.size} octets : le plafond d'envoi est de ${UPLOAD_MAX_BYTES} octets.`
    );
  }
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", UPLOAD_ENDPOINT);
    xhr.responseType = "text";
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0)
        onProgress(Math.min(1, event.loaded / event.total));
    };
    xhr.onload = () =>
      resolve(
        interpretUploadResponse(xhr.status, xhr.getResponseHeader("content-type"), xhr.responseText)
      );
    xhr.onerror = () => resolve(failure(UPLOAD_MESSAGES_FR.NETWORK));
    xhr.onabort = () => resolve(failure(UPLOAD_MESSAGES_FR.NETWORK));
    xhr.send(buildUploadForm(blob, purpose, filename));
  });
}
