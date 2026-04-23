import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mes favoris",
  description:
    "Retrouvez vos boucheries favorites et commandez rapidement sur Klik&Go.",
  robots: { index: false, follow: false },
};

export default function FavorisLayout({ children }: { children: React.ReactNode }) {
  return children;
}
