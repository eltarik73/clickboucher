import type { Metadata } from "next";

// A customer's own order: no search value. robots.txt leaves it crawlable so engines read this.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function CommandeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
