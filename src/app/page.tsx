"use client";

import Link from "next/link";
import Image from "next/image";

const HERO_IMG = "https://images.unsplash.com/photo-1558030006-450675393462?w=1400&q=85&auto=format";
const CUTS_IMG = "https://images.unsplash.com/photo-1602470520998-f4a52199a3d6?w=800&q=80&auto=format";
const SHOP_IMG = "https://images.unsplash.com/photo-1545468800-85cc9bc6ecf7?w=800&q=80&auto=format";

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-[#0f0a08] text-white overflow-hidden">
      {/* ── Hero Section ────────────────────── */}
      <section className="relative h-dvh flex items-end">
        <Image
          src={HERO_IMG}
          alt="Boucherie artisanale"
          fill
          className="object-cover"
          priority
          sizes="100vw"
        />
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f0a08] via-[#0f0a08]/40 to-transparent" />

        {/* Navbar */}
        <nav className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 md:px-12 py-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center">
              <span className="text-white text-sm font-bold">C</span>
            </div>
            <span style={{ fontFamily: "'Playfair Display', serif" }} className="text-xl font-bold tracking-tight">
              Click<span className="text-amber-400">Boucher</span>
            </span>
          </div>
          <Link
            href="/decouvrir"
            className="px-5 py-2.5 rounded-full text-sm font-semibold bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-all"
          >
            Commander
          </Link>
        </nav>

        {/* Hero Content */}
        <div className="relative z-10 w-full px-6 md:px-12 pb-16 md:pb-24 max-w-5xl">
          <div className="animate-fade-in-up">
            <p className="text-amber-400 text-sm font-semibold tracking-[0.2em] uppercase mb-4">
              Click & Collect Boucherie
            </p>
            <h1
              style={{ fontFamily: "'Playfair Display', serif" }}
              className="text-4xl sm:text-5xl md:text-7xl font-bold leading-[1.05] mb-6 max-w-3xl"
            >
              L&apos;excellence
              <br />
              artisanale, à portée
              <br />
              <span className="italic text-amber-400">de clic.</span>
            </h1>
            <p className="text-white/60 text-base md:text-lg max-w-xl mb-8 leading-relaxed">
              Commandez en ligne chez les meilleurs bouchers de votre ville.
              Viande sélectionnée, coupée sur mesure, prête en quelques minutes.
            </p>
          </div>

          <div className="flex flex-wrap gap-4 animate-fade-in-up stagger-2">
            <Link
              href="/decouvrir"
              className="group px-8 py-4 rounded-full font-semibold text-base bg-gradient-to-r from-amber-500 to-amber-600 text-[#0f0a08] hover:from-amber-400 hover:to-amber-500 transition-all shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40"
            >
              Découvrir les boucheries
              <span className="inline-block ml-2 group-hover:translate-x-1 transition-transform">→</span>
            </Link>
            <Link
              href="/bons-plans"
              className="px-8 py-4 rounded-full font-semibold text-base border border-white/20 hover:bg-white/10 transition-all"
            >
              Offres du jour
            </Link>
          </div>
        </div>
      </section>

      {/* ── Features Section ────────────────── */}
      <section className="py-20 md:py-32 px-6 md:px-12">
        <div className="max-w-5xl mx-auto">
          <p className="text-amber-400 text-sm font-semibold tracking-[0.2em] uppercase mb-4">Comment ça marche</p>
          <h2
            style={{ fontFamily: "'Playfair Display', serif" }}
            className="text-3xl md:text-5xl font-bold mb-16"
          >
            Simple. Rapide.<br />
            <span className="italic text-white/40">Savoureux.</span>
          </h2>

          <div className="grid md:grid-cols-3 gap-8 md:gap-12">
            {[
              { step: "01", title: "Choisissez", desc: "Parcourez le catalogue de votre boucher. Entrecôte maturée, filet mignon, charcuterie artisanale…", icon: "🥩" },
              { step: "02", title: "Commandez", desc: "Précisez le poids, ajoutez au panier. Votre boucher prépare votre commande sur mesure.", icon: "📱" },
              { step: "03", title: "Retirez", desc: "Recevez une notification quand c'est prêt. Passez au comptoir, c'est emballé.", icon: "✨" },
            ].map((item, i) => (
              <div key={item.step} className={`animate-fade-in-up stagger-${i + 1}`}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">{item.icon}</span>
                  <span className="text-amber-400/40 text-sm font-mono">{item.step}</span>
                </div>
                <h3 style={{ fontFamily: "'Playfair Display', serif" }} className="text-xl font-bold mb-2">{item.title}</h3>
                <p className="text-white/50 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Showcase Section ─────────────────── */}
      <section className="py-20 px-6 md:px-12">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-6">
          <div className="relative aspect-[4/5] rounded-3xl overflow-hidden group">
            <Image src={CUTS_IMG} alt="Découpes artisanales" fill className="object-cover transition-transform duration-700 group-hover:scale-105" sizes="50vw" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
              <p className="text-amber-400 text-xs font-semibold tracking-[0.2em] uppercase mb-2">Qualité premium</p>
              <h3 style={{ fontFamily: "'Playfair Display', serif" }} className="text-2xl md:text-3xl font-bold">Découpes sur mesure</h3>
              <p className="text-white/60 mt-2 text-sm">Chaque pièce préparée selon vos envies par des artisans passionnés.</p>
            </div>
          </div>
          <div className="relative aspect-[4/5] rounded-3xl overflow-hidden group">
            <Image src={SHOP_IMG} alt="Boucherie traditionnelle" fill className="object-cover transition-transform duration-700 group-hover:scale-105" sizes="50vw" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
              <p className="text-amber-400 text-xs font-semibold tracking-[0.2em] uppercase mb-2">Artisans locaux</p>
              <h3 style={{ fontFamily: "'Playfair Display', serif" }} className="text-2xl md:text-3xl font-bold">Votre boucher de quartier</h3>
              <p className="text-white/60 mt-2 text-sm">Des professionnels engagés pour la qualité et le goût.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA Section ──────────────────────── */}
      <section className="py-20 md:py-32 px-6 md:px-12">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-amber-400 text-sm font-semibold tracking-[0.2em] uppercase mb-6">Prêt à commander ?</p>
          <h2
            style={{ fontFamily: "'Playfair Display', serif" }}
            className="text-3xl md:text-5xl font-bold mb-6"
          >
            Votre prochaine pièce
            <br />
            <span className="italic text-amber-400">vous attend.</span>
          </h2>
          <p className="text-white/50 mb-10 max-w-lg mx-auto leading-relaxed">
            Rejoignez les gourmets qui commandent chez leur boucher en un clic.
            Qualité artisanale, retrait express.
          </p>
          <Link
            href="/decouvrir"
            className="inline-flex items-center gap-2 px-10 py-5 rounded-full font-semibold text-lg bg-gradient-to-r from-amber-500 to-amber-600 text-[#0f0a08] hover:from-amber-400 hover:to-amber-500 transition-all shadow-xl shadow-amber-500/20 hover:shadow-amber-500/35"
          >
            Commencer maintenant
            <span className="text-xl">→</span>
          </Link>
        </div>
      </section>

      {/* ── Footer ───────────────────────────── */}
      <footer className="border-t border-white/10 py-10 px-6 md:px-12">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center">
              <span className="text-white text-xs font-bold">C</span>
            </div>
            <span style={{ fontFamily: "'Playfair Display', serif" }} className="font-bold">
              Click<span className="text-amber-400">Boucher</span>
            </span>
          </div>
          <p className="text-white/30 text-sm">© 2026 ClickBoucher — L&apos;excellence artisanale, à portée de clic.</p>
        </div>
      </footer>
    </div>
  );
}
