import type { Metadata } from "next";
import Link from "next/link";
import { Mail, ArrowLeft } from "lucide-react";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contactez l'équipe Klik&Go pour toute question sur le click & collect, votre commande, ou devenir boucher partenaire.",
  alternates: { canonical: `${SITE_URL}/contact` },
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      <div className="max-w-2xl mx-auto px-5 py-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-[#DC2626] mb-6 transition"
        >
          <ArrowLeft size={14} /> Retour à l&apos;accueil
        </Link>

        <h1 className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white font-display">
          Contact
        </h1>
        <p className="mt-3 text-base text-gray-600 dark:text-gray-400">
          Une question, une suggestion, un problème sur votre commande ? Nous
          vous répondons sous 48h ouvrées.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <a
            href="mailto:contact@klikandgo.app"
            className="group flex items-center gap-4 bg-white dark:bg-gray-800 border border-[#ece8e3] dark:border-white/[0.06] rounded-2xl p-5 hover:border-[#DC2626] hover:shadow-md transition"
          >
            <div className="w-11 h-11 rounded-xl bg-[#DC2626]/10 flex items-center justify-center">
              <Mail size={20} className="text-[#DC2626]" />
            </div>
            <div>
              <div className="text-sm font-bold text-gray-900 dark:text-white">
                Nous écrire
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                contact@klikandgo.app
              </div>
            </div>
          </a>

          <Link
            href="/espace-boucher"
            className="group flex items-center gap-4 bg-white dark:bg-gray-800 border border-[#ece8e3] dark:border-white/[0.06] rounded-2xl p-5 hover:border-[#DC2626] hover:shadow-md transition"
          >
            <div className="w-11 h-11 rounded-xl bg-[#DC2626]/10 flex items-center justify-center text-xl">
              🥩
            </div>
            <div>
              <div className="text-sm font-bold text-gray-900 dark:text-white">
                Espace boucher
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Devenir partenaire
              </div>
            </div>
          </Link>
        </div>

        <div className="mt-8 p-5 bg-white dark:bg-gray-800 border border-[#ece8e3] dark:border-white/[0.06] rounded-2xl">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
            Informations légales
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Klik&amp;Go — Plateforme de click &amp; collect pour boucheries halal
            en France. Retrouvez nos{" "}
            <Link href="/mentions-legales" className="text-[#DC2626] hover:underline">
              mentions légales
            </Link>{" "}
            et notre{" "}
            <Link href="/politique-de-confidentialite" className="text-[#DC2626] hover:underline">
              politique de confidentialité
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
