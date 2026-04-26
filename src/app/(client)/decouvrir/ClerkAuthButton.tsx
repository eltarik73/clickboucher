import Link from "next/link";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

export default function ClerkAuthButton() {
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
