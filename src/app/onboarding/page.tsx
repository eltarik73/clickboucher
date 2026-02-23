// src/app/onboarding/page.tsx — Role selection for first-time users
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { ShoppingCart, UtensilsCrossed, Loader2 } from "lucide-react";
import { KlikLogo, KlikWordmark } from "@/components/ui/KlikLogo";
import { toast } from "sonner";

export default function OnboardingPage() {
  const router = useRouter();
  const { userId, isLoaded } = useAuth();
  const [step, setStep] = useState<"loading" | "choice" | "boucher-form">("loading");
  const [loading, setLoading] = useState(false);

  // Boucher form state
  const [shopName, setShopName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");

  // Check if user already has a role — redirect if already onboarded
  useEffect(() => {
    if (!isLoaded) return;
    if (!userId) {
      router.replace("/sign-in");
      return;
    }

    // Check if user already exists in DB
    fetch("/api/auth/me")
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then((data) => {
        if (data?.user?.role) {
          // Already onboarded — redirect by role
          const role = data.user.role;
          if (role === "BOUCHER") {
            router.replace("/boucher/commandes");
          } else if (role === "ADMIN") {
            router.replace("/admin");
          } else {
            router.replace("/decouvrir");
          }
        } else {
          // New user — show choice
          setStep("choice");
        }
      })
      .catch(() => {
        // API error or user not found — show choice
        setStep("choice");
      });
  }, [isLoaded, userId, router]);

  async function chooseClient() {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "CLIENT" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message || "Erreur");
      }
      router.push("/decouvrir");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'inscription");
      setLoading(false);
    }
  }

  async function submitBoucher(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    if (!shopName.trim() || !address.trim() || !city.trim() || !phone.trim()) {
      toast.error("Tous les champs sont obligatoires");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "BOUCHER",
          shopName: shopName.trim(),
          address: address.trim(),
          city: city.trim(),
          phone: phone.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message || "Erreur");
      }
      router.push("/boucher/commandes");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la création");
      setLoading(false);
    }
  }

  // Loading state while checking auth/DB
  if (step === "loading") {
    return (
      <div className="min-h-screen min-h-dvh bg-white dark:bg-black flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-[#DC2626]" />
      </div>
    );
  }

  if (step === "boucher-form") {
    return (
      <div className="min-h-screen min-h-dvh bg-white dark:bg-black flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center mb-8">
            <KlikLogo size={48} />
            <KlikWordmark size="lg" className="mt-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Créez votre boutique
            </p>
          </div>

          <form onSubmit={submitBoucher} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nom de la boutique
              </label>
              <input
                type="text"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="Ex: Boucherie El Fathe"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#141414] text-gray-900 dark:text-white placeholder:text-gray-400 text-base focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30 focus:border-[#DC2626]"
                disabled={loading}
                autoComplete="organization"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Adresse
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ex: 533 Faubourg Montmélian"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#141414] text-gray-900 dark:text-white placeholder:text-gray-400 text-base focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30 focus:border-[#DC2626]"
                disabled={loading}
                autoComplete="street-address"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Ville
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Ex: Chambéry"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#141414] text-gray-900 dark:text-white placeholder:text-gray-400 text-base focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30 focus:border-[#DC2626]"
                disabled={loading}
                autoComplete="address-level2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Téléphone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ex: 04 79 85 XX XX"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#141414] text-gray-900 dark:text-white placeholder:text-gray-400 text-base focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30 focus:border-[#DC2626]"
                disabled={loading}
                autoComplete="tel"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-[#DC2626] text-white font-bold text-base hover:bg-[#b91c1c] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : null}
              {loading ? "Création..." : "Créer ma boutique"}
            </button>
            <button
              type="button"
              onClick={() => setStep("choice")}
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              Retour
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-dvh bg-white dark:bg-black flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-10">
          <KlikLogo size={64} />
          <KlikWordmark size="xl" className="mt-3" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mt-6 text-center">
            Bienvenue sur Klik&amp;Go !
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Qui êtes-vous ?
          </p>
        </div>

        <div className="space-y-4">
          {/* Client card */}
          <button
            onClick={chooseClient}
            disabled={loading}
            className="w-full p-5 sm:p-6 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#141414] hover:border-[#DC2626]/50 hover:shadow-lg hover:shadow-[#DC2626]/5 transition-all text-left group disabled:opacity-50 active:scale-[0.98]"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#DC2626]/10 flex items-center justify-center shrink-0 group-hover:bg-[#DC2626]/20 transition-colors">
                <ShoppingCart size={24} className="text-[#DC2626]" />
              </div>
              <div className="min-w-0">
                <p className="text-base font-bold text-gray-900 dark:text-white">
                  {loading ? "Inscription..." : "Je suis client"}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  Commandez et récupérez vos viandes
                </p>
              </div>
            </div>
          </button>

          {/* Boucher card */}
          <button
            onClick={() => setStep("boucher-form")}
            disabled={loading}
            className="w-full p-5 sm:p-6 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#141414] hover:border-[#DC2626]/50 hover:shadow-lg hover:shadow-[#DC2626]/5 transition-all text-left group disabled:opacity-50 active:scale-[0.98]"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#DC2626]/10 flex items-center justify-center shrink-0 group-hover:bg-[#DC2626]/20 transition-colors">
                <UtensilsCrossed size={24} className="text-[#DC2626]" />
              </div>
              <div className="min-w-0">
                <p className="text-base font-bold text-gray-900 dark:text-white">
                  Je suis boucher
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  Gérez votre boutique et vos commandes
                </p>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
