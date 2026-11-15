// src/components/landing/HowItWorks.tsx — Server Component (light bg with dark mode support).
// The steps are the order steps of src/lib/seo/facts.ts: payment happens in the shop at pickup.

import { CalendarClock, ShoppingCart, Store, type LucideIcon } from "lucide-react";
import { ORDER_STEPS } from "@/lib/seo/facts";

// One icon per step of ORDER_STEPS, in order: choose, order, pick up and pay. A step added to
// ORDER_STEPS without an icon is shown without one.
const STEP_ICONS: readonly LucideIcon[] = [ShoppingCart, CalendarClock, Store];

const STEPS = ORDER_STEPS.map((step, index) => ({
  number: index + 1,
  title: step.title,
  description: step.text,
  Icon: STEP_ICONS.at(index),
}));

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="border-y border-[#ece8e3] bg-white py-8 dark:border-white/[0.06] dark:bg-[#141414] sm:py-16"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <h2 className="mb-2 text-center text-sm font-semibold uppercase tracking-widest text-[#DC2626]">
          Simple et rapide
        </h2>
        <p className="mb-6 text-center text-xl font-bold text-gray-900 dark:text-white sm:mb-12 sm:text-3xl">
          Comment ça marche
        </p>

        {/* Desktop: horizontal with separators */}
        <div className="hidden items-stretch justify-center md:flex">
          {STEPS.map((step, idx) => (
            <div key={step.number} className="flex items-stretch">
              <div className="flex flex-col items-center px-8 py-6 text-center lg:px-12">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#DC2626] shadow-lg shadow-[#DC2626]/30">
                  <span className="text-xl font-bold text-white">{step.number}</span>
                </div>
                {step.Icon && (
                  <div className="mb-4 text-[#DC2626]">
                    <step.Icon size={32} strokeWidth={1.5} aria-hidden="true" />
                  </div>
                )}
                <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
                  {step.title}
                </h3>
                <p className="max-w-[220px] text-sm text-gray-500 dark:text-gray-400">
                  {step.description}
                </p>
              </div>
              {idx < STEPS.length - 1 && (
                <div className="my-4 w-px bg-gradient-to-b from-transparent via-gray-200 to-transparent dark:via-gray-700" />
              )}
            </div>
          ))}
        </div>

        {/* Mobile: stacked cards */}
        <div className="space-y-2.5 md:hidden">
          {STEPS.map((step) => (
            <div
              key={step.number}
              className="flex items-start gap-3 rounded-xl border border-[#ece8e3] bg-gray-50 p-3.5 dark:border-white/[0.06] dark:bg-gray-800"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#DC2626] shadow-lg shadow-[#DC2626]/30">
                <span className="text-sm font-bold text-white">{step.number}</span>
              </div>
              <div className="flex-1">
                <div className="mb-1 flex items-center gap-3">
                  {step.Icon && (
                    <div className="text-[#DC2626]">
                      <step.Icon size={24} strokeWidth={1.5} aria-hidden="true" />
                    </div>
                  )}
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                    {step.title}
                  </h3>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
