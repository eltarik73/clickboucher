import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Validation schema
const addToCartSchema = z.object({
  shopId: z.string().min(1),
  productId: z.string().min(1),
  qty: z.number().positive(),
});

export async function POST(req: NextRequest) {
  try {
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
    console.log(`[CART] Add: shop=${shopId}, product=${productId}, qty=${qty}`);

    return NextResponse.json({
      success: true,
      message: "Product added to cart",
      item: { shopId, productId, qty },
    });
  } catch (error) {
    console.error("[CART] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
