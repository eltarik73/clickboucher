"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Loader2,
  AlertCircle,
  Check,
  Store,
  Zap,
  Pause,
  Clock,
  Bot,
  Building2,
  Gift,
  MapPin,
} from "lucide-react";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type Shop = {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  status: string;
  busyMode: boolean;
  busyExtraMin: number;
  prepTimeMin: number;
  autoAccept: boolean;
  maxOrdersPerHour: number;
  openingHours: Record<string, { open: string; close: string }> | null;
  latitude: number | null;
  longitude: number | null;
  deliveryRadius: number;
};

const DAYS = [
  { key: "lundi", label: "Lundi" },
  { key: "mardi", label: "Mardi" },
  { key: "mercredi", label: "Mercredi" },
  { key: "jeudi", label: "Jeudi" },
  { key: "vendredi", label: "Vendredi" },
  { key: "samedi", label: "Samedi" },
  { key: "dimanche", label: "Dimanche" },
];

// ─────────────────────────────────────────────
// Saved toast
// ─────────────────────────────────────────────
function useSavedToast() {
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  function show() {
    setVisible(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setVisible(false), 2000);
  }

  return { visible, show };
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
export default function BoucherParametresPage() {
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const toast = useSavedToast();

  // Info form state
  const [infoName, setInfoName] = useState("");
  const [infoAddress, setInfoAddress] = useState("");
  const [infoCity, setInfoCity] = useState("");
  const [infoPhone, setInfoPhone] = useState("");
  const [hours, setHours] = useState<Record<string, { open: string; close: string }>>({});
  const [infoSaving, setInfoSaving] = useState(false);

  // Geo state
  const [geoLat, setGeoLat] = useState<number | null>(null);
  const [geoLng, setGeoLng] = useState<number | null>(null);
  const [geoRadius, setGeoRadius] = useState(15);
  const [geoLoading, setGeoLoading] = useState(false);

  // Loyalty state
  const [loyaltyActive, setLoyaltyActive] = useState(false);
  const [loyaltyOrders, setLoyaltyOrders] = useState(10);
  const [loyaltyPct, setLoyaltyPct] = useState(10);
  const [loyaltyLoading, setLoyaltyLoading] = useState(true);
  const [loyaltySaving, setLoyaltySaving] = useState(false);

  const fetchLoyaltyConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/loyalty/config");
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setLoyaltyActive(json.data.active);
          setLoyaltyOrders(json.data.ordersRequired);
          setLoyaltyPct(json.data.rewardPct);
        }
      }
    } catch {} finally {
      setLoyaltyLoading(false);
    }
  }, []);

  const saveLoyalty = async () => {
    setLoyaltySaving(true);
    try {
      const res = await fetch("/api/loyalty/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          active: loyaltyActive,
          ordersRequired: loyaltyOrders,
          rewardPct: loyaltyPct,
        }),
      });
      if (res.ok) toast.show();
    } catch {} finally {
      setLoyaltySaving(false);
    }
  };

  const fetchShop = useCallback(async () => {
    try {
      const res = await fetch("/api/shops/my-shop");
      if (!res.ok) {
        setError("Impossible de charger votre boucherie");
        return;
      }
      const json = await res.json();
      const data: Shop = json.data;
      setShop(data);
      setInfoName(data.name);
      setInfoAddress(data.address);
      setInfoCity(data.city);
      setInfoPhone(data.phone || "");
      setHours(
        data.openingHours ||
          DAYS.reduce(
            (acc, d) => ({ ...acc, [d.key]: { open: "08:00", close: "19:00" } }),
            {} as Record<string, { open: string; close: string }>
          )
      );
      setGeoLat(data.latitude);
      setGeoLng(data.longitude);
      setGeoRadius(data.deliveryRadius || 15);
    } catch {
      setError("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShop();
    fetchLoyaltyConfig();
  }, [fetchShop, fetchLoyaltyConfig]);

  // ── PATCH status (instant toggle) ──
  async function patchStatus(data: Record<string, unknown>) {
    if (!shop) return;
    try {
      const res = await fetch(`/api/shops/${shop.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const json = await res.json();
        setShop((prev) => (prev ? { ...prev, ...data, ...json.data } : prev));
        toast.show();
      }
    } catch {
      // silent
    }
  }

  // ── PATCH info ──
  async function saveInfo() {
    if (!shop) return;
    setInfoSaving(true);
    try {
      const res = await fetch(`/api/shops/${shop.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: infoName,
          address: infoAddress,
          city: infoCity,
          phone: infoPhone || undefined,
          openingHours: hours,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setShop((prev) => (prev ? { ...prev, ...json.data } : prev));
        toast.show();
      }
    } catch {
      // silent
    } finally {
      setInfoSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#DC2626]" />
      </div>
    );
  }

  if (error || !shop) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 px-5">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <p className="text-sm text-gray-500 dark:text-gray-400">{error || "Boucherie introuvable"}</p>
      </div>
    );
  }

  const effectiveTime = shop.prepTimeMin + (shop.busyMode ? shop.busyExtraMin : 0);

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Paramètres</h1>

        {/* ── 1. STATUS BOUTIQUE ── */}
        <SettingCard
          icon={<Store size={18} className="text-emerald-600" />}
          title="Status de la boutique"
          accent={(shop.status === "OPEN" || shop.status === "BUSY") ? "border-l-emerald-500" : "border-l-red-400"}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">
                {(shop.status === "OPEN" || shop.status === "BUSY") ? "Ouvert" : "Fermé"}
              </p>
              {(shop.status === "CLOSED" || shop.status === "VACATION") && (
                <p className="text-xs text-red-500 mt-0.5">
                  Les clients ne peuvent pas commander
                </p>
              )}
            </div>
            <Switch
              checked={shop.status === "OPEN" || shop.status === "BUSY"}
              onCheckedChange={(v) => patchStatus({ status: v ? "OPEN" : "CLOSED" })}
              className={(shop.status === "OPEN" || shop.status === "BUSY") ? "!bg-emerald-500" : "!bg-red-400"}
            />
          </div>
        </SettingCard>

        {/* ── 2. MODE OCCUPÉ ── */}
        <SettingCard
          icon={<Zap size={18} className="text-amber-600" />}
          title="Mode occupé"
          accent={shop.busyMode ? "border-l-amber-400" : "border-l-transparent"}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-gray-900 dark:text-white">Mode occupé</p>
              <Switch
                checked={shop.busyMode}
                onCheckedChange={(v) => patchStatus({ busyMode: v })}
                className={shop.busyMode ? "!bg-amber-500" : ""}
              />
            </div>
            {shop.busyMode && (
              <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 space-y-2">
                <label className="text-sm text-amber-800 dark:text-amber-300 font-medium">
                  Minutes supplémentaires
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={shop.busyExtraMin}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setShop((prev) => (prev ? { ...prev, busyExtraMin: val } : prev));
                    }}
                    onBlur={() => patchStatus({ busyExtraMin: shop.busyExtraMin })}
                    className="w-20 h-9"
                    min={0}
                    max={60}
                  />
                  <span className="text-sm text-gray-500 dark:text-gray-400">min</span>
                </div>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Ajoute {shop.busyExtraMin} min au temps de préparation affiché aux clients
                </p>
              </div>
            )}
          </div>
        </SettingCard>

        {/* ── 3. PAUSE COMMANDES ── */}
        <SettingCard
          icon={<Pause size={18} className="text-red-500" />}
          title="Pause commandes"
          accent={(shop.status === "PAUSED" || shop.status === "AUTO_PAUSED") ? "border-l-red-500" : "border-l-transparent"}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-gray-900 dark:text-white">Pause nouvelles commandes</p>
              <Switch
                checked={shop.status === "PAUSED" || shop.status === "AUTO_PAUSED"}
                onCheckedChange={(v) => patchStatus({ status: v ? "PAUSED" : "OPEN" })}
                className={(shop.status === "PAUSED" || shop.status === "AUTO_PAUSED") ? "!bg-red-500" : ""}
              />
            </div>
            {(shop.status === "PAUSED" || shop.status === "AUTO_PAUSED") && (
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                <p className="text-sm text-red-700 dark:text-red-300 font-medium">
                  Aucune nouvelle commande ne sera acceptée
                </p>
              </div>
            )}
          </div>
        </SettingCard>

        {/* ── 4. TEMPS DE PRÉPARATION ── */}
        <SettingCard
          icon={<Clock size={18} className="text-blue-600" />}
          title="Temps de préparation"
        >
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                Temps par défaut (minutes)
              </label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  value={shop.prepTimeMin}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setShop((prev) => (prev ? { ...prev, prepTimeMin: val } : prev));
                  }}
                  onBlur={() => patchStatus({ prepTimeMin: shop.prepTimeMin })}
                  className="w-24 h-9"
                  min={5}
                  max={120}
                />
                <span className="text-sm text-gray-500 dark:text-gray-400">min</span>
              </div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg px-3 py-2">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                Temps affiché : <span className="font-bold">{effectiveTime} min</span>
                {shop.busyMode && (
                  <span className="text-blue-600 dark:text-blue-400"> ({shop.prepTimeMin} + {shop.busyExtraMin} mode occupé)</span>
                )}
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                Ce temps est affiché aux clients avant de commander
              </p>
            </div>
          </div>
        </SettingCard>

        {/* ── 5. COMMANDE AUTOMATIQUE ── */}
        <SettingCard
          icon={<Bot size={18} className="text-purple-600" />}
          title="Commande automatique"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">Accepter automatiquement</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Les commandes sont acceptées sans validation manuelle
                </p>
              </div>
              <Switch
                checked={shop.autoAccept}
                onCheckedChange={(v) => patchStatus({ autoAccept: v })}
                className={shop.autoAccept ? "!bg-purple-500" : ""}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                Max commandes par heure
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={shop.maxOrdersPerHour}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setShop((prev) => (prev ? { ...prev, maxOrdersPerHour: val } : prev));
                  }}
                  onBlur={() => patchStatus({ maxOrdersPerHour: shop.maxOrdersPerHour })}
                  className="w-24 h-9"
                  min={1}
                  max={100}
                />
                <span className="text-sm text-gray-500 dark:text-gray-400">/ heure</span>
              </div>
            </div>
          </div>
        </SettingCard>

        {/* ── 6. PROGRAMME FIDÉLITÉ ── */}
        <SettingCard
          icon={<Gift size={18} className="text-amber-600" />}
          title="Programme fidélité"
          accent={loyaltyActive ? "border-l-amber-500" : "border-l-transparent"}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">Activer la fidélité</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Récompensez vos clients réguliers
                </p>
              </div>
              <Switch
                checked={loyaltyActive}
                onCheckedChange={(v) => setLoyaltyActive(v)}
                className={loyaltyActive ? "!bg-amber-500" : ""}
              />
            </div>
            {loyaltyActive && (
              <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 space-y-3">
                <div>
                  <label className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-1.5 block">
                    Nombre de commandes requises
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={loyaltyOrders}
                      onChange={(e) => setLoyaltyOrders(Number(e.target.value))}
                      className="w-24 h-9"
                      min={2}
                      max={50}
                    />
                    <span className="text-sm text-gray-500 dark:text-gray-400">commandes</span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-1.5 block">
                    Réduction offerte
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={loyaltyPct}
                      onChange={(e) => setLoyaltyPct(Number(e.target.value))}
                      className="w-24 h-9"
                      min={1}
                      max={50}
                    />
                    <span className="text-sm text-gray-500 dark:text-gray-400">%</span>
                  </div>
                </div>
                <div className="bg-white dark:bg-[#141414] rounded-lg px-3 py-2 border border-amber-200 dark:border-amber-800/30">
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Vos clients verront : &laquo; Encore X commandes pour -{loyaltyPct}% ! &raquo;
                  </p>
                </div>
                <Button
                  onClick={saveLoyalty}
                  disabled={loyaltySaving}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white h-10"
                >
                  {loyaltySaving ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    "Enregistrer la fidélité"
                  )}
                </Button>
              </div>
            )}
            {!loyaltyActive && !loyaltyLoading && (
              <Button
                onClick={saveLoyalty}
                disabled={loyaltySaving}
                variant="outline"
                className="w-full h-10 text-sm"
              >
                {loyaltySaving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  "Désactiver et sauvegarder"
                )}
              </Button>
            )}
          </div>
        </SettingCard>

        {/* ── 7. INFORMATIONS BOUTIQUE ── */}
        <SettingCard
          icon={<Building2 size={18} className="text-gray-600 dark:text-gray-400" />}
          title="Informations boutique"
        >
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Nom</label>
              <Input value={infoName} onChange={(e) => setInfoName(e.target.value)} />
            </div>

            {/* Address & City */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Adresse</label>
                <Input value={infoAddress} onChange={(e) => setInfoAddress(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Ville</label>
                <Input value={infoCity} onChange={(e) => setInfoCity(e.target.value)} />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Téléphone</label>
              <Input
                value={infoPhone}
                onChange={(e) => setInfoPhone(e.target.value)}
                placeholder="+33612345678"
              />
            </div>

            {/* Opening hours */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Horaires d&apos;ouverture
              </label>
              <div className="space-y-2">
                {DAYS.map((day) => {
                  const h = hours[day.key] || { open: "08:00", close: "19:00" };
                  return (
                    <div key={day.key} className="flex items-center gap-2">
                      <span className="w-24 text-sm text-gray-600 dark:text-gray-400 shrink-0">{day.label}</span>
                      <Input
                        type="time"
                        value={h.open}
                        onChange={(e) =>
                          setHours((prev) => ({
                            ...prev,
                            [day.key]: { ...prev[day.key], open: e.target.value },
                          }))
                        }
                        className="h-9 w-28"
                      />
                      <span className="text-xs text-gray-400 dark:text-gray-500">à</span>
                      <Input
                        type="time"
                        value={h.close}
                        onChange={(e) =>
                          setHours((prev) => ({
                            ...prev,
                            [day.key]: { ...prev[day.key], close: e.target.value },
                          }))
                        }
                        className="h-9 w-28"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Save */}
            <Button
              onClick={saveInfo}
              disabled={infoSaving}
              className="w-full bg-[#DC2626] hover:bg-[#DC2626] h-11"
            >
              {infoSaving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                "Enregistrer les informations"
              )}
            </Button>
          </div>
        </SettingCard>

        {/* ── 8. GÉOLOCALISATION ── */}
        <SettingCard
          icon={<MapPin size={18} className="text-red-600" />}
          title="Géolocalisation"
          accent={geoLat ? "border-l-red-500" : "border-l-transparent"}
        >
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Géocodez votre adresse pour apparaître dans les recherches par proximité.
              </p>
              {geoLat && geoLng ? (
                <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/30 rounded-lg px-3 py-2 mb-3">
                  <p className="text-sm text-green-700 dark:text-green-400 font-medium">
                    Position enregistrée : {geoLat.toFixed(4)}, {geoLng.toFixed(4)}
                  </p>
                </div>
              ) : (
                <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800/30 rounded-lg px-3 py-2 mb-3">
                  <p className="text-sm text-yellow-700 dark:text-yellow-400">
                    Aucune position enregistrée. Les clients ne pourront pas vous trouver par proximité.
                  </p>
                </div>
              )}
              <Button
                onClick={async () => {
                  if (!infoAddress && !infoCity) return;
                  setGeoLoading(true);
                  try {
                    const query = `${infoAddress}, ${infoCity}`;
                    const res = await fetch(
                      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=fr`,
                      { headers: { "User-Agent": "KlikGo/1.0" } }
                    );
                    const results = await res.json();
                    if (results.length > 0) {
                      const lat = parseFloat(results[0].lat);
                      const lng = parseFloat(results[0].lon);
                      setGeoLat(lat);
                      setGeoLng(lng);
                      // Save to DB
                      await fetch(`/api/shops/${shop.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ latitude: lat, longitude: lng }),
                      });
                      toast.show();
                    }
                  } catch {} finally {
                    setGeoLoading(false);
                  }
                }}
                disabled={geoLoading || (!infoAddress && !infoCity)}
                variant="outline"
                className="w-full h-10 text-sm"
              >
                {geoLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>
                    <MapPin size={14} className="mr-1.5" />
                    Géocoder mon adresse
                  </>
                )}
              </Button>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                Rayon de chalandise : <span className="font-bold text-red-600">{geoRadius} km</span>
              </label>
              <input
                type="range"
                min={5}
                max={30}
                step={1}
                value={geoRadius}
                onChange={(e) => setGeoRadius(Number(e.target.value))}
                onMouseUp={async () => {
                  await fetch(`/api/shops/${shop.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ deliveryRadius: geoRadius }),
                  });
                  toast.show();
                }}
                onTouchEnd={async () => {
                  await fetch(`/api/shops/${shop.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ deliveryRadius: geoRadius }),
                  });
                  toast.show();
                }}
                className="w-full h-2 bg-gray-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-red-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>5 km</span>
                <span>30 km</span>
              </div>
            </div>
          </div>
        </SettingCard>
      </div>

      {/* ── Saved toast ── */}
      {toast.visible && (
        <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 dark:bg-[#f8f6f3] text-white dark:text-gray-900 text-sm font-medium rounded-full shadow-lg">
            <Check size={14} className="text-emerald-400 dark:text-emerald-600" />
            Sauvegardé ✓
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Setting Card wrapper
// ─────────────────────────────────────────────
function SettingCard({
  icon,
  title,
  accent,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={`bg-white dark:bg-[#141414] border-0 shadow-sm overflow-hidden ${accent ? `border-l-4 ${accent}` : ""}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</h2>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}
