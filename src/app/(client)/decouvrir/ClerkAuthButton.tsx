"use client";

import Link from "next/link";
import { useAuth, UserButton } from "@clerk/nextjs";

// useAuth() plutôt que <SignedIn>/<SignedOut> : tant que clerk-js n'est pas
// chargé (isLoaded:false), ces deux composants ne rendent rien et le lien
// « Se connecter » disparaîtrait puis réapparaîtrait dans le header.
export default function ClerkAuthButton() {
  const { isSignedIn } = useAuth();

  if (isSignedIn) {
    return <UserButton afterSignOutUrl="/" />;
  }

  return (
    <Link
      href="/sign-in"
      prefetch={false}
      className="px-5 py-2.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-white text-sm font-medium rounded-xl transition-colors border border-gray-200 dark:border-white/10"
    >
      Se connecter
    </Link>
  );
}
