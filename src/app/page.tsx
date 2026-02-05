"use client";

import Link from "next/link";
import Image from "next/image";

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-white overflow-hidden">
      {/* Hero */}
      <section className="relative h-dvh flex items-end">
        <Image
          src="https://images.unsplash.com/photo-1558030006-450675393462?w=1400&q=85&auto=format"
          alt="Boucherie artisanale"
          fill
          className="object-cover"
          priority
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />

        {/* Nav */}
        <nav className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-5 md:px-10 py-5">
          <span className="text-white text-xl font-extrabold tracking-tight">
            Click<span className="text-white/60">Boucher</span>
          </span>
          <Link href="/decouvrir" className="px-5 py-2.5 rounded-full text-sm font-semibold bg-white text-zinc-900 hover:bg-zinc-100 transition-all shadow-sm">
            Commander
          </Link>
        </nav>

        {/* Content */}
        <div className="relative z-10 w-full px-5 md:px-10 pb-14 md:pb-20 max-w-4xl">
          <p className="text-white/50 text-xs font-semibold tracking-[0.2em] uppercase mb-3">Click & Collect Boucherie</p>
          <h1 className="text-white text-4xl sm:text-5xl md:text-6xl font-extrabold leading-[1.08] mb-5 max-w-2xl">
            Votre boucher,<br />à portée de clic.
          </h1>
          <p className="text-white/50 text-base max-w-md mb-8 leading-relaxed">
            Viande sélectionnée, coupée sur mesure, prête en quelques minutes. Commandez, retirez, savourez.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/decouvrir" className="group px-7 py-3.5 rounded-full font-semibold text-sm bg-white text-zinc-900 hover:bg-zinc-100 transition-all shadow-md">
              Découvrir les boucheries <span className="inline-block ml-1 group-hover:translate-x-0.5 transition-transform">→</span>
            </Link>
            <Link href="/bons-plans" className="px-7 py-3.5 rounded-full font-semibold text-sm border border-white/25 text-white hover:bg-white/10 transition-all">
              Offres du jour
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 md:py-28 px-5 md:px-10 max-w-4xl mx-auto">
        <p className="text-primary text-xs font-bold tracking-[0.15em] uppercase mb-3">Comment ça marche</p>
        <h2 className="text-3xl md:text-4xl font-extrabold mb-14 leading-tight">
          3 étapes.<br /><span className="text-zinc-400">Zéro attente.</span>
        </h2>
        <div className="grid md:grid-cols-3 gap-10">
          {[
            { n: "01", title: "Choisissez", desc: "Parcourez le catalogue de votre boucher. Entrecôte maturée, filet mignon, charcuterie…", icon: "🥩" },
            { n: "02", title: "Commandez", desc: "Précisez le poids, ajoutez au panier. Votre boucher prépare sur mesure.", icon: "📱" },
            { n: "03", title: "Retirez", desc: "Notification quand c'est prêt. Passez au comptoir, c'est emballé.", icon: "✨" },
          ].map((s) => (
            <div key={s.n}>
              <span className="text-4xl mb-3 block">{s.icon}</span>
              <span className="text-zinc-300 text-xs font-mono">{s.n}</span>
              <h3 className="text-lg font-bold mt-1 mb-2">{s.title}</h3>
              <p className="text-zinc-500 text-sm leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Photos */}
      <section className="px-5 md:px-10 pb-20 max-w-4xl mx-auto grid md:grid-cols-2 gap-4">
        {[
          { src: "https://images.unsplash.com/photo-1602470520998-f4a52199a3d6?w=800&q=80&auto=format", label: "Découpes sur mesure", sub: "Qualité premium" },
          { src: "https://images.unsplash.com/photo-1545468800-85cc9bc6ecf7?w=800&q=80&auto=format", label: "Artisans locaux", sub: "Savoir-faire" },
        ].map((p) => (
          <div key={p.label} className="relative aspect-[4/5] rounded-3xl overflow-hidden group">
            <Image src={p.src} alt={p.label} fill className="object-cover transition-transform duration-700 group-hover:scale-105" sizes="50vw" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 p-6">
              <p className="text-white/50 text-xs font-semibold tracking-widest uppercase mb-1">{p.sub}</p>
              <h3 className="text-white text-xl font-bold">{p.label}</h3>
            </div>
          </div>
        ))}
      </section>

      {/* CTA */}
      <section className="py-20 text-center px-5">
        <h2 className="text-3xl md:text-4xl font-extrabold mb-4">Prêt à commander ?</h2>
        <p className="text-zinc-500 mb-8 max-w-md mx-auto">Votre prochaine pièce vous attend chez un artisan près de chez vous.</p>
        <Link href="/decouvrir" className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-bold text-base bg-primary text-white hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">
          Commencer maintenant →
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-5 text-center">
        <span className="text-sm font-bold">Click<span className="text-zinc-400">Boucher</span></span>
        <p className="text-zinc-400 text-xs mt-1">© 2026 — L&apos;excellence artisanale, à portée de clic.</p>
      </footer>
    </div>
  );
}
