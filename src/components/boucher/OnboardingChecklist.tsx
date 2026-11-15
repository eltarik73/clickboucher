"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { Check, ArrowRight, Rocket, PartyPopper } from "lucide-react";
import type { ShopPublication } from "@/lib/shop-publication";

const onboardingResponseSchema = z.object({
  data: z.object({
    steps: z.array(
      z.object({
        key: z.string(),
        label: z.string(),
        emoji: z.string(),
        completed: z.boolean(),
        href: z.string(),
      })
    ),
    progress: z.number(),
    onboardingCompleted: z.boolean(),
    publication: z.enum([
      "PUBLISHED",
      "ON_VACATION",
      "UNPUBLISHED",
      "SUSPENDED",
    ]) satisfies z.ZodType<ShopPublication>,
  }),
});

type OnboardingData = z.infer<typeof onboardingResponseSchema>["data"];

type PublicationLabel = { text: string; className: string };

const AMBER = "text-amber-700 dark:text-amber-300";

/** What the card says about publication: the shop never publishes itself, Klik&Go validates it. */
function publicationLabel(publication: ShopPublication, progress: number): PublicationLabel | null {
  switch (publication) {
    case "PUBLISHED":
      return { text: "Boutique en ligne", className: "text-emerald-700 dark:text-emerald-400" };
    case "ON_VACATION":
      return { text: "Boutique en vacances", className: AMBER };
    case "UNPUBLISHED":
      return progress >= 80
        ? { text: "En attente de validation par Klik&Go", className: AMBER }
        : null;
    case "SUSPENDED":
      return {
        text: "Boutique suspendue par Klik&Go",
        className: "text-red-700 dark:text-red-400",
      };
  }
}

async function markOnboardingCompleted() {
  try {
    await fetch("/api/boucher/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ complete: true }),
    });
  } catch {
    // Network failure: the flag is sent again on the next dashboard visit.
  }
}

export default function OnboardingChecklist() {
  const [data, setData] = useState<OnboardingData | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    let ignore = false;
    async function load() {
      let res: Response;
      try {
        res = await fetch("/api/boucher/onboarding");
      } catch {
        return;
      }
      if (!res.ok) return;
      const parsed = onboardingResponseSchema.safeParse(await res.json());
      if (ignore || !parsed.success) return;
      const loaded = parsed.data.data;
      setData(loaded);
      setShowConfetti(loaded.publication === "PUBLISHED" && loaded.progress >= 80);
      if (loaded.progress >= 100 && !loaded.onboardingCompleted) await markOnboardingCompleted();
    }
    void load();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!showConfetti) return;
    const timer = setTimeout(() => setShowConfetti(false), 4000);
    return () => clearTimeout(timer);
  }, [showConfetti]);

  if (!data || (data.onboardingCompleted && data.publication !== "SUSPENDED")) return null;

  const completedCount = data.steps.filter((s) => s.completed).length;
  const label = publicationLabel(data.publication, data.progress);

  return (
    <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-100 dark:border-white/10 shadow-sm overflow-hidden mb-6 relative">
      {/* Confetti overlay */}
      {showConfetti && (
        <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
          <div className="text-center animate-bounce">
            <PartyPopper size={48} className="text-amber-500 mx-auto mb-2" />
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              Votre boutique est en ligne !
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 dark:border-white/10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-gray-900 dark:text-[#f8f6f3] flex items-center gap-2">
            <Rocket size={20} className="text-[#DC2626]" />
            Préparez votre boutique
          </h2>
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
            {completedCount}/{data.steps.length} étapes
          </span>
        </div>

        {/* Progress bar */}
        <div className="relative h-3 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#DC2626] to-[#ef4444] rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${data.progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {data.progress}% complété
          </span>
          {label && (
            <span className={`text-xs font-semibold ${label.className}`}>{label.text}</span>
          )}
        </div>
      </div>

      {/* Steps */}
      <div className="divide-y divide-gray-50 dark:divide-white/5">
        {data.steps.map((step) => (
          <div
            key={step.key}
            className={`px-5 py-3 flex items-center gap-3 transition-colors ${
              step.completed
                ? "bg-emerald-50/50 dark:bg-emerald-500/5"
                : ""
            }`}
          >
            {/* Checkbox */}
            <div
              className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                step.completed
                  ? "bg-emerald-500 text-white"
                  : "border-2 border-gray-300 dark:border-gray-600"
              }`}
            >
              {step.completed && <Check size={14} strokeWidth={3} />}
            </div>

            {/* Label */}
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-medium ${
                  step.completed
                    ? "text-gray-500 dark:text-gray-400 line-through"
                    : "text-gray-900 dark:text-[#f8f6f3]"
                }`}
              >
                <span className="mr-1.5">{step.emoji}</span>
                {step.label}
              </p>
            </div>

            {/* Action */}
            {!step.completed && step.href !== "#" && (
              <Link
                href={step.href}
                className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-[#DC2626] hover:text-[#b91c1c] transition-colors"
              >
                Configurer
                <ArrowRight size={12} />
              </Link>
            )}
            {step.completed && (
              <span className="shrink-0 text-xs text-emerald-500 font-medium">
                Fait
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
