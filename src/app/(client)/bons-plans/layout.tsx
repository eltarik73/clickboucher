// src/app/(client)/bons-plans/layout.tsx — Shared layout with tab navigation
import Link from "next/link";
import { ArrowLeft, Flame } from "lucide-react";
import { BonsPlansNav } from "@/components/client/BonsPlansNav";

export default function BonsPlansLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#DC2626] to-[#ef4444] px-4 pt-12 pb-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <ArrowLeft size={15} className="text-white" />
            </Link>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
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
