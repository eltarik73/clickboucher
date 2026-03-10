import { ImageResponse } from "next/og";
import prisma from "@/lib/prisma";

export const alt = "Boutique sur Klik&Go";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let shopName = slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  let shopCity = "";
  let shopRating = "";

  try {
    const shop = await prisma.shop.findUnique({
      where: { slug },
      select: { name: true, city: true, rating: true },
    });
    if (shop) {
      shopName = shop.name;
      shopCity = shop.city || "";
      shopRating = shop.rating ? Number(shop.rating).toFixed(1) : "";
    }
  } catch {
    // Fallback to formatted slug
  }

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
          color: "white",
          fontFamily: "sans-serif",
          padding: 60,
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 40,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: "#DC2626",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              fontWeight: 900,
              color: "white",
            }}
          >
            K
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#DC2626" }}>
            Klik&Go
          </div>
        </div>

        {/* Shop name */}
        <div
          style={{
            fontSize: 56,
            fontWeight: 800,
            textAlign: "center",
            lineHeight: 1.1,
            marginBottom: 16,
            maxWidth: 900,
          }}
        >
          {shopName}
        </div>

        {/* City + rating */}
        {(shopCity || shopRating) && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              fontSize: 28,
              color: "#9ca3af",
              marginBottom: 10,
            }}
          >
            {shopCity && <span>📍 {shopCity}</span>}
            {shopRating && <span>⭐ {shopRating}</span>}
          </div>
        )}

        {/* CTA */}
        <div
          style={{
            display: "flex",
            marginTop: 36,
            background: "#DC2626",
            padding: "14px 40px",
            borderRadius: 999,
            fontSize: 24,
            fontWeight: 600,
          }}
        >
          Commander en click & collect
        </div>
      </div>
    ),
    { ...size },
  );
}
