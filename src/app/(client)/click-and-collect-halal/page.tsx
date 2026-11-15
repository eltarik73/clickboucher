import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Check, Info, MapPin, Smartphone, Store, type LucideIcon } from "lucide-react";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { LastUpdated } from "@/components/seo/LastUpdated";
import { SEO_CITIES, SEO_DEPARTMENTS } from "@/lib/seo/cities";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  COMMON_FAQ,
  FACT_FEES,
  FACT_HALAL,
  FACT_PAYMENT,
  FACT_PICKUP,
  FACT_SUMMARY_SHORT,
  ORDER_STEPS,
  type Faq,
} from "@/lib/seo/facts";
import { faqPageJsonLd } from "@/lib/seo/jsonld/pages";
import { SITE_URL, absoluteUrl } from "@/lib/seo/site";

const PAGE_LAST_UPDATED = "2026-11-15";

const PAGE_URL = absoluteUrl("/click-and-collect-halal");

export const metadata: Metadata = {
  // Title court (~50 chars) — titleTemplate root ajoute " | Klik&Go" auto.
  // Bing flagué > 70 chars en encoding HTML &amp; (commit Bing audit 2026-05-09).
  title: "Click & Collect halal — Boucher en ligne",
  description:
    "Click & collect halal : commandez en ligne chez votre boucher halal, retirez en boutique au créneau choisi et payez sur place, sans frais de service.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "Klik&Go",
    title: "Click & Collect halal — Boucher halal en ligne | Klik&Go",
    description:
      "Commandez votre viande halal en ligne et retirez-la en boutique : paiement sur place, sans frais de service.",
    url: PAGE_URL,
    images: [
      { url: "/og-image.png", width: 1200, height: 630, alt: "Click and Collect halal Klik&Go" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Click & Collect halal — Boucher halal en ligne",
    description: "Commandez votre viande halal en ligne, retirez-la et payez-la en boutique.",
    images: ["/og-image.png"],
  },
};

// One icon per step of ORDER_STEPS, in order: choose, order, pick up and pay.
const STEP_ICONS: readonly LucideIcon[] = [MapPin, Smartphone, Store];

const FAQS: Faq[] = [
  {
    question: "Qu'est-ce que le click and collect halal ?",
    answer: `Le click and collect halal, c'est commander sa viande halal en ligne chez un boucher de proximité. ${FACT_PICKUP} ${FACT_PAYMENT}`,
  },
  {
    question: "Comment fonctionne Klik&Go ?",
    answer: `Trois étapes : ${ORDER_STEPS.map((step, index) => `(${index + 1}) ${step.text}`).join(" ")}`,
  },
  {
    question: "Combien de temps pour préparer ma commande ?",
    answer:
      "Le temps de préparation dépend de la boucherie et de votre commande. Vous choisissez de retirer votre commande dès qu'elle est prête ou à un créneau précis, et vous suivez son avancement sur Klik&Go.",
  },
  {
    question: "Où est disponible le click & collect halal Klik&Go ?",
    answer: `Klik&Go a une page pour ${SEO_CITIES.length} villes de ${SEO_DEPARTMENTS.length} départements d'Auvergne-Rhône-Alpes : ${SEO_DEPARTMENTS.map((d) => d.name).join(", ")}. Les boucheries proposées dépendent de chaque ville. Vous êtes boucher halal ? Contactez-nous.`,
  },
  COMMON_FAQ.halal,
  COMMON_FAQ.fees,
];

const REASONS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Info, title: "Certification halal", text: FACT_HALAL },
  { icon: Store, title: "Retrait en boutique", text: FACT_PICKUP },
  {
    icon: MapPin,
    title: "Boucheries de proximité",
    text: "Klik&Go s'adresse aux artisans bouchers halal de quartier, pas à la grande distribution.",
  },
  { icon: Check, title: "Sans frais de service", text: FACT_FEES },
];

export default function ClickAndCollectHalalPage() {
  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      <BreadcrumbSchema
        items={[
          { name: "Accueil", url: SITE_URL },
          { name: "Click & Collect halal", url: PAGE_URL },
        ]}
      />

      <JsonLd data={faqPageJsonLd(FAQS)} />

      <section className="relative bg-gradient-to-br from-[#DC2626] via-[#b91c1c] to-[#991b1b] text-white">
        <div className="relative mx-auto max-w-4xl px-5 py-14 sm:py-20">
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-white/70 transition hover:text-white"
          >
            <ArrowLeft size={16} /> Accueil
          </Link>
          <h1 className="mb-4 text-4xl font-black leading-tight md:text-5xl">
            Click &amp; Collect halal — Le boucher halal en ligne
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-white/90">
            Commandez votre <strong>viande halal en ligne</strong> chez votre boucher halal de
            proximité. {FACT_SUMMARY_SHORT}
          </p>
          <LastUpdated date={PAGE_LAST_UPDATED} className="mt-4 text-white/60" />
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-bold text-[#DC2626] transition-colors hover:bg-gray-100"
            >
              <Store size={18} /> Trouver ma boucherie halal
            </Link>
            <Link
              href="/recettes"
              className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-6 py-3 font-bold text-white backdrop-blur transition-colors hover:bg-white/20"
            >
              Voir les recettes halal
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 py-12">
        <h2 className="mb-3 text-2xl font-black text-[#1C1512] dark:text-white md:text-3xl">
          Comment ça marche ?
        </h2>
        <p className="mb-8 text-gray-600 dark:text-gray-400">
          Le <strong>click and collect halal</strong> Klik&amp;Go en 3 étapes :
        </p>

        <div className="grid gap-4 md:grid-cols-3">
          {ORDER_STEPS.map((step, index) => {
            const Icon = STEP_ICONS.at(index);
            return (
              <div
                key={step.title}
                className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.05]"
              >
                {Icon && (
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-[#DC2626] dark:bg-red-900/30">
                    <Icon size={20} />
                  </div>
                )}
                <h3 className="mb-2 font-extrabold text-[#1C1512] dark:text-white">
                  {index + 1}. {step.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{step.text}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 py-8">
        <h2 className="mb-3 text-2xl font-black text-[#1C1512] dark:text-white md:text-3xl">
          Pourquoi commander sa viande halal en ligne avec Klik&amp;Go ?
        </h2>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {REASONS.map((item) => (
            <div
              key={item.title}
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

      <section className="mx-auto max-w-4xl px-5 py-8">
        <h2 className="mb-3 text-2xl font-black text-[#1C1512] dark:text-white md:text-3xl">
          Boucheries halal en click &amp; collect dans votre ville
        </h2>
        <p className="mb-5 text-gray-600 dark:text-gray-400">
          Consultez la page de votre ville et de son agglomération :
        </p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {SEO_CITIES.map((c) => (
            <Link
              key={c.slug}
              href={`/boucherie-halal/${c.slug}`}
              prefetch={false}
              className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 transition-colors hover:border-[#DC2626] dark:border-white/10 dark:bg-white/[0.05]"
            >
              <MapPin size={16} className="shrink-0 text-[#DC2626]" />
              <span className="text-sm font-semibold text-[#1C1512] dark:text-white">
                Boucherie halal {c.name}
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
          {FAQS.map((f) => (
            <details
              key={f.question}
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
