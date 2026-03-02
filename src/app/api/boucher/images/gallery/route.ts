// GET /api/boucher/images/gallery — Boucher gallery (shop-scoped)
import { NextRequest } from "next/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import { apiSuccess, handleApiError } from "@/lib/api/errors";
import { listImages, type ImageUsage } from "@/lib/image-generation";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthenticatedBoucher();
    if (auth.error) return auth.error;

    const usage = req.nextUrl.searchParams.get("usage") as ImageUsage | null;

    const images = await listImages({
      shopId: auth.shopId,
      usage: usage || undefined,
      limit: 50,
    });

    return apiSuccess(images);
  } catch (err) {
    return handleApiError(err, "boucher/images/gallery");
  }
}
