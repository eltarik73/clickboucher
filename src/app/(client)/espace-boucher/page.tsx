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
// PACK FEATURE LINE
// ─────────────────────────────────────────────────
function Feature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-sm">
      <Check size={16} className="text-emerald-500 shrink-0 mt-0.5" />
      <span>{children}</span>
    </li>
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
      {/* OFFRE — 100% gratuit, commission par commande */}
      {/* ══════════════════════════════════════════ */}
      <section className="max-w-4xl mx-auto px-5 py-20">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white font-display">
            100% gratuit pour votre boucherie
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-3 max-w-2xl mx-auto">
            Aucun abonnement, aucun frais fixe. Klik&amp;Go se rémunère uniquement
            sur une petite commission par commande encaissée. Vous ne payez que si
            vous vendez.
          </p>
        </div>

        <div className="bg-white dark:bg-[#141414] border-2 border-[#DC2626] rounded-2xl p-8 shadow-lg max-w-2xl mx-auto">
          <div className="text-center mb-6">
            <span className="inline-block text-xs font-semibold text-[#DC2626] bg-[#DC2626]/10 px-3 py-1 rounded-full mb-4">
              Tout inclus
            </span>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-5xl font-bold text-gray-900 dark:text-white">0&euro;</span>
              <span className="text-lg text-gray-500 dark:text-gray-400">/mois</span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Commission uniquement sur les commandes encaissées
            </p>
          </div>

          <ul className="space-y-3 text-gray-700 dark:text-gray-300 mb-8">
            <Feature>Vitrine en ligne dédiée à votre boucherie</Feature>
            <Feature>Catalogue produits illimité avec photos</Feature>
            <Feature>Commandes click &amp; collect avec QR code retrait</Feature>
            <Feature>Mode Cuisine temps réel pour gérer vos commandes</Feature>
            <Feature>Notifications clients automatiques</Feature>
            <Feature>Programme de fidélité intégré</Feature>
            <Feature>Promotions &amp; offres flash</Feature>
            <Feature>Statistiques &amp; analytics complètes</Feature>
            <Feature>Support 7j/7</Feature>
          </ul>

          <Link
            href="/inscription-boucher"
            className="block w-full text-center bg-[#DC2626] text-white rounded-xl py-3 font-semibold hover:bg-[#b91c1c] transition-colors shadow-md"
          >
            Ajouter ma boucherie gratuitement
          </Link>
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
