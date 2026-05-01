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
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 900px 500px at 50% 0%, rgba(220,38,38,0.18), transparent 70%)",
          }}
        />
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />

        {/* Header */}
        <header className="relative z-10 border-b border-white/5">
          <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2.5 text-white hover:text-gray-300 transition"
            >
              <ArrowLeft size={18} />
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 bg-[#DC2626] rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-base">K</span>
                </div>
                <span className="text-lg font-bold tracking-tight">Klik&Go</span>
              </div>
            </Link>
            <Link
              href="/sign-in?redirect_url=/espace-boucher"
              className="text-sm text-gray-400 hover:text-white transition"
            >
              Se connecter
            </Link>
          </div>
        </header>

        {/* Hero content */}
        <div className="relative z-10 max-w-4xl mx-auto px-5 py-20 sm:py-28 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/5 border border-white/10 rounded-full text-sm text-gray-400 mb-8 animate-fade-up">
            <MapPin size={14} className="text-[#DC2626]" />
            Boucherie halal &middot; {city.name}, {city.region}
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold text-white tracking-tight leading-[1.1] animate-fade-up">
            Boucher halal à {city.name} ?
            <br />
            <span className="font-serif italic font-normal text-[#FCA5A5]">
              Développez vos ventes
            </span>{" "}
            avec Klik&Go
          </h1>

          <p
            className="mt-6 text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed animate-fade-up"
            style={{ animationDelay: "100ms" }}
          >
            Click &amp; collect, vitrine en ligne, mode cuisine. Aucun abonnement,
            commission uniquement. Rejoignez les boucheries de {city.name} qui
            digitalisent.
          </p>

          {/* Trust signal */}
          {shopCount > 0 && (
            <div
              className="mt-6 inline-flex items-center gap-2 text-sm text-gray-500 animate-fade-up"
              style={{ animationDelay: "150ms" }}
            >
              <span className="inline-flex w-2 h-2 rounded-full bg-emerald-500 animate-pulse-soft" />
              {shopCount} boucherie{shopCount > 1 ? "s" : ""} déjà inscrite
              {shopCount > 1 ? "s" : ""} à {city.name}
            </div>
          )}

          {/* CTA */}
          <div
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10 animate-fade-up"
            style={{ animationDelay: "200ms" }}
          >
            <Link
              href="/inscription-boucher"
              className="group bg-[#DC2626] text-white rounded-xl py-4 px-8 font-semibold hover:bg-[#b91c1c] transition-all shadow-[0_10px_40px_-10px_rgba(220,38,38,0.6)] hover:shadow-[0_20px_50px_-10px_rgba(220,38,38,0.8)] hover:scale-[1.02]"
            >
              <span className="inline-flex items-center gap-2">
                Inscrire ma boucherie gratuitement
                <ArrowRight
                  size={18}
                  className="transition-transform group-hover:translate-x-1"
                />
              </span>
            </Link>
            <Link
              href="/espace-boucher"
              className="border border-white/20 text-white rounded-xl py-4 px-8 font-medium hover:bg-white/5 transition"
            >
              En savoir plus
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════ */}
      {/* 3 ÉTAPES                                  */}
      {/* ══════════════════════════════════════════ */}
      <section className="relative bg-[#0a0a0a] border-t border-white/[0.05] py-20 px-5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14 animate-fade-up">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-[11px] font-semibold tracking-[2px] uppercase text-gray-400 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-soft" />
              Démarrer en 24h
            </span>
            <h2 className="text-3xl sm:text-4xl font-semibold text-white font-display tracking-tight">
              Lancez votre boucherie en ligne
              <br />
              <span className="font-serif italic font-normal text-[#FCA5A5]">
                en 3 étapes simples.
              </span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
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
                  className="relative rounded-2xl p-7 border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.15] transition-all animate-fade-up"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <div className="absolute top-5 right-5 text-xs font-bold text-white/20 tabular-nums">
                    {item.step}
                  </div>
                  <div className="w-12 h-12 bg-[#DC2626]/10 border border-[#DC2626]/20 rounded-xl flex items-center justify-center mb-4">
                    <Icon size={22} className="text-[#DC2626]" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════ */}
      {/* PRICING — 0€/mois (cloned from /espace-boucher) */}
      {/* ══════════════════════════════════════════ */}
      <section className="relative bg-[#0a0a0a] border-t border-white/[0.05] py-24 px-5 overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none opacity-60"
          style={{
            background:
              "radial-gradient(ellipse 800px 400px at 50% 50%, rgba(220,38,38,0.08), transparent 70%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.025] pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />

        <div className="relative max-w-4xl mx-auto">
          <div className="text-center mb-14 animate-fade-up">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-[11px] font-semibold tracking-[2px] uppercase text-gray-400 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-soft" />
              Tarification
            </span>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-white font-display tracking-tight leading-[1.05]">
              Tout ce dont vous avez besoin,
              <br />
              <span className="font-serif italic font-normal text-[#FCA5A5]">
                pour zéro euro.
              </span>
            </h2>
            <p className="text-gray-400 mt-6 max-w-xl mx-auto text-base leading-relaxed">
              Aucun abonnement, aucun frais fixe. Klik&amp;Go se rémunère uniquement
              via une petite commission sur les commandes encaissées —
              <span className="text-gray-300"> vous ne payez que si vous vendez.</span>
            </p>
          </div>

          <div
            className="relative max-w-2xl mx-auto rounded-3xl overflow-hidden animate-fade-up"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.08), 0 30px 80px -20px rgba(220,38,38,0.15), 0 0 0 1px rgba(255,255,255,0.06)",
              animationDelay: "100ms",
            }}
          >
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#DC2626]/60 to-transparent" />

            <div className="p-10 sm:p-12">
              <div className="text-center pb-10 border-b border-white/[0.06]">
                <span className="inline-block text-[10px] font-bold tracking-[3px] uppercase text-[#FCA5A5] bg-[#DC2626]/15 border border-[#DC2626]/25 px-3 py-1.5 rounded-full mb-6">
                  Tout inclus
                </span>
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-7xl sm:text-8xl font-semibold text-white tracking-[-0.04em] leading-none">
                    0
                  </span>
                  <span className="text-4xl sm:text-5xl font-serif italic font-normal text-white/90 leading-none">
                    €
                  </span>
                  <span className="text-base text-gray-500 ml-1 self-end mb-2">
                    / mois
                  </span>
                </div>
                <p className="text-sm text-gray-400 mt-4 max-w-sm mx-auto">
                  Commission transparente uniquement sur les commandes encaissées
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3.5 py-10 border-b border-white/[0.06]">
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
                    <div className="shrink-0 w-4 h-4 mt-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                      <Check size={10} className="text-emerald-400" strokeWidth={3} />
                    </div>
                    <span className="text-sm text-gray-300 leading-relaxed">
                      {feature}
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-8">
                <Link
                  href="/inscription-boucher"
                  className="group relative block w-full text-center overflow-hidden rounded-2xl bg-[#DC2626] hover:bg-[#b91c1c] py-4 px-6 font-semibold text-white text-base shadow-[0_10px_40px_-10px_rgba(220,38,38,0.5)] hover:shadow-[0_20px_50px_-10px_rgba(220,38,38,0.7)] transition-all duration-300 hover:scale-[1.015] active:scale-[0.99]"
                >
                  <span className="relative z-10 inline-flex items-center gap-2">
                    Inscrire ma boucherie à {city.name}
                    <ArrowRight
                      size={18}
                      className="transition-transform group-hover:translate-x-1"
                    />
                  </span>
                  <span
                    className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out pointer-events-none"
                    style={{
                      background:
                        "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.15) 50%, transparent 70%)",
                    }}
                  />
                </Link>
                <div className="flex items-center justify-center gap-x-5 gap-y-1 flex-wrap mt-5 text-[11px] text-gray-500">
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
      <section className="relative bg-[#0a0a0a] border-t border-white/[0.05] py-20 px-5">
        <div className="max-w-4xl mx-auto">
          <div className="mb-10 animate-fade-up">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-[11px] font-semibold tracking-[2px] uppercase text-gray-400 mb-6">
              <MapPin size={11} className="text-[#DC2626]" />
              Marché local
            </span>
            <h2 className="text-3xl sm:text-4xl font-semibold text-white font-display tracking-tight leading-[1.1]">
              Pourquoi {city.name} ?
              <br />
              <span className="font-serif italic font-normal text-[#FCA5A5]">
                Une opportunité réelle.
              </span>
            </h2>
          </div>

          <div
            className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 sm:p-10 animate-fade-up"
            style={{ animationDelay: "100ms" }}
          >
            <p className="text-base text-gray-300 leading-relaxed">
              {city.localContext}
            </p>

            {city.districts.length > 0 && (
              <div className="mt-8 pt-8 border-t border-white/[0.06]">
                <p className="text-sm font-semibold text-white mb-3">
                  Quartiers et communes desservis :
                </p>
                <div className="flex flex-wrap gap-2">
                  {city.districts.map((d) => (
                    <span
                      key={d}
                      className="inline-flex items-center px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-xs text-gray-300"
                    >
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {city.specialty && (
              <div className="mt-6 text-sm text-gray-400">
                <strong className="text-white">
                  Spécialités appréciées à {city.name} :
                </strong>{" "}
                {city.specialty}.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════ */}
      {/* TÉMOIGNAGE                                */}
      {/* ══════════════════════════════════════════ */}
      <section className="relative bg-[#0a0a0a] border-t border-white/[0.05] py-20 px-5">
        <div className="max-w-3xl mx-auto">
          <div
            className="relative rounded-3xl overflow-hidden animate-fade-up"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.08), 0 0 0 1px rgba(255,255,255,0.06)",
            }}
          >
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#DC2626]/60 to-transparent" />
            <div className="p-8 sm:p-12">
              <div className="flex items-center gap-1 mb-5">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    size={16}
                    className="text-[#FCA5A5] fill-[#FCA5A5]"
                  />
                ))}
              </div>

              <blockquote className="text-xl sm:text-2xl text-white font-serif italic leading-relaxed">
                &laquo; Avant Klik&amp;Go, le samedi matin c&apos;était la queue
                jusque dans la rue. Maintenant mes clients commandent la veille,
                je prépare tranquille, et tout le monde est servi en deux minutes.
                Et c&apos;est gratuit. &raquo;
              </blockquote>

              <div className="mt-6 pt-6 border-t border-white/[0.06] flex items-center gap-4">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#DC2626] to-[#b91c1c] flex items-center justify-center text-white font-bold">
                  Y
                </div>
                <div>
                  <p className="font-semibold text-white text-sm">Yacine</p>
                  <p className="text-xs text-gray-400">
                    Boucherie El Houda &middot; {city.name}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════ */}
      {/* FAQ                                       */}
      {/* ══════════════════════════════════════════ */}
      <section className="relative bg-[#0a0a0a] border-t border-white/[0.05] py-20 px-5">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12 animate-fade-up">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-[11px] font-semibold tracking-[2px] uppercase text-gray-400 mb-6">
              FAQ
            </span>
            <h2 className="text-3xl sm:text-4xl font-semibold text-white font-display tracking-tight leading-[1.1]">
              Questions fréquentes
              <br />
              <span className="font-serif italic font-normal text-[#FCA5A5]">
                des bouchers de {city.name}.
              </span>
            </h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <details
                key={i}
                className="group rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden animate-fade-up"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <summary className="flex items-center justify-between cursor-pointer px-5 py-4 font-semibold text-white text-sm sm:text-base hover:bg-white/[0.03] transition-colors">
                  <span>{faq.question}</span>
                  <span className="text-gray-500 group-open:rotate-180 transition-transform ml-4 shrink-0">
                    ▼
                  </span>
                </summary>
                <p className="px-5 pb-5 text-sm text-gray-400 leading-relaxed">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════ */}
      {/* BOTTOM CTA                                */}
      {/* ══════════════════════════════════════════ */}
      <section className="relative bg-[#0a0a0a] border-t border-white/[0.05] py-24 px-5 overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 700px 400px at 50% 50%, rgba(220,38,38,0.15), transparent 70%)",
          }}
        />
        <div className="relative max-w-3xl mx-auto text-center animate-fade-up">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/5 border border-white/10 rounded-full text-sm text-gray-400 mb-8">
            <Store size={14} className="text-[#DC2626]" />
            Boucherie halal &middot; {city.name}
          </div>
          <h2 className="text-4xl sm:text-5xl font-semibold text-white font-display tracking-tight leading-[1.1]">
            Prêt à digitaliser
            <br />
            <span className="font-serif italic font-normal text-[#FCA5A5]">
              votre boucherie ?
            </span>
          </h2>
          <p className="text-gray-400 mt-6 max-w-xl mx-auto">
            L&apos;inscription prend 5 minutes. La validation sous 24h. Aucune carte
            bancaire requise. Vous serez en ligne avant la fin de la semaine.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
            <Link
              href="/inscription-boucher"
              className="group bg-[#DC2626] text-white rounded-xl py-4 px-8 font-semibold hover:bg-[#b91c1c] transition-all shadow-[0_10px_40px_-10px_rgba(220,38,38,0.6)] hover:shadow-[0_20px_50px_-10px_rgba(220,38,38,0.8)] hover:scale-[1.02]"
            >
              <span className="inline-flex items-center gap-2">
                Inscrire ma boucherie gratuitement
                <ArrowRight
                  size={18}
                  className="transition-transform group-hover:translate-x-1"
                />
              </span>
            </Link>
            <a
              href="mailto:contact@klikandgo.app"
              className="border border-white/20 text-white rounded-xl py-4 px-8 font-medium hover:bg-white/5 transition"
            >
              Nous contacter
            </a>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════ */}
      {/* AUTRES VILLES                             */}
      {/* ══════════════════════════════════════════ */}
      <section className="relative bg-[#0a0a0a] border-t border-white/[0.05] py-16 px-5">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-5">
            Devenir partenaire dans d&apos;autres villes
          </h2>
          <div className="flex flex-wrap gap-2">
            {otherCities.map((c) => (
              <Link
                key={c.slug}
                href={`/devenir-boucher-partenaire/${c.slug}`}
                className="px-4 py-2 bg-white/[0.04] border border-white/10 rounded-full text-sm text-gray-300 hover:border-[#DC2626] hover:text-white hover:bg-[#DC2626]/10 transition"
              >
                {c.name}
              </Link>
            ))}
          </div>
          <div className="mt-6 text-xs text-gray-500">
            Voir aussi :{" "}
            <Link
              href={`/boucherie-halal/${city.slug}`}
              className="text-gray-400 hover:text-[#DC2626] underline-offset-2 hover:underline"
            >
              Les boucheries halal de {city.name}
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════ */}
      {/* FOOTER                                    */}
      {/* ══════════════════════════════════════════ */}
      <footer className="bg-[#0a0a0a] border-t border-white/[0.05] py-10">
        <div className="max-w-4xl mx-auto px-5 text-center">
          <p className="text-xs text-gray-500">
            &copy; 2026 Klik&amp;Go &middot; Click &amp; Collect pour boucheries
            halal de proximité &middot;{" "}
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
