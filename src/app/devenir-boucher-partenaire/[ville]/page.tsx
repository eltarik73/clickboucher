import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  MapPin,
  Settings,
  Star,
  Store,
  Users,
  Zap,
} from "lucide-react";
import prisma from "@/lib/prisma";
import { SEO_CITIES } from "@/lib/seo/cities";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

// Static-with-revalidation — page content is built from city config + a partner
// count that rarely changes. SSG with hourly revalidation is the right tradeoff.
export const revalidate = 3600;

export async function generateStaticParams() {
  return SEO_CITIES.map((city) => ({ ville: city.slug }));
}

export default async function DevenirBoucherPartenaireVille({
  params,
}: {
  params: { ville: string };
}) {
  const city = SEO_CITIES.find((c) => c.slug === params.ville);
  if (!city) notFound();

  // Trust signal — number of partner shops already onboarded in the city
  const shopCount = await prisma.shop.count({
    where: {
      visible: true,
      city: { contains: city.name, mode: "insensitive" },
    },
  });

  const otherCities = SEO_CITIES.filter((c) => c.slug !== city.slug).slice(0, 8);

  const faqs = [
    {
      question: "Combien ça coûte ?",
      answer: `Klik&Go est 100% gratuit pour votre boucherie à ${city.name} : aucun abonnement, aucun frais fixe, aucun engagement. Une simple commission est prélevée sur les commandes encaissées via la plateforme — vous ne payez que si vous vendez.`,
    },
    {
      question: "Combien de temps pour être en ligne ?",
      answer: `Votre boucherie peut être visible et opérationnelle à ${city.name} en moins de 24 heures. Notre équipe valide votre inscription, configure votre vitrine et vous accompagne pas à pas pour le démarrage.`,
    },
    {
      question: "Faut-il du matériel particulier ?",
      answer:
        "Non, un simple smartphone, une tablette ou un ordinateur suffit. Le Mode Cuisine fonctionne dans n'importe quel navigateur et tient sur un coin du laboratoire. Aucun investissement matériel n'est nécessaire pour démarrer.",
    },
    {
      question: "Quelle commission prélevez-vous ?",
      answer:
        "Une commission unique et transparente est appliquée sur le montant des commandes passées via Klik&Go. Aucune commission sur les ventes en boutique, aucun frais caché. Le détail vous est communiqué lors de l'inscription, sans surprise.",
    },
    {
      question: "Comment se faire payer ?",
      answer:
        "Pour les commandes payées en ligne, les fonds sont reversés directement sur le compte bancaire de votre boucherie via virement automatique. Pour les commandes payées sur place, vous encaissez votre client comme d'habitude au moment du retrait.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* ── SEO Schemas ── */}
      <BreadcrumbSchema
        items={[
          { name: "Accueil", url: SITE_URL },
          { name: "Devenir partenaire boucher", url: `${SITE_URL}/espace-boucher` },
          {
            name: city.name,
            url: `${SITE_URL}/devenir-boucher-partenaire/${city.slug}`,
          },
        ]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((faq) => ({
              "@type": "Question",
              name: faq.question,
              acceptedAnswer: { "@type": "Answer", text: faq.answer },
            })),
          }),
        }}
      />

      {/* ══════════════════════════════════════════ */}
      {/* HERO — Dark premium                        */}
      {/* ══════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-[#0a0a0a]">
        {/* Radial glow */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 900px 500px at 50% 0%, rgba(220,38,38,0.18), transparent 70%)",
          }}
        />
        {/* Grid pattern */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />

        {/* Header */}
        <header className="relative z-10 border-b border-white/5">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
            <Link
              href="/"
              className="flex items-center gap-2.5 text-white transition hover:text-gray-300"
            >
              <ArrowLeft size={18} />
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#DC2626]">
                  <span className="text-base font-bold text-white">K</span>
                </div>
                <span className="text-lg font-bold tracking-tight">Klik&Go</span>
              </div>
            </Link>
            <Link
              href="/sign-in?redirect_url=/espace-boucher"
              className="text-sm text-gray-400 transition hover:text-white"
            >
              Se connecter
            </Link>
          </div>
        </header>

        {/* Hero content */}
        <div className="relative z-10 mx-auto max-w-4xl px-5 py-20 text-center sm:py-28">
          <div className="mb-8 inline-flex animate-fade-up items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-gray-400">
            <MapPin size={14} className="text-[#DC2626]" />
            Boucherie halal &middot; {city.name}, {city.region}
          </div>

          <h1 className="animate-fade-up text-3xl font-bold leading-[1.1] tracking-tight text-white sm:text-4xl lg:text-5xl xl:text-6xl">
            Boucher halal à {city.name} ? <br />
            <span className="font-serif font-normal italic text-[#FCA5A5]">
              Développez vos ventes
            </span>{" "}
            avec Klik&Go
          </h1>

          <p
            className="mx-auto mt-6 max-w-2xl animate-fade-up text-lg leading-relaxed text-gray-400"
            style={{ animationDelay: "100ms" }}
          >
            Click &amp; collect, vitrine en ligne, mode cuisine. Aucun abonnement, commission
            uniquement. Rejoignez les boucheries de {city.name} qui digitalisent.
          </p>

          {/* Trust signal */}
          {shopCount > 0 && (
            <div
              className="mt-6 inline-flex animate-fade-up items-center gap-2 text-sm text-gray-500"
              style={{ animationDelay: "150ms" }}
            >
              <span className="inline-flex h-2 w-2 animate-pulse-soft rounded-full bg-emerald-500" />
              {shopCount} boucherie{shopCount > 1 ? "s" : ""} déjà inscrite
              {shopCount > 1 ? "s" : ""} à {city.name}
            </div>
          )}

          {/* CTA */}
          <div
            className="mt-10 flex animate-fade-up flex-col items-center justify-center gap-4 sm:flex-row"
            style={{ animationDelay: "200ms" }}
          >
            <Link
              href="/inscription-boucher"
              className="group rounded-xl bg-[#DC2626] px-8 py-4 font-semibold text-white shadow-[0_10px_40px_-10px_rgba(220,38,38,0.6)] transition-all hover:scale-[1.02] hover:bg-[#b91c1c] hover:shadow-[0_20px_50px_-10px_rgba(220,38,38,0.8)]"
            >
              <span className="inline-flex items-center gap-2">
                Inscrire ma boucherie gratuitement
                <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
            <Link
              href="/espace-boucher"
              className="rounded-xl border border-white/20 px-8 py-4 font-medium text-white transition hover:bg-white/5"
            >
              En savoir plus
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════ */}
      {/* 3 ÉTAPES                                  */}
      {/* ══════════════════════════════════════════ */}
      <section className="relative border-t border-white/[0.05] bg-[#0a0a0a] px-5 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 animate-fade-up text-center">
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[2px] text-gray-400">
              <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-emerald-400" />
              Démarrer en 24h
            </span>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Lancez votre boucherie en ligne
              <br />
              <span className="font-serif font-normal italic text-[#FCA5A5]">
                en 3 étapes simples.
              </span>
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {[
              {
                step: "01",
                icon: Users,
                title: "Inscription",
                desc: `Renseignez les informations de votre boucherie à ${city.name}. Inscription 100% gratuite, validation sous 24h.`,
              },
              {
                step: "02",
                icon: Settings,
                title: "Configuration",
                desc: "Ajoutez votre catalogue, vos horaires, vos créneaux de retrait. Notre équipe vous accompagne à chaque étape.",
              },
              {
                step: "03",
                icon: Zap,
                title: "Premières ventes",
                desc: `Recevez vos premières commandes click & collect. Mode Cuisine, notifications, fidélité — tout est inclus.`,
              },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.step}
                  className="relative animate-fade-up rounded-2xl border border-white/[0.08] bg-white/[0.02] p-7 transition-all hover:border-white/[0.15] hover:bg-white/[0.04]"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <div className="absolute right-5 top-5 text-xs font-bold tabular-nums text-white/20">
                    {item.step}
                  </div>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-[#DC2626]/20 bg-[#DC2626]/10">
                    <Icon size={22} className="text-[#DC2626]" />
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-white">{item.title}</h3>
                  <p className="text-sm leading-relaxed text-gray-400">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════ */}
      {/* PRICING — 0€/mois (cloned from /espace-boucher) */}
      {/* ══════════════════════════════════════════ */}
      <section className="relative overflow-hidden border-t border-white/[0.05] bg-[#0a0a0a] px-5 py-24">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(ellipse 800px 400px at 50% 50%, rgba(220,38,38,0.08), transparent 70%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />

        <div className="relative mx-auto max-w-4xl">
          <div className="mb-14 animate-fade-up text-center">
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[2px] text-gray-400">
              <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-emerald-400" />
              Tarification
            </span>
            <h2 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Tout ce dont vous avez besoin,
              <br />
              <span className="font-serif font-normal italic text-[#FCA5A5]">pour zéro euro.</span>
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-gray-400">
              Aucun abonnement, aucun frais fixe. Klik&amp;Go se rémunère uniquement via une petite
              commission sur les commandes encaissées —
              <span className="text-gray-300"> vous ne payez que si vous vendez.</span>
            </p>
          </div>

          <div
            className="relative mx-auto max-w-2xl animate-fade-up overflow-hidden rounded-3xl"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.08), 0 30px 80px -20px rgba(220,38,38,0.15), 0 0 0 1px rgba(255,255,255,0.06)",
              animationDelay: "100ms",
            }}
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#DC2626]/60 to-transparent" />

            <div className="p-10 sm:p-12">
              <div className="border-b border-white/[0.06] pb-10 text-center">
                <span className="mb-6 inline-block rounded-full border border-[#DC2626]/25 bg-[#DC2626]/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[3px] text-[#FCA5A5]">
                  Tout inclus
                </span>
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-7xl font-semibold leading-none tracking-[-0.04em] text-white sm:text-8xl">
                    0
                  </span>
                  <span className="font-serif text-4xl font-normal italic leading-none text-white/90 sm:text-5xl">
                    €
                  </span>
                  <span className="mb-2 ml-1 self-end text-base text-gray-500">/ mois</span>
                </div>
                <p className="mx-auto mt-4 max-w-sm text-sm text-gray-400">
                  Commission transparente uniquement sur les commandes encaissées
                </p>
              </div>

              <div className="grid grid-cols-1 gap-x-6 gap-y-3.5 border-b border-white/[0.06] py-10 sm:grid-cols-2">
                {[
                  "Vitrine en ligne dédiée",
                  "Catalogue produits illimité",
                  "Click & collect avec QR code",
                  "Mode Cuisine temps réel",
                  "Notifications clients auto",
                  "Programme de fidélité intégré",
                  "Promotions & offres flash",
                  "Statistiques & analytics",
                  "Support 7j/7",
                ].map((feature) => (
                  <div key={feature} className="flex items-start gap-2.5">
                    <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/15">
                      <Check size={10} className="text-emerald-400" strokeWidth={3} />
                    </div>
                    <span className="text-sm leading-relaxed text-gray-300">{feature}</span>
                  </div>
                ))}
              </div>

              <div className="pt-8">
                <Link
                  href="/inscription-boucher"
                  className="group relative block w-full overflow-hidden rounded-2xl bg-[#DC2626] px-6 py-4 text-center text-base font-semibold text-white shadow-[0_10px_40px_-10px_rgba(220,38,38,0.5)] transition-all duration-300 hover:scale-[1.015] hover:bg-[#b91c1c] hover:shadow-[0_20px_50px_-10px_rgba(220,38,38,0.7)] active:scale-[0.99]"
                >
                  <span className="relative z-10 inline-flex items-center gap-2">
                    Inscrire ma boucherie à {city.name}
                    <ArrowRight
                      size={18}
                      className="transition-transform group-hover:translate-x-1"
                    />
                  </span>
                  <span
                    className="pointer-events-none absolute inset-0 -translate-x-full transition-transform duration-1000 ease-out group-hover:translate-x-full"
                    style={{
                      background:
                        "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.15) 50%, transparent 70%)",
                    }}
                  />
                </Link>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[11px] text-gray-500">
                  <span className="inline-flex items-center gap-1.5">
                    <Check size={11} className="text-emerald-500" />
                    Sans engagement
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Check size={11} className="text-emerald-500" />
                    Aucune carte requise
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Check size={11} className="text-emerald-500" />
                    Validation sous 24h
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════ */}
      {/* POURQUOI {VILLE}                          */}
      {/* ══════════════════════════════════════════ */}
      <section className="relative border-t border-white/[0.05] bg-[#0a0a0a] px-5 py-20">
        <div className="mx-auto max-w-4xl">
          <div className="mb-10 animate-fade-up">
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[2px] text-gray-400">
              <MapPin size={11} className="text-[#DC2626]" />
              Marché local
            </span>
            <h2 className="font-display text-3xl font-semibold leading-[1.1] tracking-tight text-white sm:text-4xl">
              Pourquoi {city.name} ?
              <br />
              <span className="font-serif font-normal italic text-[#FCA5A5]">
                Une opportunité réelle.
              </span>
            </h2>
          </div>

          <div
            className="animate-fade-up rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 sm:p-10"
            style={{ animationDelay: "100ms" }}
          >
            <p className="text-base leading-relaxed text-gray-300">{city.localContext}</p>

            {city.districts.length > 0 && (
              <div className="mt-8 border-t border-white/[0.06] pt-8">
                <p className="mb-3 text-sm font-semibold text-white">
                  Quartiers et communes desservis :
                </p>
                <div className="flex flex-wrap gap-2">
                  {city.districts.map((d) => (
                    <span
                      key={d}
                      className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-gray-300"
                    >
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {city.specialty && (
              <div className="mt-6 text-sm text-gray-400">
                <strong className="text-white">Spécialités appréciées à {city.name} :</strong>{" "}
                {city.specialty}.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════ */}
      {/* TÉMOIGNAGE                                */}
      {/* ══════════════════════════════════════════ */}
      <section className="relative border-t border-white/[0.05] bg-[#0a0a0a] px-5 py-20">
        <div className="mx-auto max-w-3xl">
          <div
            className="relative animate-fade-up overflow-hidden rounded-3xl"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 0 0 1px rgba(255,255,255,0.06)",
            }}
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#DC2626]/60 to-transparent" />
            <div className="p-8 sm:p-12">
              <div className="mb-5 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#DC2626]/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[1.5px] text-[#FCA5A5]">
                  Notre promesse
                </span>
              </div>

              {/* Manifest honnête — pas de fake review (audit Bing 2026-05-09 :
                  même témoignage répété sur 45 pages = signal manipulation). */}
              <blockquote className="font-serif text-xl italic leading-relaxed text-white sm:text-2xl">
                &laquo; Le samedi matin avec la file qui dépasse sur le trottoir, ça doit être un
                souvenir, pas une fatalité. Klik&amp;Go fait simple : tes clients commandent la
                veille, tu prépares tranquille, ils retirent en deux minutes. Pas d&apos;abonnement,
                pas de frais cachés &mdash; tu paies seulement quand tu vends. &raquo;
              </blockquote>

              <div className="mt-6 flex items-center gap-4 border-t border-white/[0.06] pt-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#DC2626] to-[#b91c1c] font-bold text-white">
                  K
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">L&apos;équipe Klik&amp;Go</p>
                  <p className="text-xs text-gray-400">Notre engagement à {city.name}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════ */}
      {/* FAQ                                       */}
      {/* ══════════════════════════════════════════ */}
      <section className="relative border-t border-white/[0.05] bg-[#0a0a0a] px-5 py-20">
        <div className="mx-auto max-w-3xl">
          <div className="mb-12 animate-fade-up text-center">
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[2px] text-gray-400">
              FAQ
            </span>
            <h2 className="font-display text-3xl font-semibold leading-[1.1] tracking-tight text-white sm:text-4xl">
              Questions fréquentes
              <br />
              <span className="font-serif font-normal italic text-[#FCA5A5]">
                des bouchers de {city.name}.
              </span>
            </h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <details
                key={i}
                className="group animate-fade-up overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02]"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-sm font-semibold text-white transition-colors hover:bg-white/[0.03] sm:text-base">
                  <span>{faq.question}</span>
                  <span className="ml-4 shrink-0 text-gray-500 transition-transform group-open:rotate-180">
                    ▼
                  </span>
                </summary>
                <p className="px-5 pb-5 text-sm leading-relaxed text-gray-400">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════ */}
      {/* BOTTOM CTA                                */}
      {/* ══════════════════════════════════════════ */}
      <section className="relative overflow-hidden border-t border-white/[0.05] bg-[#0a0a0a] px-5 py-24">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 700px 400px at 50% 50%, rgba(220,38,38,0.15), transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-3xl animate-fade-up text-center">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-gray-400">
            <Store size={14} className="text-[#DC2626]" />
            Boucherie halal &middot; {city.name}
          </div>
          <h2 className="font-display text-4xl font-semibold leading-[1.1] tracking-tight text-white sm:text-5xl">
            Prêt à digitaliser
            <br />
            <span className="font-serif font-normal italic text-[#FCA5A5]">votre boucherie ?</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-gray-400">
            L&apos;inscription prend 5 minutes. La validation sous 24h. Aucune carte bancaire
            requise. Vous serez en ligne avant la fin de la semaine.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/inscription-boucher"
              className="group rounded-xl bg-[#DC2626] px-8 py-4 font-semibold text-white shadow-[0_10px_40px_-10px_rgba(220,38,38,0.6)] transition-all hover:scale-[1.02] hover:bg-[#b91c1c] hover:shadow-[0_20px_50px_-10px_rgba(220,38,38,0.8)]"
            >
              <span className="inline-flex items-center gap-2">
                Inscrire ma boucherie gratuitement
                <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
            <a
              href="mailto:contact@klikandgo.app"
              className="rounded-xl border border-white/20 px-8 py-4 font-medium text-white transition hover:bg-white/5"
            >
              Nous contacter
            </a>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════ */}
      {/* AUTRES VILLES                             */}
      {/* ══════════════════════════════════════════ */}
      <section className="relative border-t border-white/[0.05] bg-[#0a0a0a] px-5 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-5 text-sm font-semibold uppercase tracking-wider text-gray-400">
            Devenir partenaire dans d&apos;autres villes
          </h2>
          <div className="flex flex-wrap gap-2">
            {otherCities.map((c) => (
              <Link
                key={c.slug}
                href={`/devenir-boucher-partenaire/${c.slug}`}
                className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-gray-300 transition hover:border-[#DC2626] hover:bg-[#DC2626]/10 hover:text-white"
              >
                {c.name}
              </Link>
            ))}
          </div>
          <div className="mt-6 text-xs text-gray-500">
            Voir aussi :{" "}
            <Link
              href={`/boucherie-halal/${city.slug}`}
              className="text-gray-400 underline-offset-2 hover:text-[#DC2626] hover:underline"
            >
              Les boucheries halal de {city.name}
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════ */}
      {/* FOOTER                                    */}
      {/* ══════════════════════════════════════════ */}
      <footer className="border-t border-white/[0.05] bg-[#0a0a0a] py-10">
        <div className="mx-auto max-w-4xl px-5 text-center">
          <p className="text-xs text-gray-500">
            &copy; 2026 Klik&amp;Go &middot; Click &amp; Collect pour boucheries halal de proximité
            &middot;{" "}
            <Link href="/mentions-legales" className="hover:text-gray-300">
              Mentions légales
            </Link>{" "}
            &middot;{" "}
            <Link href="/cgv" className="hover:text-gray-300">
              CGV
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
