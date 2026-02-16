"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ── Types ────────────────────────────────────────

interface Shop {
  id: string;
  name: string;
  city: string;
}

const SECTORS = [
  "Restaurant",
  "Traiteur",
  "Collectivité",
  "Commerce alimentaire",
  "Autre",
];

// ── Main Page ────────────────────────────────────

export default function InscriptionProPage() {
  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useUser();

  const [companyName, setCompanyName] = useState("");
  const [siret, setSiret] = useState("");
  const [sector, setSector] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedShops, setSelectedShops] = useState<string[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const role = user?.publicMetadata?.role as string | undefined;

  // Redirect if already pro
  useEffect(() => {
    if (isLoaded && role === "client_pro") {
      router.replace("/profil");
    }
  }, [isLoaded, role, router]);

  // Fetch shops list
  useEffect(() => {
    fetch("/api/shops?perPage=50")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setShops(data.data);
        }
      })
      .catch(() => {});
  }, []);

  const siretValid = /^[0-9]{14}$/.test(siret);
  const canSubmit = companyName.trim().length >= 2 && siretValid && sector !== "";

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/users/upgrade-pro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: companyName.trim(),
          siret,
          sector,
          phone: phone.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSubmitted(true);
      } else {
        toast.error(data.error?.message || "Erreur lors de l'envoi");
      }
    } catch {
      toast.error("Erreur réseau, réessayez");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading ────────────────────────────────────
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
        <Header />
        <main className="max-w-xl mx-auto px-5 mt-8 flex justify-center py-16">
          <Loader2 size={32} className="animate-spin text-[#DC2626]" />
        </main>
      </div>
    );
  }

  // ── Not signed in ──────────────────────────────
  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
        <Header />
        <main className="max-w-xl mx-auto px-5 mt-8">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-5xl mb-4">🔒</div>
            <h2 className="text-lg font-bold text-[#2a2018] dark:text-white">Connexion requise</h2>
            <p className="text-sm text-[#999] dark:text-gray-400 mt-2">
              Connectez-vous pour demander un compte professionnel.
            </p>
            <Button className="mt-6 bg-[#DC2626] hover:bg-[#DC2626]" size="lg" asChild>
              <Link href="/sign-in?redirect_url=/inscription-pro">Se connecter</Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // ── Already pending ────────────────────────────
  if (role === "client_pro_pending") {
    return (
      <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
        <Header />
        <main className="max-w-xl mx-auto px-5 mt-8">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
              <Loader2 size={28} className="text-amber-600" />
            </div>
            <h2 className="text-lg font-bold text-[#2a2018] dark:text-white">
              Demande en cours
            </h2>
            <p className="text-sm text-[#999] dark:text-gray-400 mt-2 max-w-sm">
              Votre demande de compte professionnel est en attente de validation.
              Vous recevrez une notification dès approbation.
            </p>
            <Button className="mt-6 bg-[#DC2626] hover:bg-[#DC2626]" size="lg" asChild>
              <Link href="/decouvrir">Retour à l&apos;accueil</Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // ── Confirmation after submit ──────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
        <Header />
        <main className="max-w-xl mx-auto px-5 mt-8">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
              <CheckCircle2 size={32} className="text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-[#2a2018] dark:text-white">
              Demande envoyée
            </h2>
            <p className="text-sm text-[#999] dark:text-gray-400 mt-3 max-w-sm">
              Votre boucherie va valider votre compte professionnel.
              Vous recevrez une notification dès validation.
            </p>
            <Button className="mt-6 bg-[#DC2626] hover:bg-[#DC2626]" size="lg" asChild>
              <Link href="/decouvrir">Retour à l&apos;accueil</Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // ── Form ───────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a] pb-8">
      <Header />

      <main className="max-w-xl mx-auto px-5 mt-6 space-y-5">
        {/* Intro */}
        <div className="bg-[#DC2626]/5 rounded-2xl p-5 border border-[#DC2626]/10">
          <div className="flex items-center gap-2.5 mb-2">
            <Building2 size={18} className="text-[#DC2626]" />
            <h2 className="text-base font-bold text-[#2a2018] dark:text-white">
              Devenir client professionnel
            </h2>
          </div>
          <p className="text-sm text-[#666] dark:text-gray-400 leading-relaxed">
            Accédez aux tarifs professionnels, aux commandes en volume
            et à un suivi dédié auprès de vos boucheries partenaires.
          </p>
        </div>

        {/* Form card */}
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10 shadow-[0_1px_4px_rgba(0,0,0,0.03)] p-5 space-y-5">
          {/* Company name */}
          <div>
            <label className="text-sm font-semibold text-[#2a2018] dark:text-white mb-1.5 block">
              Nom de l&apos;entreprise <span className="text-red-500">*</span>
            </label>
            <Input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Ex: Restaurant Le Provençal"
              className="border-[#ece8e3] dark:border-white/10 focus-visible:ring-[#DC2626]/30 focus-visible:border-[#DC2626]"
            />
          </div>

          {/* SIRET */}
          <div>
            <label className="text-sm font-semibold text-[#2a2018] dark:text-white mb-1.5 block">
              Numéro SIRET <span className="text-red-500">*</span>
            </label>
            <Input
              value={siret}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 14);
                setSiret(v);
              }}
              placeholder="12345678901234"
              maxLength={14}
              inputMode="numeric"
              className="border-[#ece8e3] dark:border-white/10 focus-visible:ring-[#DC2626]/30 focus-visible:border-[#DC2626] font-mono"
            />
            {siret.length > 0 && !siretValid && (
              <p className="text-[11px] text-red-500 mt-1">
                Le SIRET doit contenir exactement 14 chiffres
              </p>
            )}
            {siretValid && (
              <p className="text-[11px] text-emerald-600 mt-1">
                Format valide
              </p>
            )}
          </div>

          {/* Sector */}
          <div>
            <label className="text-sm font-semibold text-[#2a2018] dark:text-white mb-1.5 block">
              Secteur d&apos;activité <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                className="flex h-12 w-full rounded-xl border border-[#ece8e3] dark:border-white/10 bg-white dark:bg-[#1a1a1a] px-4 py-3 text-sm text-[#2a2018] dark:text-white appearance-none focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30 focus:border-[#DC2626] transition-colors"
              >
                <option value="" disabled>
                  Choisir un secteur
                </option>
                {SECTORS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={16}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#999] dark:text-gray-400 pointer-events-none"
              />
            </div>
          </div>

          {/* Preferred shops */}
          {shops.length > 0 && (
            <div>
              <label className="text-sm font-semibold text-[#2a2018] dark:text-white mb-1.5 block">
                Boucherie(s) préférée(s)
                <span className="text-[#999] dark:text-gray-400 font-normal ml-1">(optionnel)</span>
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto rounded-xl border border-[#ece8e3] dark:border-white/10 p-3">
                {shops.map((shop) => {
                  const checked = selectedShops.includes(shop.id);
                  return (
                    <label
                      key={shop.id}
                      className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-[#f5f0eb] dark:hover:bg-white/5 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setSelectedShops((prev) =>
                            checked
                              ? prev.filter((id) => id !== shop.id)
                              : [...prev, shop.id]
                          );
                        }}
                        className="w-4 h-4 accent-[#DC2626] rounded"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#2a2018] dark:text-white truncate">
                          {shop.name}
                        </p>
                        <p className="text-[11px] text-[#999] dark:text-gray-400">{shop.city}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Phone */}
          <div>
            <label className="text-sm font-semibold text-[#2a2018] dark:text-white mb-1.5 block">
              Téléphone professionnel
              <span className="text-[#999] dark:text-gray-400 font-normal ml-1">(optionnel)</span>
            </label>
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+33612345678"
              className="border-[#ece8e3] dark:border-white/10 focus-visible:ring-[#DC2626]/30 focus-visible:border-[#DC2626]"
            />
            <p className="text-[11px] text-[#999] dark:text-gray-400 mt-1">
              Format : +33XXXXXXXXX
            </p>
          </div>
        </div>

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className="w-full bg-[#DC2626] hover:bg-[#DC2626] disabled:opacity-50"
          size="lg"
        >
          {submitting ? (
            <span className="flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              Envoi en cours...
            </span>
          ) : (
            "Envoyer ma demande"
          )}
        </Button>

        <p className="text-[11px] text-center text-[#999] dark:text-gray-400">
          En soumettant ce formulaire, vous acceptez que vos informations soient
          vérifiées par nos partenaires boucheries.
        </p>
      </main>
    </div>
  );
}

// ── Header ───────────────────────────────────────

function Header() {
  return (
    <header className="sticky top-0 z-10 bg-[#f8f6f3]/95 dark:bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-[#ece8e3] dark:border-white/10 px-5 py-4">
      <div className="max-w-xl mx-auto flex items-center gap-3">
        <Link
          href="/profil"
          className="flex items-center justify-center w-10 h-10 rounded-[14px] bg-white dark:bg-[#141414] border border-[#ece8e3] dark:border-white/10 shadow-sm"
        >
          <ArrowLeft size={17} className="text-[#333] dark:text-white" />
        </Link>
        <h1 className="text-lg font-bold text-[#2a2018] dark:text-white">Inscription Pro</h1>
      </div>
    </header>
  );
}
