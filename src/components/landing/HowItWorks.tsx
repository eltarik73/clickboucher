// src/components/landing/HowItWorks.tsx
"use client";

const STEPS = [
  {
    number: 1,
    title: "Passez commande",
    description: "Choisissez vos produits en quelques clics",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
    ),
  },
  {
    number: 2,
    title: "Payez en ligne",
    description: "Paiement s\u00e9curis\u00e9 et rapide",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ),
  },
  {
    number: 3,
    title: "Retirez en boutique",
    description: "Passez devant tout le monde",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-[#0A0A0A] text-white py-16 sm:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <h2 className="text-center text-sm font-semibold text-[#DC2626] uppercase tracking-widest mb-3">
          Simple et rapide
        </h2>
        <p className="text-center text-2xl sm:text-3xl font-bold mb-12">
          Comment &ccedil;a marche
        </p>

        {/* Desktop: horizontal with separators */}
        <div className="hidden md:flex items-stretch justify-center">
          {STEPS.map((step, idx) => (
            <div key={step.number} className="flex items-stretch">
              {/* Step */}
              <div className="flex flex-col items-center text-center px-8 lg:px-12 py-6">
                {/* Number badge */}
                <div className="w-12 h-12 rounded-full bg-[#DC2626] flex items-center justify-center mb-5 shadow-lg shadow-[#DC2626]/30">
                  <span className="text-xl font-bold text-white">{step.number}</span>
                </div>
                {/* Icon */}
                <div className="mb-4 text-white/90">
                  {step.icon}
                </div>
                {/* Title */}
                <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                {/* Description */}
                <p className="text-sm text-[#A0A0A0] max-w-[180px]">{step.description}</p>
              </div>

              {/* Separator (not after last) */}
              {idx < STEPS.length - 1 && (
                <div className="w-px bg-gradient-to-b from-transparent via-[#333] to-transparent my-4" />
              )}
            </div>
          ))}
        </div>

        {/* Mobile: stacked cards */}
        <div className="md:hidden space-y-4">
          {STEPS.map(step => (
            <div key={step.number} className="flex items-start gap-4 bg-[#151515] rounded-2xl p-5 border border-[#222]">
              {/* Number badge */}
              <div className="w-10 h-10 rounded-full bg-[#DC2626] flex items-center justify-center shrink-0 shadow-lg shadow-[#DC2626]/30">
                <span className="text-lg font-bold text-white">{step.number}</span>
              </div>
              {/* Content */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <div className="text-white/80 scale-75 origin-left">{step.icon}</div>
                  <h3 className="text-base font-semibold">{step.title}</h3>
                </div>
                <p className="text-sm text-[#A0A0A0]">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
