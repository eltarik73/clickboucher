import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, MapPin, ShieldCheck, Truck, Award, Banknote } from "lucide-react";
import prisma from "@/lib/prisma";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { SpeakableSchema } from "@/components/seo/SpeakableSchema";
import { LastUpdated } from "@/components/seo/LastUpdated";
import { SEO_CITIES } from "@/lib/seo/cities";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";
const PAGE_LAST_UPDATED = "2026-05-01";

export const metadata: Metadata = {
  // Title court — titleTemplate root ajoute " | Klik&Go" auto (Bing audit 2026-05-09).
  title: "Commander viande halal en ligne — Boucher proche",
  description:
    "Commandez votre viande halal en ligne chez votre boucher de proximité. Bœuf, agneau, veau, volaille halal certifiée. Retrait en boutique en 30 min, frais 0,99€.",
  alternates: { canonical: `${SITE_URL}/commander-viande-halal` },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "Klik&Go",
    title: "Commander de la viande halal en ligne | Klik&Go",
    description:
      "Commandez votre viande halal en ligne chez votre boucher de proximité. Retrait en boutique en 30 min.",
    url: `${SITE_URL}/commander-viande-halal`,
    images: [
      { url: "/og-image.png", width: 1200, height: 630, alt: "Commander viande halal en ligne" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Commander de la viande halal en ligne",
    description: "Commandez votre viande halal en ligne chez votre boucher de proximité.",
    images: ["/og-image.png"],
  },
};

export const revalidate = 3600;

export default async function CommanderViandeHalalPage() {
  const [shopCount, sampleShops] = await Promise.all([
    prisma.shop.count({ where: { visible: true } }),
    prisma.shop.findMany({
      where: { visible: true },
      select: { slug: true, name: true, city: true, rating: true, ratingCount: true },
      take: 6,
      orderBy: { rating: "desc" },
    }),
  ]);

  const faqs = [
    {
      question: "Comment commander de la viande halal en ligne ?",
      answer:
        "Sur Klik&Go : choisissez votre boucherie halal de proximité, ajoutez vos produits au panier (bœuf, agneau, veau, volaille…), payez en ligne et récupérez votre commande en boutique au créneau choisi. Aucun abonnement, frais de service unique de 0,99 € par commande.",
    },
    {
      question: "La viande commandée est-elle bien halal certifiée ?",
      answer:
        "Oui. Toutes les boucheries Klik&Go sont des boucheries halal indépendantes vérifiées. Chaque produit affiche systématiquement son organisme certificateur (AVS, ACMIF, Mosquée de Paris, etc.) pour une transparence totale.",
    },
    {
      question: "Quels types de viande halal puis-je commander ?",
      answer:
        "Bœuf halal (entrecôte, faux-filet, bavette, haché…), agneau halal (épaule, gigot, côtelettes…), veau halal (escalope, blanquette…), volaille halal (poulet, dinde, escalope…), agneau de l'Aïd, kefta, merguez maison, brochettes préparées… Le catalogue dépend de chaque boucherie partenaire.",
    },
    {
      question: "Où est disponible la commande de viande halal en ligne Klik&Go ?",
      answer: `Klik&Go propose la commande en ligne de viande halal dans ${SEO_CITIES.length} villes françaises et leurs agglomérations : ${SEO_CITIES.map((c) => c.name).join(", ")}.`,
    },
    {
      question: "La viande est-elle plus chère en ligne ?",
      answer:
        "Non. Les prix affichés sur Klik&Go sont identiques à ceux de la boucherie en magasin. Klik&Go ajoute uniquement un frais de service unique de 0,99 € par commande, sans aucune commission cachée sur les produits.",
    },
    {
      question: "Combien de temps pour récupérer ma commande ?",
      answer:
        "Votre boucher prépare votre commande en moins de 30 minutes en moyenne. Vous choisissez le créneau de retrait qui vous arrange — pas d'attente surprise en boutique.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      <SpeakableSchema
        url={`${SITE_URL}/commander-viande-halal`}
        cssSelectors={["h1", '[data-purpose="ai-summary"]']}
      />
      <BreadcrumbSchema
        items={[
          { name: "Accueil", url: SITE_URL },
          { name: "Commander viande halal", url: `${SITE_URL}/commander-viande-halal` },
        ]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((f) => ({
              "@type": "Question",
              name: f.question,
              acceptedAnswer: { "@type": "Answer", text: f.answer },
            })),
          }),
        }}
      />

      <section className="relative bg-gradient-to-br from-[#DC2626] via-[#b91c1c] to-[#991b1b] text-white">
        <div className="relative mx-auto max-w-4xl px-5 py-14 sm:py-20">
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-white/70 transition hover:text-white"
          >
            <ArrowLeft size={16} /> Accueil
          </Link>
          <h1 className="mb-4 text-4xl font-black leading-tight md:text-5xl">
            Commander de la viande halal en ligne
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-white/90">
            Bœuf, agneau, veau, volaille — <strong>commandez votre viande halal en ligne</strong>{" "}
            chez votre boucher de proximité parmi {shopCount}+ boucheries halal certifiées. Retrait
            en boutique en moins de 30 minutes. Pas d&apos;abonnement, frais de service 0,99 € par
            commande.
          </p>
          <LastUpdated date={PAGE_LAST_UPDATED} className="mt-4 text-white/60" />
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-bold text-[#DC2626] transition-colors hover:bg-gray-100"
            >
              Commander maintenant
            </Link>
            <Link
              href="/click-and-collect-halal"
              className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-6 py-3 font-bold text-white backdrop-blur transition-colors hover:bg-white/20"
            >
              Comment ça marche ?
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 py-12">
        <h2 className="mb-6 text-2xl font-black text-[#1C1512] dark:text-white md:text-3xl">
          Pourquoi acheter sa viande halal en ligne avec Klik&amp;Go ?
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          {[
            {
              icon: ShieldCheck,
              title: "Halal certifié et tracé",
              text: "Chaque viande affiche son organisme certificateur halal — pas de zone grise.",
            },
            {
              icon: Award,
              title: "Boucheries indépendantes",
              text: "Uniquement des artisans bouchers halal de proximité, pas la grande distribution.",
            },
            {
              icon: Truck,
              title: "Retrait en boutique en 30 min",
              text: "Pas de livraison, pas de chaîne du froid à risque. Tu passes quand tu veux.",
            },
            {
              icon: Banknote,
              title: "Mêmes prix qu'en magasin",
              text: "Aucune majoration. Frais unique 0,99 € par commande, point.",
            },
          ].map((item, i) => (
            <div
              key={i}
              className="flex gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.05]"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-[#DC2626] dark:bg-red-900/20">
                <item.icon size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#1C1512] dark:text-white">{item.title}</h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {sampleShops.length > 0 && (
        <section className="mx-auto max-w-4xl px-5 py-8">
          <h2 className="mb-3 text-2xl font-black text-[#1C1512] dark:text-white md:text-3xl">
            Nos boucheries halal partenaires
          </h2>
          <p className="mb-5 text-gray-600 dark:text-gray-400">
            Quelques boucheries où vous pouvez commander votre viande halal en ligne dès maintenant
            :
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {sampleShops.map((s) => (
              <Link
                key={s.slug}
                href={`/boutique/${s.slug}`}
                className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 transition-colors hover:border-[#DC2626] dark:border-white/10 dark:bg-white/[0.05]"
              >
                <div>
                  <div className="text-sm font-bold text-[#1C1512] dark:text-white">{s.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{s.city}</div>
                </div>
                {s.rating > 0 && (
                  <div className="text-xs font-semibold text-amber-600">
                    ⭐ {s.rating.toFixed(1)} ({s.ratingCount})
                  </div>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-4xl px-5 py-8">
        <h2 className="mb-3 text-2xl font-black text-[#1C1512] dark:text-white md:text-3xl">
          Commander sa viande halal par ville
        </h2>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
          {SEO_CITIES.map((c) => (
            <Link
              key={c.slug}
              href={`/boucherie-halal/${c.slug}`}
              className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 transition-colors hover:border-[#DC2626] dark:border-white/10 dark:bg-white/[0.05]"
            >
              <MapPin size={16} className="shrink-0 text-[#DC2626]" />
              <span className="text-sm font-semibold text-[#1C1512] dark:text-white">
                Viande halal {c.name}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 py-12">
        <h2 className="mb-6 text-2xl font-black text-[#1C1512] dark:text-white md:text-3xl">
          Questions fréquentes
        </h2>
        <div className="space-y-3">
          {faqs.map((f, i) => (
            <details
              key={i}
              className="group rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.05]"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between font-bold text-[#1C1512] dark:text-white">
                {f.question}
                <span className="text-xl text-[#DC2626] transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                {f.answer}
              </p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
