import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

// Audit Bing Site Scan #3 (2026-05-10) : title 80 chars > 65 limite Bing.
// Suffixe " | Klik&Go" auto via titleTemplate root → 50 + 11 = 61 chars OK.
// OG/Twitter titles peuvent être plus longs (limite 90+).
export const metadata: Metadata = {
  title: "Devenir partenaire boucher — 100% gratuit",
  description:
    "Rejoignez Klik&Go : aucun abonnement, aucun frais fixe. Commission uniquement sur les commandes encaissées. Vitrine en ligne, mode cuisine, fidélité, statistiques inclus.",
  openGraph: {
    title: "Devenir partenaire boucher — Klik&Go (100% gratuit)",
    description:
      "Aucun abonnement, commission uniquement. Vitrine en ligne + mode cuisine + fidélité.",
    url: `${SITE_URL}/espace-boucher`,
    siteName: "Klik&Go",
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Devenir partenaire boucher — Klik&Go",
    description: "Aucun abonnement. Commission uniquement sur les commandes encaissées.",
  },
  alternates: { canonical: `${SITE_URL}/espace-boucher` },
};

export default function EspaceBoucherLayout({ children }: { children: React.ReactNode }) {
  return children;
}
