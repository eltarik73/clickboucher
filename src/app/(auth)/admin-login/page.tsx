import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { SignIn } from "@clerk/nextjs";
import { isAdmin } from "@/lib/roles";

export const metadata = {
  title: "Administration — Klik&Go",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  const { userId } = await auth();

  if (userId) {
    // Read role directly from Clerk user (works without session token config)
    const user = await currentUser();
    const role = (user?.publicMetadata as Record<string, string>)?.role;

    console.log("[admin-login] userId:", userId);
    console.log("[admin-login] publicMetadata:", user?.publicMetadata);
    console.log("[admin-login] role detected:", role, "| isAdmin:", isAdmin(role));

    if (isAdmin(role)) {
      redirect("/admin/dashboard");
    }

    // Logged in but not admin → access denied
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center px-5">
        <p className="text-sm text-gray-500 mb-2">Administration</p>
        <div className="bg-[#141414] border border-white/10 rounded-2xl p-8 text-center max-w-sm w-full">
          <div className="text-3xl mb-3">🔒</div>
          <h1 className="text-lg font-bold text-white mb-2">Accès refusé</h1>
          <p className="text-sm text-gray-400">
            Vous n&apos;avez pas les droits d&apos;administration.
          </p>
          <p className="text-xs text-gray-500 mt-3">Redirection dans 3 secondes...</p>
          <meta httpEquiv="refresh" content="3;url=/decouvrir" />
        </div>
      </div>
    );
  }

  // Not logged in → show Clerk sign-in
  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center px-5">
      <p className="text-xs text-gray-600 mb-6 tracking-wider uppercase">Administration</p>
      <SignIn
        fallbackRedirectUrl="/admin-login"
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "bg-[#141414] border border-white/10",
          },
        }}
      />
    </div>
  );
}
