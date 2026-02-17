import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";

export const dynamic = "force-dynamic";

const UPLOADS_BASE = path.join(process.cwd(), "uploads");

const MIME_MAP: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

// ── GET /api/uploads/[...path] ─────────────────
// Serve uploaded files from the uploads directory
export async function GET(
  _req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const { path: segments } = params;
    const relativePath = segments.join("/");

    // Security: no path traversal
    const filePath = path.resolve(path.join(UPLOADS_BASE, relativePath));
    if (!filePath.startsWith(path.resolve(UPLOADS_BASE))) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // Check file exists
    try {
      await fs.access(filePath);
    } catch {
      return new NextResponse("Not Found", { status: 404 });
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_MAP[ext] || "application/octet-stream";
    const buffer = await fs.readFile(filePath);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch {
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
