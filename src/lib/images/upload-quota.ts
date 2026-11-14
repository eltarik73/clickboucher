// src/lib/images/upload-quota.ts — 30 photos envoyées par heure : par boutique, ou par
// administrateur pour les photos de la plateforme.
//
// Compté dans PostgreSQL sur les lignes de generated_images écrites par un envoi
// (model = UPLOAD_REGISTRY_MODEL), parce que la production n'a pas de Redis (la limite Upstash y
// laisse tout passer). Sans verrou : deux envois simultanés peuvent dépasser d'une ou deux photos,
// ce qui est acceptable pour une opération qui ne coûte rien à l'appel.
import type { Prisma } from "@prisma/client";
import { apiError } from "@/lib/api/errors";
import prisma from "@/lib/prisma";
import type { ImageOwner } from "./ingest";
import { UPLOAD_MESSAGES_FR, UPLOADS_PER_HOUR } from "./upload-contract";

/** Valeur de generated_images.model pour une photo envoyée (formulaire produit, source de retouche). */
export const UPLOAD_REGISTRY_MODEL = "UPLOAD";

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

export type QuotaDecision = { allowed: true } | { allowed: false; retryAfterMinutes: number };

function ownerScope(owner: ImageOwner): Prisma.GeneratedImageWhereInput {
  return owner.shopId !== null
    ? { shopId: owner.shopId }
    : { shopId: null, createdBy: owner.createdBy };
}

export async function checkUploadQuota(owner: ImageOwner, now: Date = new Date()): Promise<QuotaDecision> {
  const recent = await prisma.generatedImage.findMany({
    where: {
      model: UPLOAD_REGISTRY_MODEL,
      createdAt: { gt: new Date(now.getTime() - HOUR_MS) },
      ...ownerScope(owner),
    },
    select: { createdAt: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: UPLOADS_PER_HOUR,
  });
  if (recent.length < UPLOADS_PER_HOUR) return { allowed: true };
  // Une place se libère quand la 30e photo la plus récente sort de la fenêtre d'une heure.
  const freedAt = recent[UPLOADS_PER_HOUR - 1].createdAt.getTime() + HOUR_MS;
  return { allowed: false, retryAfterMinutes: Math.max(1, Math.ceil((freedAt - now.getTime()) / MINUTE_MS)) };
}

/** Réponse 429 d'un envoi refusé par le quota : message français et Retry-After en secondes. */
export function uploadQuotaExceeded(retryAfterMinutes: number): Response {
  const response = apiError("RATE_LIMITED", UPLOAD_MESSAGES_FR.QUOTA(retryAfterMinutes));
  response.headers.set("Retry-After", String(retryAfterMinutes * (MINUTE_MS / 1000)));
  return response;
}
