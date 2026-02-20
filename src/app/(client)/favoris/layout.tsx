import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mes favoris | Klik&Go",
  description:
    "Retrouvez vos boucheries favorites et commandez rapidement sur Klik&Go.",
};

export default function FavorisLayout({ children }: { children: React.ReactNode }) {
  return children;
}
