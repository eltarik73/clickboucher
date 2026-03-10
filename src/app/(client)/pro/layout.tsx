import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

export const metadata: Metadata = {
  title: "Espace Professionnel",
  description:
    "Espace professionnel Klik&Go pour les restaurateurs, traiteurs et commerces. Commandez en gros auprès de boucheries halal partenaires avec des tarifs préférentiels.",
  alternates: { canonical: `${SITE_URL}/pro` },
};

export default function ProLayout({ children }: { children: React.ReactNode }) {
  return children;
}
