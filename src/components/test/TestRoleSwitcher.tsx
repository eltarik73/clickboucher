"use client";
// @security: test-only — Barre flottante de switch de rôle pour le mode test
// N'apparaît QUE si le test mode a été activé via le secret URL (vérifié server-side)

import { useTestAuth } from "@/hooks/useTestAuth";
import type { TestRole } from "@/lib/auth/test-auth";
import { X } from "lucide-react";

const ROLE_CONFIG: Record<TestRole, { label: string; color: string }> = {
  CLIENT: { label: "Client", color: "bg-blue-500" },
  BOUCHER: { label: "Boucher", color: "bg-green-500" },
  ADMIN: { label: "Webmaster", color: "bg-red-500" },
};

export function TestRoleSwitcher() {
  const { enabled, activated, role, switchRole, deactivate } = useTestAuth();

  // Don't render anything if test mode is not enabled OR not activated via secret
  if (!enabled || !activated) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[9999] flex items-center gap-2 rounded-full bg-black/90 px-4 py-2 shadow-2xl border border-yellow-400">
      <span className="text-yellow-400 text-[11px] font-bold mr-1 select-none">TEST</span>
      {(Object.entries(ROLE_CONFIG) as [TestRole, { label: string; color: string }][]).map(
        ([key, config]) => (
          <button
            key={key}
            onClick={() => switchRole(key)}
            className={`px-3 py-1 rounded-full text-[11px] font-medium text-white transition-all ${
              role === key
                ? `${config.color} ring-2 ring-yellow-400 scale-110`
                : "bg-gray-700 hover:bg-gray-600"
            }`}
          >
            {config.label}
          </button>
        )
      )}
      <button
        onClick={deactivate}
        className="ml-1 p-1 rounded-full text-gray-400 hover:text-white hover:bg-red-600 transition-all"
        title="Quitter le mode test"
      >
        <X size={14} />
      </button>
    </div>
  );
}
