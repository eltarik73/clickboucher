"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useUser } from "@clerk/nextjs";
import {
  ArrowLeft,
  User as UserIcon,
  ShieldCheck,
  Bell,
  Heart,
  ExternalLink,
  Loader2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

// ── Types ────────────────────────────────────────

interface FavoriteShop {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  city: string;
}

interface UserProfile {
  id: string;
  clerkId: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  role: string;
  companyName: string | null;
  siret: string | null;
  proStatus: string | null;
  notifEmail: boolean;
  notifSms: boolean;
  notifWhatsapp: boolean;
  favoriteShops: FavoriteShop[];
}

// ── Helpers ──────────────────────────────────────

const ROLE_CONFIG: Record<string, { label: string; color: string }> = {
  CLIENT:             { label: "Particulier",              color: "bg-stone-100 text-stone-700 border-stone-200" },
  CLIENT_PRO_PENDING: { label: "Pro en attente de validation", color: "bg-amber-100 text-amber-800 border-amber-200" },
  CLIENT_PRO:         { label: "Professionnel",            color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
};

// ── Main Page ────────────────────────────────────

export default function ProfilPage() {
  const { user: clerkUser, isLoaded, isSignedIn } = useUser();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Notification form state
  const [notifSms, setNotifSms] = useState(false);
  const [notifWhatsapp, setNotifWhatsapp] = useState(false);
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    fetch("/api/users/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setProfile(data.data);
          setNotifSms(data.data.notifSms);
          setNotifWhatsapp(data.data.notifWhatsapp);
          setPhone(data.data.phone || "");
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [isLoaded, isSignedIn]);

  const handleSavePrefs = async () => {
    if ((notifSms || notifWhatsapp) && !phone) {
      toast.error("Numéro de téléphone requis pour les notifications SMS/WhatsApp");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notifSms,
          notifWhatsapp,
          phone: phone || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setProfile(data.data);
        toast.success("Préférences enregistrées");
      } else {
        toast.error(data.error?.message || "Erreur");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveFavorite = async (shopId: string) => {
    try {
      const res = await fetch("/api/favorites/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopId }),
      });
      const data = await res.json();
      if (data.success && profile) {
        setProfile({
          ...profile,
          favoriteShops: profile.favoriteShops.filter((s) => s.id !== shopId),
        });
        toast.success("Favori retiré");
      }
    } catch {
      toast.error("Erreur réseau");
    }
  };

  // ── Loading ────────────────────────────────────
  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-[#f8f6f3]">
        <Header />
        <main className="max-w-xl mx-auto px-5 mt-8">
          <div className="flex flex-col items-center py-16">
            <Loader2 size={32} className="animate-spin text-[#DC2626]" />
          </div>
        </main>
      </div>
    );
  }

  // ── Not signed in ──────────────────────────────
  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-[#f8f6f3]">
        <Header />
        <main className="max-w-xl mx-auto px-5 mt-8">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-5xl mb-4">🔒</div>
            <h2 className="text-lg font-bold text-[#2a2018]">Connexion requise</h2>
            <p className="text-sm text-[#999] mt-2">
              Connectez-vous pour accéder à votre profil.
            </p>
            <Button className="mt-6 bg-[#DC2626] hover:bg-[#DC2626]" size="lg" asChild>
              <Link href="/sign-in?redirect_url=/profil">Se connecter</Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────
  if (error || !profile) {
    return (
      <div className="min-h-screen bg-[#f8f6f3]">
        <Header />
        <main className="max-w-xl mx-auto px-5 mt-8">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-lg font-bold text-[#2a2018]">Erreur de chargement</h2>
            <p className="text-sm text-[#999] mt-2">
              Impossible de charger votre profil.
            </p>
            <Button
              className="mt-6 bg-[#DC2626] hover:bg-[#DC2626]"
              size="lg"
              onClick={() => window.location.reload()}
            >
              Réessayer
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const roleConfig = ROLE_CONFIG[profile.role] ?? ROLE_CONFIG.CLIENT;
  const showPhoneField = notifSms || notifWhatsapp;

  return (
    <div className="min-h-screen bg-[#f8f6f3] pb-8">
      <Header />

      <main className="max-w-xl mx-auto px-5 mt-6 space-y-5">
        {/* ═══════════════════════════════════════ */}
        {/* 1. INFOS PERSONNELLES                  */}
        {/* ═══════════════════════════════════════ */}
        <section className="bg-white rounded-2xl border border-[#ece8e3] shadow-[0_1px_4px_rgba(0,0,0,0.03)] p-5">
          <div className="flex items-center gap-2 mb-4">
            <UserIcon size={16} className="text-[#DC2626]" />
            <h2 className="text-sm font-bold text-[#2a2018]">Informations personnelles</h2>
          </div>

          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-full overflow-hidden bg-stone-200 shrink-0">
              {clerkUser?.imageUrl ? (
                <Image
                  src={clerkUser.imageUrl}
                  alt="Avatar"
                  width={64}
                  height={64}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl text-stone-400">
                  {profile.firstName[0]}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-[#2a2018] truncate">
                {profile.firstName} {profile.lastName}
              </p>
              <p className="text-sm text-[#999] truncate">{profile.email}</p>
              {profile.phone && (
                <p className="text-sm text-[#999]">{profile.phone}</p>
              )}
            </div>
          </div>

          <a
            href="/user-profile"
            className="flex items-center justify-center gap-2 mt-4 w-full py-2.5 rounded-xl bg-stone-50 hover:bg-stone-100 border border-[#ece8e3] text-sm font-medium text-[#2a2018] transition-colors"
          >
            Modifier sur Clerk
            <ExternalLink size={14} className="text-[#999]" />
          </a>
        </section>

        {/* ═══════════════════════════════════════ */}
        {/* 2. TYPE DE COMPTE                      */}
        {/* ═══════════════════════════════════════ */}
        <section className="bg-white rounded-2xl border border-[#ece8e3] shadow-[0_1px_4px_rgba(0,0,0,0.03)] p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck size={16} className="text-[#DC2626]" />
            <h2 className="text-sm font-bold text-[#2a2018]">Type de compte</h2>
          </div>

          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${roleConfig.color}`}>
              {roleConfig.label}
              {profile.role === "CLIENT_PRO" && " \u2713"}
            </span>

            {profile.role === "CLIENT" && (
              <Link
                href="/pro"
                className="text-sm font-semibold text-[#DC2626] hover:underline"
              >
                Passer Pro &rarr;
              </Link>
            )}
          </div>

          {profile.role === "CLIENT_PRO" && (
            <div className="mt-3 pt-3 border-t border-[#ece8e3] space-y-1">
              {profile.companyName && (
                <p className="text-sm text-[#2a2018]">
                  <span className="text-[#999]">Entreprise :</span>{" "}
                  <span className="font-medium">{profile.companyName}</span>
                </p>
              )}
              {profile.siret && (
                <p className="text-sm text-[#2a2018]">
                  <span className="text-[#999]">SIRET :</span>{" "}
                  <span className="font-mono font-medium">{profile.siret}</span>
                </p>
              )}
            </div>
          )}
        </section>

        {/* ═══════════════════════════════════════ */}
        {/* 3. PRÉFÉRENCES DE NOTIFICATION         */}
        {/* ═══════════════════════════════════════ */}
        <section className="bg-white rounded-2xl border border-[#ece8e3] shadow-[0_1px_4px_rgba(0,0,0,0.03)] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Bell size={16} className="text-[#DC2626]" />
            <h2 className="text-sm font-bold text-[#2a2018]">Notifications</h2>
          </div>

          <div className="space-y-4">
            {/* Email — always on */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#2a2018]">Email</p>
                <p className="text-[11px] text-[#999]">Toujours activé</p>
              </div>
              <Switch checked={true} onCheckedChange={() => {}} disabled />
            </div>

            {/* SMS */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#2a2018]">SMS</p>
                <p className="text-[11px] text-[#999]">Recevez des alertes par SMS</p>
              </div>
              <Switch checked={notifSms} onCheckedChange={setNotifSms} />
            </div>

            {/* WhatsApp */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#2a2018]">WhatsApp</p>
                <p className="text-[11px] text-[#999]">Recevez des alertes WhatsApp</p>
              </div>
              <Switch checked={notifWhatsapp} onCheckedChange={setNotifWhatsapp} />
            </div>

            {/* Phone field */}
            {showPhoneField && (
              <div>
                <label className="text-xs font-medium text-[#2a2018] mb-1.5 block">
                  Numéro de téléphone
                </label>
                <Input
                  type="tel"
                  placeholder="+33612345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="border-[#ece8e3] focus-visible:ring-[#DC2626]/30 focus-visible:border-[#DC2626]"
                />
                <p className="text-[11px] text-[#999] mt-1">
                  Format : +33XXXXXXXXX
                </p>
              </div>
            )}

            {/* Save button */}
            <Button
              onClick={handleSavePrefs}
              disabled={saving}
              className="w-full bg-[#DC2626] hover:bg-[#DC2626] disabled:opacity-50"
            >
              {saving ? "Enregistrement..." : "Enregistrer les préférences"}
            </Button>
          </div>
        </section>

        {/* ═══════════════════════════════════════ */}
        {/* 4. BOUCHERIES FAVORITES                */}
        {/* ═══════════════════════════════════════ */}
        <section className="bg-white rounded-2xl border border-[#ece8e3] shadow-[0_1px_4px_rgba(0,0,0,0.03)] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Heart size={16} className="text-[#DC2626]" />
            <h2 className="text-sm font-bold text-[#2a2018]">
              Boucheries favorites
            </h2>
            {profile.favoriteShops.length > 0 && (
              <span className="ml-auto text-[11px] font-bold text-[#DC2626] bg-[#DC2626]/10 px-2 py-0.5 rounded-full">
                {profile.favoriteShops.length}
              </span>
            )}
          </div>

          {profile.favoriteShops.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-[#999]">
                Aucune boucherie en favori
              </p>
              <Link
                href="/decouvrir"
                className="text-sm font-semibold text-[#DC2626] hover:underline mt-2 inline-block"
              >
                Découvrir les boucheries
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {profile.favoriteShops.map((shop) => (
                <div
                  key={shop.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-[#ece8e3] hover:bg-[#f5f0eb] transition-colors"
                >
                  {/* Shop image */}
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-stone-200 shrink-0">
                    {shop.imageUrl ? (
                      <Image
                        src={shop.imageUrl}
                        alt={shop.name}
                        width={40}
                        height={40}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-lg">
                        🥩
                      </div>
                    )}
                  </div>

                  {/* Shop info */}
                  <Link
                    href={`/boutique/${shop.slug}`}
                    className="flex-1 min-w-0"
                  >
                    <p className="text-sm font-semibold text-[#2a2018] truncate">
                      {shop.name}
                    </p>
                    <p className="text-xs text-[#999]">{shop.city}</p>
                  </Link>

                  {/* Remove button */}
                  <button
                    onClick={() => handleRemoveFavorite(shop.id)}
                    className="p-2 rounded-lg text-[#999] hover:text-[#DC2626] hover:bg-red-50 transition-colors shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

// ── Header ───────────────────────────────────────

function Header() {
  return (
    <header className="sticky top-0 z-10 bg-[#f8f6f3]/95 backdrop-blur-xl border-b border-[#ece8e3] px-5 py-4">
      <div className="max-w-xl mx-auto flex items-center gap-3">
        <Link
          href="/decouvrir"
          className="flex items-center justify-center w-10 h-10 rounded-[14px] bg-white border border-[#ece8e3] shadow-sm"
        >
          <ArrowLeft size={17} className="text-[#333]" />
        </Link>
        <h1 className="text-lg font-bold text-[#2a2018]">Mon profil</h1>
      </div>
    </header>
  );
}
