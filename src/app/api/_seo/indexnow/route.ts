// POST /api/_seo/indexnow — admin-only manual IndexNow ping
// Body: { urls: string[] }
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, handleApiError } from "@/lib/api/errors";
import { notifyIndexNow } from "@/lib/indexnow";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  urls: z.array(z.string().url()).min(1).max(10000),
});

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const body = await req.json();
    const { urls } = schema.parse(body);

    await notifyIndexNow(urls);
    return apiSuccess({ submitted: urls.length });
  } catch (error) {
    return handleApiError(error, "_seo/indexnow");
  }
}

