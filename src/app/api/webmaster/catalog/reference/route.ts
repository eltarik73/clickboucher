// API: GET/POST /api/webmaster/catalog/reference
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, apiPaginated, handleApiError } from "@/lib/api/errors";
import { createReferenceProductSchema, referenceCatalogQuerySchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if ("error" in admin) return admin.error;

    const params = Object.fromEntries(req.nextUrl.searchParams);
    const query = referenceCatalogQuerySchema.parse(params);

    const where: Record<string, unknown> = {};
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { description: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.referenceProduct.findMany({
        where,
        include: { category: true },
        orderBy: [{ category: { order: "asc" } }, { name: "asc" }],
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      prisma.referenceProduct.count({ where }),
    ]);

    return apiPaginated(data, total, query.page, query.perPage);
  } catch (error) {
    return handleApiError(error, "GET /api/webmaster/catalog/reference");
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if ("error" in admin) return admin.error;

    const body = await req.json();
    const data = createReferenceProductSchema.parse(body);

    const product = await prisma.referenceProduct.create({
      data: {
        name: data.name,
        description: data.description,
        imageUrl: data.imageUrl,
        suggestedPrice: data.suggestedPrice,
        unit: data.unit,
        categoryId: data.categoryId,
        origin: data.origin,
        pricePerKg: data.pricePerKg,
        sliceWeights: data.sliceWeights,
        tags: data.tags || [],
        isActive: data.isActive ?? true,
      },
      include: { category: true },
    });

    return apiSuccess(product, 201);
  } catch (error) {
    return handleApiError(error, "POST /api/webmaster/catalog/reference");
  }
}
