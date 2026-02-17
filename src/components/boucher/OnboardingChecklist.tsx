"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Check, ArrowRight, Rocket, PartyPopper } from "lucide-react";

type Step = {
  key: string;
  label: string;
  emoji: string;
  weight: number;
  completed: boolean;
  href: string;
};

type OnboardingData = {
  steps: Step[];
  progress: number;
  onboardingCompleted: boolean;
  visible: boolean;
};

export default function OnboardingChecklist() {
  const [data, setData] = useState<OnboardingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);
  const [prevProgress, setPrevProgress] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/boucher/onboarding");
      const json = await res.json();
      const d = json.data || json;
      setData(d);

      // Auto-visibility when >= 80%
      if (d.progress >= 80 && !d.visible) {
        await fetch("/api/boucher/onboarding", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ setVisible: true }),
        });
      }

      // Show confetti when first reaching 80%+
      if (d.progress >= 80 && prevProgress < 80) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 4000);
      }
      setPrevProgress(d.progress);

      // Auto-complete at 100%
      if (d.progress >= 100 && !d.onboardingCompleted) {
        await fetch("/api/boucher/onboarding", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ complete: true }),
        });
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [prevProgress]);

  useEffect(() => { load(); }, [load]);

  if (loading || !data || data.onboardingCompleted) return null;

  const completedCount = data.steps.filter((s) => s.completed).length;

  return (
    <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-100 dark:border-white/10 shadow-sm overflow-hidden mb-6 relative">
      {/* Confetti overlay */}
      {showConfetti && (
        <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
          <div className="text-center animate-bounce">
            <PartyPopper size={48} className="text-amber-500 mx-auto mb-2" />
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              Votre boutique est visible !
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
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {data.progress}% complété
          </span>
          {data.progress >= 80 && (
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              Boutique visible !
            </span>
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
                    ? "text-gray-400 dark:text-gray-500 line-through"
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
