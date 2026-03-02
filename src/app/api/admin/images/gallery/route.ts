// GET /api/admin/images/gallery — Webmaster gallery (all images)
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, handleApiError } from "@/lib/api/errors";
import { listImages, type ImageUsage } from "@/lib/image-generation";

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const usage = req.nextUrl.searchParams.get("usage") as ImageUsage | null;
    const shopId = req.nextUrl.searchParams.get("shopId");

    const images = await listImages({
      usage: usage || undefined,
      shopId: shopId || undefined,
      limit: 100,
    });

    return apiSuccess(images);
  } catch (err) {
    return handleApiError(err, "admin/images/gallery");
  }
}
