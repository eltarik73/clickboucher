import type { Metadata } from "next";
import { SignUp } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "Inscription | Klik&Go",
  description:
    "Créez votre compte Klik&Go pour commander facilement chez votre boucher halal à Chambéry.",
};

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-stone-50 grid place-items-center">
      <div className="w-full max-w-[420px] px-5">
        <div className="text-center mb-7">
          <span className="text-3xl">🥩</span>
          <h1 className="font-display text-xl font-extrabold text-[#DC2626] mt-2">
            ClickBoucher
          </h1>
          <p className="text-sm text-stone-500 mt-1.5">
            Crée ton compte pour commander facilement.
          </p>
        </div>
        <SignUp
          fallbackRedirectUrl="/decouvrir"
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "rounded-[20px] border border-stone-200 shadow-sm",
              headerTitle: "font-display",
              formButtonPrimary:
                "bg-[#DC2626] hover:bg-[#9B1B32] rounded-[14px] text-sm font-semibold",
            },
          }}
        />
        <p className="text-center mt-5">
          <a
            href="/decouvrir"
            className="text-xs text-stone-400 underline underline-offset-4 hover:text-stone-600"
          >
            Retour au site
          </a>
        </p>
      </div>
    </div>
  );
}
