// src/components/boucher/photos/retouch-request.ts — Demande de retouche depuis le navigateur.
//
// La photo source n'est jamais envoyée à la route de retouche : elle passe d'abord par
// POST /api/uploads/image (uploadImage(…, "RETOUCH_SOURCE"), upload-transport.ts : réduite à 4 Mo au
// plus, vérifiée et réencodée par le serveur), puis la retouche reçoit son URL. La réponse est lue comme celle d'un
// envoi (interpretApiResponse) : un 504 text/plain de Vercel donne un message français.
import { z } from "zod";
import { classifyImageUrl } from "@/lib/images/durable-url";
import { UPLOAD_MESSAGES_FR } from "@/lib/images/upload-contract";
import { interpretApiResponse, type ApiOutcome } from "./upload-transport";

export const RETOUCH_ENDPOINT = "/api/boucher/images/retouch";

export const retouchResultSchema = z.object({
  originalUrl: z.string().min(1),
  images: z.array(z.object({ id: z.string().min(1), url: z.string().min(1) })),
});
export type RetouchResult = z.infer<typeof retouchResultSchema>;
export type RetouchOutcome = ApiOutcome<RetouchResult>;

export interface RetouchRequest {
  /** URL de la photo source sur notre magasin (rendue par l'envoi, ou photo du produit). */
  sourceUrl: string;
  preset: string;
  variations: number;
  usage: "PRODUCT" | "CAMPAIGN" | "BANNER";
  customPrompt?: string;
}

/**
 * Photo du produit proposée d'emblée comme source de retouche : seulement un fichier de notre
 * magasin Blob (URL absolue que le fournisseur sait lire). Une photo du site (/img/...), un fichier
 * du magasin local ou une photo historique d'un autre hôte : aucune, la fenêtre s'ouvre sur l'envoi.
 */
export function retouchSourceUrl(url: string | null | undefined): string | undefined {
  if (typeof url !== "string") return undefined;
  return classifyImageUrl(url) === "BLOB" ? url : undefined;
}

export function interpretRetouchResponse(
  status: number,
  contentType: string | null,
  bodyText: string
): RetouchOutcome {
  return interpretApiResponse(status, contentType, bodyText, retouchResultSchema);
}

/** Envoie la demande de retouche. La promesse ne rejette jamais : toute issue est affichable. */
export async function requestRetouch(
  request: RetouchRequest,
  origin: string
): Promise<RetouchOutcome> {
  const body = JSON.stringify({
    // La route attend une URL absolue : celle du magasin local (/local-images/...) est relative.
    imageUrl: new URL(request.sourceUrl, origin).href,
    preset: request.preset,
    variations: request.variations,
    usage: request.usage,
    customPrompt: request.customPrompt,
  });
  try {
    const response = await fetch(RETOUCH_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const bodyText = await response.text();
    return interpretRetouchResponse(
      response.status,
      response.headers.get("content-type"),
      bodyText
    );
  } catch {
    // fetch ou la lecture du corps n'aboutit pas : connexion coupée.
    return { ok: false, messageFr: UPLOAD_MESSAGES_FR.NETWORK };
  }
}
