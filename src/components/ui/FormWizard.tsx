"use client";

import { useState, ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type WizardStep = {
  id: string;
  title: string;
  description?: string;
  isValid?: () => boolean;
  content: ReactNode;
};

export type FormWizardProps = {
  steps: WizardStep[];
  onComplete: () => Promise<void> | void;
  submitting?: boolean;
  initialStep?: number;
};

export function FormWizard({
  steps,
  onComplete,
  submitting = false,
  initialStep = 0,
}: FormWizardProps) {
  const [currentIdx, setCurrentIdx] = useState(initialStep);
  const isLast = currentIdx === steps.length - 1;
  const current = steps[currentIdx];
  const canAdvance = current.isValid ? current.isValid() : true;

  return (
    <div className="space-y-6 font-[var(--font-outfit)]">
      {/* Progress indicator */}
      <div className="flex items-center justify-between gap-2">
        {steps.map((step, i) => {
          const isDone = i < currentIdx;
          const isCurrent = i === currentIdx;
          return (
            <div key={step.id} className="flex-1 flex items-center gap-2">
              <div
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 transition-colors",
                  isDone
                    ? "bg-[#DC2626] text-white"
                    : isCurrent
                    ? "bg-[#DC2626] text-white ring-4 ring-[#DC2626]/20"
                    : "bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-gray-400"
                )}
              >
                {isDone ? <Check size={16} /> : i + 1}
              </div>
              {i < steps.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 flex-1 transition-colors",
                    isDone ? "bg-[#DC2626]" : "bg-gray-200 dark:bg-white/10"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Title + description */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Étape {currentIdx + 1} / {steps.length}
        </p>
        <h2 className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
          {current.title}
        </h2>
        {current.description && (
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {current.description}
          </p>
        )}
      </div>

      {/* Step content */}
      <div className="min-h-[280px]">{current.content}</div>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3 pt-4 border-t border-gray-200 dark:border-white/10">
        <button
          type="button"
          onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
          disabled={currentIdx === 0 || submitting}
          className="min-h-[44px] px-4 py-2 rounded-xl border border-gray-300 dark:border-white/10 text-gray-700 dark:text-gray-300 font-medium flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-40 transition-colors"
        >
          <ChevronLeft size={16} /> Précédent
        </button>

        <button
          type="button"
          onClick={() => {
            if (isLast) onComplete();
            else setCurrentIdx((i) => i + 1);
          }}
          disabled={!canAdvance || submitting}
          className="min-h-[44px] px-6 py-2 rounded-xl bg-[#DC2626] text-white font-semibold flex items-center gap-2 hover:bg-[#b91c1c] disabled:opacity-40 transition-colors"
        >
          {submitting ? "..." : isLast ? "Confirmer" : "Suivant"}
          {!isLast && <ChevronRight size={16} />}
        </button>
      </div>
    </div>
  );
}
