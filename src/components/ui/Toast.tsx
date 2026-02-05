// src/components/ui/Toast.tsx
"use client";

import { useCart } from "@/lib/hooks/useCart";

export function Toast() {
  const { toast, dismissToast } = useCart();

  return (
    <div className={`fixed top-4 right-4 z-50 transition-all duration-300 ease-out
      ${toast ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0 pointer-events-none"}`}>
      <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#1A1A1A] text-white shadow-xl">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <span className="text-[13px] font-medium">{toast?.message}</span>
        <button type="button" onClick={dismissToast} className="ml-1 p-0.5 rounded hover:bg-white/10 transition-colors">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
