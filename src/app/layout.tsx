import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { frFR } from "@clerk/localizations";
import { Toaster } from "sonner";
import { CartProviderWrapper } from "@/components/providers/CartProviderWrapper";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { NotificationProvider } from "@/components/ui/NotificationToast";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "Klik&Go - Click & Collect Boucherie",
  description: "Commande en ligne aupres de ta boucherie preferee. Retrait rapide, zero file.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider localization={frFR}>
      <html lang="fr" suppressHydrationWarning>
        <body className="bg-[#f8f6f3] text-stone-900 dark:bg-[#1a1814] dark:text-[#f8f6f3] antialiased transition-colors duration-300">
          <ThemeProvider>
            <Toaster position="top-center" richColors />
            <NotificationProvider>
              <CartProviderWrapper>{children}</CartProviderWrapper>
            </NotificationProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
