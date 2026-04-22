import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

export const metadata: Metadata = {
  title: "À propos de Klik&Go",
  description:
    "Klik&Go est une plateforme click & collect dédiée aux boucheries halal. Notre mission : zéro file d'attente, zéro stress, 100% frais.",
  alternates: { canonical: `${SITE_URL}/a-propos` },
};

export default function AProposPage() {
  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      <div className="max-w-3xl mx-auto px-5 py-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-[#DC2626] mb-6 transition"
        >
          <ArrowLeft size={14} /> Retour à l&apos;accueil
        </Link>

        <h1 className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white font-display">
          À propos de Klik&amp;Go
        </h1>

        <div className="prose prose-sm dark:prose-invert mt-6 max-w-none text-gray-700 dark:text-gray-300 space-y-5">
          <p>
            Klik&amp;Go est la première plateforme de click &amp; collect
            dédiée aux boucheries halal en France. Notre mission : permettre à
            chacun de commander sa viande halal en ligne, et la retirer
            rapidement en boutique, sans faire la queue.
          </p>

          <h2 className="text-xl font-bold text-gray-900 dark:text-white mt-8">
            Pourquoi Klik&amp;Go ?
          </h2>
          <p>
            Le samedi, le vendredi soir, pendant le Ramadan — les boucheries
            halal sont saturées. Files d&apos;attente de 30 minutes, commandes
            perdues, stress inutile. Klik&amp;Go digitalise ce parcours avec un
            outil simple : le client commande en ligne, paie ou réserve, le
            boucher prépare, le client récupère. Zero file. Zero stress. 100%
            frais.
          </p>

          <h2 className="text-xl font-bold text-gray-900 dark:text-white mt-8">
            Soutenir les bouchers locaux
          </h2>
          <p>
            Contrairement aux géants de la livraison qui prennent 30% de
            commission, Klik&amp;Go facture 0,99 € de frais de service par
            commande, payés par le client. Les bouchers gardent 100% de leur
            marge. Notre objectif : donner aux artisans halal les mêmes outils
            numériques que les grandes chaînes.
          </p>

          <h2 className="text-xl font-bold text-gray-900 dark:text-white mt-8">
            100% halal, 100% local
          </h2>
          <p>
            Toutes les boucheries référencées sur Klik&amp;Go sont des
            boucheries halal vérifiées. La certification relève de chaque
            boucher partenaire, dont le sérieux est notre priorité lors de
            l&apos;onboarding.
          </p>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/"
            className="px-5 py-3 bg-[#DC2626] text-white rounded-full text-sm font-semibold hover:bg-[#b91c1c] transition"
          >
            Voir les boucheries
          </Link>
          <Link
            href="/espace-boucher"
            className="px-5 py-3 bg-white dark:bg-gray-800 border border-[#ece8e3] dark:border-white/[0.06] rounded-full text-sm font-semibold hover:border-[#DC2626] transition"
          >
            Je suis boucher
          </Link>
          <Link
            href="/contact"
            className="px-5 py-3 bg-white dark:bg-gray-800 border border-[#ece8e3] dark:border-white/[0.06] rounded-full text-sm font-semibold hover:border-[#DC2626] transition"
          >
            Nous contacter
          </Link>
        </div>
      </div>
    </div>
  );
}
