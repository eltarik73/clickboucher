"use client";

import Link from "next/link";
import Image from "next/image";
import { SignedIn, SignedOut, useUser } from "@clerk/nextjs";

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
        <UserAvatar />
      </SignedIn>
    </>
  );
}

function UserAvatar() {
  const { user } = useUser();

  return (
    <Link
      href="/profil"
      className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-white/10"
    >
      {user?.imageUrl ? (
        <div className="w-7 h-7 rounded-full overflow-hidden">
          <Image
            src={user.imageUrl}
            alt=""
            width={28}
            height={28}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="w-7 h-7 rounded-full bg-[#DC2626] flex items-center justify-center text-white text-xs font-bold">
          {user?.firstName?.[0] || "?"}
        </div>
      )}
      <span className="text-white text-sm font-medium">
        {user?.firstName || "Profil"}
      </span>
    </Link>
  );
}
