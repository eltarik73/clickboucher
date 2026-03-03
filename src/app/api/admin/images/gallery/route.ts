// GET /api/admin/images/gallery — Webmaster gallery (all images)
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, handleApiError } from "@/lib/api/errors";

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const usage = req.nextUrl.searchParams.get("usage");
    const shopId = req.nextUrl.searchParams.get("shopId");

    const images = await prisma.generatedImage.findMany({
      where: {
        ...(usage ? { usage } : {}),
        ...(shopId ? { shopId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return apiSuccess(images);
  } catch (err) {
    return handleApiError(err, "admin/images/gallery");
  }
}
