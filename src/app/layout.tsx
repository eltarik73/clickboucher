import type { Metadata, Viewport } from "next";
import { DM_Sans, Outfit, Cormorant_Garamond } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { frFR } from "@clerk/localizations";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import dynamic from "next/dynamic";

const SplashScreen = dynamic(
  () => import("@/components/SplashScreen").then(m => m.SplashScreen),
  { ssr: false }
);
import { NotificationProvider } from "@/components/ui/NotificationToast";
import ServiceWorkerRegistration from "@/components/pwa/ServiceWorkerRegistration";
import InstallPrompt from "@/components/pwa/InstallPrompt";
import OfflineBanner from "@/components/pwa/OfflineBanner";
import { TestRoleSwitcher } from "@/components/test/TestRoleSwitcher";
import { OrganizationSchema } from "@/components/seo/OrganizationSchema";
import Script from "next/script";
import "@/styles/globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-display",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-serif",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#DC2626",
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
  keywords: [
    "boucherie halal",
    "click and collect",
    "viande halal",
    "commande en ligne",
    "halal",
    "Chambéry",
    "Grenoble",
    "Lyon",
  ],
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
    apple: "/icons/icon-192.png",
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: SITE_URL,
    siteName: "Klik&Go",
    title: "Klik&Go — Click & Collect Boucherie Halal",
    description: "Commandez en ligne chez votre boucherie halal de proximité. Viande fraîche, retrait rapide en boutique.",
    images: [{
      url: "/og-image.png",
      width: 1200,
      height: 630,
      alt: "Klik&Go - Click & Collect Boucherie Halal",
    }],
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
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider localization={frFR}>
      <html lang="fr" suppressHydrationWarning>
        <head>
          {process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN && (
            <Script
              defer
              data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN}
              src="https://plausible.io/js/script.js"
              strategy="afterInteractive"
            />
          )}
        </head>
        <body className={`${dmSans.variable} ${outfit.variable} ${cormorant.variable} bg-white text-gray-900 dark:bg-black dark:text-white antialiased transition-colors duration-300`}>
          <OrganizationSchema />
          <ThemeProvider>
            <Toaster position="top-center" richColors />
            <NotificationProvider>
              <ServiceWorkerRegistration />
              <OfflineBanner />
              <SplashScreen>{children}</SplashScreen>
              <InstallPrompt />
              <TestRoleSwitcher />
            </NotificationProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
