"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import {
  ArrowLeft,
  Store,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PACKS: Record<string, { name: string; price: string }> = {
  essentiel: { name: "Essentiel", price: "49\u20AC/mois" },
  premium: { name: "Premium", price: "99\u20AC/mois" },
  entreprise: { name: "Entreprise", price: "199\u20AC/mois" },
};

export default function InscriptionBoucherPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a] flex items-center justify-center">
          <Loader2 size={32} className="animate-spin text-[#DC2626]" />
        </div>
      }
    >
      <InscriptionBoucherContent />
    </Suspense>
  );
}

function InscriptionBoucherContent() {
  const { isLoaded, isSignedIn } = useUser();
  const searchParams = useSearchParams();
  const packKey = searchParams.get("pack") || "essentiel";
  const pack = PACKS[packKey] || PACKS.essentiel;

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [siret, setSiret] = useState("");
  const [description, setDescription] = useState("");
  const [acceptCgv, setAcceptCgv] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const siretValid = /^[0-9]{14}$/.test(siret);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const phoneValid = /^\+?[0-9]{10,14}$/.test(phone.replace(/\s/g, ""));
  const canSubmit =
    name.trim().length >= 2 &&
    address.trim().length >= 5 &&
    city.trim().length >= 2 &&
    phoneValid &&
    emailValid &&
    siretValid &&
    acceptCgv;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/shops/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          address: address.trim(),
          city: city.trim(),
          phone: phone.trim(),
          email: email.trim(),
          siret: siret.trim(),
          description: description.trim() || undefined,
          pack: packKey,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
      } else {
        toast.error(data.error?.message || "Erreur lors de l'inscription");
      }
    } catch {
      toast.error("Erreur reseau, reessayez");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success ──
  if (submitted) {
    return (
      <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
        <Header />
        <main className="max-w-xl mx-auto px-5 mt-8">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
              <CheckCircle2 size={32} className="text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Bienvenue !
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-3 max-w-sm leading-relaxed">
              Votre boucherie est en cours de validation. Vous recevrez un email
              de confirmation sous 24h.
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Pack selectionne : {pack.name} — {pack.price}
            </p>
            <Button
              className="mt-6 bg-[#DC2626] hover:bg-[#b91c1c]"
              size="lg"
              asChild
            >
              <Link href="/decouvrir">Retour a l&apos;accueil</Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // ── Not signed in ──
  if (isLoaded && !isSignedIn) {
    return (
      <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
        <Header />
        <main className="max-w-xl mx-auto px-5 mt-8">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-5xl mb-4">&#128274;</div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Connexion requise
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Connectez-vous ou creez un compte pour inscrire votre boucherie.
            </p>
            <Button
              className="mt-6 bg-[#DC2626] hover:bg-[#b91c1c]"
              size="lg"
              asChild
            >
              <Link
                href={`/sign-in?redirect_url=/inscription-boucher?pack=${packKey}`}
              >
                Se connecter
              </Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // ── Form ──
  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a] pb-12">
      <Header />

      <main className="max-w-xl mx-auto px-5 mt-6 space-y-5">
        {/* Pack selected */}
        <div className="bg-[#DC2626]/5 dark:bg-[#DC2626]/10 rounded-2xl p-5 border border-[#DC2626]/10">
          <div className="flex items-center gap-2.5 mb-1">
            <Store size={18} className="text-[#DC2626]" />
            <h2 className="text-base font-bold text-gray-900 dark:text-white">
              Pack {pack.name} — {pack.price}
            </h2>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            30 jours d&apos;essai gratuit inclus. Changez de formule a tout
            moment.
          </p>
        </div>

        {/* Form card */}
        <div className="bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10 shadow-sm p-5 space-y-5">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">
            Informations de votre boucherie
          </h3>

          {/* Name */}
          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">
              Nom de la boucherie <span className="text-red-500">*</span>
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Boucherie El Fath"
              className="border-[#ece8e3] dark:border-white/10 dark:bg-[#0a0a0a] focus-visible:ring-[#DC2626]/30 focus-visible:border-[#DC2626]"
            />
          </div>

          {/* Address */}
          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">
              Adresse complete <span className="text-red-500">*</span>
            </label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="15 rue de Boigne"
              className="border-[#ece8e3] dark:border-white/10 dark:bg-[#0a0a0a] focus-visible:ring-[#DC2626]/30 focus-visible:border-[#DC2626]"
            />
          </div>

          {/* City */}
          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">
              Ville <span className="text-red-500">*</span>
            </label>
            <Input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Chambery"
              className="border-[#ece8e3] dark:border-white/10 dark:bg-[#0a0a0a] focus-visible:ring-[#DC2626]/30 focus-visible:border-[#DC2626]"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">
              Telephone <span className="text-red-500">*</span>
            </label>
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+33 6 12 34 56 78"
              className="border-[#ece8e3] dark:border-white/10 dark:bg-[#0a0a0a] focus-visible:ring-[#DC2626]/30 focus-visible:border-[#DC2626]"
            />
          </div>

          {/* Email */}
          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">
              Email <span className="text-red-500">*</span>
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contact@maboucherie.fr"
              className="border-[#ece8e3] dark:border-white/10 dark:bg-[#0a0a0a] focus-visible:ring-[#DC2626]/30 focus-visible:border-[#DC2626]"
            />
          </div>

          {/* SIRET */}
          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">
              SIRET <span className="text-red-500">*</span>
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
              className="border-[#ece8e3] dark:border-white/10 dark:bg-[#0a0a0a] focus-visible:ring-[#DC2626]/30 focus-visible:border-[#DC2626] font-mono"
            />
            {siret.length > 0 && !siretValid && (
              <p className="text-[11px] text-red-500 mt-1">
                Le SIRET doit contenir exactement 14 chiffres
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">
              Description courte
              <span className="text-gray-400 dark:text-gray-500 font-normal ml-1">
                (optionnel)
              </span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Boucherie halal artisanale, viandes fraiches du jour..."
              rows={3}
              maxLength={500}
              className="flex w-full rounded-xl border border-[#ece8e3] dark:border-white/10 dark:bg-[#0a0a0a] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30 focus:border-[#DC2626] transition-colors resize-none"
            />
          </div>

          {/* CGV */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={acceptCgv}
              onChange={(e) => setAcceptCgv(e.target.checked)}
              className="mt-1 w-4 h-4 accent-[#DC2626] rounded"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              J&apos;accepte les conditions generales de vente et la periode
              d&apos;essai gratuite de 30 jours.
            </span>
          </label>
        </div>

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className="w-full bg-[#DC2626] hover:bg-[#b91c1c] disabled:opacity-50"
          size="lg"
        >
          {submitting ? (
            <span className="flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              Inscription en cours...
            </span>
          ) : (
            "Creer mon compte boucher"
          )}
        </Button>

        <p className="text-[11px] text-center text-gray-400 dark:text-gray-500">
          Votre boucherie sera validee par notre equipe sous 24h.
          <br />
          Essai gratuit de 30 jours, sans engagement.
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
          href="/espace-boucher"
          className="flex items-center justify-center w-10 h-10 rounded-[14px] bg-white dark:bg-[#141414] border border-[#ece8e3] dark:border-white/10 shadow-sm"
        >
          <ArrowLeft size={17} className="text-gray-700 dark:text-gray-300" />
        </Link>
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">
          Inscription boucher
        </h1>
      </div>
    </header>
  );
}
