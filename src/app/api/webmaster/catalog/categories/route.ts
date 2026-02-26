// API: GET/POST /api/webmaster/catalog/categories
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, handleApiError } from "@/lib/api/errors";
import { createGlobalCategorySchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = await requireAdmin();
    if ("error" in admin) return admin.error;

    const categories = await prisma.globalCategory.findMany({
      orderBy: { order: "asc" },
      include: { _count: { select: { products: true } } },
    });

    return apiSuccess(categories);
  } catch (error) {
    return handleApiError(error, "GET /api/webmaster/catalog/categories");
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if ("error" in admin) return admin.error;

    const body = await req.json();
    const data = createGlobalCategorySchema.parse(body);

    const category = await prisma.globalCategory.create({ data });

    return apiSuccess(category, 201);
  } catch (error) {
    return handleApiError(error, "POST /api/webmaster/catalog/categories");
  }
}
