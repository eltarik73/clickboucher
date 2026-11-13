import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  Mail,
  Newspaper,
  Quote,
  TrendingUp,
  Users,
  MapPin,
} from "lucide-react";
import prisma from "@/lib/prisma";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

export const metadata: Metadata = {
  // Le titleTemplate root ("%s | Klik&Go") ajoute déjà la marque (audit 2026-06-12).
  title: "Espace presse — Dossier presse",
  description:
    "Dossier de presse Klik&Go : la marketplace click & collect des boucheries halal en Auvergne-Rhône-Alpes. Logos, photos HD, chiffres clés, contact presse.",
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

export const revalidate = 86400; // contenu éditorial + compteurs : 1 régénération / jour suffit

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

      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <Link
            href="/"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/5"
            aria-label="Retour"
          >
            <ArrowLeft size={18} className="text-gray-700 dark:text-gray-300" />
          </Link>
          <h1 className="text-3xl font-black text-[#1C1512] dark:text-white md:text-4xl">
            Espace presse 📰
          </h1>
        </div>

        <p className="mb-8 text-base leading-relaxed text-gray-600 dark:text-gray-400 md:text-lg">
          <strong>Klik&Go</strong> est la marketplace de click & collect dédiée aux boucheries halal
          indépendantes. Notre mission : digitaliser les boucheries de proximité pour permettre aux
          clients de commander leur viande halal en quelques clics et de la récupérer fraîche en
          moins de 30 minutes.
        </p>

        <section className="mb-10 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.05]">
            <div className="mb-1 flex items-center gap-2 text-[#DC2626]">
              <Users size={18} />
              <span className="text-xs font-semibold uppercase tracking-wide">Boucheries</span>
            </div>
            <div className="text-2xl font-extrabold text-[#1C1512] dark:text-white">
              {shopCount}+
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">partenaires actives</div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.05]">
            <div className="mb-1 flex items-center gap-2 text-[#DC2626]">
              <MapPin size={18} />
              <span className="text-xs font-semibold uppercase tracking-wide">Régions</span>
            </div>
            <div className="text-2xl font-extrabold text-[#1C1512] dark:text-white">Aura</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Savoie · Isère · Rhône · Loire
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.05]">
            <div className="mb-1 flex items-center gap-2 text-[#DC2626]">
              <Newspaper size={18} />
              <span className="text-xs font-semibold uppercase tracking-wide">Recettes</span>
            </div>
            <div className="text-2xl font-extrabold text-[#1C1512] dark:text-white">
              {recipeCount}+
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">recettes halal publiées</div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.05]">
            <div className="mb-1 flex items-center gap-2 text-[#DC2626]">
              <TrendingUp size={18} />
              <span className="text-xs font-semibold uppercase tracking-wide">Frais service</span>
            </div>
            <div className="text-2xl font-extrabold text-[#1C1512] dark:text-white">0,99 €</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              par commande, transparent
            </div>
          </div>
        </section>

        <section className="mb-8 rounded-3xl border border-gray-200 bg-white p-6 dark:border-white/10 dark:bg-white/[0.05]">
          <h2 className="mb-3 text-xl font-extrabold text-[#1C1512] dark:text-white">
            Notre histoire
          </h2>
          <p className="leading-relaxed text-gray-700 dark:text-gray-300">
            Klik&Go est né en 2025 d&apos;un constat simple : les boucheries halal de quartier sont
            des piliers de leur communauté, mais elles n&apos;ont ni le temps ni les moyens de
            digitaliser leur activité. Notre plateforme leur fournit en quelques minutes une
            boutique en ligne professionnelle, un système de paiement sécurisé, et une visibilité
            locale optimisée. Le client commande sa viande halal fraîche depuis son téléphone, paye
            en ligne, et la récupère en boutique en moins de 30 minutes — sans frais supplémentaires
            côté boucher, sans abonnement.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-xl font-extrabold text-[#1C1512] dark:text-white">
            <Quote size={20} className="mr-2 inline text-[#DC2626]" />
            Ce qu&apos;on défend
          </h2>
          <div className="space-y-3">
            <div className="rounded-xl border-l-4 border-[#DC2626] bg-white p-4 dark:bg-white/[0.05]">
              <p className="italic text-gray-700 dark:text-gray-300">
                &laquo; Nos boucheries partenaires ne paient aucun abonnement, aucun frais fixe.
                Klik&amp;Go se rémunère uniquement via une commission transparente sur les commandes
                encaissées et des frais de service côté client (0,99 €), pour que la valeur reste
                chez l&apos;artisan. &raquo;
              </p>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                — Tarik Boudefar, fondateur
              </p>
            </div>
            <div className="rounded-xl border-l-4 border-[#DC2626] bg-white p-4 dark:bg-white/[0.05]">
              <p className="italic text-gray-700 dark:text-gray-300">
                &laquo; Le halal en France est encore largement opaque. Klik&Go affiche
                systématiquement l&apos;organisme certificateur sur chaque produit, pour que le
                client achète en confiance. &raquo;
              </p>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                — Tarik Boudefar, fondateur
              </p>
            </div>
          </div>
        </section>

        <section className="mb-8 rounded-3xl border border-red-100 bg-gradient-to-br from-red-50 to-orange-50 p-6 dark:border-red-800 dark:from-red-900/20 dark:to-orange-900/20">
          <h2 className="mb-3 text-xl font-extrabold text-[#1C1512] dark:text-white">
            <Download size={20} className="mr-2 inline text-[#DC2626]" />
            Kit presse à télécharger
          </h2>
          <p className="mb-4 text-sm text-gray-700 dark:text-gray-300">
            Logo officiel, photos haute résolution des boucheries partenaires, captures d&apos;écran
            de l&apos;application. Libres de droits pour tout usage éditorial.
          </p>
          <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-3">
            <a
              href="/icons/icon-512.png"
              download
              className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 transition-colors hover:border-[#DC2626] dark:border-white/10 dark:bg-white/10"
            >
              <Download size={14} /> Logo PNG (512×512)
            </a>
            <a
              href="/og-image.png"
              download
              className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 transition-colors hover:border-[#DC2626] dark:border-white/10 dark:bg-white/10"
            >
              <Download size={14} /> Cover OG (1200×630)
            </a>
            <a
              href="/manifest.json"
              download
              className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 transition-colors hover:border-[#DC2626] dark:border-white/10 dark:bg-white/10"
            >
              <Download size={14} /> Brand manifest
            </a>
          </div>
        </section>

        <section className="mb-8 rounded-3xl border border-gray-200 bg-white p-6 dark:border-white/10 dark:bg-white/[0.05]">
          <h2 className="mb-3 text-xl font-extrabold text-[#1C1512] dark:text-white">
            <Mail size={20} className="mr-2 inline text-[#DC2626]" />
            Contact presse
          </h2>
          <p className="mb-3 text-gray-700 dark:text-gray-300">
            Pour toute demande d&apos;interview, témoignage, ou complément d&apos;information :
          </p>
          <a
            href="mailto:contact@klikandgo.app?subject=Demande presse"
            className="inline-flex items-center gap-2 rounded-xl bg-[#DC2626] px-5 py-3 font-bold text-white transition-colors hover:bg-[#b91c1c]"
          >
            <Mail size={18} /> contact@klikandgo.app
          </a>
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            Réponse sous 24h ouvrées · Disponibilité interview en visio ou téléphone
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-extrabold text-[#1C1512] dark:text-white">
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
