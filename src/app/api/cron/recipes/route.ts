// src/app/api/cron/recipes/route.ts — Trigger daily recipe generation
import { NextRequest } from "next/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { generateDailyRecipe } from "@/lib/recipe-generator";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    // Vérifier le secret pour sécuriser l'endpoint
    const secret = req.headers.get("x-cron-secret") || req.headers.get("authorization")?.replace("Bearer ", "");
    if (secret !== process.env.CRON_SECRET) {
      return apiError("UNAUTHORIZED", "Invalid cron secret");
    }

    const recipe = await generateDailyRecipe();
    return apiSuccess({ title: recipe.title, slug: recipe.slug });
  } catch (error) {
    return handleApiError(error, "cron-recipes");
  }
}
