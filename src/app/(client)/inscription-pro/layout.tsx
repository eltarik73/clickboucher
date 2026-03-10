import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

export const metadata: Metadata = {
  title: "Inscription Professionnelle",
  description:
    "Créez votre compte professionnel Klik&Go pour accéder aux tarifs préférentiels et commander en gros auprès de boucheries halal partenaires en click & collect.",
  alternates: { canonical: `${SITE_URL}/inscription-pro` },
};

export default function InscriptionProLayout({ children }: { children: React.ReactNode }) {
  return children;
}
