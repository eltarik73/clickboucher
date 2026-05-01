import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

export const metadata: Metadata = {
  title: "Devenir Partenaire Boucher — 100% gratuit, commission uniquement",
  description:
    "Rejoignez Klik&Go : aucun abonnement, aucun frais fixe. Commission uniquement sur les commandes encaissées. Vitrine en ligne, mode cuisine, fidélité, statistiques inclus.",
  openGraph: {
    title: "Devenir Partenaire Boucher — Klik&Go (100% gratuit)",
    description:
      "Aucun abonnement, commission uniquement. Vitrine en ligne + mode cuisine + fidélité.",
    url: `${SITE_URL}/espace-boucher`,
    siteName: "Klik&Go",
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Devenir Partenaire Boucher — Klik&Go (100% gratuit)",
    description:
      "Aucun abonnement. Commission uniquement sur les commandes encaissées.",
  },
  alternates: { canonical: `${SITE_URL}/espace-boucher` },
};

export default function EspaceBoucherLayout({ children }: { children: React.ReactNode }) {
  return children;
}
