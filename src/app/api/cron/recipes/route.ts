// src/app/api/cron/recipes/route.ts — Trigger daily recipe generation
import { NextRequest } from "next/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { generateDailyRecipe } from "@/lib/recipe-generator";
import { verifyCronAuth } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    if (!verifyCronAuth(req)) return apiError("UNAUTHORIZED", "Invalid cron secret");

    const recipe = await generateDailyRecipe();
    return apiSuccess({ title: recipe.title, slug: recipe.slug });
  } catch (error) {
    return handleApiError(error, "cron-recipes");
  }
}
