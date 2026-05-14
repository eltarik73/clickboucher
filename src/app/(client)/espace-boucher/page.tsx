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
function AnimatedStat({ value, suffix, label }: { value: number; suffix: string; label: string }) {
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
      <p className="text-3xl font-bold text-white sm:text-4xl">
        {count}
        {suffix}
      </p>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────
// FAQ ITEM
// ─────────────────────────────────────────────────
function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl border border-[#ece8e3] dark:border-white/10">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between p-5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-white/5"
      >
        <span className="text-sm font-semibold text-gray-900 dark:text-white sm:text-base">
          {question}
        </span>
        {open ? (
          <ChevronUp size={18} className="ml-4 shrink-0 text-gray-500 dark:text-gray-400" />
        ) : (
          <ChevronDown size={18} className="ml-4 shrink-0 text-gray-500 dark:text-gray-400" />
        )}
      </button>
      {open && (
        <div className="px-5 pb-5 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
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
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0a] px-5">
        <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#141414] p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#DC2626]/10">
            <Store size={28} className="text-[#DC2626]" />
          </div>
          <h1 className="mb-2 text-xl font-bold text-white">Bienvenue, {user.firstName} !</h1>
          <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
            Accédez à votre espace boucher pour gérer votre boucherie.
          </p>
          <button
            onClick={() => router.push("/boucher/dashboard")}
            className="w-full rounded-xl bg-[#DC2626] py-3 font-semibold text-white transition-colors hover:bg-[#b91c1c]"
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
      <section className="relative overflow-hidden bg-[#1a1a1a]">
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
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
              className="text-sm text-gray-500 transition hover:text-white dark:text-gray-400"
            >
              Se connecter
            </Link>
          </div>
        </header>

        {/* Hero content */}
        <div className="relative z-10 mx-auto max-w-4xl px-5 py-20 text-center sm:py-28">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-gray-500 dark:text-gray-400">
            <Store size={14} />
            Espace professionnel boucher
          </div>

          <h1 className="text-3xl font-bold leading-[1.15] tracking-tight text-white sm:text-4xl lg:text-5xl">
            Développez votre boucherie
            <br />
            <span className="text-[#DC2626]">avec Klik&Go</span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-lg text-gray-500 dark:text-gray-400">
            Rejoignez les boucheries de Chambéry qui ont supprimé les files d&apos;attente et
            augmenté leur chiffre d&apos;affaires.
          </p>

          {/* Stats */}
          <div className="mt-12 flex items-center justify-center gap-8 sm:gap-16">
            <AnimatedStat value={10} suffix="+" label="boucheries" />
            <div className="h-12 w-px bg-white/10" />
            <AnimatedStat value={2000} suffix="+" label="commandes" />
            <div className="h-12 w-px bg-white/10" />
            <AnimatedStat value={4} suffix=".7★" label="satisfaction" />
          </div>

          {/* CTA Buttons */}
          <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/inscription-boucher"
              className="rounded-xl bg-[#DC2626] px-8 py-3 font-semibold text-white shadow-lg shadow-[#DC2626]/20 transition-colors hover:bg-[#b91c1c]"
            >
              Ajouter ma boucherie
            </Link>
            <Link
              href="/sign-in?redirect_url=/espace-boucher"
              className="rounded-xl border border-white/30 px-8 py-3 font-medium text-white transition-colors hover:bg-white/5"
            >
              Se connecter
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════ */}
      {/* OFFRE — Premium dark pricing card           */}
      {/* ══════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-[#0a0a0a] px-5 py-32">
        {/* Subtle radial glow */}
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(ellipse 800px 400px at 50% 50%, rgba(220,38,38,0.08), transparent 70%)",
          }}
        />
        {/* Grid pattern subtle */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />

        <div className="relative mx-auto max-w-4xl">
          {/* Header */}
          <div className="mb-16 animate-fade-up text-center">
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

          {/* Pricing card — glassmorphism dark */}
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
            {/* Top gradient accent */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#DC2626]/60 to-transparent" />

            <div className="p-10 sm:p-12">
              {/* Price hero */}
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

              {/* Features grid 2 cols */}
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

              {/* CTA */}
              <div className="pt-8">
                <Link
                  href="/inscription-boucher"
                  className="group relative block w-full overflow-hidden rounded-2xl bg-[#DC2626] px-6 py-4 text-center text-base font-semibold text-white shadow-[0_10px_40px_-10px_rgba(220,38,38,0.5)] transition-all duration-300 hover:scale-[1.015] hover:bg-[#b91c1c] hover:shadow-[0_20px_50px_-10px_rgba(220,38,38,0.7)] active:scale-[0.99]"
                >
                  <span className="relative z-10 inline-flex items-center gap-2">
                    Ajouter ma boucherie gratuitement
                    <span className="transition-transform group-hover:translate-x-1">→</span>
                  </span>
                  {/* Shimmer overlay on hover */}
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
      {/* COMMENT CA MARCHE                         */}
      {/* ══════════════════════════════════════════ */}
      <section className="border-y border-[#ece8e3] bg-white py-16 dark:border-white/10 dark:bg-[#141414]">
        <div className="mx-auto max-w-4xl px-5 text-center">
          <h2 className="mb-12 font-display text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
            Comment ça marche ?
          </h2>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            <div>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#DC2626]/10">
                <Users size={24} className="text-[#DC2626]" />
              </div>
              <h3 className="mb-2 font-bold text-gray-900 dark:text-white">1. Inscription</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Remplissez le formulaire avec les informations de votre boucherie. C&apos;est rapide
                et gratuit.
              </p>
            </div>
            <div>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#DC2626]/10">
                <Settings size={24} className="text-[#DC2626]" />
              </div>
              <h3 className="mb-2 font-bold text-gray-900 dark:text-white">2. Configuration</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Ajoutez vos produits, définissez vos horaires et personnalisez votre vitrine en
                ligne.
              </p>
            </div>
            <div>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#DC2626]/10">
                <Zap size={24} className="text-[#DC2626]" />
              </div>
              <h3 className="mb-2 font-bold text-gray-900 dark:text-white">
                3. C&apos;est parti !
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Recevez vos premières commandes click &amp; collect et développez votre activité.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════ */}
      {/* FAQ                                       */}
      {/* ══════════════════════════════════════════ */}
      <section className="mx-auto max-w-3xl px-5 py-16">
        <h2 className="mb-10 text-center font-display text-2xl font-bold text-gray-900 dark:text-white">
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
      {/* Audit a11y 2026-05-10 : text-gray-500 (#6B7280) sur bg-#1a1a1a = ratio 4.0 FAIL.
          text-gray-400 (#9CA3AF) sur même fond = ratio 6.0 PASS AA. */}
      <footer className="bg-[#1a1a1a] py-12">
        <div className="mx-auto max-w-4xl px-5 text-center">
          <h2 className="mb-3 text-xl font-bold text-white">Des questions ? Contactez-nous</h2>
          <p className="text-sm text-gray-400">
            <a
              href="mailto:contact@klikandgo.app"
              className="underline underline-offset-2 transition hover:text-white"
            >
              contact@klikandgo.app
            </a>
          </p>
          <div className="mt-6 flex justify-center gap-4 text-xs text-gray-400">
            <a
              href="/mentions-legales"
              className="underline underline-offset-2 transition hover:text-white"
            >
              Mentions légales
            </a>
            <a href="/cgv" className="underline underline-offset-2 transition hover:text-white">
              CGV
            </a>
            <a
              href="/politique-de-confidentialite"
              className="underline underline-offset-2 transition hover:text-white"
            >
              Confidentialité
            </a>
          </div>
          <div className="mt-8 border-t border-white/10 pt-8">
            <p className="text-sm text-gray-400">&copy; 2026 Klik&amp;Go</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
