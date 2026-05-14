// src/app/(client)/bons-plans/layout.tsx — Shared layout with tab navigation
import Link from "next/link";
import { ArrowLeft, Flame } from "lucide-react";
import { BonsPlansNav } from "@/components/client/BonsPlansNav";

export default function BonsPlansLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#DC2626] to-[#ef4444] px-4 pb-4 pt-12">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              aria-label="Retour à l'accueil"
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20 backdrop-blur"
            >
              <ArrowLeft size={15} className="text-white" aria-hidden="true" />
            </Link>
            <h1 className="flex items-center gap-2 text-lg font-bold text-white">
              <Flame size={20} aria-hidden="true" />
              <span>Bons plans et promotions boucherie halal</span>
            </h1>
          </div>
        </div>

        {/* Tab navigation */}
        <BonsPlansNav />

        {/* Content */}
        {children}
      </div>
    </div>
  );
}
