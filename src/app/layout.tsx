import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";
import { Toaster } from "sonner";
import { CartProvider } from "@/lib/hooks/use-cart";

export const metadata: Metadata = {
  title: "ClickBoucher — Click & Collect Boucherie Artisanale",
  description: "Commandez en ligne chez votre boucher de quartier. Viande sélectionnée, retrait express, qualité artisanale.",
  keywords: ["boucherie", "click and collect", "viande", "artisan", "local", "boucherie en ligne"],
  authors: [{ name: "ClickBoucher" }],
  openGraph: {
    title: "ClickBoucher — L'excellence artisanale, à portée de clic",
    description: "Commandez en ligne chez votre boucher de quartier. Viande sélectionnée, retrait express.",
    type: "website",
    locale: "fr_FR",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#5a0d1a",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className="min-h-dvh antialiased">
        <CartProvider>
          {children}
        </CartProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            className: "!bg-card !border-border !text-foreground !shadow-lg !rounded-xl",
          }}
          closeButton
          richColors
        />
      </body>
    </html>
  );
}
