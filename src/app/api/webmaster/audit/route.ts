import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, handleApiError } from "@/lib/api/errors";
import { queryAuditLogs } from "@/lib/audit-log";
import { wmAuditLogQuerySchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const { searchParams } = new URL(request.url);
    const query = wmAuditLogQuerySchema.parse({
      actorId: searchParams.get("actorId") || undefined,
      action: searchParams.get("action") || undefined,
      target: searchParams.get("target") || undefined,
      from: searchParams.get("from") || undefined,
      to: searchParams.get("to") || undefined,
      page: searchParams.get("page") || undefined,
      perPage: searchParams.get("perPage") || undefined,
    });

    const result = await queryAuditLogs({
      ...query,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });

    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error, "webmaster/audit");
  }
}
