import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Download, Mail, Newspaper, Quote, TrendingUp, Users, MapPin } from "lucide-react";
import prisma from "@/lib/prisma";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

export const metadata: Metadata = {
  title: "Espace presse — Dossier presse Klik&Go",
  description:
    "Dossier de presse Klik&Go : la marketplace click & collect des boucheries halal en Auvergne-Rhône-Alpes. Logos, photos HD, chiffres clés, contact presse.",
  keywords: [
    "klik and go presse",
    "klikandgo dossier presse",
    "boucherie halal startup",
    "marketplace halal France",
    "click and collect halal",
  ],
  alternates: { canonical: `${SITE_URL}/presse` },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "Klik&Go",
    title: "Espace presse — Klik&Go",
    description: "Dossier de presse Klik&Go : marketplace click & collect des boucheries halal.",
    url: `${SITE_URL}/presse`,
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Klik&Go presse" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Espace presse Klik&Go",
    description: "Marketplace click & collect des boucheries halal en Auvergne-Rhône-Alpes.",
    images: ["/og-image.png"],
  },
};

export const revalidate = 3600;

export default async function PressePage() {
  const [shopCount, recipeCount] = await Promise.all([
    prisma.shop.count({ where: { visible: true } }),
    prisma.recipe.count({ where: { published: true } }),
  ]);

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      <BreadcrumbSchema
        items={[
          { name: "Accueil", url: SITE_URL },
          { name: "Presse", url: `${SITE_URL}/presse` },
        ]}
      />

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/"
            className="w-11 h-11 flex items-center justify-center rounded-xl bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors shrink-0"
            aria-label="Retour"
          >
            <ArrowLeft size={18} className="text-gray-700 dark:text-gray-300" />
          </Link>
          <h1 className="text-3xl md:text-4xl font-black text-[#1C1512] dark:text-white">
            Espace presse 📰
          </h1>
        </div>

        <p className="text-gray-600 dark:text-gray-400 text-base md:text-lg leading-relaxed mb-8">
          <strong>Klik&Go</strong> est la marketplace de click & collect dédiée aux boucheries
          halal indépendantes. Notre mission : digitaliser les boucheries de proximité pour
          permettre aux clients de commander leur viande halal en quelques clics et de la
          récupérer fraîche en moins de 30 minutes.
        </p>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
          <div className="bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/10 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-[#DC2626] mb-1">
              <Users size={18} />
              <span className="text-xs font-semibold uppercase tracking-wide">Boucheries</span>
            </div>
            <div className="text-2xl font-extrabold text-[#1C1512] dark:text-white">
              {shopCount}+
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">partenaires actives</div>
          </div>
          <div className="bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/10 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-[#DC2626] mb-1">
              <MapPin size={18} />
              <span className="text-xs font-semibold uppercase tracking-wide">Régions</span>
            </div>
            <div className="text-2xl font-extrabold text-[#1C1512] dark:text-white">
              Aura
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Savoie · Isère · Rhône · Loire</div>
          </div>
          <div className="bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/10 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-[#DC2626] mb-1">
              <Newspaper size={18} />
              <span className="text-xs font-semibold uppercase tracking-wide">Recettes</span>
            </div>
            <div className="text-2xl font-extrabold text-[#1C1512] dark:text-white">
              {recipeCount}+
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">recettes halal publiées</div>
          </div>
          <div className="bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/10 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-[#DC2626] mb-1">
              <TrendingUp size={18} />
              <span className="text-xs font-semibold uppercase tracking-wide">Frais service</span>
            </div>
            <div className="text-2xl font-extrabold text-[#1C1512] dark:text-white">
              0,99 €
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">par commande, transparent</div>
          </div>
        </section>

        <section className="bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/10 rounded-3xl p-6 mb-8">
          <h2 className="text-xl font-extrabold text-[#1C1512] dark:text-white mb-3">
            Notre histoire
          </h2>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            Klik&Go est né en 2025 d&apos;un constat simple : les boucheries halal de quartier sont
            des piliers de leur communauté, mais elles n&apos;ont ni le temps ni les moyens de
            digitaliser leur activité. Notre plateforme leur fournit en quelques minutes une
            boutique en ligne professionnelle, un système de paiement sécurisé, et une visibilité
            locale optimisée. Le client commande sa viande halal fraîche depuis son téléphone,
            paye en ligne, et la récupère en boutique en moins de 30 minutes — sans frais
            supplémentaires côté boucher, sans abonnement.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-extrabold text-[#1C1512] dark:text-white mb-4">
            <Quote size={20} className="inline mr-2 text-[#DC2626]" />
            Ce qu&apos;on défend
          </h2>
          <div className="space-y-3">
            <div className="bg-white dark:bg-white/[0.05] border-l-4 border-[#DC2626] rounded-xl p-4">
              <p className="text-gray-700 dark:text-gray-300 italic">
                &laquo; Nos boucheries partenaires ne paient ni abonnement ni commission cachée.
                On se rémunère uniquement sur les frais de service côté client (0,99 €), pour
                que la valeur reste chez l&apos;artisan. &raquo;
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">— Tarik Boudefar, fondateur</p>
            </div>
            <div className="bg-white dark:bg-white/[0.05] border-l-4 border-[#DC2626] rounded-xl p-4">
              <p className="text-gray-700 dark:text-gray-300 italic">
                &laquo; Le halal en France est encore largement opaque. Klik&Go affiche
                systématiquement l&apos;organisme certificateur sur chaque produit, pour que le
                client achète en confiance. &raquo;
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">— Tarik Boudefar, fondateur</p>
            </div>
          </div>
        </section>

        <section className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border border-red-100 dark:border-red-800 rounded-3xl p-6 mb-8">
          <h2 className="text-xl font-extrabold text-[#1C1512] dark:text-white mb-3">
            <Download size={20} className="inline mr-2 text-[#DC2626]" />
            Kit presse à télécharger
          </h2>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
            Logo officiel, photos haute résolution des boucheries partenaires, captures d&apos;écran
            de l&apos;application. Libres de droits pour tout usage éditorial.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
            <a
              href="/icons/icon-512.png"
              download
              className="flex items-center gap-2 bg-white dark:bg-white/10 px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 hover:border-[#DC2626] transition-colors"
            >
              <Download size={14} /> Logo PNG (512×512)
            </a>
            <a
              href="/og-image.png"
              download
              className="flex items-center gap-2 bg-white dark:bg-white/10 px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 hover:border-[#DC2626] transition-colors"
            >
              <Download size={14} /> Cover OG (1200×630)
            </a>
            <a
              href="/manifest.json"
              download
              className="flex items-center gap-2 bg-white dark:bg-white/10 px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 hover:border-[#DC2626] transition-colors"
            >
              <Download size={14} /> Brand manifest
            </a>
          </div>
        </section>

        <section className="bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/10 rounded-3xl p-6 mb-8">
          <h2 className="text-xl font-extrabold text-[#1C1512] dark:text-white mb-3">
            <Mail size={20} className="inline mr-2 text-[#DC2626]" />
            Contact presse
          </h2>
          <p className="text-gray-700 dark:text-gray-300 mb-3">
            Pour toute demande d&apos;interview, témoignage, ou complément d&apos;information :
          </p>
          <a
            href="mailto:contact@klikandgo.app?subject=Demande presse"
            className="inline-flex items-center gap-2 px-5 py-3 bg-[#DC2626] text-white rounded-xl font-bold hover:bg-[#b91c1c] transition-colors"
          >
            <Mail size={18} /> contact@klikandgo.app
          </a>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
            Réponse sous 24h ouvrées · Disponibilité interview en visio ou téléphone
          </p>
        </section>

        <section>
          <h2 className="text-xl font-extrabold text-[#1C1512] dark:text-white mb-3">
            Liens utiles
          </h2>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/" className="text-[#DC2626] hover:underline">
                Page d&apos;accueil
              </Link>
            </li>
            <li>
              <Link href="/avantages" className="text-[#DC2626] hover:underline">
                Pourquoi choisir Klik&Go (avantages)
              </Link>
            </li>
            <li>
              <Link href="/recettes" className="text-[#DC2626] hover:underline">
                Recettes halal
              </Link>
            </li>
            <li>
              <Link href="/inscription-boucher" className="text-[#DC2626] hover:underline">
                Espace dédié aux boucheries
              </Link>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
