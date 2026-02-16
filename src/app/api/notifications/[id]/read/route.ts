import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { getOrCreateUser } from "@/lib/get-or-create-user";

export const dynamic = "force-dynamic";

// ── PATCH /api/notifications/[id]/read ───────
export async function PATCH(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    const user = await getOrCreateUser(userId);
    if (!user) {
      return apiError("NOT_FOUND", "Utilisateur introuvable");
    }

    const { id } = params;

    // Mark all as read
    if (id === "all") {
      await prisma.notification.updateMany({
        where: { userId: user.id, read: false },
        data: { read: true },
      });
      return apiSuccess({ marked: "all" });
    }

    // Mark single notification
    const notif = await prisma.notification.findUnique({ where: { id } });
    if (!notif || notif.userId !== user.id) {
      return apiError("NOT_FOUND", "Notification introuvable");
    }

    await prisma.notification.update({
      where: { id },
      data: { read: true },
    });

    return apiSuccess({ id, read: true });
  } catch (error) {
    return handleApiError(error);
  }
}
