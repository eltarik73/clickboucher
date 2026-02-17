import type { Metadata, Viewport } from "next";
import { DM_Sans, Plus_Jakarta_Sans, Cormorant_Garamond } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { frFR } from "@clerk/localizations";
import { Toaster } from "sonner";
import { CartProviderWrapper } from "@/components/providers/CartProviderWrapper";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { SplashScreen } from "@/components/SplashScreen";
import { NotificationProvider } from "@/components/ui/NotificationToast";
import ServiceWorkerRegistration from "@/components/pwa/ServiceWorkerRegistration";
import InstallPrompt from "@/components/pwa/InstallPrompt";
import OfflineBanner from "@/components/pwa/OfflineBanner";
import "@/styles/globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
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

export const metadata: Metadata = {
  title: "Klik&Go — Click & Collect Boucheries Halal Chambéry",
  description:
    "Commandez en ligne chez votre boucher halal à Chambéry. Retrait rapide avec QR code. Zéro file, zéro stress, 100% frais.",
  keywords: [
    "boucherie halal",
    "click and collect",
    "Chambéry",
    "viande halal",
    "commande en ligne",
    "retrait rapide",
  ],
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
    title: "Klik&Go — Click & Collect Boucheries Halal",
    description: "Commandez, récupérez. Zéro file, zéro stress.",
    url: "https://clickboucher-production.up.railway.app",
    siteName: "Klik&Go",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider localization={frFR}>
      <html lang="fr" suppressHydrationWarning>
        <body className={`${dmSans.variable} ${plusJakarta.variable} ${cormorant.variable} bg-[#f8f6f3] text-gray-900 dark:bg-[#0a0a0a] dark:text-white antialiased transition-colors duration-300`}>
          <ThemeProvider>
            <Toaster position="top-center" richColors />
            <NotificationProvider>
              <CartProviderWrapper>
                <ServiceWorkerRegistration />
                <OfflineBanner />
                <SplashScreen>{children}</SplashScreen>
                <InstallPrompt />
              </CartProviderWrapper>
            </NotificationProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
