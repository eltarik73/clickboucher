"use client";

import Link from "next/link";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

// @security: test-only — En mode test, on affiche un avatar mock
function TestModeAvatar() {
  if (process.env.NEXT_PUBLIC_TEST_MODE !== "true") return null;
  return (
    <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white text-xs font-bold" title="Mode Test">
      T
    </div>
  );
}

export function AuthButton() {
  // @security: test-only — Bypass Clerk
  if (process.env.NEXT_PUBLIC_TEST_MODE === "true") {
    return <TestModeAvatar />;
  }

  return (
    <>
      <SignedOut>
        <Link
          href="/sign-in"
          className="px-5 py-2.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-white text-sm font-medium rounded-xl transition-colors border border-gray-200 dark:border-white/10"
        >
          Se connecter
        </Link>
      </SignedOut>
      <SignedIn>
        <UserButton afterSignOutUrl="/" />
      </SignedIn>
    </>
  );
}
