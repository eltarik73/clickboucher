import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, MapPin, ShieldCheck, Truck, Award, Banknote } from "lucide-react";
import prisma from "@/lib/prisma";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { SEO_CITIES } from "@/lib/seo/cities";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

export const metadata: Metadata = {
  title: "Commander de la viande halal en ligne — Boucher halal de proximité",
  description:
    "Commandez votre viande halal en ligne chez votre boucher de proximité. Bœuf, agneau, veau, volaille halal certifiée. Retrait en boutique en 30 min, frais 0,99€.",
  keywords: [
    "commander viande halal",
    "commander viande halal en ligne",
    "acheter viande halal en ligne",
    "viande halal en ligne",
    "commande viande halal",
    "boucherie halal en ligne",
    "boucher halal proximité",
    "viande halal fraîche",
  ],
  alternates: { canonical: `${SITE_URL}/commander-viande-halal` },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "Klik&Go",
    title: "Commander de la viande halal en ligne | Klik&Go",
    description: "Commandez votre viande halal en ligne chez votre boucher de proximité. Retrait en boutique en 30 min.",
    url: `${SITE_URL}/commander-viande-halal`,
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Commander viande halal en ligne" }],
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
      answer: "Sur Klik&Go : choisissez votre boucherie halal de proximité, ajoutez vos produits au panier (bœuf, agneau, veau, volaille…), payez en ligne et récupérez votre commande en boutique au créneau choisi. Aucun abonnement, frais de service unique de 0,99 € par commande.",
    },
    {
      question: "La viande commandée est-elle bien halal certifiée ?",
      answer: "Oui. Toutes les boucheries Klik&Go sont des boucheries halal indépendantes vérifiées. Chaque produit affiche systématiquement son organisme certificateur (AVS, ACMIF, Mosquée de Paris, etc.) pour une transparence totale.",
    },
    {
      question: "Quels types de viande halal puis-je commander ?",
      answer: "Bœuf halal (entrecôte, faux-filet, bavette, haché…), agneau halal (épaule, gigot, côtelettes…), veau halal (escalope, blanquette…), volaille halal (poulet, dinde, escalope…), agneau de l'Aïd, kefta, merguez maison, brochettes préparées… Le catalogue dépend de chaque boucherie partenaire.",
    },
    {
      question: "Où est disponible la commande de viande halal en ligne Klik&Go ?",
      answer: `Klik&Go propose la commande en ligne de viande halal dans ${SEO_CITIES.length} villes françaises et leurs agglomérations : ${SEO_CITIES.map((c) => c.name).join(", ")}.`,
    },
    {
      question: "La viande est-elle plus chère en ligne ?",
      answer: "Non. Les prix affichés sur Klik&Go sont identiques à ceux de la boucherie en magasin. Klik&Go ajoute uniquement un frais de service unique de 0,99 € par commande, sans aucune commission cachée sur les produits.",
    },
    {
      question: "Combien de temps pour récupérer ma commande ?",
      answer: "Votre boucher prépare votre commande en moins de 30 minutes en moyenne. Vous choisissez le créneau de retrait qui vous arrange — pas d'attente surprise en boutique.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
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
        <div className="relative max-w-4xl mx-auto px-5 py-14 sm:py-20">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white mb-6 transition"
          >
            <ArrowLeft size={16} /> Accueil
          </Link>
          <h1 className="text-4xl md:text-5xl font-black mb-4 leading-tight">
            Commander de la viande halal en ligne
          </h1>
          <p className="text-lg text-white/90 max-w-2xl leading-relaxed">
            Bœuf, agneau, veau, volaille — <strong>commandez votre viande halal en ligne</strong> chez votre
            boucher de proximité parmi {shopCount}+ boucheries halal certifiées. Retrait en boutique en
            moins de 30 minutes. Pas d&apos;abonnement, frais de service 0,99 € par commande.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-[#DC2626] rounded-xl font-bold hover:bg-gray-100 transition-colors"
            >
              Commander maintenant
            </Link>
            <Link
              href="/click-and-collect-halal"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 backdrop-blur text-white rounded-xl font-bold hover:bg-white/20 transition-colors border border-white/30"
            >
              Comment ça marche ?
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-5 py-12">
        <h2 className="text-2xl md:text-3xl font-black text-[#1C1512] dark:text-white mb-6">
          Pourquoi acheter sa viande halal en ligne avec Klik&amp;Go ?
        </h2>
        <div className="grid md:grid-cols-2 gap-3">
          {[
            { icon: ShieldCheck, title: "Halal certifié et tracé", text: "Chaque viande affiche son organisme certificateur halal — pas de zone grise." },
            { icon: Award, title: "Boucheries indépendantes", text: "Uniquement des artisans bouchers halal de proximité, pas la grande distribution." },
            { icon: Truck, title: "Retrait en boutique en 30 min", text: "Pas de livraison, pas de chaîne du froid à risque. Tu passes quand tu veux." },
            { icon: Banknote, title: "Mêmes prix qu'en magasin", text: "Aucune majoration. Frais unique 0,99 € par commande, point." },
          ].map((item, i) => (
            <div key={i} className="flex gap-3 bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/10 rounded-2xl p-4">
              <div className="w-10 h-10 rounded-lg bg-red-50 dark:bg-red-900/20 text-[#DC2626] flex items-center justify-center shrink-0">
                <item.icon size={18} />
              </div>
              <div>
                <h3 className="font-bold text-[#1C1512] dark:text-white text-sm">{item.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {sampleShops.length > 0 && (
        <section className="max-w-4xl mx-auto px-5 py-8">
          <h2 className="text-2xl md:text-3xl font-black text-[#1C1512] dark:text-white mb-3">
            Nos boucheries halal partenaires
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-5">
            Quelques boucheries où vous pouvez commander votre viande halal en ligne dès maintenant :
          </p>
          <div className="grid md:grid-cols-2 gap-3">
            {sampleShops.map((s) => (
              <Link
                key={s.slug}
                href={`/boutique/${s.slug}`}
                className="flex justify-between items-center bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 hover:border-[#DC2626] transition-colors"
              >
                <div>
                  <div className="font-bold text-[#1C1512] dark:text-white text-sm">{s.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{s.city}</div>
                </div>
                {s.rating > 0 && (
                  <div className="text-xs text-amber-600 font-semibold">
                    ⭐ {s.rating.toFixed(1)} ({s.ratingCount})
                  </div>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="max-w-4xl mx-auto px-5 py-8">
        <h2 className="text-2xl md:text-3xl font-black text-[#1C1512] dark:text-white mb-3">
          Commander sa viande halal par ville
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-5">
          {SEO_CITIES.map((c) => (
            <Link
              key={c.slug}
              href={`/boucherie-halal/${c.slug}`}
              className="flex items-center gap-2 bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 hover:border-[#DC2626] transition-colors"
            >
              <MapPin size={16} className="text-[#DC2626] shrink-0" />
              <span className="font-semibold text-sm text-[#1C1512] dark:text-white">
                Viande halal {c.name}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-5 py-12">
        <h2 className="text-2xl md:text-3xl font-black text-[#1C1512] dark:text-white mb-6">
          Questions fréquentes
        </h2>
        <div className="space-y-3">
          {faqs.map((f, i) => (
            <details
              key={i}
              className="bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/10 rounded-2xl p-5 group"
            >
              <summary className="font-bold text-[#1C1512] dark:text-white cursor-pointer list-none flex justify-between items-center">
                {f.question}
                <span className="text-[#DC2626] text-xl group-open:rotate-45 transition-transform">+</span>
              </summary>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 leading-relaxed">
                {f.answer}
              </p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
