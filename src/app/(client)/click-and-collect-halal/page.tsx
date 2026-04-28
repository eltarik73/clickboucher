import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Check, Clock, MapPin, ShieldCheck, Smartphone, Store } from "lucide-react";
import prisma from "@/lib/prisma";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { SEO_CITIES } from "@/lib/seo/cities";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

export const metadata: Metadata = {
  title: "Click & Collect halal — Commandez votre viande halal en ligne",
  description:
    "Click and collect viande halal : commandez en ligne chez votre boucher halal et récupérez votre commande en boutique en moins de 30 minutes. Sans frais cachés.",
  keywords: [
    "click and collect halal",
    "boucherie halal click and collect",
    "click and collect viande halal",
    "boucher halal en ligne",
    "boucherie halal en ligne",
    "commander viande halal en ligne",
    "click collect halal",
    "viande halal en ligne",
  ],
  alternates: { canonical: `${SITE_URL}/click-and-collect-halal` },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "Klik&Go",
    title: "Click & Collect halal — Boucher halal en ligne | Klik&Go",
    description: "Commandez votre viande halal en ligne et récupérez en boutique en 30 min. La marketplace click & collect dédiée aux boucheries halal.",
    url: `${SITE_URL}/click-and-collect-halal`,
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Click and Collect halal Klik&Go" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Click & Collect halal — Boucher halal en ligne",
    description: "Commandez votre viande halal en ligne et récupérez en boutique en 30 min.",
    images: ["/og-image.png"],
  },
};

export const revalidate = 3600;

export default async function ClickAndCollectHalalPage() {
  const shopCount = await prisma.shop.count({ where: { visible: true } });

  const faqs = [
    {
      question: "Qu'est-ce que le click and collect halal ?",
      answer: "Le click and collect halal, c'est commander de la viande halal en ligne chez son boucher de proximité, payer sur la plateforme, puis récupérer sa commande directement en boutique au créneau choisi. Klik&Go propose ce service avec des boucheries halal partenaires dans toute la région Auvergne-Rhône-Alpes.",
    },
    {
      question: "Comment fonctionne Klik&Go ?",
      answer: "Trois étapes : (1) Choisissez votre boucherie halal sur klikandgo.app. (2) Sélectionnez vos produits et un créneau de retrait. (3) Récupérez votre commande fraîche en boutique. Frais de service unique : 0,99 € par commande, aucune commission cachée.",
    },
    {
      question: "Combien de temps pour préparer ma commande ?",
      answer: "Les boucheries partenaires préparent votre commande en moins de 30 minutes en moyenne. Vous choisissez le créneau qui vous arrange — aucune attente surprise en boutique.",
    },
    {
      question: "Où est disponible le click & collect halal Klik&Go ?",
      answer: `Klik&Go est actuellement présent dans ${SEO_CITIES.length} villes : ${SEO_CITIES.map((c) => c.name).join(", ")} et leur agglomération. Nous nous étendons régulièrement à de nouvelles villes — contactez-nous si vous êtes boucher halal intéressé.`,
    },
    {
      question: "La viande est-elle vraiment halal ?",
      answer: "Oui. Toutes les boucheries partenaires Klik&Go sont des boucheries halal vérifiées. Chaque produit affiche systématiquement l'organisme certificateur (AVS, ACMIF, Mosquée de Paris, etc.) pour une transparence totale.",
    },
    {
      question: "Y a-t-il un coût supplémentaire pour le click and collect ?",
      answer: "Non. Les prix affichés sont ceux de la boucherie, sans majoration. Klik&Go ajoute uniquement un frais de service unique de 0,99 € par commande pour le fonctionnement de la plateforme.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      <BreadcrumbSchema
        items={[
          { name: "Accueil", url: SITE_URL },
          { name: "Click & Collect halal", url: `${SITE_URL}/click-and-collect-halal` },
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
            Click &amp; Collect halal — Le boucher halal en ligne
          </h1>
          <p className="text-lg text-white/90 max-w-2xl leading-relaxed">
            Commandez votre <strong>viande halal en ligne</strong> chez {shopCount}+ boucheries halal partenaires.
            Payez en ligne, récupérez en boutique en moins de 30 minutes. Frais de service 0,99 € — sans commission cachée.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-[#DC2626] rounded-xl font-bold hover:bg-gray-100 transition-colors"
            >
              <Store size={18} /> Trouver ma boucherie halal
            </Link>
            <Link
              href="/recettes"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 backdrop-blur text-white rounded-xl font-bold hover:bg-white/20 transition-colors border border-white/30"
            >
              Voir les recettes halal
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-5 py-12">
        <h2 className="text-2xl md:text-3xl font-black text-[#1C1512] dark:text-white mb-3">
          Comment ça marche ?
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Le <strong>click and collect halal</strong> Klik&amp;Go en 3 étapes :
        </p>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/10 rounded-2xl p-5">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 text-[#DC2626] flex items-center justify-center mb-3">
              <Smartphone size={20} />
            </div>
            <h3 className="font-extrabold text-[#1C1512] dark:text-white mb-2">1. Je commande</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Choisis ta boucherie halal, ajoute tes produits au panier, sélectionne un créneau de retrait. Paiement sécurisé.
            </p>
          </div>
          <div className="bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/10 rounded-2xl p-5">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 text-[#DC2626] flex items-center justify-center mb-3">
              <Clock size={20} />
            </div>
            <h3 className="font-extrabold text-[#1C1512] dark:text-white mb-2">2. Le boucher prépare</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Ton boucher halal reçoit la commande et prépare ta viande fraîche. Tu reçois une notification quand c&apos;est prêt.
            </p>
          </div>
          <div className="bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/10 rounded-2xl p-5">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 text-[#DC2626] flex items-center justify-center mb-3">
              <Store size={20} />
            </div>
            <h3 className="font-extrabold text-[#1C1512] dark:text-white mb-2">3. Je récupère</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Tu passes en boutique au créneau choisi, tu repars avec ta viande halal. Aucune attente, aucun stress.
            </p>
          </div>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-5 py-8">
        <h2 className="text-2xl md:text-3xl font-black text-[#1C1512] dark:text-white mb-3">
          Pourquoi commander sa viande halal en ligne avec Klik&amp;Go ?
        </h2>
        <div className="grid md:grid-cols-2 gap-3 mt-6">
          {[
            { icon: ShieldCheck, title: "Boucheries halal certifiées", text: "Chaque produit affiche l'organisme certificateur halal (AVS, ACMIF, Mosquée de Paris…)." },
            { icon: Clock, title: "Préparation en 30 minutes", text: "Ton boucher prépare la commande pendant que tu choisis ton créneau de retrait." },
            { icon: MapPin, title: "Boucheries de proximité", text: "Uniquement des artisans bouchers halal indépendants, pas la grande distribution." },
            { icon: Check, title: "Sans surcoût caché", text: "Mêmes prix qu'en boutique. Frais de service unique de 0,99 € par commande." },
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

      <section className="max-w-4xl mx-auto px-5 py-8">
        <h2 className="text-2xl md:text-3xl font-black text-[#1C1512] dark:text-white mb-3">
          Boucheries halal en click &amp; collect dans votre ville
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-5">
          Klik&amp;Go propose le click and collect halal dans ces villes (et leurs agglomérations) :
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {SEO_CITIES.map((c) => (
            <Link
              key={c.slug}
              href={`/boucherie-halal/${c.slug}`}
              className="flex items-center gap-2 bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 hover:border-[#DC2626] transition-colors"
            >
              <MapPin size={16} className="text-[#DC2626] shrink-0" />
              <span className="font-semibold text-sm text-[#1C1512] dark:text-white">
                Boucherie halal {c.name}
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
