// src/components/product/ProductSheet.tsx — Floating mini card (F1 Fusion Crème+Rouge)
"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { resolveProductImage } from "@/lib/product-images";
import { getFlag } from "@/lib/flags";
import { displayedUnitPrice, promoBadgeLabel } from "@/lib/pricing/display";
import { isWeighedUnit, lineTotalCents, MAX_LINE_QUANTITY } from "@/lib/pricing/line";
import { limitedStockRemaining, limitedStockSoldOut } from "@/lib/pricing/limited-stock";
import { useMountedNow, type ProductCardData } from "./ProductCard";

/** Weighed products go on to their weight or slice sheet; counted products are added with a quantity. */
export interface ProductSheetSelection {
  variant?: string;
  quantity: number;
}

interface Props {
  product: ProductCardData | null;
  onAdd: (selection: ProductSheetSelection) => void;
  onClose: () => void;
}

function fmtPrice(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

function unitLabel(unit: string) {
  return unit === "KG" || unit === "TRANCHE" ? "/kg" : unit === "PIECE" ? "/piece" : "/barquette";
}

export function ProductSheet({ product, onAdd, onClose }: Props) {
  const [visible, setVisible] = useState(false);
  const [qty, setQty] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [showFiche, setShowFiche] = useState(false);
  const [imgError, setImgError] = useState(false);
  const now = useMountedNow();

  useEffect(() => {
    if (product) {
      setQty(1);
      setSelectedVariant(null);
      setImgError(false);
      // Auto-expand Fiche Confiance if product has traceability data
      setShowFiche(
        !!(
          product.originRegion ||
          product.elevageMode ||
          product.raceDescription ||
          product.halalMethod ||
          product.freshDetail
        )
      );
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [product]);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 300);
  }, [onClose]);

  useEffect(() => {
    if (!product) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [product, handleClose]);

  if (!product) return null;

  // Use product images but skip expired Replicate URLs
  const rawImgUrl = product.images.length > 0 ? product.images[0].url : null;
  const isReplicateUrl = rawImgUrl?.includes("replicate.delivery");
  const imgSrc =
    rawImgUrl && !isReplicateUrl
      ? rawImgUrl
      : resolveProductImage({
          name: product.name,
          imageUrl: product.imageUrl,
          category: product.category.name,
        });
  const hasImage = !!imgSrc && !imgError;
  const price = displayedUnitPrice(product, now);
  const promo = price.promo;
  const isAntiGaspi = product.isAntiGaspi && product.antiGaspiOrigPriceCents;
  const isKg = product.unit === "KG";
  const isWeighed = isWeighedUnit(product.unit);
  const needsVariant = !isWeighed && product.variants.length > 0 && selectedVariant === null;
  const maxStock = limitedStockRemaining(product);
  const soldOut = limitedStockSoldOut(product);
  const maxQty = Math.min(maxStock ?? MAX_LINE_QUANTITY, MAX_LINE_QUANTITY);

  function handleAdd() {
    onAdd({ variant: selectedVariant || undefined, quantity: qty });
    handleClose();
  }

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 transition-opacity duration-300 ${visible ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={handleClose}
      >
        {/* Card */}
        <div
          onClick={(e) => e.stopPropagation()}
          className={`relative max-h-[calc(100vh-32px)] w-[340px] max-w-[calc(100vw-32px)] overflow-y-auto overflow-x-hidden transition-all duration-300 ease-out ${visible ? "scale-100 opacity-100" : "scale-90 opacity-0"}`}
          style={{
            background: "#FAF8F5",
            borderRadius: "20px",
            boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
          }}
        >
          {/* ── Close button ── */}
          <button
            onClick={handleClose}
            className="absolute right-3.5 top-3 z-10 cursor-pointer text-sm"
            style={{ color: "#C4B5A3" }}
            aria-label="Fermer"
          >
            ✕
          </button>

          {/* ── Header row: emoji/img + name + price ── */}
          <div className="flex items-center gap-3 px-3.5 pt-3.5">
            {/* Emoji / Image square */}
            <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-2xl">
              {hasImage ? (
                <img
                  src={imgSrc}
                  alt={product.name}
                  width={56}
                  height={56}
                  loading="eager"
                  className="h-full w-full object-cover"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center"
                  style={{ background: "linear-gradient(145deg, #1C1512, #3D261A)" }}
                >
                  <span
                    className="text-3xl"
                    style={{ filter: "drop-shadow(0 4px 20px rgba(0,0,0,0.4))" }}
                  >
                    {product.category.emoji || "🥩"}
                  </span>
                </div>
              )}
              {/* Anti-gaspi / Promo badge */}
              {isAntiGaspi ? (
                <span className="absolute -right-1.5 -top-1.5 rounded-md bg-emerald-600 px-1.5 py-0.5 text-[11px] font-extrabold text-white shadow">
                  Anti-Gaspi
                </span>
              ) : promo ? (
                <span className="absolute -right-1.5 -top-1.5 rounded-md bg-[#DC2626] px-1.5 py-0.5 text-[11px] font-extrabold text-white shadow">
                  {promoBadgeLabel(promo)}
                </span>
              ) : null}
            </div>

            {/* Name + category */}
            <div className="min-w-0 flex-1">
              <h2
                className="truncate text-[15px] font-extrabold leading-tight"
                style={{ color: "#1C1512", fontFamily: "Georgia, serif" }}
              >
                {product.name}
              </h2>
              <p
                className="mt-0.5 truncate uppercase"
                style={{
                  fontSize: "10px",
                  color: "#C9A96E",
                  letterSpacing: "1.5px",
                  fontFamily: "Georgia, serif",
                }}
              >
                {product.category.emoji && `${product.category.emoji} `}
                {product.category.name}
              </p>
            </div>

            {/* Price */}
            <div className="flex-shrink-0 text-right">
              <span
                className={`block text-[22px] font-black leading-none ${isAntiGaspi ? "text-emerald-600" : "text-[#DC2626]"}`}
              >
                {fmtPrice(price.unitPriceCents)}
              </span>
              <div className="mt-0.5 flex items-center justify-end gap-1">
                {isAntiGaspi && (
                  <span className="text-[11px] line-through" style={{ color: "#C4B5A3" }}>
                    {fmtPrice(product.antiGaspiOrigPriceCents!)}
                  </span>
                )}
                {promo && !isAntiGaspi && (
                  <span className="text-[11px] line-through" style={{ color: "#C4B5A3" }}>
                    {fmtPrice(price.baseCents)}
                  </span>
                )}
                <span className="text-[11px]" style={{ color: "#A08060" }}>
                  {unitLabel(product.unit)}
                </span>
              </div>
            </div>
          </div>

          {/* ── Body: description + badges ── */}
          <div className="px-3.5 pt-2">
            {/* Description */}
            {product.description && (
              <p
                className="line-clamp-2 italic"
                style={{ fontSize: "12px", color: "#8B7355", fontFamily: "Georgia, serif" }}
              >
                {product.description}
              </p>
            )}

            {/* Badges */}
            {(product.origin ||
              product.halalOrg ||
              product.race ||
              (product.freshness && product.freshness !== "STANDARD") ||
              product.labels.length > 0) && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {product.origin && (
                  <span className="inline-flex items-center gap-0.5 rounded-[5px] border border-[#DBEAFE] bg-[#EFF6FF] px-1.5 py-0.5 text-[11px] font-bold text-[#2563EB]">
                    {getFlag(product.origin)} {product.origin}
                  </span>
                )}
                {product.halalOrg && (
                  <span className="inline-flex items-center gap-0.5 rounded-[5px] border border-[#FECACA] bg-[#FEF2F2] px-1.5 py-0.5 text-[11px] font-bold text-[#DC2626]">
                    ☪ Halal {product.halalOrg}
                  </span>
                )}
                {product.freshness && product.freshness !== "STANDARD" && (
                  <span className="inline-flex items-center gap-0.5 rounded-[5px] border border-[#BBF7D0] bg-[#F0FDF4] px-1.5 py-0.5 text-[11px] font-bold text-[#16A34A]">
                    {product.freshness === "EXTRA_FRESH"
                      ? "❄ Extra frais"
                      : product.freshness === "FROZEN"
                        ? "❄ Surgele"
                        : product.freshness === "FRAIS"
                          ? "❄ Frais"
                          : product.freshness}
                  </span>
                )}
                {product.race && (
                  <span className="inline-flex items-center gap-0.5 rounded-[5px] border border-[#FEF3C7] bg-[#FFFBEB] px-1.5 py-0.5 text-[11px] font-bold text-[#92400E]">
                    🐄 {product.race}
                  </span>
                )}
                {product.labels.map((l) => (
                  <span
                    key={l.id}
                    className="rounded-[5px] border px-1.5 py-0.5 text-[11px] font-bold"
                    style={{
                      backgroundColor: l.color ? `${l.color}1F` : "#FFF7ED",
                      color: l.color || "#C2410C",
                      borderColor: l.color ? `${l.color}40` : "#FED7AA",
                    }}
                  >
                    {l.name}
                  </span>
                ))}
              </div>
            )}

            {/* Limited stock info (anti-gaspi or flash sale) */}
            {product.inStock && maxStock !== null && maxStock > 0 && (
              <div
                className="mt-1.5 rounded-md px-2 py-1.5 text-[10px] font-semibold"
                style={{ background: "#ECFDF5", color: "#059669", border: "1px solid #A7F3D0" }}
              >
                {product.isAntiGaspi ? "🌿 Anti-gaspi" : "⚡ Vente flash"} — Reste {maxStock} en
                stock
              </div>
            )}

            {/* Weight note */}
            {isKg && (
              <span
                className="mt-1.5 inline-block rounded-md px-2 py-1 text-[10px] font-medium"
                style={{ background: "#FFFBEB", color: "#92400E" }}
              >
                ⚖️ ±10%
              </span>
            )}

            {/* Pack info */}
            {product.packContent && (
              <div
                className="mt-1.5 rounded-md px-2 py-1.5 text-[10px] font-medium"
                style={{ background: "#F0FDF4", color: "#16A34A" }}
              >
                <span className="font-bold">Pack :</span> {product.packContent}
                {product.packWeight && <span> — {product.packWeight}</span>}
                {product.packOldPriceCents && (
                  <span className="ml-1 text-gray-500 line-through dark:text-gray-400">
                    {fmtPrice(product.packOldPriceCents)}
                  </span>
                )}
              </div>
            )}

            {/* ── Fiche Confiance teaser ── */}
            {(product.originRegion ||
              product.elevageMode ||
              product.raceDescription ||
              product.halalMethod ||
              product.freshDetail) && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setShowFiche(!showFiche)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors"
                  style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#16A34A"
                    strokeWidth="2.5"
                    className="flex-shrink-0"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <polyline points="9 12 11 14 15 10" />
                  </svg>
                  <span className="flex-1 text-[10px] font-bold uppercase tracking-wide text-[#16A34A]">
                    Fiche Confiance — Tracabilite
                  </span>
                  <ChevronDown
                    size={14}
                    className={`text-[#16A34A] transition-transform ${showFiche ? "rotate-180" : ""}`}
                  />
                </button>

                {showFiche && (
                  <div
                    className="mt-1.5 space-y-1.5 rounded-lg px-2.5 py-2"
                    style={{ background: "#F7FDF9", border: "1px solid #D1FAE5" }}
                  >
                    {product.originRegion && (
                      <div className="flex items-start gap-1.5">
                        <span className="text-[10px]">📍</span>
                        <div>
                          <p className="text-[11px] font-bold uppercase text-[#166534]">Region</p>
                          <p className="text-[11px] text-[#1C1512]">
                            {product.originRegion}
                            {product.origin ? ` (${product.origin})` : ""}
                          </p>
                        </div>
                      </div>
                    )}
                    {product.raceDescription && (
                      <div className="flex items-start gap-1.5">
                        <span className="text-[10px]">🐄</span>
                        <div>
                          <p className="text-[11px] font-bold uppercase text-[#166534]">
                            Race{product.race ? ` — ${product.race}` : ""}
                          </p>
                          <p className="text-[11px] text-[#1C1512]">{product.raceDescription}</p>
                        </div>
                      </div>
                    )}
                    {product.elevageMode && (
                      <div className="flex items-start gap-1.5">
                        <span className="text-[10px]">🌿</span>
                        <div>
                          <p className="text-[11px] font-bold uppercase text-[#166534]">Elevage</p>
                          <p className="text-[11px] text-[#1C1512]">
                            {product.elevageMode
                              .replace(/_/g, " ")
                              .toLowerCase()
                              .replace(/^\w/, (c) => c.toUpperCase())}
                            {product.elevageDetail ? ` — ${product.elevageDetail}` : ""}
                          </p>
                        </div>
                      </div>
                    )}
                    {product.halalMethod && (
                      <div className="flex items-start gap-1.5">
                        <span className="text-[10px]">☪</span>
                        <div>
                          <p className="text-[11px] font-bold uppercase text-[#166534]">
                            Abattage halal
                          </p>
                          <p className="text-[11px] text-[#1C1512]">{product.halalMethod}</p>
                        </div>
                      </div>
                    )}
                    {(product.freshDate || product.freshDetail) && (
                      <div className="flex items-start gap-1.5">
                        <span className="text-[10px]">❄</span>
                        <div>
                          <p className="text-[11px] font-bold uppercase text-[#166534]">
                            Fraicheur
                          </p>
                          <p className="text-[11px] text-[#1C1512]">
                            {product.freshDetail || ""}
                            {product.freshDate && (
                              <span className="text-[10px] text-[#6B7280]">
                                {" "}
                                — {new Date(product.freshDate).toLocaleDateString("fr-FR")}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Variant selector */}
            {product.variants && product.variants.length > 0 && (
              <div className="mt-2.5">
                <p
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    color: "#A08060",
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    marginBottom: "6px",
                  }}
                >
                  Saveur
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {product.variants.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setSelectedVariant(v === selectedVariant ? null : v)}
                      className="transition-all"
                      style={{
                        padding: "4px 10px",
                        borderRadius: "9999px",
                        fontSize: "12px",
                        fontWeight: 700,
                        background: selectedVariant === v ? "#DC2626" : "rgba(255,255,255,0.8)",
                        color: selectedVariant === v ? "#fff" : "#374151",
                        border: selectedVariant === v ? "1px solid #DC2626" : "1px solid #ece8e3",
                      }}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Bottom bar: qty + CTA ── */}
          <div className="mt-1 flex items-center gap-2 px-3.5 pb-3.5 pt-2.5">
            {!product.inStock || soldOut ? (
              <div
                className="flex h-10 flex-1 items-center justify-center rounded-[10px] text-sm font-bold"
                style={{ background: "#F5F0EB", color: "#C4B5A3" }}
              >
                {soldOut ? "Épuisé" : "Indisponible"}
              </div>
            ) : isWeighed ? (
              <button
                onClick={handleAdd}
                className="flex h-10 flex-1 items-center justify-center gap-2 rounded-[10px] text-sm font-extrabold text-white transition-transform active:scale-[0.97]"
                style={{ background: "#DC2626", boxShadow: "0 4px 12px rgba(220,38,38,0.2)" }}
              >
                {isKg ? "Choisir le poids" : "Choisir les tranches"}
              </button>
            ) : (
              <>
                {/* Quantity selector */}
                <div
                  className="flex items-center"
                  style={{
                    background: "#F5F0EB",
                    borderRadius: "10px",
                    border: "1px solid #E8DFD4",
                  }}
                >
                  <button
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="flex items-center justify-center text-[15px] font-extrabold transition-transform active:scale-90"
                    style={{
                      width: "34px",
                      height: "38px",
                      color: qty <= 1 ? "#D4C4B0" : "#8B7355",
                    }}
                    aria-label="Diminuer la quantite"
                  >
                    −
                  </button>
                  <span
                    className="w-5 text-center text-sm font-black tabular-nums"
                    style={{ color: "#1C1512", fontFamily: "Georgia, serif" }}
                  >
                    {qty}
                  </span>
                  <button
                    onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                    className={`flex items-center justify-center text-[15px] font-extrabold transition-transform active:scale-90 ${qty >= maxQty ? "text-gray-300" : "text-[#DC2626]"}`}
                    style={{ width: "34px", height: "38px" }}
                    disabled={qty >= maxQty}
                    aria-label="Augmenter la quantite"
                  >
                    +
                  </button>
                </div>

                {/* CTA */}
                <button
                  onClick={handleAdd}
                  disabled={needsVariant}
                  className="flex h-10 flex-1 items-center justify-center gap-2 rounded-[10px] text-sm font-extrabold text-white transition-transform active:scale-[0.97] disabled:opacity-50"
                  style={{ background: "#DC2626", boxShadow: "0 4px 12px rgba(220,38,38,0.2)" }}
                >
                  Ajouter
                  <span className="rounded-md bg-white/20 px-2 py-0.5 text-[13px] font-black">
                    {fmtPrice(
                      lineTotalCents({ unit: product.unit, quantity: qty }, price.unitPriceCents)
                    )}
                  </span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
