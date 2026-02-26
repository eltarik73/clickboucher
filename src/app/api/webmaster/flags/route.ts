import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, handleApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const flags = await prisma.featureFlag.findMany({
      orderBy: { key: "asc" },
    });

    return apiSuccess(flags);
  } catch (error) {
    return handleApiError(error, "webmaster/flags");
  }
}
