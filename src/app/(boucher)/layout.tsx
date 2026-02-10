export const dynamic = "force-dynamic";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { BoucherNav } from "@/components/layout/BoucherNav";

export default async function BoucherLayout({ children }: { children: React.ReactNode }) {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    redirect("/sign-in");
  }

  // Check role from DB (not Clerk metadata)
  const user = await getOrCreateUser(clerkId);

  if (!user || (user.role !== "BOUCHER" && user.role !== "ADMIN")) {
    console.log("[BoucherLayout] Access denied for", clerkId, "role:", user?.role);
    redirect("/decouvrir");
  }

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      <BoucherNav />
      {/* Mobile: bottom padding for nav. Desktop: left padding for sidebar */}
      <main className="pb-20 md:pb-0 md:pl-[220px]">
        {children}
      </main>
    </div>
  );
}
