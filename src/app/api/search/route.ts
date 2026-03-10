import { NextRequest, NextResponse } from "next/server";
import { searchProducts } from "@/lib/ai-search";
import { apiCached, handleApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const q = searchParams.get("q")?.trim();
    const shopId = searchParams.get("shopId") || undefined;

    if (!q || q.length < 2) {
      return NextResponse.json(
        { error: "Paramètre 'q' requis (min 2 caractères)" },
        { status: 400 }
      );
    }

    const results = await searchProducts(q, shopId, 10);

    return apiCached({ query: q, count: results.length, results }, 30);
  } catch (error) {
    return handleApiError(error, "search");
  }
}
