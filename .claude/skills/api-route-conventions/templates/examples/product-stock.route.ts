// Modèle : src/app/api/products/[id]/stock/route.ts après migration MÉCANIQUE (logique inchangée).
// Avant : 57 lignes, try/catch, auth, req.json() et parse à la main. Voir references/migration.md.
// Deux écarts assumés avec l'original, à dire dans la PR (migration.md § 4) : la validation passe
// avant la lecture du produit, et `rateLimit: "api"` ajoute une limite (30/min par boutique) qui
// n'existait pas — à retirer de la config si la PR doit rester strictement sans effet.
import prisma from "@/lib/prisma";
import { z } from "zod";
import { toggleStockSchema } from "@/lib/validators";
import { apiError, apiSuccess } from "@/lib/api/errors";
import { boucherRoute } from "@/lib/api/route-auth";

// La config de segment reste dans le route.ts : Next la lit statiquement.
export const dynamic = "force-dynamic";

// Un route.ts n'exporte QUE des méthodes HTTP et la config de segment : ce schéma n'est pas exporté.
const paramsSchema = z.object({ id: z.string().min(1).max(64) });

// ── PATCH /api/products/[id]/stock — boucher propriétaire : bascule de stock ──
export const PATCH = boucherRoute(
  { name: "products/stock", rateLimit: "api", params: paramsSchema, body: toggleStockSchema },
  async ({ auth, params, body }) => {
    const product = await prisma.product.findUnique({
      where: { id: params.id },
      select: { shopId: true },
    });
    if (!product) return apiError("NOT_FOUND", "Produit introuvable");
    if (product.shopId !== auth.shopId) {
      return apiError("FORBIDDEN", "Vous n'êtes pas propriétaire de cette boucherie");
    }

    const updated = await prisma.product.update({
      where: { id: params.id },
      data: {
        ...(body.inStock !== undefined && { inStock: body.inStock }),
        ...(body.stockQty !== undefined && {
          stockQty: body.stockQty,
          ...(body.inStock === undefined && { inStock: body.stockQty > 0 }),
        }),
      },
      select: { id: true, name: true, inStock: true, stockQty: true },
    });

    return apiSuccess(updated);
  }
);
