/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.VERCEL ? undefined : "standalone",
  experimental: {
    instrumentationHook: true,
    optimizePackageImports: ["lucide-react", "recharts", "sonner", "zod", "class-variance-authority", "clsx"],
  },
  images: {
    formats: ["image/webp", "image/avif"],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "*.replicate.delivery" },
      { protocol: "https", hostname: "images.pexels.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  async redirects() {
    return [
      { source: "/decouvrir", destination: "/", permanent: true },
      { source: "/boucheries", destination: "/", permanent: true },
      // Common 404s reported by audit — map to nearest existing page
      { source: "/cgu", destination: "/cgv", permanent: true },
      { source: "/confidentialite", destination: "/politique-de-confidentialite", permanent: true },
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.klikandgo.app" }],
        destination: "https://klikandgo.app/:path*",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      { source: "/manifest.webmanifest", destination: "/manifest.json" },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://challenges.cloudflare.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https: http:",
              "connect-src 'self' https://*.clerk.accounts.dev https://api.anthropic.com https://clerk.busy-mutt-20.clerk.accounts.dev wss://*.clerk.accounts.dev https://api.stripe.com https://*.sentry.io",
              "frame-src 'self' https://*.clerk.accounts.dev https://challenges.cloudflare.com https://js.stripe.com https://hooks.stripe.com",
              "worker-src 'self' blob:",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

// ── Sentry wrapping (no-op when SENTRY_DSN absent) ──
let exported = nextConfig;
if (process.env.SENTRY_DSN) {
  // Dynamically require to keep the dependency soft
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { withSentryConfig } = await import("@sentry/nextjs");
  exported = withSentryConfig(nextConfig, {
    silent: true,
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
  }, {
    hideSourceMaps: true,
    disableLogger: true,
  });
}

export default exported;
