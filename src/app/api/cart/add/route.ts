import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { checkRateLimit, rateLimits } from "@/lib/rate-limit";

// Validation schema
const addToCartSchema = z.object({
  shopId: z.string().min(1),
  productId: z.string().min(1),
  qty: z.number().positive(),
});

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "anon";
    const rl = await checkRateLimit(rateLimits.api, `cart-add:${ip}`);
    if (!rl.success) {
      return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 });
    }

    const body = await req.json();

    // Validate input
    const parsed = addToCartSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { shopId, productId, qty } = parsed.data;

    // For now, cart is handled client-side via localStorage
    // This endpoint is for future server-side cart + analytics
    
    // Log for analytics (future: save to DB)
    logger.info(`[CART] Add: shop=${shopId}, product=${productId}, qty=${qty}`);

    return NextResponse.json({
      success: true,
      message: "Product added to cart",
      item: { shopId, productId, qty },
    });
  } catch (error) {
    console.error("[cart/add]", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.flatten() },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
