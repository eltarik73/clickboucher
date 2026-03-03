import type { Metadata } from "next";
import Link from "next/link";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

export const metadata: Metadata = {
  title: "Klik&Go — Click & Collect Boucherie Halal | Commandez en ligne",
  description:
    "Commandez en ligne chez votre boucherie halal de proximité. Retrait rapide en boutique à Chambéry, Grenoble, Lyon. Frais de service 0,99€ seulement.",
  alternates: { canonical: SITE_URL },
};

// ─────────────────────────────────────────────────────────────
// STEPS DATA
// ─────────────────────────────────────────────────────────────

const STEPS = [
  {
    icon: "🏪",
    title: "Choisissez votre boucherie",
    sub: "Parcourez les boucheries halal près de chez vous",
  },
  {
    icon: "🛒",
    title: "Commandez en quelques clics",
    sub: "Ajoutez vos produits et validez votre commande",
  },
  {
    icon: "📦",
    title: "Récupérez votre commande",
    sub: "Présentez votre QR code et repartez avec vos produits frais",
  },
];

// ─────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────

export default function HomePage() {

  return (
    <div className="min-h-screen">
      {/* ═══════════════════════════════════════════════════════ */}
      {/* HERO — dark premium with red glow                     */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="relative min-h-screen flex flex-col items-center justify-center bg-[#F8F8F6] dark:bg-[#0A0A0A] overflow-hidden transition-colors duration-300">
        {/* Subtle red radial glow behind logo */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] sm:w-[500px] sm:h-[500px] bg-[#DC2626]/[0.06] dark:bg-[#DC2626]/[0.08] blur-[120px] rounded-full pointer-events-none" />

        <div className="relative z-10 text-center px-6 max-w-2xl mx-auto">
          {/* Logo — scale 0.8→1 + fade in */}
          <div className="flex flex-col items-center mb-8 animate-hero-scale">
            <div className="relative">
              {/* Glow behind circle */}
              <div className="absolute inset-0 blur-3xl opacity-25 bg-[#DC2626] rounded-full scale-[2] pointer-events-none" />
              <svg viewBox="0 0 100 100" className="w-20 h-20 sm:w-28 sm:h-28 relative z-10">
                <defs>
                  <linearGradient id="heroLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#a83320" />
                    <stop offset="50%" stopColor="#DC2626" />
                    <stop offset="100%" stopColor="#DC2626" />
                  </linearGradient>
                </defs>
                <circle cx="50" cy="50" r="46" fill="url(#heroLogoGrad)" />
                <path
                  d="M35 25 L35 75 L45 75 L45 55 L60 75 L73 75 L55 52 L72 25 L59 25 L45 47 L45 25 Z"
                  fill="white"
                />
                {/* Speed lines */}
                <g className="animate-pulse-soft">
                  <line x1="75" y1="35" x2="88" y2="35" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.9" />
                  <line x1="78" y1="45" x2="93" y2="45" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
                  <line x1="75" y1="55" x2="86" y2="55" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
                </g>
              </svg>
            </div>
            <h2 className="mt-4 text-2xl sm:text-3xl font-bold tracking-tight font-display text-[#1A1A1A] dark:text-white">
              Klik&amp;Go
            </h2>
          </div>

          {/* Tagline — italic serif (Cormorant Garamond) */}
          <p className="font-serif italic text-xl sm:text-2xl text-[#555] dark:text-white/70 mb-10 animate-fade-up" style={{ animationDelay: "0.3s", animationFillMode: "both" }}>
            Votre boucherie, sans la file d&apos;attente
          </p>

          {/* CTA — red rounded with hover glow */}
          <div className="animate-fade-up" style={{ animationDelay: "0.5s", animationFillMode: "both" }}>
            <Link
              href="/decouvrir"
              className="inline-block px-10 py-4 bg-[#DC2626] text-white font-semibold rounded-full text-base sm:text-lg shadow-lg shadow-[#DC2626]/30 hover:shadow-xl hover:shadow-[#DC2626]/50 hover:bg-[#b91c1c] transition-all duration-300 w-full sm:w-auto"
            >
              Découvrir les boucheries
            </Link>
          </div>

          {/* 3 features — row on desktop, column on mobile */}
          <div className="mt-14 flex flex-col sm:flex-row items-center justify-center gap-5 sm:gap-10 text-sm text-[#777] dark:text-white/50 animate-fade-up" style={{ animationDelay: "0.7s", animationFillMode: "both" }}>
            <div className="flex items-center gap-2">
              <span className="text-lg">📱</span>
              <span>Commandez en ligne</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg">⏱️</span>
              <span>Prêt en 15 min</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg">🥩</span>
              <span>Viande fraîche halal</span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* COMMENT ÇA MARCHE — slightly lighter background       */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="bg-[#F0EDE8] dark:bg-[#111111] py-20 sm:py-28 transition-colors duration-300">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-center text-sm font-semibold text-[#DC2626] uppercase tracking-widest mb-3">
            Simple et rapide
          </p>
          <h2 className="text-center text-3xl sm:text-4xl font-bold text-[#1A1A1A] dark:text-white mb-16 font-display">
            Comment ça marche
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8">
            {STEPS.map((step, idx) => (
              <div key={idx} className="flex flex-col items-center text-center group">
                {/* Icon with numbered badge */}
                <div className="relative mb-6">
                  <div className="w-20 h-20 bg-white dark:bg-[#DC2626]/10 rounded-2xl flex items-center justify-center group-hover:bg-red-50 dark:group-hover:bg-[#DC2626]/15 transition-colors duration-300 shadow-sm">
                    <span className="text-4xl">{step.icon}</span>
                  </div>
                  <div className="absolute -top-2 -right-2 w-7 h-7 bg-[#DC2626] rounded-full flex items-center justify-center shadow-lg shadow-[#DC2626]/30">
                    <span className="text-white text-xs font-bold">{idx + 1}</span>
                  </div>
                </div>

                <h3 className="text-lg font-bold text-[#1A1A1A] dark:text-white mb-2 font-display">
                  {step.title}
                </h3>
                <p className="text-sm text-[#777] dark:text-white/50 max-w-[260px]">
                  {step.sub}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* CTA FINAL                                             */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="bg-[#F8F8F6] dark:bg-[#0A0A0A] py-20 sm:py-24 transition-colors duration-300">
        <div className="max-w-xl mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-[#1A1A1A] dark:text-white mb-6 font-display">
            Fini les files d&apos;attente
          </h2>
          <p className="text-[#777] dark:text-white/50 mb-10 text-lg">
            Commandez en ligne, récupérez en boutique. Simple, rapide, frais.
          </p>
          <Link
            href="/decouvrir"
            className="inline-block px-10 py-4 bg-[#DC2626] text-white font-semibold rounded-full text-base sm:text-lg shadow-lg shadow-[#DC2626]/30 hover:shadow-xl hover:shadow-[#DC2626]/50 hover:bg-[#b91c1c] transition-all duration-300 w-full sm:w-auto"
          >
            Commencer
          </Link>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* FOOTER                                                 */}
      {/* ═══════════════════════════════════════════════════════ */}
      <footer className="bg-[#1A1A1A] dark:bg-[#0A0A0A] text-white py-12">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-2.5 mb-6">
            <div className="w-9 h-9 bg-[#DC2626] rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-base">K</span>
            </div>
            <span className="text-lg font-bold tracking-tight font-display">
              Klik&amp;Go
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-[#888] mb-6">
            <Link href="/decouvrir" className="hover:text-white transition-colors">
              Boucheries
            </Link>
            <span className="text-[#333]">|</span>
            <Link href="/sign-up" className="hover:text-white transition-colors">
              S&apos;inscrire
            </Link>
            <span className="text-[#333]">|</span>
            <span className="cursor-default">CGV</span>
            <span className="text-[#333]">|</span>
            <span className="cursor-default">Mentions légales</span>
          </div>
          <p className="text-xs text-[#555]">
            &copy; 2026 Klik&amp;Go
          </p>
        </div>
      </footer>
    </div>
  );
}
