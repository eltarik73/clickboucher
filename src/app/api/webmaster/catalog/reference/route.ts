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
        include: { category: true, images: true, labels: true },
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

    const { images, labels, ...scalar } = data;

    const product = await prisma.referenceProduct.create({
      data: {
        name: scalar.name,
        description: scalar.description,
        imageUrl: scalar.imageUrl,
        suggestedPrice: scalar.suggestedPrice,
        unit: scalar.unit,
        categoryId: scalar.categoryId,
        origin: scalar.origin,
        pricePerKg: scalar.pricePerKg,
        sliceWeights: scalar.sliceWeights,
        tags: scalar.tags || [],
        isActive: scalar.isActive ?? true,
        halalOrg: scalar.halalOrg ?? null,
        freshness: scalar.freshness,
        race: scalar.race ?? null,
        customerNote: scalar.customerNote ?? null,
        minWeightG: scalar.minWeightG,
        weightStepG: scalar.weightStepG,
        maxWeightG: scalar.maxWeightG,
        sliceOptions: scalar.sliceOptions ?? undefined,
        variants: scalar.variants || [],
        weightPerPiece: scalar.weightPerPiece ?? null,
        pieceLabel: scalar.pieceLabel ?? null,
        weightMargin: scalar.weightMargin,
        ...(images?.length && {
          images: { create: images.map((img, i) => ({ url: img.url, alt: img.alt || null, order: img.order ?? i, isPrimary: img.isPrimary ?? i === 0 })) },
        }),
        ...(labels?.length && {
          labels: { create: labels.map((l) => ({ name: l.name, color: l.color || null })) },
        }),
      },
      include: { category: true, images: true, labels: true },
    });

    return apiSuccess(product, 201);
  } catch (error) {
    return handleApiError(error, "POST /api/webmaster/catalog/reference");
  }
}
