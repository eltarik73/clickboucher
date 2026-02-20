import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Espace Boucher | Klik&Go",
  description:
    "Rejoignez Klik&Go et développez votre boucherie avec le click & collect. Gérez vos commandes, produits et clients depuis votre tableau de bord.",
  openGraph: {
    title: "Espace Boucher | Klik&Go",
    description: "Développez votre boucherie avec le click & collect Klik&Go.",
  },
};

export default function EspaceBoucherLayout({ children }: { children: React.ReactNode }) {
  return children;
}
