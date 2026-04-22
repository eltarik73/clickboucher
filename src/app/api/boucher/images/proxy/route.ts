// GET /api/boucher/images/proxy?url=<encoded> — Thumbnail proxy (Pexels/Unsplash)
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const ALLOWED_HOSTS = new Set(["images.pexels.com", "images.unsplash.com"]);
const ALLOWED_HOST_SUFFIXES = [".public.blob.vercel-storage.com", ".replicate.delivery"];
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export async function GET(req: NextRequest) {
  const urlParam = req.nextUrl.searchParams.get("url");
  if (!urlParam) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(urlParam);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  const isExact = ALLOWED_HOSTS.has(target.hostname);
  const isSuffix = ALLOWED_HOST_SUFFIXES.some((s) => target.hostname.endsWith(s));
  if (target.protocol !== "https:" || (!isExact && !isSuffix)) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(target.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 Klik&Go Image Proxy",
        Accept: "image/*",
      },
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      return NextResponse.json({ error: `Upstream ${resp.status}` }, { status: 502 });
    }

    const contentLength = resp.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_BYTES) {
      return NextResponse.json({ error: "Too large" }, { status: 413 });
    }

    const buffer = Buffer.from(await resp.arrayBuffer());
    if (buffer.length > MAX_BYTES) {
      return NextResponse.json({ error: "Too large" }, { status: 413 });
    }

    const contentType = resp.headers.get("content-type") || "image/jpeg";
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch (err) {
    logger.warn("images/proxy failed", err);
    return NextResponse.json({ error: "Proxy failed" }, { status: 502 });
  }
}
