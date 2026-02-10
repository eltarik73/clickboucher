import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { handleApiError } from "@/lib/api/errors";

export async function GET() {
  try {
    const { sessionClaims } = await auth();
    const role = (sessionClaims?.metadata as Record<string, string>)?.role;
    if (role !== "admin") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

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

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error, "admin/users");
  }
}
