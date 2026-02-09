import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

// Admin-only: all shops with counts + owner info
export async function GET() {
  try {
    const { sessionClaims } = await auth();
    const role = (sessionClaims?.metadata as Record<string, string>)?.role;
    if (role !== "admin") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    const shops = await prisma.shop.findMany({
      include: {
        _count: { select: { products: true, orders: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Fetch boucher users for owner names
    const ownerIds = [...new Set(shops.map((s) => s.ownerId))];
    const owners = await prisma.user.findMany({
      where: { clerkId: { in: ownerIds } },
      select: { clerkId: true, firstName: true, lastName: true, email: true },
    });
    const ownerMap = new Map(owners.map((o) => [o.clerkId, o]));

    const data = shops.map((s) => {
      const owner = ownerMap.get(s.ownerId);
      return {
        ...s,
        ownerName: owner
          ? `${owner.firstName} ${owner.lastName}`
          : s.ownerId,
        ownerEmail: owner?.email || null,
        productCount: s._count.products,
        orderCount: s._count.orders,
      };
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("[admin/shops] Error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// Admin-only: list boucher users (for owner select)
export async function POST() {
  try {
    const { sessionClaims } = await auth();
    const role = (sessionClaims?.metadata as Record<string, string>)?.role;
    if (role !== "admin") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    const bouchers = await prisma.user.findMany({
      where: { role: "BOUCHER" },
      select: {
        clerkId: true,
        firstName: true,
        lastName: true,
        email: true,
      },
      orderBy: { firstName: "asc" },
    });

    return NextResponse.json(bouchers);
  } catch (error) {
    console.error("[admin/shops] Bouchers error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
