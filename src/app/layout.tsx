export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { frFR } from "@clerk/localizations";
import { CartProviderWrapper } from "@/components/providers/CartProviderWrapper";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "Klik&Go - Click & Collect Boucherie",
  description: "Commande en ligne aupres de ta boucherie preferee. Retrait rapide, zero file.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider localization={frFR}>
      <html lang="fr">
        <body className="bg-stone-50 text-stone-900 antialiased">
          <CartProviderWrapper>{children}</CartProviderWrapper>
        </body>
      </html>
    </ClerkProvider>
  );
}
