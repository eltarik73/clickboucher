import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Klik&Go - Click & Collect Boucherie Halal";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #DC2626 0%, #991B1B 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: 30,
            background: "rgba(255,255,255,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 30,
          }}
        >
          <div
            style={{
              fontSize: 72,
              fontWeight: 900,
              color: "white",
            }}
          >
            K
          </div>
        </div>
        <div
          style={{
            fontSize: 72,
            fontWeight: 800,
            color: "white",
            marginBottom: 16,
            letterSpacing: -2,
          }}
        >
          Klik&Go
        </div>
        <div
          style={{
            fontSize: 32,
            color: "rgba(255,255,255,0.9)",
            marginBottom: 12,
          }}
        >
          Click & Collect Boucherie Halal
        </div>
        <div
          style={{
            fontSize: 22,
            color: "rgba(255,255,255,0.6)",
            marginTop: 8,
          }}
        >
          Chambéry · Grenoble · Lyon · Saint-Étienne
        </div>
      </div>
    ),
    { ...size },
  );
}
