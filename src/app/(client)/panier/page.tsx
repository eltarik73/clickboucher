"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ShoppingBag,
  Clock,
  CreditCard,
  Banknote,
  ChevronLeft,
  ChevronRight,
  X,
  Tag,
  Loader2,
  Gift,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/lib/hooks/use-cart";
import { cartLineTotalCents, cartTotalCents } from "@/lib/cart/cart-line";
import {
  buildCheckoutSubmission,
  buildQuoteRequest,
  parseCheckoutAttempt,
  prepareCheckoutAttempt,
  refusedCartLines,
  type CheckoutAttempt,
  type CheckoutSelection,
  type CheckoutSubmission,
} from "@/lib/cart/order-payload";
import { useOrderQuote } from "@/lib/hooks/use-order-quote";
import { useCheckoutSession } from "@/lib/hooks/use-checkout-session";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { OrderCountdown } from "@/components/checkout/OrderCountdown";
import CartSuggestions from "@/components/cart/CartSuggestions";
import { CheckoutLineRow } from "@/components/cart/CheckoutLineRow";

// ── Helpers ──────────────────────────────────────

// Date locale du navigateur au format "YYYY-MM-DD". Ne pas utiliser
// toISOString() : entre 00h et 02h en France, la date UTC est celle de la veille.
function localDateKey(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

// Tentative de commande en cours : la même clé d'idempotence est renvoyée tant que
// le contenu confirmé ne change pas, y compris après un rechargement de la page.
const CHECKOUT_ATTEMPT_KEY = "klikgo-checkout-attempt";

function readCheckoutAttempt(): CheckoutAttempt | null {
  try {
    return parseCheckoutAttempt(sessionStorage.getItem(CHECKOUT_ATTEMPT_KEY));
  } catch (error) {
    if (error instanceof DOMException) return null;
    throw error;
  }
}

function writeCheckoutAttempt(attempt: CheckoutAttempt | null) {
  try {
    if (attempt) sessionStorage.setItem(CHECKOUT_ATTEMPT_KEY, JSON.stringify(attempt));
    else sessionStorage.removeItem(CHECKOUT_ATTEMPT_KEY);
  } catch (error) {
    if (!(error instanceof DOMException)) throw error;
  }
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
  const { ready: sessionReady, signedIn } = useCheckoutSession();
  const { state, updateQty, removeItem, clear, itemCount } = useCart();

  const [timeMode, setTimeMode] = useState<"asap" | "slot">("asap");
  const [customerNote, setCustomerNote] = useState("");

  // Pickup slots
  const [selectedDate, setSelectedDate] = useState(() => localDateKey(new Date()));
  const [slots, setSlots] = useState<PickupSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<PickupSlot | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);

  // Countdown overlay
  const [countdown, setCountdown] = useState<CheckoutSubmission | null>(null);

  // Clear cart dialog
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Guest checkout (Baymard +23%) — non-signed-in visitors can place an order
  // by providing email + name + optional phone. A magic link is sent for tracking.
  const [guestForm, setGuestForm] = useState({ email: "", firstName: "", lastName: "", phone: "" });
  const [guestErrors, setGuestErrors] = useState<{
    email?: string;
    firstName?: string;
    lastName?: string;
  }>({});

  // Promo code: the input, and the code sent to the server quote once applied.
  const [promoInput, setPromoInput] = useState("");
  const [promoCode, setPromoCode] = useState<string | null>(null);
  const [promoError, setPromoError] = useState("");

  // ── Server quote ───────────────────────────────

  const selection = useMemo<CheckoutSelection | null>(() => {
    if (!state.shopId || state.items.length === 0) return null;
    const slot = timeMode === "slot" ? selectedSlot : null;
    return {
      shopId: state.shopId,
      items: state.items,
      promoCode,
      requestedTime: slot ? `${selectedDate}T${slot.start}:00` : "asap",
      pickupSlot: slot
        ? {
            startIso: new Date(`${selectedDate}T${slot.start}:00`).toISOString(),
            endIso: new Date(`${selectedDate}T${slot.end}:00`).toISOString(),
          }
        : null,
      customerNote,
    };
  }, [state.shopId, state.items, promoCode, timeMode, selectedSlot, selectedDate, customerNote]);

  const quoteRequest = useMemo(
    () => (selection ? buildQuoteRequest(selection) : null),
    [selection]
  );
  const {
    state: quoteState,
    quote,
    error: quoteError,
    refresh: refreshQuote,
  } = useOrderQuote(quoteRequest);

  const refusedLines = useMemo(
    () => (quoteState === "error" ? refusedCartLines(state.items, quoteError) : {}),
    [quoteState, quoteError, state.items]
  );
  const refusedLineCount = Object.keys(refusedLines).length;

  const removeMissingProducts = useCallback(
    (missingProductIds: readonly string[]) => {
      const stale = state.items.filter((item) => missingProductIds.includes(item.productId));
      for (const item of stale) removeItem(item.id);
      if (stale.length > 0) {
        toast.error(`${stale.length} produit(s) retiré(s) du panier (plus disponibles)`);
      }
    },
    [state.items, removeItem]
  );

  useEffect(() => {
    if (quoteError?.code !== "PRODUCTS_MISSING") return;
    removeMissingProducts(quoteError.details?.missingProductIds ?? []);
  }, [quoteError, removeMissingProducts]);

  useEffect(() => {
    if (!quote?.discountRejection) return;
    setPromoError(quote.discountRejection.message);
    setPromoCode(null);
  }, [quote]);

  // Fetch available slots when date or shop changes
  const fetchSlots = useCallback(async () => {
    if (!state.shopId) return;
    setSlotsLoading(true);
    try {
      const res = await fetch(`/api/shops/${state.shopId}/available-slots?date=${selectedDate}`);
      const json = await res.json();
      let fetchedSlots: PickupSlot[] = json.data?.slots || [];
      // Client-side filter: hide slots whose start time has already passed (+ 10 min margin)
      const today = localDateKey(new Date());
      if (selectedDate === today) {
        const now = new Date();
        const nowMin = now.getHours() * 60 + now.getMinutes() + 10;
        fetchedSlots = fetchedSlots.filter((s) => {
          const [h, m] = s.start.split(":").map(Number);
          return h * 60 + m >= nowMin;
        });
      }
      setSlots(fetchedSlots);
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, [state.shopId, selectedDate]);

  useEffect(() => {
    if (timeMode === "slot") fetchSlots();
  }, [timeMode, fetchSlots]);

  const applyPromoCode = () => {
    const code = promoInput.trim();
    if (!code) return;
    setPromoError("");
    setPromoCode(code);
  };

  const removePromo = () => {
    setPromoCode(null);
    setPromoInput("");
    setPromoError("");
  };

  function navigateDate(dir: number) {
    const d = new Date(`${selectedDate}T00:00:00`);
    d.setDate(d.getDate() + dir);
    const today = localDateKey(new Date());
    if (localDateKey(d) < today) return;
    setSelectedDate(localDateKey(d));
    setSelectedSlot(null);
  }

  const validateGuestForm = () => {
    const errs: { email?: string; firstName?: string; lastName?: string } = {};
    if (!guestForm.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestForm.email.trim())) {
      errs.email = "Email invalide";
    }
    if (!guestForm.firstName.trim()) errs.firstName = "Prénom requis";
    if (!guestForm.lastName.trim()) errs.lastName = "Nom requis";
    setGuestErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const readyQuote = quoteState === "ready" ? quote : null;
  const promoPending = promoCode !== null && quoteState === "loading";
  const canConfirm =
    readyQuote !== null &&
    !readyQuote.belowMinimumOrder &&
    !readyQuote.discountRejection &&
    countdown === null &&
    !(timeMode === "slot" && !selectedSlot);

  const handleOrder = () => {
    if (!selection || !readyQuote || !canConfirm) return;
    // Guest path — validate identity form before sending.
    if (!signedIn && !validateGuestForm()) return;

    const { request, attempt } = prepareCheckoutAttempt(
      selection,
      readyQuote.amountDueCents,
      readCheckoutAttempt(),
      () => crypto.randomUUID()
    );
    writeCheckoutAttempt(attempt);

    setCountdown(buildCheckoutSubmission(request, signedIn ? null : guestForm));
  };

  const backHref = state.shopSlug ? `/boutique/${state.shopSlug}` : "/";

  // ── Empty cart ──────────────────────────────────
  if (state.items.length === 0) {
    return (
      <div className="flex min-h-screen flex-col bg-[#f8f6f3] dark:bg-[#0a0a0a]">
        {/* Header */}
        <header className="sticky top-0 z-10 border-b border-[#ece8e3] bg-[#f8f6f3]/95 px-5 py-4 backdrop-blur-xl dark:border-white/10 dark:bg-[#0a0a0a]/95">
          <div className="mx-auto flex max-w-xl items-center gap-3">
            <Link
              href={backHref}
              className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-[#ece8e3] bg-white shadow-sm dark:border-white/10 dark:bg-[#141414]"
            >
              <ArrowLeft size={17} className="text-gray-900 dark:text-white" />
            </Link>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Mon panier</h1>
          </div>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center px-5">
          <div className="mb-4 text-6xl">🛒</div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Votre panier est vide</h2>
          <p className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">
            Ajoutez des produits depuis une boucherie pour commencer.
          </p>
          <Button className="mt-6 bg-[#DC2626] hover:bg-[#b91c1c]" size="lg" asChild>
            <Link href="/">Découvrir les boucheries</Link>
          </Button>
        </div>
      </div>
    );
  }

  // ── Cart with items ─────────────────────────────
  return (
    <div className="min-h-screen bg-[#f8f6f3] pb-8 dark:bg-[#0a0a0a]">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-[#ece8e3] bg-[#f8f6f3]/95 px-5 py-4 backdrop-blur-xl dark:border-white/10 dark:bg-[#0a0a0a]/95">
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={backHref}
              className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-[#ece8e3] bg-white shadow-sm dark:border-white/10 dark:bg-[#141414]"
            >
              <ArrowLeft size={17} className="text-gray-900 dark:text-white" />
            </Link>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Mon panier</h1>
          </div>
          <span className="rounded-full bg-[#DC2626]/10 px-3 py-1.5 text-xs font-bold text-[#DC2626]">
            {itemCount} article{itemCount > 1 ? "s" : ""}
          </span>
        </div>
      </header>

      <main className="mx-auto mt-6 max-w-xl px-5">
        {/* Shop name + clear */}
        <div className="mb-4 flex items-center gap-2">
          <ShoppingBag size={16} className="text-[#DC2626]" />
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            {state.shopName}
          </span>
          <button
            onClick={() => setShowClearConfirm(true)}
            className="ml-auto flex items-center gap-1 text-xs text-gray-500 transition-colors hover:text-[#DC2626] dark:text-gray-400"
          >
            <X size={12} />
            Vider
          </button>
        </div>

        {/* ═══════════════════════════════════════════ */}
        {/* CART ITEMS */}
        {/* ═══════════════════════════════════════════ */}
        <div className="flex flex-col gap-2.5">
          {state.items.map((item, index) => (
            <CheckoutLineRow
              key={item.id}
              item={item}
              lineTotalCents={readyQuote?.lines[index]?.lineTotalCents ?? cartLineTotalCents(item)}
              refusal={refusedLines[item.id]}
              onUpdateQty={(qty) => updateQty(item.id, qty)}
              onRemove={() => removeItem(item.id)}
            />
          ))}
        </div>

        {/* Suggestions */}
        <CartSuggestions />

        {/* Promo code */}
        {signedIn && (
          <div className="mt-5 rounded-2xl border border-[#ece8e3] bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.03)] dark:border-white/10 dark:bg-[#141414]">
            <div className="mb-3 flex items-center gap-2">
              <Tag size={16} className="text-[#DC2626]" />
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                Code promo ou fidélité
              </span>
            </div>

            {readyQuote?.discount ? (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950/20">
                <Gift size={18} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                    {readyQuote.discount.label}
                  </p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    -{formatPrice(readyQuote.discount.discountCents)}
                  </p>
                </div>
                <button
                  onClick={removePromo}
                  aria-label="Retirer le code promo"
                  className="rounded-lg p-1.5 text-emerald-600 transition-colors hover:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-900/30"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={promoInput}
                    onChange={(e) => {
                      setPromoInput(e.target.value.toUpperCase());
                      setPromoError("");
                    }}
                    placeholder="Entrez un code..."
                    maxLength={30}
                    className="flex-1 rounded-xl border border-[#ece8e3] bg-white px-4 py-2.5 text-sm uppercase text-gray-900 transition-colors placeholder:text-gray-500 focus:border-[#DC2626] focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30 dark:border-white/10 dark:bg-[#1a1a1a] dark:text-gray-400 dark:text-white dark:placeholder:text-gray-500"
                  />
                  <button
                    onClick={applyPromoCode}
                    disabled={promoPending || !promoInput.trim()}
                    className="flex shrink-0 items-center gap-2 rounded-xl bg-[#DC2626] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#b91c1c] disabled:opacity-50"
                  >
                    {promoPending ? <Loader2 size={14} className="animate-spin" /> : "Appliquer"}
                  </button>
                </div>
                {promoError && <p className="mt-2 text-xs text-red-500">{promoError}</p>}
              </div>
            )}
          </div>
        )}

        {/* Total */}
        <div className="mt-5 rounded-2xl border border-[#ece8e3] bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.03)] dark:border-white/10 dark:bg-[#141414]">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">Sous-total</span>
            <span className="text-sm text-gray-700 dark:text-gray-200">
              {formatPrice(readyQuote ? readyQuote.subtotalCents : cartTotalCents(state.items))}
            </span>
          </div>
          {readyQuote?.discount && (
            <div className="mt-1 flex items-center justify-between">
              <span className="text-sm text-emerald-600 dark:text-emerald-400">
                {readyQuote.discount.label || "Réduction"}
              </span>
              <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                -{formatPrice(readyQuote.discount.discountCents)}
              </span>
            </div>
          )}
          {readyQuote && readyQuote.serviceFeeCents > 0 && (
            <div className="mt-1 flex items-center justify-between">
              <span className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                Frais de service Klik&amp;Go
                <span title="Frais fixes par commande, payés par le client et reversés à Klik&Go.">
                  <Info size={12} className="text-gray-400" />
                </span>
              </span>
              <span className="text-sm text-gray-700 dark:text-gray-200">
                {formatPrice(readyQuote.serviceFeeCents)}
              </span>
            </div>
          )}
          <div className="mt-2 flex items-center justify-between border-t border-[#ece8e3] pt-2 dark:border-white/10">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              Total à payer
            </span>
            <span className="text-2xl font-extrabold text-gray-900 dark:text-white">
              {formatPrice(readyQuote ? readyQuote.amountDueCents : cartTotalCents(state.items))}
            </span>
          </div>
          {quoteState === "loading" && (
            <p
              className="mt-1.5 flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400"
              aria-live="polite"
            >
              <Loader2 size={11} className="animate-spin" />
              Calcul du total…
            </p>
          )}
          {quoteState === "error" && quoteError && (
            <p className="mt-1.5 text-xs text-red-500" role="alert">
              {refusedLineCount > 0
                ? refusedLineCount > 1
                  ? `${refusedLineCount} articles signalés ci-dessus : modifiez-les ou retirez-les pour commander.`
                  : "Un article signalé ci-dessus : modifiez-le ou retirez-le pour commander."
                : quoteError.message}
            </p>
          )}
          {readyQuote?.belowMinimumOrder && (
            <p className="mt-1.5 text-xs text-red-500" role="alert">
              Commande minimum de {formatPrice(readyQuote.minOrderCents)}
            </p>
          )}
          <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
            Le poids exact sera ajusté au retrait — paiement sur place.
          </p>
        </div>

        {/* ═══════════════════════════════════════════ */}
        {/* CHECKOUT */}
        {/* ═══════════════════════════════════════════ */}
        <div className="mt-6">
          <h2 className="mb-4 text-base font-bold text-gray-900 dark:text-white">
            Finaliser la commande
          </h2>

          {!sessionReady ? (
            <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              Chargement...
            </div>
          ) : (
            <div className="space-y-4">
              {!signedIn && (
                /* Not signed in — Guest checkout (Baymard +23% conversion) */
                <div className="rounded-2xl border border-[#ece8e3] bg-white p-4 dark:border-white/10 dark:bg-[#141414]">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        Tes infos pour la commande
                      </p>
                      <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                        Pas besoin de créer un compte. On t&apos;envoie un lien de suivi par email.
                      </p>
                    </div>
                    <Link
                      href="/sign-in?redirect_url=/panier"
                      prefetch={false}
                      className="shrink-0 whitespace-nowrap text-xs font-semibold text-[#DC2626] hover:underline"
                    >
                      J&apos;ai un compte
                    </Link>
                  </div>
                  <div className="space-y-2.5">
                    <div>
                      <input
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        value={guestForm.email}
                        onChange={(e) => {
                          setGuestForm((f) => ({ ...f, email: e.target.value }));
                          setGuestErrors((er) => ({ ...er, email: undefined }));
                        }}
                        placeholder="Email *"
                        className="w-full rounded-xl border border-[#ece8e3] bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-500 focus:border-[#DC2626] focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30 dark:border-white/10 dark:bg-[#1a1a1a] dark:text-white"
                      />
                      {guestErrors.email && (
                        <p className="mt-1 text-[11px] text-red-500">{guestErrors.email}</p>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <input
                          type="text"
                          autoComplete="given-name"
                          value={guestForm.firstName}
                          onChange={(e) => {
                            setGuestForm((f) => ({ ...f, firstName: e.target.value }));
                            setGuestErrors((er) => ({ ...er, firstName: undefined }));
                          }}
                          placeholder="Prénom *"
                          className="w-full rounded-xl border border-[#ece8e3] bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-500 focus:border-[#DC2626] focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30 dark:border-white/10 dark:bg-[#1a1a1a] dark:text-white"
                        />
                        {guestErrors.firstName && (
                          <p className="mt-1 text-[11px] text-red-500">{guestErrors.firstName}</p>
                        )}
                      </div>
                      <div>
                        <input
                          type="text"
                          autoComplete="family-name"
                          value={guestForm.lastName}
                          onChange={(e) => {
                            setGuestForm((f) => ({ ...f, lastName: e.target.value }));
                            setGuestErrors((er) => ({ ...er, lastName: undefined }));
                          }}
                          placeholder="Nom *"
                          className="w-full rounded-xl border border-[#ece8e3] bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-500 focus:border-[#DC2626] focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30 dark:border-white/10 dark:bg-[#1a1a1a] dark:text-white"
                        />
                        {guestErrors.lastName && (
                          <p className="mt-1 text-[11px] text-red-500">{guestErrors.lastName}</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <input
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        value={guestForm.phone}
                        onChange={(e) => setGuestForm((f) => ({ ...f, phone: e.target.value }))}
                        placeholder="Téléphone (recommandé)"
                        className="w-full rounded-xl border border-[#ece8e3] bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-500 focus:border-[#DC2626] focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30 dark:border-white/10 dark:bg-[#1a1a1a] dark:text-white"
                      />
                      <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                        Tu pourras créer un compte plus tard pour retrouver tes commandes.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Time slot */}
              <div className="rounded-2xl border border-[#ece8e3] bg-white p-4 dark:border-white/10 dark:bg-[#141414]">
                <div className="mb-3 flex items-center gap-2">
                  <Clock size={16} className="text-[#DC2626]" />
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    Créneau de retrait
                  </span>
                </div>

                <label className="mb-2 flex cursor-pointer items-center gap-3 rounded-xl border border-[#ece8e3] p-3 transition-colors hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5">
                  <input
                    type="radio"
                    name="timeSlot"
                    checked={timeMode === "asap"}
                    onChange={() => setTimeMode("asap")}
                    className="h-4 w-4 accent-[#DC2626]"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      Dès que possible
                    </span>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      Préparation immédiate par le boucher
                    </p>
                  </div>
                </label>

                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#ece8e3] p-3 transition-colors hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5">
                  <input
                    type="radio"
                    name="timeSlot"
                    checked={timeMode === "slot"}
                    onChange={() => setTimeMode("slot")}
                    className="h-4 w-4 accent-[#DC2626]"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      Choisir un créneau
                    </span>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      Sélectionnez un créneau de 30 min
                    </p>
                  </div>
                </label>

                {timeMode === "slot" && (
                  <div className="mt-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => navigateDate(-1)}
                        aria-label="Jour précédent"
                        className="flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5"
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
                        aria-label="Jour suivant"
                        className="flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                    {slotsLoading ? (
                      <p className="py-4 text-center text-xs text-gray-500 dark:text-gray-400">
                        Chargement...
                      </p>
                    ) : slots.length === 0 ? (
                      <p className="py-4 text-center text-xs text-gray-500 dark:text-gray-400">
                        Aucun créneau disponible ce jour
                      </p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {slots.map((slot) => {
                          const isSelected = selectedSlot?.start === slot.start;
                          return (
                            <button
                              key={slot.start}
                              onClick={() => slot.available && setSelectedSlot(slot)}
                              disabled={!slot.available}
                              className={`rounded-xl border px-2 py-2.5 text-sm font-medium transition-colors ${
                                isSelected
                                  ? "border-[#DC2626] bg-[#DC2626] text-white"
                                  : slot.available
                                    ? "border-gray-200 bg-white text-gray-900 hover:border-[#DC2626]/50 dark:border-white/10 dark:bg-[#1a1a1a] dark:text-white"
                                    : "cursor-not-allowed border-transparent bg-gray-100 text-gray-300 dark:bg-white/5 dark:text-gray-600"
                              }`}
                            >
                              {slot.start}
                              {slot.available && (
                                <span
                                  className={`mt-0.5 block text-[10px] ${isSelected ? "text-white/70" : "text-gray-500 dark:text-gray-400"}`}
                                >
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
              <div className="rounded-2xl border border-[#ece8e3] bg-white p-4 dark:border-white/10 dark:bg-[#141414]">
                <label className="mb-2 block text-sm font-semibold text-gray-900 dark:text-white">
                  Note au boucher
                  <span className="ml-1 font-normal text-gray-500 dark:text-gray-400">
                    (optionnel)
                  </span>
                </label>
                <textarea
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                  placeholder="Sans trop de gras, bien saignant..."
                  maxLength={500}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-[#ece8e3] bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-500 focus:border-[#DC2626] focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30 dark:border-white/10 dark:bg-[#1a1a1a] dark:text-white"
                />
              </div>

              {/* Payment method — paiement sur place uniquement (Stripe à venir) */}
              {signedIn && (
                <div className="rounded-2xl border border-[#ece8e3] bg-white p-4 dark:border-white/10 dark:bg-[#141414]">
                  <div className="mb-3 flex items-center gap-2">
                    <CreditCard size={16} className="text-[#DC2626]" />
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      Mode de paiement
                    </span>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl border border-[#DC2626] bg-[#DC2626]/5 p-3">
                    <Banknote size={18} className="shrink-0 text-emerald-600" />
                    <div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        Paiement sur place
                      </span>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        Payez au retrait (espèces, CB)
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Submit — sticky bottom on mobile (Uber Eats pattern), inline on md+ */}
              <div className="sticky bottom-0 -mx-5 bg-gradient-to-t from-[#f8f6f3] from-60% to-transparent px-5 pb-[env(safe-area-inset-bottom)] pt-3 dark:from-[#0a0a0a] md:static md:mx-0 md:bg-none md:px-0 md:pb-0 md:pt-0">
                <Button
                  onClick={handleOrder}
                  disabled={!canConfirm}
                  className="w-full bg-[#DC2626] shadow-lg hover:bg-[#b91c1c] disabled:opacity-50 md:shadow-none"
                  size="lg"
                >
                  Confirmer ma commande
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      <ConfirmDialog
        open={showClearConfirm}
        onOpenChange={setShowClearConfirm}
        title="Vider le panier ?"
        description={`Tous les articles de ${state.shopName || "votre panier"} seront supprimés.`}
        confirmLabel="Vider le panier"
        cancelLabel="Annuler"
        variant="danger"
        onConfirm={() => {
          clear();
          toast.success("Panier vidé");
        }}
      />

      {/* ── Countdown overlay ── */}
      {countdown && (
        <OrderCountdown
          submission={countdown}
          itemCount={itemCount}
          totalCents={countdown.body.expectedTotalCents}
          shopName={state.shopName}
          pickupLabel={
            timeMode === "slot" && selectedSlot
              ? `Retrait : ${selectedDate === localDateKey(new Date()) ? "Aujourd'hui" : selectedDate} ${selectedSlot.start}-${selectedSlot.end}`
              : "Retrait : Dès que possible"
          }
          onCancel={() => {
            setCountdown(null);
            toast("Commande annulée", { icon: "ℹ️" });
          }}
          onSuccess={(order) => {
            writeCheckoutAttempt(null);
            clear();
            toast.success(`Commande ${order.orderNumber} confirmée !`);
            router.push(
              order.guestToken
                ? `/suivi/${order.id}?guestToken=${encodeURIComponent(order.guestToken)}`
                : `/suivi/${order.id}`
            );
          }}
          onError={(missingProductIds) => {
            setCountdown(null);
            if (missingProductIds) removeMissingProducts(missingProductIds);
            else void refreshQuote();
          }}
          onPriceChanged={(message) => {
            setCountdown(null);
            void refreshQuote();
            toast.error(message);
          }}
          duration={5}
        />
      )}
    </div>
  );
}
