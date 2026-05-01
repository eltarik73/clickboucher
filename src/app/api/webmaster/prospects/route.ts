// GET  /api/webmaster/prospects — list with optional filters (status, city, search)
// POST /api/webmaster/prospects — create a single prospect manually
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const VALID_STATUSES = [
  "NEW",
  "CONTACTED",
  "REPLIED",
  "VISIT_SCHEDULED",
  "VISITED",
  "SIGNED",
  "REFUSED",
  "UNREACHABLE",
] as const;

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const params = req.nextUrl.searchParams;
    const status = params.get("status");
    const city = params.get("city");
    const search = params.get("search");
    const limit = Math.min(parseInt(params.get("limit") || "100", 10), 500);

    const where: Prisma.ProspectWhereInput = {};
    if (status && (VALID_STATUSES as readonly string[]).includes(status)) {
      where.status = status as (typeof VALID_STATUSES)[number];
    }
    if (city) {
      where.city = { contains: city, mode: "insensitive" };
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const [prospects, counts] = await Promise.all([
      prisma.prospect.findMany({
        where,
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: limit,
      }),
      prisma.prospect.groupBy({
        by: ["status"],
        _count: true,
      }),
    ]);

    const countsByStatus = Object.fromEntries(
      counts.map((c) => [c.status, c._count])
    );

    return apiSuccess({ prospects, countsByStatus, total: prospects.length });
  } catch (error) {
    return handleApiError(error, "webmaster/prospects/GET");
  }
}

const createSchema = z.object({
  name: z.string().min(1).max(200),
  city: z.string().min(1).max(100),
  zipCode: z.string().max(10).optional(),
  address: z.string().max(500).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional().or(z.literal("")),
  notes: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const body = await req.json();
    const data = createSchema.parse(body);

    const prospect = await prisma.prospect.create({
      data: {
        name: data.name,
        city: data.city,
        zipCode: data.zipCode || null,
        address: data.address || null,
        phone: data.phone || null,
        email: data.email || null,
        notes: data.notes || null,
        source: "MANUAL",
        status: "NEW",
      },
    });

    return apiSuccess(prospect, 201);
  } catch (error) {
    return handleApiError(error, "webmaster/prospects/POST");
  }
}
