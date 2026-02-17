// GET /api/admin/plan-features — List all plan features
// POST /api/admin/plan-features — Create a new plan feature
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, handleApiError } from "@/lib/api/errors";
import { z } from "zod";

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const features = await prisma.planFeature.findMany({
      orderBy: [{ plan: "asc" }, { featureKey: "asc" }],
    });

    return apiSuccess(features);
  } catch (error) {
    return handleApiError(error, "admin/plan-features");
  }
}

const createFeatureSchema = z.object({
  plan: z.enum(["STARTER", "PRO", "PREMIUM"]),
  featureKey: z.string().min(1).max(100),
  featureName: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  enabled: z.boolean().optional().default(true),
});

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const body = await req.json();
    const data = createFeatureSchema.parse(body);

    const feature = await prisma.planFeature.create({ data });

    return apiSuccess(feature, 201);
  } catch (error) {
    return handleApiError(error, "admin/plan-features/create");
  }
}
