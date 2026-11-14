// POST /api/uploads/image — Envoi d'une photo (formulaires produit, source de retouche, catalogue
// de référence). Multipart : « file » et « purpose » (contrat : src/lib/images/upload-contract.ts).
// Aucun identifiant de produit : la photo appartient à la boutique de la session (ou à la
// plateforme pour REFERENCE), le produit la reçoit à l'enregistrement du formulaire.
//
// 200 { id, url, thumbUrl, width, height } · 400 formulaire · 401 · 403/404 (helpers d'accès)
// · 422 IMAGE_REJECTED · 429 quota (30 par heure) · 503 stockage indisponible.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/errors";
import { getServerUserId } from "@/lib/auth/server-auth";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import { ImageRejectedError, StoreUnavailableError } from "@/lib/images/errors";
import { persistImage, type ImageOwner } from "@/lib/images/ingest";
import {
  checkUploadQuota,
  UPLOAD_REGISTRY_MODEL,
  uploadQuotaExceeded,
} from "@/lib/images/upload-quota";
import {
  parseUploadForm,
  REGISTRY_USAGE_BY_PURPOSE,
  UPLOAD_MAX_BYTES,
  UPLOAD_MESSAGES_FR,
  type UploadPurpose,
} from "@/lib/images/upload-contract";

/** Marge du multipart autour de la photo (en-têtes des parties, champ purpose). */
const FORM_OVERHEAD_BYTES = 64 * 1024;

/** Propriétaire de la photo selon le type d'envoi, ou la réponse de refus du helper d'accès. */
async function resolveOwner(purpose: UploadPurpose): Promise<{ owner: ImageOwner } | { error: Response }> {
  if (purpose === "REFERENCE") {
    const admin = await requireAdmin();
    if (admin.error) return { error: admin.error };
    return { owner: { shopId: null, createdBy: admin.userId } };
  }
  const boucher = await getAuthenticatedBoucher();
  if (boucher.error) return { error: boucher.error };
  return { owner: { shopId: boucher.shopId, createdBy: boucher.userId } };
}

export async function POST(req: NextRequest) {
  try {
    const clerkId = await getServerUserId();
    if (!clerkId) return apiError("UNAUTHORIZED", "Authentification requise");

    if (Number(req.headers.get("content-length")) > UPLOAD_MAX_BYTES + FORM_OVERHEAD_BYTES) {
      return apiError("IMAGE_REJECTED", UPLOAD_MESSAGES_FR.TOO_LARGE);
    }

    // Un corps qui n'est pas un formulaire multipart est une erreur de l'appelant : 400.
    const form = await req.formData().catch(() => null);
    if (form === null) return apiError("VALIDATION_ERROR", UPLOAD_MESSAGES_FR.NO_FILE);
    const parsed = parseUploadForm(form);
    if (!parsed.ok) return apiError("VALIDATION_ERROR", parsed.messageFr);

    const scope = await resolveOwner(parsed.purpose);
    if ("error" in scope) return scope.error;

    const quota = await checkUploadQuota(scope.owner);
    if (!quota.allowed) return uploadQuotaExceeded(quota.retryAfterMinutes);

    const result = await persistImage({
      bytes: new Uint8Array(await parsed.file.arrayBuffer()),
      owner: scope.owner,
      registry: { model: UPLOAD_REGISTRY_MODEL, prompt: "", usage: REGISTRY_USAGE_BY_PURPOSE[parsed.purpose] },
      maxBytes: UPLOAD_MAX_BYTES,
      folder: parsed.purpose,
    });
    return apiSuccess(result);
  } catch (error) {
    if (error instanceof ImageRejectedError) return apiError("IMAGE_REJECTED", error.messageFr);
    if (error instanceof StoreUnavailableError) return apiError("SERVICE_DISABLED", error.messageFr);
    return handleApiError(error, "uploads/image");
  }
}
