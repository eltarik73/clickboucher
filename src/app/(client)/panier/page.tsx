"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useUser } from "@clerk/nextjs";
import { Trash2, Minus, Plus, ArrowLeft, ShoppingBag, Clock, CreditCard, Banknote, ChevronLeft, ChevronRight, X, Tag, Loader2, Gift, Trophy } from "lucide-react";
import { toast } from "sonner";
import { useCart, type CartItem } from "@/lib/hooks/use-cart";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { OrderCountdown } from "@/components/checkout/OrderCountdown";
import CartSuggestions from "@/components/cart/CartSuggestions";

// ── Helpers ──────────────────────────────────────

function fmtPrice(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

function itemTotal(item: CartItem) {
  if ((item.unit === "KG" || item.unit === "TRANCHE") && item.weightGrams) {
    return Math.round((item.weightGrams / 1000) * item.priceCents) * item.quantity;
  }
  return item.priceCents * item.quantity;
}

const THICKNESS_LABELS: Record<string, string> = {
  chiffonnade: "chiffonnade",
  fine: "fine",
  normale: "normale",
  epaisse: "epaisse",
};

function qtyLabel(item: CartItem) {
  if (item.unit === "TRANCHE" && item.sliceCount && item.thickness) {
    const g = item.weightGrams ?? 0;
    const weight = g >= 1000 ? `${(g / 1000).toFixed(1)} kg` : `${g} g`;
    return `${item.sliceCount} tranches (${THICKNESS_LABELS[item.thickness] || item.thickness}) — ~${weight}`;
  }
  if (item.unit === "KG" && item.weightGrams) {
    const g = item.weightGrams;
    const weight = g >= 1000 ? `${(g / 1000).toFixed(1)} kg` : `${g} g`;
    return item.quantity > 1 ? `${item.quantity} × ${weight}` : weight;
  }
  const u = item.unit === "PIECE" ? "piece" : "barquette";
  return `${item.quantity} ${u}${item.quantity > 1 ? "s" : ""}`;
}

// ── Cart Item Row ────────────────────────────────

function CartItemRow({
  item,
  onUpdateQty,
  onRemove,
}: {
  item: CartItem;
  onUpdateQty: (qty: number) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-3 bg-white dark:bg-[#141414] rounded-2xl p-3 border border-[#ece8e3] dark:border-white/10 shadow-[0_1px_4px_rgba(0,0,0,0.03)]">
      {/* Image */}
      <div className="relative w-[60px] h-[60px] rounded-xl overflow-hidden shrink-0">
        <Image
          src={item.imageUrl || "/img/products/boeuf-1.jpg"}
          alt={item.name}
          width={60}
          height={60}
          className="object-cover w-full h-full"
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
          {item.name}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{qtyLabel(item)}</p>
        <p className="text-sm font-bold text-gray-900 dark:text-white mt-1">
          {fmtPrice(itemTotal(item))}
        </p>
      </div>

      {/* Qty controls */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => onUpdateQty(item.quantity - 1)}
          aria-label="Diminuer la quantité"
          className="w-11 h-11 rounded-full border border-gray-100 dark:border-white/10 bg-white dark:bg-[#1a1a1a] flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
        >
          <Minus size={16} />
        </button>
        <span className="text-sm font-bold text-gray-900 dark:text-white min-w-[20px] text-center">
          {item.quantity}
        </span>
        <button
          onClick={() => onUpdateQty(item.quantity + 1)}
          aria-label="Augmenter la quantité"
          className="w-11 h-11 rounded-full bg-[#DC2626] flex items-center justify-center text-white hover:bg-[#b91c1c] transition-colors"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Delete */}
      <button
        onClick={onRemove}
        aria-label="Supprimer du panier"
        className="p-3 rounded-xl text-gray-500 dark:text-gray-400 hover:text-[#DC2626] hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors shrink-0"
      >
        <Trash2 size={18} />
      </button>
    </div>
  );
}

// ── Slot type ────────────────────────────────────

type PickupSlot = {
  start: string;
  end: string;
  available: boolean;
  remaining: number;
};

// ── Main Page ────────────────────────────────────

export default function PanierPage() {
  const router = useRouter();
  const { user, isSignedIn, isLoaded } = useUser();
  const { state, updateQty, removeItem, clear, itemCount, totalCents } = useCart();

  const [timeMode, setTimeMode] = useState<"asap" | "slot">("asap");
  const [customerNote, setCustomerNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"ON_PICKUP" | "ONLINE">("ON_PICKUP");

  // Pickup slots
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState<PickupSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<PickupSlot | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);

  // Countdown overlay
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdownOrderData, setCountdownOrderData] = useState<Record<string, unknown> | null>(null);

  // Clear cart dialog
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Promo code
  const [promoCode, setPromoCode] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<{
    discountCents: number;
    offerId?: string;
    loyaltyRewardId?: string;
    source: string;
    label: string;
    type: string;
  } | null>(null);

  // Available loyalty rewards
  const [availableRewards, setAvailableRewards] = useState<{ code: string; rewardCents: number | null; rewardPercent: number | null; rewardType: string }[]>([]);

  // Shop payment config
  const [shopAcceptOnline, setShopAcceptOnline] = useState(false);
  const [shopAcceptOnPickup, setShopAcceptOnPickup] = useState(true);

  const role = user?.publicMetadata?.role as string | undefined;
  const isPro = role === "client_pro";

  // Fetch shop payment config + validate cart products
  useEffect(() => {
    if (!state.shopId) return;
    fetch(`/api/shops/${state.shopId}`)
      .then((r) => r.json())
      .then((json) => {
        const shop = json.data || json;
        setShopAcceptOnline(shop.acceptOnline ?? false);
        setShopAcceptOnPickup(shop.acceptOnPickup ?? true);
        if (!shop.acceptOnPickup && shop.acceptOnline) {
          setPaymentMethod("ONLINE");
        }
      })
      .catch(() => {});
  }, [state.shopId]);

  // Fetch available loyalty rewards
  useEffect(() => {
    if (!isSignedIn) return;
    fetch("/api/loyalty/available")
      .then((r) => r.json())
      .then((json) => { if (json.data?.rewards) setAvailableRewards(json.data.rewards); })
      .catch(() => {});
  }, [isSignedIn]);

  // Validate cart products still exist in the shop
  useEffect(() => {
    if (!state.shopId || state.items.length === 0) return;
    const productIds = state.items
      .map((i) => i.productId || i.id)
      .filter(Boolean);
    if (productIds.length === 0) return;

    fetch(`/api/shops/${state.shopId}/products/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productIds }),
    })
      .then((r) => r.json())
      .then((json) => {
        const missingIds: string[] = json.data?.missingIds || [];
        if (missingIds.length > 0) {
          // Remove stale items from cart
          for (const item of state.items) {
            const pid = item.productId || item.id;
            if (missingIds.includes(pid)) {
              removeItem(item.id);
            }
          }
          toast.error(
            `${missingIds.length} produit(s) supprime(s) du panier (plus disponibles)`
          );
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.shopId]);

  // Fetch available slots when date or shop changes
  const fetchSlots = useCallback(async () => {
    if (!state.shopId) return;
    setSlotsLoading(true);
    try {
      const res = await fetch(`/api/shops/${state.shopId}/available-slots?date=${selectedDate}`);
      const json = await res.json();
      setSlots(json.data?.slots || []);
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, [state.shopId, selectedDate]);

  useEffect(() => {
    if (timeMode === "slot") fetchSlots();
  }, [timeMode, fetchSlots]);

  const applyPromoCode = async () => {
    const code = promoCode.trim();
    if (!code) return;
    setPromoLoading(true);
    setPromoError("");
    try {
      const res = await fetch("/api/offers/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, orderTotalCents: totalCents, shopId: state.shopId }),
      });
      const json = await res.json();
      if (json.data?.valid) {
        setAppliedPromo({
          discountCents: json.data.discountCents || 0,
          offerId: json.data.offerId,
          loyaltyRewardId: json.data.loyaltyRewardId,
          source: json.data.source,
          label: json.data.label,
          type: json.data.type,
        });
        toast.success(`Code "${code}" appliqué !`);
      } else {
        setPromoError(json.data?.error || "Code invalide");
      }
    } catch {
      setPromoError("Erreur réseau");
    } finally {
      setPromoLoading(false);
    }
  };

  const removePromo = () => {
    setAppliedPromo(null);
    setPromoCode("");
    setPromoError("");
  };

  const finalTotal = appliedPromo ? Math.max(0, totalCents - appliedPromo.discountCents) : totalCents;

  function navigateDate(dir: number) {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + dir);
    const today = new Date().toISOString().slice(0, 10);
    if (d.toISOString().slice(0, 10) < today) return;
    setSelectedDate(d.toISOString().slice(0, 10));
    setSelectedSlot(null);
  }

  const handleOrder = () => {
    if (!state.shopId || state.items.length === 0) return;

    const requestedTime =
      timeMode === "slot" && selectedSlot
        ? `${selectedDate}T${selectedSlot.start}:00`
        : "asap";

    const orderBody: Record<string, unknown> = {
      shopId: state.shopId,
      items: state.items.map((i) => ({
        productId: i.productId || i.id,
        quantity: (i.unit === "KG" || i.unit === "TRANCHE") && i.weightGrams
          ? (i.weightGrams / 1000) * i.quantity
          : i.quantity,
        ...(i.weightGrams && { weightGrams: i.weightGrams }),
        ...(i.sliceCount && { sliceCount: i.sliceCount }),
        ...(i.thickness && { sliceThickness: i.thickness }),
      })),
      requestedTime,
      customerNote: customerNote.trim() || undefined,
      paymentMethod,
      ...(appliedPromo?.offerId && {
        offerId: appliedPromo.offerId,
        discountCents: appliedPromo.discountCents,
        discountSource: appliedPromo.source,
      }),
      ...(appliedPromo?.loyaltyRewardId && !appliedPromo?.offerId && {
        loyaltyRewardId: appliedPromo.loyaltyRewardId,
        discountCents: appliedPromo.discountCents,
        discountSource: "LOYALTY",
      }),
    };

    if (timeMode === "slot" && selectedSlot) {
      orderBody.pickupSlotStart = new Date(`${selectedDate}T${selectedSlot.start}:00`).toISOString();
      orderBody.pickupSlotEnd = new Date(`${selectedDate}T${selectedSlot.end}:00`).toISOString();
    }

    setCountdownOrderData(orderBody);
    setShowCountdown(true);
  };

  const backHref = state.shopSlug ? `/boutique/${state.shopSlug}` : "/";

  // ── Empty cart ──────────────────────────────────
  if (state.items.length === 0) {
    return (
      <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a] flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-[#f8f6f3]/95 dark:bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-[#ece8e3] dark:border-white/10 px-5 py-4">
          <div className="max-w-xl mx-auto flex items-center gap-3">
            <Link
              href={backHref}
              className="flex items-center justify-center w-10 h-10 rounded-[14px] bg-white dark:bg-[#141414] border border-[#ece8e3] dark:border-white/10 shadow-sm"
            >
              <ArrowLeft size={17} className="text-gray-900 dark:text-white" />
            </Link>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Mon panier</h1>
          </div>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center px-5">
          <div className="text-6xl mb-4">🛒</div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Votre panier est vide
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 text-center">
            Ajoutez des produits depuis une boucherie pour commencer.
          </p>
          <Button
            className="mt-6 bg-[#DC2626] hover:bg-[#b91c1c]"
            size="lg"
            asChild
          >
            <Link href="/">Decouvrir les boucheries</Link>
          </Button>
        </div>
      </div>
    );
  }

  // ── Cart with items ─────────────────────────────
  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a] pb-8">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#f8f6f3]/95 dark:bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-[#ece8e3] dark:border-white/10 px-5 py-4">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={backHref}
              className="flex items-center justify-center w-10 h-10 rounded-[14px] bg-white dark:bg-[#141414] border border-[#ece8e3] dark:border-white/10 shadow-sm"
            >
              <ArrowLeft size={17} className="text-gray-900 dark:text-white" />
            </Link>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Mon panier</h1>
          </div>
          <span className="text-xs font-bold text-[#DC2626] bg-[#DC2626]/10 px-3 py-1.5 rounded-full">
            {itemCount} article{itemCount > 1 ? "s" : ""}
          </span>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-5 mt-6">
        {/* Shop name + clear */}
        <div className="flex items-center gap-2 mb-4">
          <ShoppingBag size={16} className="text-[#DC2626]" />
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            {state.shopName}
          </span>
          {isPro && (
            <span className="ml-auto text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-2 py-1 rounded-full">
              Prix Pro appliques
            </span>
          )}
          <button
            onClick={() => setShowClearConfirm(true)}
            className="ml-auto text-xs text-gray-400 hover:text-[#DC2626] transition-colors flex items-center gap-1"
          >
            <X size={12} />
            Vider
          </button>
        </div>

        {/* ═══════════════════════════════════════════ */}
        {/* CART ITEMS */}
        {/* ═══════════════════════════════════════════ */}
        <div className="flex flex-col gap-2.5">
          {state.items.map((item) => (
            <CartItemRow
              key={item.id}
              item={item}
              onUpdateQty={(qty) => updateQty(item.id, qty)}
              onRemove={() => removeItem(item.id)}
            />
          ))}
        </div>

        {/* Suggestions */}
        <CartSuggestions />

        {/* Promo code */}
        {isSignedIn && (
          <div className="mt-5 p-4 bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10 shadow-[0_1px_4px_rgba(0,0,0,0.03)]">
            <div className="flex items-center gap-2 mb-3">
              <Tag size={16} className="text-[#DC2626]" />
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                Code promo ou fidelite
              </span>
            </div>

            {appliedPromo ? (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                <Gift size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                    {appliedPromo.label}
                  </p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    -{fmtPrice(appliedPromo.discountCents)}
                  </p>
                </div>
                <button
                  onClick={removePromo}
                  className="p-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div>
                {/* Loyalty reward suggestion */}
                {availableRewards.length > 0 && !appliedPromo && (
                  <button
                    onClick={() => { setPromoCode(availableRewards[0].code); }}
                    className="w-full mb-3 flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-left hover:bg-amber-100 dark:hover:bg-amber-950/30 transition-colors"
                  >
                    <Trophy size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
                    <span className="text-xs text-amber-800 dark:text-amber-300">
                      Vous avez un bon de{" "}
                      <span className="font-bold">
                        {availableRewards[0].rewardType === "FIXED" && availableRewards[0].rewardCents
                          ? fmtPrice(availableRewards[0].rewardCents)
                          : `${availableRewards[0].rewardPercent}%`}
                      </span>
                      {" "}&mdash; Appliquer ?
                    </span>
                  </button>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setPromoError(""); }}
                    placeholder="Entrez un code..."
                    maxLength={30}
                    className="flex-1 rounded-xl border border-[#ece8e3] dark:border-white/10 bg-white dark:bg-[#1a1a1a] px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30 focus:border-[#DC2626] transition-colors uppercase"
                  />
                  <button
                    onClick={applyPromoCode}
                    disabled={promoLoading || !promoCode.trim()}
                    className="px-4 py-2.5 rounded-xl bg-[#DC2626] text-white text-sm font-semibold hover:bg-[#b91c1c] disabled:opacity-50 transition-colors shrink-0 flex items-center gap-2"
                  >
                    {promoLoading ? <Loader2 size={14} className="animate-spin" /> : "Appliquer"}
                  </button>
                </div>
                {promoError && (
                  <p className="text-xs text-red-500 mt-2">{promoError}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Total */}
        <div className="mt-5 p-4 bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10 shadow-[0_1px_4px_rgba(0,0,0,0.03)]">
          {appliedPromo ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">Sous-total</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">{fmtPrice(totalCents)}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-sm text-emerald-600 dark:text-emerald-400">Reduction</span>
                <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  -{fmtPrice(appliedPromo.discountCents)}
                </span>
              </div>
              <div className="border-t border-[#ece8e3] dark:border-white/10 mt-2 pt-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">Total</span>
                <span className="text-2xl font-extrabold text-gray-900 dark:text-white">
                  {fmtPrice(finalTotal)}
                </span>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Total estime</span>
              <span className="text-2xl font-extrabold text-gray-900 dark:text-white">
                {fmtPrice(totalCents)}
              </span>
            </div>
          )}
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5">
            Le poids exact sera ajuste au retrait. Paiement sur place.
          </p>
        </div>

        {/* ═══════════════════════════════════════════ */}
        {/* CHECKOUT */}
        {/* ═══════════════════════════════════════════ */}
        <div className="mt-6">
          <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4">
            Finaliser la commande
          </h2>

          {!isLoaded ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
              Chargement...
            </div>
          ) : !isSignedIn ? (
            /* Not signed in */
            <div className="p-5 bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Connectez-vous pour passer votre commande
              </p>
              <Button
                className="bg-[#DC2626] hover:bg-[#b91c1c] w-full"
                size="lg"
                asChild
              >
                <Link href="/sign-in?redirect_url=/panier">
                  Se connecter pour commander
                </Link>
              </Button>
            </div>
          ) : (
            /* Signed in — checkout form */
            <div className="space-y-4">
              {/* Time slot */}
              <div className="p-4 bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10">
                <div className="flex items-center gap-2 mb-3">
                  <Clock size={16} className="text-[#DC2626]" />
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    Creneau de retrait
                  </span>
                </div>

                <label className="flex items-center gap-3 p-3 rounded-xl border border-[#ece8e3] dark:border-white/10 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors mb-2">
                  <input
                    type="radio"
                    name="timeSlot"
                    checked={timeMode === "asap"}
                    onChange={() => setTimeMode("asap")}
                    className="w-4 h-4 accent-[#DC2626]"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      Des que possible
                    </span>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      Preparation immediate par le boucher
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-xl border border-[#ece8e3] dark:border-white/10 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                  <input
                    type="radio"
                    name="timeSlot"
                    checked={timeMode === "slot"}
                    onChange={() => setTimeMode("slot")}
                    className="w-4 h-4 accent-[#DC2626]"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      Choisir un creneau
                    </span>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      Selectionnez un creneau de 30 min
                    </p>
                  </div>
                </label>

                {timeMode === "slot" && (
                  <div className="mt-3 space-y-3">
                    {/* Date navigator */}
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => navigateDate(-1)}
                        className="w-11 h-11 rounded-full border border-gray-200 dark:border-white/10 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-white/5"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {new Date(selectedDate + "T12:00:00").toLocaleDateString("fr-FR", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                        })}
                      </span>
                      <button
                        onClick={() => navigateDate(1)}
                        className="w-11 h-11 rounded-full border border-gray-200 dark:border-white/10 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-white/5"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>

                    {/* Slots grid */}
                    {slotsLoading ? (
                      <p className="text-xs text-gray-400 text-center py-4">Chargement...</p>
                    ) : slots.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-4">Aucun creneau disponible ce jour</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {slots.map((slot) => {
                          const isSelected = selectedSlot?.start === slot.start;
                          return (
                            <button
                              key={slot.start}
                              onClick={() => slot.available && setSelectedSlot(slot)}
                              disabled={!slot.available}
                              className={`py-2.5 px-2 rounded-xl text-sm font-medium transition-colors border ${
                                isSelected
                                  ? "bg-[#DC2626] text-white border-[#DC2626]"
                                  : slot.available
                                  ? "bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white border-gray-200 dark:border-white/10 hover:border-[#DC2626]/50"
                                  : "bg-gray-100 dark:bg-white/5 text-gray-300 dark:text-gray-600 border-transparent cursor-not-allowed"
                              }`}
                            >
                              {slot.start}
                              {slot.available && (
                                <span className={`block text-[10px] mt-0.5 ${isSelected ? "text-white/70" : "text-gray-400"}`}>
                                  {slot.remaining} place{slot.remaining > 1 ? "s" : ""}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Customer note */}
              <div className="p-4 bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10">
                <label className="text-sm font-semibold text-gray-900 dark:text-white mb-2 block">
                  Note au boucher
                  <span className="text-gray-500 dark:text-gray-400 font-normal ml-1">(optionnel)</span>
                </label>
                <textarea
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                  placeholder="Sans trop de gras, bien saignant..."
                  maxLength={500}
                  rows={3}
                  className="w-full rounded-xl border border-[#ece8e3] dark:border-white/10 bg-white dark:bg-[#1a1a1a] px-4 py-3 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30 focus:border-[#DC2626] transition-colors"
                />
              </div>

              {/* Payment method */}
              <div className="p-4 bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10">
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard size={16} className="text-[#DC2626]" />
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    Mode de paiement
                  </span>
                </div>

                {shopAcceptOnPickup && (
                  <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors mb-2 ${
                    paymentMethod === "ON_PICKUP"
                      ? "border-[#DC2626] bg-[#DC2626]/5"
                      : "border-[#ece8e3] dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5"
                  }`}>
                    <input
                      type="radio"
                      name="payment"
                      checked={paymentMethod === "ON_PICKUP"}
                      onChange={() => setPaymentMethod("ON_PICKUP")}
                      className="w-4 h-4 accent-[#DC2626]"
                    />
                    <Banknote size={18} className="text-emerald-600 shrink-0" />
                    <div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        Paiement sur place
                      </span>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        Payez au retrait (especes, CB)
                      </p>
                    </div>
                  </label>
                )}

                {shopAcceptOnline && (
                  <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    paymentMethod === "ONLINE"
                      ? "border-[#DC2626] bg-[#DC2626]/5"
                      : "border-[#ece8e3] dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5"
                  }`}>
                    <input
                      type="radio"
                      name="payment"
                      checked={paymentMethod === "ONLINE"}
                      onChange={() => setPaymentMethod("ONLINE")}
                      className="w-4 h-4 accent-[#DC2626]"
                    />
                    <CreditCard size={18} className="text-blue-600 shrink-0" />
                    <div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        Paiement en ligne
                      </span>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        Payez par carte maintenant
                      </p>
                    </div>
                  </label>
                )}
              </div>

              {/* Submit */}
              <Button
                onClick={handleOrder}
                disabled={showCountdown || (timeMode === "slot" && !selectedSlot)}
                className="w-full bg-[#DC2626] hover:bg-[#b91c1c] disabled:opacity-50"
                size="lg"
              >
                {paymentMethod === "ONLINE"
                  ? `Payer ${fmtPrice(finalTotal)} et commander`
                  : "Confirmer ma commande"}
              </Button>
            </div>
          )}
        </div>
      </main>

      <ConfirmDialog
        open={showClearConfirm}
        onOpenChange={setShowClearConfirm}
        title="Vider le panier ?"
        description={`Tous les articles de ${state.shopName || "votre panier"} seront supprimes.`}
        confirmLabel="Vider le panier"
        cancelLabel="Annuler"
        variant="danger"
        onConfirm={() => {
          clear();
          toast.success("Panier vide");
        }}
      />

      {/* ── Countdown overlay ── */}
      {showCountdown && countdownOrderData && (
        <OrderCountdown
          orderData={countdownOrderData}
          itemCount={itemCount}
          totalCents={finalTotal}
          shopName={state.shopName}
          pickupLabel={
            timeMode === "slot" && selectedSlot
              ? `Retrait : ${selectedDate === new Date().toISOString().slice(0, 10) ? "Aujourd'hui" : selectedDate} ${selectedSlot.start}-${selectedSlot.end}`
              : "Retrait : Des que possible"
          }
          onCancel={() => {
            setShowCountdown(false);
            setCountdownOrderData(null);
            toast("Commande annulee", { icon: "ℹ️" });
          }}
          onSuccess={(order) => {
            clear();
            toast.success(`Commande ${order.orderNumber} confirmee !`);
            router.push(`/suivi/${order.id}`);
          }}
          onError={(missingProductIds) => {
            setShowCountdown(false);
            setCountdownOrderData(null);
            // Auto-clean stale products from cart
            if (missingProductIds && missingProductIds.length > 0) {
              for (const item of state.items) {
                const pid = item.productId || item.id;
                if (missingProductIds.includes(pid)) {
                  removeItem(item.id);
                }
              }
              toast.error(
                `${missingProductIds.length} produit(s) retire(s) du panier (plus disponibles)`
              );
            }
          }}
          duration={5}
        />
      )}
    </div>
  );
}
