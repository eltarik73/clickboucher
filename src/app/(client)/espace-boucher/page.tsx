"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import {
  Store,
  Check,
  ChevronDown,
  ChevronUp,
  Zap,
  Settings,
  Users,
  ArrowLeft,
} from "lucide-react";

// ─────────────────────────────────────────────────
// ANIMATED COUNTER
// ─────────────────────────────────────────────────
function AnimatedStat({
  value,
  suffix,
  label,
}: {
  value: number;
  suffix: string;
  label: string;
}) {
  const [count, setCount] = useState(value);
  const ref = useRef<HTMLDivElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          // Animate from 0 to value
          let start = 0;
          const duration = 1500;
          const step = Math.ceil(value / (duration / 16));
          const timer = setInterval(() => {
            start += step;
            if (start >= value) {
              setCount(value);
              clearInterval(timer);
            } else {
              setCount(start);
            }
          }, 16);
        }
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value, hasAnimated]);

  return (
    <div ref={ref} className="text-center">
      <p className="text-3xl sm:text-4xl font-bold text-white">
        {count}
        {suffix}
      </p>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{label}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────
// FAQ ITEM
// ─────────────────────────────────────────────────
function FaqItem({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-[#ece8e3] dark:border-white/10 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
      >
        <span className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">
          {question}
        </span>
        {open ? (
          <ChevronUp size={18} className="text-gray-500 dark:text-gray-400 shrink-0 ml-4" />
        ) : (
          <ChevronDown size={18} className="text-gray-500 dark:text-gray-400 shrink-0 ml-4" />
        )}
      </button>
      {open && (
        <div className="px-5 pb-5 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          {answer}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────
export default function EspaceBoucherPage() {
  const { user, isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  const role = user?.publicMetadata?.role as string | undefined;

  // Boucher connected → show dashboard access button
  if (isLoaded && isSignedIn && (role === "boucher" || role === "admin" || role === "webmaster")) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-5">
        <div className="bg-[#141414] border border-white/10 rounded-2xl p-8 text-center max-w-sm w-full">
          <div className="w-14 h-14 bg-[#DC2626]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Store size={28} className="text-[#DC2626]" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Bienvenue, {user.firstName} !</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Accédez à votre espace boucher pour gérer votre boucherie.</p>
          <button
            onClick={() => router.push("/boucher/dashboard")}
            className="w-full bg-[#DC2626] text-white rounded-xl py-3 font-semibold hover:bg-[#b91c1c] transition-colors"
          >
            Accéder à mon dashboard →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      {/* ══════════════════════════════════════════ */}
      {/* HERO                                      */}
      {/* ══════════════════════════════════════════ */}
      <section className="relative bg-[#1a1a1a] overflow-hidden">
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
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
                <span className="text-lg font-bold tracking-tight">
                  Klik&Go
                </span>
              </div>
            </Link>
            <Link
              href="/sign-in?redirect_url=/espace-boucher"
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-white transition"
            >
              Se connecter
            </Link>
          </div>
        </header>

        {/* Hero content */}
        <div className="relative z-10 max-w-4xl mx-auto px-5 py-20 sm:py-28 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/5 border border-white/10 rounded-full text-sm text-gray-500 dark:text-gray-400 mb-8">
            <Store size={14} />
            Espace professionnel boucher
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight leading-[1.15]">
            Développez votre boucherie
            <br />
            <span className="text-[#DC2626]">avec Klik&Go</span>
          </h1>

          <p className="mt-5 text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
            Rejoignez les boucheries de Chambéry qui ont supprimé les files
            d&apos;attente et augmenté leur chiffre d&apos;affaires.
          </p>

          {/* Stats */}
          <div className="flex items-center justify-center gap-8 sm:gap-16 mt-12">
            <AnimatedStat value={10} suffix="+" label="boucheries" />
            <div className="w-px h-12 bg-white/10" />
            <AnimatedStat value={2000} suffix="+" label="commandes" />
            <div className="w-px h-12 bg-white/10" />
            <AnimatedStat value={4} suffix=".7★" label="satisfaction" />
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-12">
            <Link
              href="/inscription-boucher"
              className="bg-[#DC2626] text-white rounded-xl py-3 px-8 font-semibold hover:bg-[#b91c1c] transition-colors shadow-lg shadow-[#DC2626]/20"
            >
              Ajouter ma boucherie
            </Link>
            <Link
              href="/sign-in?redirect_url=/espace-boucher"
              className="border border-white/30 text-white rounded-xl py-3 px-8 font-medium hover:bg-white/5 transition-colors"
            >
              Se connecter
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════ */}
      {/* OFFRE — Premium dark pricing card           */}
      {/* ══════════════════════════════════════════ */}
      <section className="relative bg-[#0a0a0a] py-32 px-5 overflow-hidden">
        {/* Subtle radial glow */}
        <div
          className="absolute inset-0 pointer-events-none opacity-60"
          style={{
            background:
              "radial-gradient(ellipse 800px 400px at 50% 50%, rgba(220,38,38,0.08), transparent 70%)",
          }}
        />
        {/* Grid pattern subtle */}
        <div
          className="absolute inset-0 opacity-[0.025] pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />

        <div className="relative max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-16 animate-fade-up">
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

          {/* Pricing card — glassmorphism dark */}
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
            {/* Top gradient accent */}
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#DC2626]/60 to-transparent" />

            <div className="p-10 sm:p-12">
              {/* Price hero */}
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

              {/* Features grid 2 cols */}
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

              {/* CTA */}
              <div className="pt-8">
                <Link
                  href="/inscription-boucher"
                  className="group relative block w-full text-center overflow-hidden rounded-2xl bg-[#DC2626] hover:bg-[#b91c1c] py-4 px-6 font-semibold text-white text-base shadow-[0_10px_40px_-10px_rgba(220,38,38,0.5)] hover:shadow-[0_20px_50px_-10px_rgba(220,38,38,0.7)] transition-all duration-300 hover:scale-[1.015] active:scale-[0.99]"
                >
                  <span className="relative z-10 inline-flex items-center gap-2">
                    Ajouter ma boucherie gratuitement
                    <span className="transition-transform group-hover:translate-x-1">→</span>
                  </span>
                  {/* Shimmer overlay on hover */}
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
      {/* COMMENT CA MARCHE                         */}
      {/* ══════════════════════════════════════════ */}
      <section className="bg-white dark:bg-[#141414] border-y border-[#ece8e3] dark:border-white/10 py-16">
        <div className="max-w-4xl mx-auto px-5 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white font-display mb-12">
            Comment ça marche ?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            <div>
              <div className="w-14 h-14 bg-[#DC2626]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users size={24} className="text-[#DC2626]" />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-2">
                1. Inscription
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Remplissez le formulaire avec les informations de votre
                boucherie. C&apos;est rapide et gratuit.
              </p>
            </div>
            <div>
              <div className="w-14 h-14 bg-[#DC2626]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Settings size={24} className="text-[#DC2626]" />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-2">
                2. Configuration
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Ajoutez vos produits, définissez vos horaires et personnalisez
                votre vitrine en ligne.
              </p>
            </div>
            <div>
              <div className="w-14 h-14 bg-[#DC2626]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Zap size={24} className="text-[#DC2626]" />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-2">
                3. C&apos;est parti !
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Recevez vos premières commandes click &amp; collect et
                développez votre activité.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════ */}
      {/* FAQ                                       */}
      {/* ══════════════════════════════════════════ */}
      <section className="max-w-3xl mx-auto px-5 py-16">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white font-display text-center mb-10">
          Questions fréquentes
        </h2>
        <div className="space-y-3">
          <FaqItem
            question="Combien ça coûte vraiment ?"
            answer="Klik&Go est 100% gratuit pour votre boucherie : aucun abonnement, aucun frais fixe, aucun engagement. Nous prélevons uniquement une petite commission sur chaque commande encaissée — vous ne payez que si vous vendez."
          />
          <FaqItem
            question="Ai-je besoin de matériel spécifique ?"
            answer="Non, un simple smartphone ou tablette suffit pour gérer vos commandes. L'application est accessible depuis n'importe quel navigateur web."
          />
          <FaqItem
            question="Combien de temps pour être en ligne ?"
            answer="Votre boucherie peut être en ligne en moins de 24 heures. Notre équipe valide votre inscription et vous accompagne pour la mise en route."
          />
          <FaqItem
            question="Comment sont gérées les commandes ?"
            answer="Vous recevez une notification pour chaque nouvelle commande. Vous pouvez accepter, préparer et signaler les commandes prêtes depuis votre tableau de bord Mode Cuisine."
          />
          <FaqItem
            question="Quand suis-je payé ?"
            answer="Les paiements en ligne sont versés automatiquement sur votre compte bancaire via Stripe. Pour les paiements sur place, vous encaissez directement votre client en boutique au moment du retrait."
          />
        </div>
      </section>

      {/* ══════════════════════════════════════════ */}
      {/* FOOTER                                    */}
      {/* ══════════════════════════════════════════ */}
      <footer className="bg-[#1a1a1a] py-12">
        <div className="max-w-4xl mx-auto px-5 text-center">
          <h3 className="text-xl font-bold text-white mb-3">
            Des questions ? Contactez-nous
          </h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            <a
              href="mailto:contact@klikandgo.app"
              className="hover:text-white transition"
            >
              contact@klikandgo.app
            </a>
          </p>
          <div className="flex justify-center gap-4 mt-6 text-xs text-gray-500">
            <a href="/mentions-legales" className="hover:text-gray-300 transition">Mentions légales</a>
            <a href="/cgv" className="hover:text-gray-300 transition">CGV</a>
            <a href="/politique-de-confidentialite" className="hover:text-gray-300 transition">Confidentialité</a>
          </div>
          <div className="mt-8 pt-8 border-t border-white/10">
            <p className="text-sm text-gray-500">
              &copy; 2026 Klik&amp;Go
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
