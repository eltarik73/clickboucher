"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useTestAuth } from "@/hooks/useTestAuth";

// Lazy-load Clerk UI components — removes ~250KiB from initial homepage bundle
const ClerkAuthButton = dynamic(() => import("./ClerkAuthButton"), {
  ssr: false,
  loading: () => (
    <Link
      href="/sign-in"
      className="px-5 py-2.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-white text-sm font-medium rounded-xl transition-colors border border-gray-200 dark:border-white/10"
    >
      Se connecter
    </Link>
  ),
});

export function AuthButton() {
  // @security: test-only — Bypass Clerk only when test mode is activated server-side
  const { enabled, activated } = useTestAuth();
  if (enabled && activated) {
    return (
      <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white text-xs font-bold" title="Mode Test">
        T
      </div>
    );
  }

  return <ClerkAuthButton />;
}
