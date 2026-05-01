import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

// Common disallow list — private, transactional, or session-only paths
// that must never be indexed nor used to train AI models.
const DISALLOW = [
  "/api/",
  "/dashboard/",
  "/admin/",
  "/checkout/",
  "/sign-in/",
  "/sign-up/",
  "/onboarding/",
  "/webmaster/",
  "/boucher/",
  "/panier/",
  "/profil/",
  "/commandes/",
  "/validation/",
  "/suivi/",
  "/avantages/",
  "/recherche",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Default: any classic search engine crawler
      {
        userAgent: "*",
        allow: "/",
        disallow: DISALLOW,
      },
      // ── Explicit AI crawler rules (2026 best practice) ──
      // We allow training/retrieval crawlers to index public pages so Klik&Go
      // appears in ChatGPT / Claude / Perplexity / Gemini answers, while
      // blocking the same private paths as classic crawlers.
      // If you ever want to opt out of LLM training entirely, change "allow"
      // to "disallow" for GPTBot / ClaudeBot / Google-Extended.
      {
        userAgent: "GPTBot", // OpenAI training crawler
        allow: "/",
        disallow: DISALLOW,
      },
      {
        userAgent: "OAI-SearchBot", // ChatGPT Search retrieval
        allow: "/",
        disallow: DISALLOW,
      },
      {
        userAgent: "ChatGPT-User", // user-triggered fetcher
        allow: "/",
        disallow: DISALLOW,
      },
      {
        userAgent: "ClaudeBot", // Anthropic training crawler
        allow: "/",
        disallow: DISALLOW,
      },
      {
        userAgent: "Claude-SearchBot", // Claude search retrieval
        allow: "/",
        disallow: DISALLOW,
      },
      {
        userAgent: "Claude-User", // user-triggered fetcher
        allow: "/",
        disallow: DISALLOW,
      },
      {
        userAgent: "Google-Extended", // Google Bard/Gemini training opt-out token
        allow: "/",
        disallow: DISALLOW,
      },
      {
        userAgent: "PerplexityBot",
        allow: "/",
        disallow: DISALLOW,
      },
      {
        userAgent: "Applebot-Extended", // Apple Intelligence training
        allow: "/",
        disallow: DISALLOW,
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
