// src/app/api/offers/route.ts — Public GET: list active offers
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const shopId = searchParams.get("shopId");
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const pageSize = 20;

    const now = new Date();
    const where = {
      status: "ACTIVE" as const,
      startDate: { lte: now },
      endDate: { gt: now },
      ...(shopId ? { shopId } : {}),
    };

    const [offers, total] = await Promise.all([
      prisma.offer.findMany({
        where,
        include: { shop: { select: { id: true, name: true, slug: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.offer.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: offers,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL", message: err instanceof Error ? err.message : "Internal error" } },
      { status: 500 }
    );
  }
}
