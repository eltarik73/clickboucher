import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Recherche",
  description: "Recherchez parmi les boucheries halal et les produits Klik&Go.",
  // Search result pages should never be indexed (audit SEO LOW #26).
  robots: { index: false, follow: true },
};

export default function RechercheLayout({ children }: { children: React.ReactNode }) {
  return children;
}
