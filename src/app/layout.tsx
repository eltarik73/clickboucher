import type { Metadata, Viewport } from "next";
import { DM_Sans, Plus_Jakarta_Sans } from "next/font/google";
import "@/styles/globals.css";
import { Toaster } from "sonner";
import { CartProvider } from "@/lib/hooks/use-cart";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "ClickBoucher — Click & Collect Boucherie",
  description:
    "Commandez en ligne chez votre boucher de quartier. Retrait express, qualité artisanale.",
  keywords: ["boucherie", "click and collect", "viande", "artisan", "local"],
  authors: [{ name: "ClickBoucher" }],
  openGraph: {
    title: "ClickBoucher — Click & Collect Boucherie",
    description: "Commandez en ligne chez votre boucher de quartier.",
    type: "website",
    locale: "fr_FR",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#7A1023",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${dmSans.variable} ${plusJakarta.variable}`}>
      <body className="min-h-dvh bg-background antialiased">
        <CartProvider>
          {children}
        </CartProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            className:
              "!bg-card !border-border !text-foreground !shadow-elevated !rounded-2xl",
          }}
          closeButton
          richColors
        />
      </body>
    </html>
  );
}
