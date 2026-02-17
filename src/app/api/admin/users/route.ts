import prisma from "@/lib/prisma";
import { apiSuccess, handleApiError } from "@/lib/api/errors";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const adminCheck = await requireAdmin();
    if (adminCheck.error) return adminCheck.error;

    const users = await prisma.user.findMany({
      select: {
        id: true,
        clerkId: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        companyName: true,
        siret: true,
        sector: true,
        proStatus: true,
        phone: true,
        createdAt: true,
        orders: {
          select: { totalCents: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const data = users.map((u) => ({
      id: u.id,
      clerkId: u.clerkId,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
      companyName: u.companyName,
      siret: u.siret,
      sector: u.sector,
      proStatus: u.proStatus,
      phone: u.phone,
      createdAt: u.createdAt,
      orderCount: u.orders.length,
      totalSpent: u.orders.reduce((sum, o) => sum + o.totalCents, 0),
    }));

    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error, "admin/users");
  }
}
