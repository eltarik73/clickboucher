import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

export const metadata: Metadata = {
  title: "Devenir Partenaire Boucher — Click & Collect",
  description:
    "Rejoignez Klik&Go et développez votre boucherie halal avec le click & collect. Gérez vos commandes, produits et clients facilement.",
  openGraph: {
    title: "Devenir Partenaire Boucher — Click & Collect | Klik&Go",
    description: "Développez votre boucherie avec le click & collect Klik&Go.",
    url: `${SITE_URL}/espace-boucher`,
  },
  alternates: { canonical: `${SITE_URL}/espace-boucher` },
};

export default function EspaceBoucherLayout({ children }: { children: React.ReactNode }) {
  return children;
}
