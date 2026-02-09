import { NextRequest, NextResponse } from "next/server";
import { searchProducts } from "@/lib/ai-search";

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

    return NextResponse.json({ query: q, count: results.length, results });
  } catch (error) {
    console.error("[search] Error:", error);
    return NextResponse.json(
      { error: "Erreur de recherche" },
      { status: 500 }
    );
  }
}
