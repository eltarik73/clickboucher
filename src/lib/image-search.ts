// src/lib/image-search.ts — Web image search (Pexels + Unsplash fallback)
import { logger } from "@/lib/logger";

export type SearchResult = {
  id: string;
  url: string;
  thumbUrl: string;
  author: string;
  authorUrl: string;
  source: "pexels" | "unsplash";
  width: number;
  height: number;
};

const TIMEOUT_MS = 5000;

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = TIMEOUT_MS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

type PexelsPhoto = {
  id: number;
  width: number;
  height: number;
  photographer: string;
  photographer_url: string;
  src: { large2x: string; large: string; medium: string; original: string };
};

export async function searchPexels(query: string, perPage = 16): Promise<SearchResult[]> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return [];
  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape`;
    const res = await fetchWithTimeout(url, { headers: { Authorization: key } });
    if (!res.ok) {
      logger.warn("[image-search] pexels status", res.status);
      return [];
    }
    const data = (await res.json()) as { photos?: PexelsPhoto[] };
    return (data.photos || []).map((p) => ({
      id: `pexels-${p.id}`,
      url: p.src.large2x || p.src.large || p.src.original,
      thumbUrl: `/api/boucher/images/proxy?url=${encodeURIComponent(p.src.medium || p.src.large)}`,
      author: p.photographer,
      authorUrl: p.photographer_url,
      source: "pexels" as const,
      width: p.width,
      height: p.height,
    }));
  } catch (e) {
    logger.warn("[image-search] pexels error", (e as Error).message);
    return [];
  }
}

type UnsplashPhoto = {
  id: string;
  width: number;
  height: number;
  urls: { regular: string; small: string; full: string };
  user: { name: string; links: { html: string } };
};

export async function searchUnsplash(query: string, perPage = 16): Promise<SearchResult[]> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return [];
  try {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape`;
    const res = await fetchWithTimeout(url, {
      headers: { Authorization: `Client-ID ${key}` },
    });
    if (!res.ok) {
      logger.warn("[image-search] unsplash status", res.status);
      return [];
    }
    const data = (await res.json()) as { results?: UnsplashPhoto[] };
    return (data.results || []).map((p) => ({
      id: `unsplash-${p.id}`,
      url: p.urls.regular,
      thumbUrl: `/api/boucher/images/proxy?url=${encodeURIComponent(p.urls.small)}`,
      author: p.user.name,
      authorUrl: p.user.links.html,
      source: "unsplash" as const,
      width: p.width,
      height: p.height,
    }));
  } catch (e) {
    logger.warn("[image-search] unsplash error", (e as Error).message);
    return [];
  }
}

export async function searchImages(query: string): Promise<SearchResult[]> {
  const pexels = await searchPexels(query);
  if (pexels.length >= 8) return pexels;
  const unsplash = await searchUnsplash(query);
  // Deduplicate by id, Pexels first
  const seen = new Set<string>();
  const combined: SearchResult[] = [];
  for (const r of [...pexels, ...unsplash]) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    combined.push(r);
  }
  return combined;
}

export function isImageSearchConfigured(): boolean {
  return Boolean(process.env.PEXELS_API_KEY || process.env.UNSPLASH_ACCESS_KEY);
}
