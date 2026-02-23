// src/app/onboarding/page.tsx — Role selection for first-time users
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { ShoppingCart, UtensilsCrossed, Loader2 } from "lucide-react";
import { KlikLogo, KlikWordmark } from "@/components/ui/KlikLogo";
import { toast } from "sonner";

export default function OnboardingPage() {
  const router = useRouter();
  const { userId } = useAuth();
  const [step, setStep] = useState<"choice" | "boucher-form">("choice");
  const [loading, setLoading] = useState(false);

  // Boucher form state
  const [shopName, setShopName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");

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

  if (step === "boucher-form") {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center p-4">
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
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#141414] text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30 focus:border-[#DC2626]"
                disabled={loading}
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
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#141414] text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30 focus:border-[#DC2626]"
                disabled={loading}
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
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#141414] text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30 focus:border-[#DC2626]"
                disabled={loading}
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
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#141414] text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30 focus:border-[#DC2626]"
                disabled={loading}
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
    <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-10">
          <KlikLogo size={64} />
          <KlikWordmark size="xl" className="mt-3" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mt-6">
            Bienvenue sur Klik&Go !
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
            className="w-full p-6 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#141414] hover:border-[#DC2626]/50 hover:shadow-lg hover:shadow-[#DC2626]/5 transition-all text-left group disabled:opacity-50"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#DC2626]/10 flex items-center justify-center shrink-0 group-hover:bg-[#DC2626]/20 transition-colors">
                <ShoppingCart size={24} className="text-[#DC2626]" />
              </div>
              <div>
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
            className="w-full p-6 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#141414] hover:border-[#DC2626]/50 hover:shadow-lg hover:shadow-[#DC2626]/5 transition-all text-left group disabled:opacity-50"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#DC2626]/10 flex items-center justify-center shrink-0 group-hover:bg-[#DC2626]/20 transition-colors">
                <UtensilsCrossed size={24} className="text-[#DC2626]" />
              </div>
              <div>
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
