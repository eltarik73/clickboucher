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
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
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
    return () => clearInterval(timer);
  }, [visible, value]);

  return (
    <div ref={ref} className="text-center">
      <p className="text-3xl sm:text-4xl font-bold text-white">
        {count}
        {suffix}
      </p>
      <p className="text-sm text-gray-400 mt-1">{label}</p>
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
          <ChevronUp size={18} className="text-gray-400 shrink-0 ml-4" />
        ) : (
          <ChevronDown size={18} className="text-gray-400 shrink-0 ml-4" />
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
          <p className="text-sm text-gray-400 mb-6">Accédez à votre espace boucher pour gérer votre boucherie.</p>
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
              href="/decouvrir"
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
              className="text-sm text-gray-400 hover:text-white transition"
            >
              Se connecter
            </Link>
          </div>
        </header>

        {/* Hero content */}
        <div className="relative z-10 max-w-4xl mx-auto px-5 py-20 sm:py-28 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/5 border border-white/10 rounded-full text-sm text-gray-400 mb-8">
            <Store size={14} />
            Espace professionnel boucher
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight leading-[1.15]">
            Developpez votre boucherie
            <br />
            <span className="text-[#DC2626]">avec Klik&Go</span>
          </h1>

          <p className="mt-5 text-lg text-gray-400 max-w-2xl mx-auto">
            Rejoignez les boucheries de Chambery qui ont supprime les files
            d&apos;attente et augmente leur chiffre d&apos;affaires.
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
            <a
              href="#packs"
              className="bg-[#DC2626] text-white rounded-xl py-3 px-8 font-semibold hover:bg-[#b91c1c] transition-colors shadow-lg shadow-[#DC2626]/20"
            >
              Ajouter ma boucherie
            </a>
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
      {/* PACKS TARIFAIRES                          */}
      {/* ══════════════════════════════════════════ */}
      <section
        id="packs"
        className="max-w-6xl mx-auto px-5 py-20"
      >
        <div className="text-center mb-14">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white font-display">
            Choisissez votre formule
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            30 jours d&apos;essai gratuit sur tous les packs. Sans engagement.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {/* ── PACK ESSENTIEL ── */}
          <div className="bg-white dark:bg-[#141414] border border-[#ece8e3] dark:border-white/10 rounded-2xl p-7 relative">
            <span className="inline-block text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-[#0a0a0a] px-3 py-1 rounded-full mb-4">
              Pour demarrer
            </span>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              Essentiel
            </h3>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-3xl font-bold text-gray-900 dark:text-white">
                49&euro;
              </span>
              <span className="text-sm text-gray-400">/mois</span>
            </div>
            <ul className="mt-6 space-y-3 text-gray-700 dark:text-gray-300">
              <Feature>Votre vitrine en ligne (page boucherie dediee)</Feature>
              <Feature>Catalogue produits illimite avec photos</Feature>
              <Feature>Commandes click &amp; collect avec QR code</Feature>
              <Feature>Systeme de tickets &amp; suivi en temps reel</Feature>
              <Feature>Notifications clients automatiques</Feature>
              <Feature>Tableau de bord &amp; statistiques de base</Feature>
              <Feature>Support par email</Feature>
            </ul>
            <Link
              href="/inscription-boucher?pack=essentiel"
              className="mt-8 block w-full text-center border-2 border-[#DC2626] text-[#DC2626] rounded-xl py-3 font-semibold hover:bg-[#DC2626] hover:text-white transition-colors"
            >
              Choisir l&apos;Essentiel
            </Link>
          </div>

          {/* ── PACK PREMIUM ── */}
          <div className="bg-white dark:bg-[#141414] border-2 border-[#DC2626] rounded-2xl p-7 shadow-lg relative">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#DC2626] text-white px-4 py-1 rounded-full text-xs font-bold">
              POPULAIRE
            </span>
            <span className="inline-block text-xs font-semibold text-[#DC2626] bg-[#DC2626]/10 px-3 py-1 rounded-full mb-4">
              Le plus choisi
            </span>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              Premium
            </h3>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-3xl font-bold text-gray-900 dark:text-white">
                99&euro;
              </span>
              <span className="text-sm text-gray-400">/mois</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Tout le pack Essentiel, plus :
            </p>
            <ul className="mt-6 space-y-3 text-gray-700 dark:text-gray-300">
              <Feature>
                Chat IA — vos clients commandent en langage naturel
              </Feature>
              <Feature>
                Assistant IA qui recommande vos produits et conseille les
                quantites
              </Feature>
              <Feature>
                Suggestions intelligentes d&apos;alternatives en cas de rupture
              </Feature>
              <Feature>Programme de fidelite integre</Feature>
              <Feature>Promotions &amp; offres flash automatisees</Feature>
              <Feature>Statistiques avancees &amp; analytics</Feature>
              <Feature>Support prioritaire 7j/7</Feature>
            </ul>
            <Link
              href="/inscription-boucher?pack=premium"
              className="mt-8 block w-full text-center bg-[#DC2626] text-white rounded-xl py-3 font-semibold hover:bg-[#b91c1c] transition-colors shadow-md"
            >
              Choisir le Premium
            </Link>
          </div>

          {/* ── PACK ENTREPRISE ── */}
          <div className="bg-[#1a1a1a] border border-[#333] rounded-2xl p-7 relative">
            <span className="inline-block text-xs font-semibold text-amber-400 bg-amber-400/10 px-3 py-1 rounded-full mb-4">
              Solution complete
            </span>
            <h3 className="text-xl font-bold text-white">Entreprise</h3>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-3xl font-bold text-white">199&euro;</span>
              <span className="text-sm text-gray-500">/mois</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Tout le pack Premium, plus :
            </p>
            <ul className="mt-6 space-y-3 text-gray-300">
              <Feature>Integration caisse enregistreuse (POS)</Feature>
              <Feature>
                Synchronisation stock temps reel avec votre caisse
              </Feature>
              <Feature>Developpements sur-mesure selon vos besoins</Feature>
              <Feature>Prise en compte des demandes d&apos;evolution</Feature>
              <Feature>Multi-points de vente</Feature>
              <Feature>API personnalisee</Feature>
              <Feature>Account manager dedie</Feature>
              <Feature>Formation equipe incluse</Feature>
            </ul>
            <a
              href="mailto:contact@klikandgo.fr"
              className="mt-8 block w-full text-center bg-white text-[#1a1a1a] rounded-xl py-3 font-bold hover:bg-gray-100 transition-colors"
            >
              Nous contacter
            </a>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════ */}
      {/* COMMENT CA MARCHE                         */}
      {/* ══════════════════════════════════════════ */}
      <section className="bg-white dark:bg-[#141414] border-y border-[#ece8e3] dark:border-white/10 py-16">
        <div className="max-w-4xl mx-auto px-5 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white font-display mb-12">
            Comment ca marche ?
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
                Ajoutez vos produits, definissez vos horaires et personnalisez
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
                Recevez vos premieres commandes click &amp; collect et
                developpez votre activite.
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
          Questions frequentes
        </h2>
        <div className="space-y-3">
          <FaqItem
            question="Puis-je essayer gratuitement ?"
            answer="Oui, tous nos packs incluent une periode d'essai gratuite de 30 jours. Aucune carte bancaire requise. Vous pouvez annuler a tout moment."
          />
          <FaqItem
            question="Ai-je besoin de materiel specifique ?"
            answer="Non, un simple smartphone ou tablette suffit pour gerer vos commandes. L'application est accessible depuis n'importe quel navigateur web."
          />
          <FaqItem
            question="Combien de temps pour etre en ligne ?"
            answer="Votre boucherie peut etre en ligne en moins de 24 heures. Notre equipe valide votre inscription et vous accompagne pour la mise en route."
          />
          <FaqItem
            question="Puis-je changer de formule ?"
            answer="Bien sur ! Vous pouvez passer d'un pack a un autre a tout moment. Le changement prend effet immediatement."
          />
          <FaqItem
            question="Comment sont gerees les commandes ?"
            answer="Vous recevez une notification pour chaque nouvelle commande. Vous pouvez accepter, preparer et signaler les commandes pretes depuis votre tableau de bord."
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
          <p className="text-gray-400 text-sm">
            <a
              href="mailto:contact@klikandgo.fr"
              className="hover:text-white transition"
            >
              contact@klikandgo.fr
            </a>
            {" "}&middot;{" "}
            <a
              href="tel:+33600000000"
              className="hover:text-white transition"
            >
              06 00 00 00 00
            </a>
          </p>
          <div className="mt-8 pt-8 border-t border-white/10">
            <p className="text-sm text-gray-500">
              &copy; 2026 Klik&Go by TkS26
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
