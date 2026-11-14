// src/lib/images/upload-contract.ts — Contrat de l'envoi de photo, partagé par le navigateur,
// la route POST /api/uploads/image et les tests.
//
// Module pur. Le formulaire est construit par buildUploadForm et lu par parseUploadForm :
// un seul schéma, de sorte qu'un écart entre le client et la route fasse échouer les tests.
// Les plafonds sont ici : le client n'envoie jamais plus de UPLOAD_MAX_BYTES (Vercel refuse
// un corps de plus de 4,5 Mo avant même d'appeler la route) et le serveur applique le même.
import { z } from "zod";

export const UPLOAD_ENDPOINT = "/api/uploads/image";
export const UPLOAD_MAX_BYTES = 4 * 1024 * 1024;
export const UPLOAD_RETRY_ABOVE_BYTES = 3.5 * 1024 * 1024;
export const IMAGE_MAX_SIDE = 2048;
export const THUMB_MAX_SIDE = 400;
export const UPLOADS_PER_HOUR = 30;

export const UPLOAD_PURPOSES = ["PRODUCT", "RETOUCH_SOURCE", "REFERENCE"] as const;
export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number];

/** Valeur de generated_images.usage pour chaque type d'envoi. */
export const REGISTRY_USAGE_BY_PURPOSE: Readonly<Record<UploadPurpose, string>> = {
  PRODUCT: "PRODUCT",
  RETOUCH_SOURCE: "RETOUCH_SOURCE",
  REFERENCE: "PRODUCT",
};

export const UPLOAD_FORM_FIELDS = { file: "file", purpose: "purpose" } as const;

export const UPLOAD_MESSAGES_FR = {
  TOO_LARGE: "Photo trop lourde : 4 Mo maximum. Choisissez une photo plus légère.",
  TOO_LARGE_AFTER_COMPRESSION:
    "Photo trop lourde, même après compression (4 Mo maximum). Choisissez une autre photo.",
  UNSUPPORTED_FORMAT: "Format non pris en charge. Envoyez une photo JPEG, PNG, WebP, GIF ou AVIF.",
  HEIC:
    "Les photos HEIC ne sont pas prises en charge. Sur iPhone : Réglages > Appareil photo > Formats > « Le plus compatible », puis reprenez la photo, ou envoyez-la en JPEG.",
  CORRUPT: "Le fichier image est incomplet ou abîmé. Reprenez la photo ou choisissez-en une autre.",
  TOO_MANY_PIXELS: "Photo trop grande (50 mégapixels maximum).",
  STORE_UNAVAILABLE:
    "Le stockage des photos est momentanément indisponible. Réessayez dans quelques minutes.",
  QUOTA: (minutes: number): string =>
    `Limite atteinte : ${UPLOADS_PER_HOUR} photos par heure. Réessayez dans ${minutes} min.`,
  NETWORK: "Connexion interrompue pendant l'envoi. Vérifiez votre connexion puis réessayez.",
  HTTP_413: "Photo trop lourde pour être envoyée (4 Mo maximum).",
  TIMEOUT: "Le serveur n'a pas répondu à temps. Réessayez.",
  SESSION: "Votre session a expiré : reconnectez-vous puis réessayez.",
  UNEXPECTED: "Réponse inattendue du serveur. Réessayez.",
  GENERIC: (status: number): string => `L'envoi a échoué (erreur ${status}). Réessayez.`,
  NO_FILE: "Aucune photo reçue.",
  BAD_PURPOSE: "Type d'envoi inconnu.",
} as const;

/** Formulaire multipart de l'envoi : la photo sous « file » (avec son nom), le type sous « purpose ». */
export function buildUploadForm(file: Blob, purpose: UploadPurpose, filename = "photo.jpg"): FormData {
  const form = new FormData();
  form.append(UPLOAD_FORM_FIELDS.file, file, filename);
  form.append(UPLOAD_FORM_FIELDS.purpose, purpose);
  return form;
}

const uploadFormSchema = z.object({
  file: z.custom<Blob>((value) => typeof Blob !== "undefined" && value instanceof Blob, {
    message: UPLOAD_MESSAGES_FR.NO_FILE,
  }),
  purpose: z.enum(UPLOAD_PURPOSES, { message: UPLOAD_MESSAGES_FR.BAD_PURPOSE }),
});

export type ParsedUploadForm =
  | { ok: true; purpose: UploadPurpose; file: Blob }
  | { ok: false; messageFr: string };

/** Lit le formulaire reçu. Ne contrôle pas la taille : persistImage applique le plafond. */
export function parseUploadForm(form: FormData): ParsedUploadForm {
  const parsed = uploadFormSchema.safeParse({
    file: form.get(UPLOAD_FORM_FIELDS.file),
    purpose: form.get(UPLOAD_FORM_FIELDS.purpose),
  });
  if (!parsed.success) return { ok: false, messageFr: parsed.error.issues[0].message };
  return { ok: true, purpose: parsed.data.purpose, file: parsed.data.file };
}

export const uploadResultSchema = z.object({
  id: z.string().min(1),
  url: z.string().min(1),
  thumbUrl: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
export type UploadResult = z.infer<typeof uploadResultSchema>;
