import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

export const metadata: Metadata = {
  title: "Inscrire ma boucherie halal sur Klik&Go — 100% gratuit",
  description:
    "Inscrivez votre boucherie halal sur Klik&Go gratuitement. Aucun abonnement, commission uniquement sur les commandes encaissées. Click & collect, mode cuisine, statistiques inclus.",
  openGraph: {
    title: "Inscrire ma boucherie halal sur Klik&Go — 100% gratuit",
    description:
      "Aucun abonnement, aucun frais fixe. Commission uniquement sur les commandes encaissées.",
    url: `${SITE_URL}/inscription-boucher`,
    siteName: "Klik&Go",
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Inscrire ma boucherie halal sur Klik&Go — 100% gratuit",
    description:
      "Aucun abonnement, commission uniquement sur les commandes encaissées.",
  },
  alternates: { canonical: `${SITE_URL}/inscription-boucher` },
};

export default function InscriptionBoucherLayout({ children }: { children: React.ReactNode }) {
  return children;
}
