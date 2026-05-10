import type { Metadata } from "next";
import { SEO_CITIES } from "@/lib/seo/cities";
import prisma from "@/lib/prisma";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

export async function generateMetadata({
  params,
}: {
  params: { ville: string };
}): Promise<Metadata> {
  const city = SEO_CITIES.find((c) => c.slug === params.ville);
  if (!city) return { title: "Ville introuvable" };

  // Count partner shops for descriptive metadata (used in description for trust signal)
  const shopCount = await prisma.shop.count({
    where: {
      visible: true,
      city: { contains: city.name, mode: "insensitive" },
    },
  });

  // Title court — titleTemplate root ajoute " | Klik&Go" auto (~11 chars).
  // Audit Bing Site Scan #3 (2026-05-10) : 7 villes longues > 65 chars total.
  // Nouveau format : "Boucher partenaire {Ville} — Gratuit" → 35-50 chars + 11 = max ~62.
  const title = `Boucher partenaire ${city.name} — 100% gratuit`;
  const shopCountStr =
    shopCount > 0
      ? `${shopCount} boucherie${shopCount > 1 ? "s" : ""} déjà inscrite${shopCount > 1 ? "s" : ""} à ${city.name}.`
      : `Soyez la première boucherie halal partenaire Klik&Go à ${city.name}.`;
  const description = `Boucher halal à ${city.name} ? Rejoignez Klik&Go : 100% gratuit, commission uniquement, aucun abonnement. Vitrine en ligne, mode cuisine, click & collect. ${shopCountStr}`;

  // Audit Bing 2026-05-09 : 45 pages /devenir-boucher-partenaire/[ville]
  // étaient indexables sans noindex auto → signal "thin/duplicate content"
  // (Mars 2026 Core Update). On noindex tant qu'il n'y a pas au moins 1
  // boucherie dans la ville pour faire du contenu unique pertinent.
  // Same pattern que /boucherie-halal/[ville]/layout.tsx (commit 018ba6a).
  const shouldNoIndex = shopCount === 0;

  return {
    title,
    description,
    ...(shouldNoIndex && { robots: { index: false, follow: true } }),
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/devenir-boucher-partenaire/${city.slug}`,
      siteName: "Klik&Go",
      locale: "fr_FR",
      type: "website",
      images: [
        {
          url: "/og-image.png",
          width: 1200,
          height: 630,
          alt: `Devenir partenaire boucher Klik&Go à ${city.name}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    alternates: {
      canonical: `${SITE_URL}/devenir-boucher-partenaire/${city.slug}`,
    },
  };
}

export default function DevenirBoucherPartenaireLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
