import type { Metadata } from "next";
import Link from "next/link";
import { Mail, ArrowLeft, Clock, MessageSquare, Shield, HelpCircle } from "lucide-react";
import { LastUpdated } from "@/components/seo/LastUpdated";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";
const PAGE_LAST_UPDATED = "2026-05-09";

export const metadata: Metadata = {
  title: "Contact — Support client Klik&Go",
  description:
    "Contactez l'équipe Klik&Go : support client (réponse 48h ouvrées), boucherie partenaire, presse, partenariats. Email contact@klikandgo.app, horaires lun-ven 9h-18h.",
  alternates: { canonical: `${SITE_URL}/contact` },
  openGraph: {
    title: "Contact — Support client Klik&Go",
    description:
      "Une question, un souci de commande, devenir boucher partenaire ? Notre équipe vous répond sous 48h ouvrées.",
    url: `${SITE_URL}/contact`,
    siteName: "Klik&Go",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Contact Klik&Go" }],
  },
};

const FAQS = [
  {
    q: "Comment suivre l'état de ma commande ?",
    a: "Une fois la commande passée, vous recevez un email avec un lien de suivi en temps réel. Vous voyez chaque étape : commande reçue par le boucher, en préparation, prête à retirer. Si vous avez créé un compte, l'historique est aussi disponible dans votre espace personnel.",
  },
  {
    q: "J'ai un problème avec ma commande, que faire ?",
    a: "Contactez d'abord directement la boucherie via le numéro affiché sur la fiche boutique — ils peuvent corriger immédiatement (poids, produit manquant, créneau). Si le problème persiste ou s'il y a un litige, écrivez-nous à contact@klikandgo.app avec votre numéro de commande, nous arbitrons sous 48h ouvrées.",
  },
  {
    q: "Comment devenir boucher partenaire Klik&Go ?",
    a: "Inscription 100% gratuite, aucun abonnement, commission uniquement quand vous vendez. Rendez-vous sur notre page dédiée /espace-boucher pour démarrer. Le setup prend 24-48h : nous validons votre boucherie halal certifiée, vous recevez un accès au back-office, vous chargez votre catalogue, et vous êtes en ligne. Pas d'engagement, vous pouvez partir quand vous voulez.",
  },
  {
    q: "Mes données personnelles sont-elles protégées ?",
    a: "Oui. Klik&Go est conforme RGPD. Vos données ne sont jamais revendues à des tiers, jamais utilisées pour de la publicité ciblée externe. Le détail complet est dans notre politique de confidentialité. Vous pouvez à tout moment demander l'export ou la suppression de vos données via contact@klikandgo.app.",
  },
  {
    q: "Je suis journaliste / média, comment vous contacter ?",
    a: "Pour toute demande presse (interview, étude de cas, dossier sur le marché halal en France), écrivez à contact@klikandgo.app avec « Presse » en objet. Nous répondons sous 24h ouvrées en semaine. Notre fondateur Tarik est disponible pour des interviews vidéo ou écrites.",
  },
  {
    q: "Je veux signaler un problème (boucherie, contenu, abus)",
    a: "Pour signaler un problème de modération (boucherie qui n'est pas réellement halal, contenu inapproprié, comportement abusif), écrivez à contact@klikandgo.app avec « Signalement » en objet et un maximum de détails (URL, captures, commande concernée). Nous traitons sous 48h.",
  },
];

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      <BreadcrumbSchema
        items={[
          { name: "Accueil", url: SITE_URL },
          { name: "Contact", url: `${SITE_URL}/contact` },
        ]}
      />
      {/* FAQPage schema — exposé aux IA + Rich Results Google */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQS.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }),
        }}
      />
      {/* ContactPage + ContactPoint schema (E-E-A-T signal) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ContactPage",
            "@id": `${SITE_URL}/contact`,
            name: "Contact Klik&Go",
            url: `${SITE_URL}/contact`,
            inLanguage: "fr-FR",
            isPartOf: { "@type": "WebSite", "@id": SITE_URL, name: "Klik&Go" },
            mainEntity: {
              "@type": "Organization",
              name: "Klik&Go",
              url: SITE_URL,
              email: "contact@klikandgo.app",
              contactPoint: [
                {
                  "@type": "ContactPoint",
                  contactType: "customer service",
                  email: "contact@klikandgo.app",
                  availableLanguage: ["French", "Arabic"],
                  hoursAvailable: {
                    "@type": "OpeningHoursSpecification",
                    dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                    opens: "09:00",
                    closes: "18:00",
                  },
                },
                {
                  "@type": "ContactPoint",
                  contactType: "press relations",
                  email: "contact@klikandgo.app",
                  availableLanguage: ["French"],
                },
                {
                  "@type": "ContactPoint",
                  contactType: "technical support",
                  email: "contact@klikandgo.app",
                  availableLanguage: ["French"],
                },
              ],
            },
          }),
        }}
      />

      <div className="mx-auto max-w-3xl px-5 py-10">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 transition hover:text-[#DC2626] dark:text-gray-400"
        >
          <ArrowLeft size={14} /> Retour à l&apos;accueil
        </Link>

        <h1 className="font-display text-3xl font-black text-gray-900 dark:text-white sm:text-4xl">
          Contact
        </h1>
        <p className="mt-3 max-w-2xl text-base text-gray-600 dark:text-gray-400">
          Une question sur une commande, un problème technique, devenir boucher partenaire, demande
          presse ? Notre équipe vous répond sous <strong>48h ouvrées</strong>. Pour les urgences sur
          une commande en cours, contactez d&apos;abord directement la boucherie via le numéro
          affiché sur sa fiche.
        </p>
        <LastUpdated date={PAGE_LAST_UPDATED} className="mt-3" />

        {/* ── Canaux de contact ── */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <a
            href="mailto:contact@klikandgo.app"
            className="group flex items-center gap-4 rounded-2xl border border-[#ece8e3] bg-white p-5 transition hover:border-[#DC2626] hover:shadow-md dark:border-white/[0.06] dark:bg-gray-800"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#DC2626]/10">
              <Mail size={20} className="text-[#DC2626]" />
            </div>
            <div>
              <div className="text-sm font-bold text-gray-900 dark:text-white">Nous écrire</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">contact@klikandgo.app</div>
            </div>
          </a>

          <Link
            href="/espace-boucher"
            className="group flex items-center gap-4 rounded-2xl border border-[#ece8e3] bg-white p-5 transition hover:border-[#DC2626] hover:shadow-md dark:border-white/[0.06] dark:bg-gray-800"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#DC2626]/10 text-xl">
              🥩
            </div>
            <div>
              <div className="text-sm font-bold text-gray-900 dark:text-white">Espace boucher</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Devenir partenaire</div>
            </div>
          </Link>
        </div>

        {/* ── Notre engagement (SLA) ── */}
        <section className="mt-10">
          <h2 className="mb-4 font-display text-xl font-bold text-gray-900 dark:text-white">
            Notre engagement
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                icon: Clock,
                title: "Réponse 48h ouvrées",
                desc: "Lundi à vendredi 9h-18h. Hors jours fériés.",
              },
              {
                icon: MessageSquare,
                title: "Litiges sous 5 jours",
                desc: "Médiation neutre boucher / client si besoin.",
              },
              {
                icon: Shield,
                title: "RGPD respecté",
                desc: "Vos données ne sont ni vendues ni partagées.",
              },
            ].map((item, i) => (
              <div
                key={i}
                className="rounded-2xl border border-[#ece8e3] bg-white p-4 dark:border-white/[0.06] dark:bg-gray-800"
              >
                <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-[#DC2626]/10 text-[#DC2626]">
                  <item.icon size={16} />
                </div>
                <div className="text-sm font-bold text-gray-900 dark:text-white">{item.title}</div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="mt-12">
          <div className="mb-5 flex items-center gap-2">
            <HelpCircle size={20} className="text-[#DC2626]" />
            <h2 className="font-display text-xl font-bold text-gray-900 dark:text-white">
              Questions fréquentes
            </h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <details
                key={i}
                className="group overflow-hidden rounded-2xl border border-[#ece8e3] bg-white dark:border-white/[0.06] dark:bg-gray-800"
              >
                <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-sm font-semibold text-gray-900 dark:text-white">
                  {faq.q}
                  <span className="ml-3 shrink-0 text-gray-500 transition-transform group-open:rotate-180 dark:text-gray-400">
                    ▼
                  </span>
                </summary>
                <p className="px-5 pb-4 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* ── Mentions légales ── */}
        <div className="mt-10 rounded-2xl border border-[#ece8e3] bg-white p-5 dark:border-white/[0.06] dark:bg-gray-800">
          <h2 className="mb-2 text-lg font-bold text-gray-900 dark:text-white">
            Informations légales
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Klik&amp;Go &mdash; Plateforme de click &amp; collect pour boucheries halal en France.
            Édité par Klik&amp;Go SAS, dont le siège social est en France. Hébergement : Vercel (US)
            pour le frontend, Railway (EU) pour la base de données. Retrouvez nos{" "}
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
