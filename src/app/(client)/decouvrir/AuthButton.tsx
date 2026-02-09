"use client";

import Link from "next/link";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

export function AuthButton() {
  return (
    <>
      <SignedOut>
        <Link
          href="/sign-in"
          className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white text-sm font-medium rounded-xl transition-colors border border-white/10"
        >
          Se connecter
        </Link>
      </SignedOut>
      <SignedIn>
        <UserButton afterSignOutUrl="/decouvrir" />
      </SignedIn>
    </>
  );
}
