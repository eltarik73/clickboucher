import type { Metadata } from "next";

// Butcher tool pages: no search value. robots.txt leaves them crawlable so engines read this.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ShopToolsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
