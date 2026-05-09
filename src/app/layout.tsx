import type { Metadata, Viewport } from "next";
import { DM_Sans, Outfit, Cormorant_Garamond } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { frFR } from "@clerk/localizations";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { NotificationProvider } from "@/components/ui/NotificationToast";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import dynamic from "next/dynamic";

const ServiceWorkerRegistration = dynamic(
  () => import("@/components/pwa/ServiceWorkerRegistration"),
  { ssr: false }
);
const InstallPrompt = dynamic(() => import("@/components/pwa/InstallPrompt"), { ssr: false });
const OfflineBanner = dynamic(() => import("@/components/pwa/OfflineBanner"), { ssr: false });
const TestRoleSwitcher = dynamic(
  () => import("@/components/test/TestRoleSwitcher").then((m) => m.TestRoleSwitcher),
  { ssr: false }
);
import { OrganizationSchema } from "@/components/seo/OrganizationSchema";
import Script from "next/script";
import "@/styles/globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["500", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-serif",
  display: "swap",
  preload: false,
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#DC2626",
  viewportFit: "cover",
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Klik&Go — Click & Collect Boucherie Halal",
    template: "%s | Klik&Go",
  },
  description:
    "Commandez en ligne chez votre boucherie halal de proximité. Click & collect rapide à Chambéry, Grenoble, Lyon, Saint-Étienne. Viande halal fraîche, retrait en boutique.",
  // `keywords` removed: ignored by Google since 2009 and Bing since 2014.
  authors: [{ name: "Klik&Go" }],
  creator: "Klik&Go",
  publisher: "Klik&Go",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Klik&Go",
  },
  icons: {
    icon: [
      { url: "/icon", type: "image/png", sizes: "32x32" },
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    shortcut: "/icon",
    apple: "/icons/icon-192.png",
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: SITE_URL,
    siteName: "Klik&Go",
    title: "Klik&Go — Click & Collect Boucherie Halal",
    description:
      "Commandez en ligne chez votre boucherie halal de proximité. Viande fraîche, retrait rapide en boutique.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Klik&Go - Click & Collect Boucherie Halal",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Klik&Go — Click & Collect Boucherie Halal",
    description: "Commandez en ligne chez votre boucherie halal de proximité.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large" as const,
      "max-snippet": -1,
    },
  },
  // Search engine ownership verification meta tags. Each provider gives you
  // a unique code; we read them from env so they stay out of git.
  // - Google: Search Console → Property → Settings → Ownership verification → HTML tag
  //   then set NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION on Vercel
  // - Bing: Webmaster Tools → Settings → Site → Site verification → Meta tag option
  //   then set NEXT_PUBLIC_BING_SITE_VERIFICATION on Vercel
  // - Yandex (optional): Yandex Webmaster → Site rights → Meta tag
  //   then set NEXT_PUBLIC_YANDEX_VERIFICATION on Vercel
  verification: {
    ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION && {
      google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
    }),
    ...(process.env.NEXT_PUBLIC_YANDEX_VERIFICATION && {
      yandex: process.env.NEXT_PUBLIC_YANDEX_VERIFICATION,
    }),
    other: {
      ...(process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION && {
        "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION,
      }),
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider localization={frFR} dynamic>
      <html lang="fr" suppressHydrationWarning>
        <head>
          {/* New mobile-web-app-capable meta — coexists with apple-mobile-web-app-capable
              auto-generated from `appleWebApp` metadata. Without this, Chrome 117+ warns. */}
          <meta name="mobile-web-app-capable" content="yes" />
          {/* DNS preconnect for critical third parties — saves 100-300ms on LCP (audit P-06). */}
          <link rel="preconnect" href="https://clerk.klikandgo.app" crossOrigin="" />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
          <link rel="dns-prefetch" href="https://api.stripe.com" />
          <link rel="dns-prefetch" href="https://js.stripe.com" />
          {process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN && (
            <Script
              defer
              data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN}
              src="https://plausible.io/js/script.js"
              strategy="lazyOnload"
            />
          )}
        </head>
        <body
          className={`${dmSans.variable} ${outfit.variable} ${cormorant.variable} bg-white text-gray-900 antialiased dark:bg-black dark:text-white`}
        >
          <OrganizationSchema />
          {/* WCAG 2.4.1 — Skip link pour utilisateurs clavier/screen readers
              (audit a11y 2026-05-09). Visuellement caché sauf au focus. */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-[#DC2626] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg"
          >
            Aller au contenu
          </a>
          <ThemeProvider>
            <Toaster position="top-center" richColors />
            <NotificationProvider>
              <ServiceWorkerRegistration />
              <OfflineBanner />
              <main id="main-content" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
                {children}
              </main>
              <SpeedInsights />
              <Analytics />
              <InstallPrompt />
              <TestRoleSwitcher />
            </NotificationProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
