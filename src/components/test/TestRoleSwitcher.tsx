"use client";
// @security: test-only — Barre flottante de switch de rôle pour le mode test

import { useTestAuth } from "@/hooks/useTestAuth";
import type { TestRole } from "@/lib/auth/test-auth";

const ROLE_CONFIG: Record<TestRole, { label: string; color: string }> = {
  CLIENT: { label: "Client", color: "bg-blue-500" },
  BOUCHER: { label: "Boucher", color: "bg-green-500" },
  ADMIN: { label: "Webmaster", color: "bg-red-500" },
};

export function TestRoleSwitcher() {
  if (process.env.NEXT_PUBLIC_TEST_MODE !== "true") return null;

  return <TestRoleSwitcherInner />;
}

function TestRoleSwitcherInner() {
  const { role, switchRole } = useTestAuth();

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
    </div>
  );
}
