// src/components/shop/ShopProductsClient.tsx — V2 bis shop products page
"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { useCart, type CartItem } from "@/lib/hooks/use-cart";
import {
  WeightSheet,
  type WeightSelection,
  type WeightSheetProduct,
} from "@/components/product/WeightSheet";
import {
  TrancheSheet,
  type TrancheSheetProduct,
  type ThicknessKey,
} from "@/components/product/TrancheSheet";
import { ProductGrid } from "@/components/product/ProductGrid";
import { useMountedNow, type ProductCardData } from "@/components/product/ProductCard";
import { ProductSheet, type ProductSheetSelection } from "@/components/product/ProductSheet";
import { resolveProductImage } from "@/lib/product-images";
import { cartLineId } from "@/lib/cart/cart-line";
import { displayedProductPromo } from "@/lib/pricing/display";
import { checkLineQuantity } from "@/lib/pricing/line";
import { formatGrams } from "@/lib/pricing/format";
import { resolveUnitPrice, type ProductPricing } from "@/lib/pricing/unit-price";
import { limitedStockSoldOut } from "@/lib/pricing/limited-stock";

// ── Types ────────────────────────────────────────

export interface CategoryData {
  id: string;
  name: string;
  emoji: string | null;
}

export interface ProductData {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  priceCents: number;
  proPriceCents?: number | null;
  unit: string;
  inStock: boolean;
  tags: string[];
  origin: string;
  halalOrg: string | null;
  race: string | null;
  freshness: string;
  popular: boolean;
  promoPct: number | null;
  promoEnd: string | null;
  promoType: string | null;
  customerNote: string | null;
  originRegion: string | null;
  raceDescription: string | null;
  elevageMode: string | null;
  elevageDetail: string | null;
  halalMethod: string | null;
  freshDate: string | null;
  freshDetail: string | null;
  minWeightG: number;
  weightStepG: number;
  maxWeightG: number;
  sliceOptions?: {
    defaultSlices: number;
    minSlices: number;
    maxSlices: number;
    thicknesses: string[];
  } | null;
  variants: string[];
  weightPerPiece: number | null;
  pieceLabel: string | null;
  weightMargin: number;
  cutOptions: Array<{ name: string; priceCents: number }> | null;
  promoFixedCents: number | null;
  packContent: string | null;
  packWeight: string | null;
  packOldPriceCents: number | null;
  isAntiGaspi: boolean;
  antiGaspiOrigPriceCents: number | null;
  antiGaspiStock: number | null;
  antiGaspiEndAt: string | null;
  antiGaspiReason: string | null;
  /** Flash-sale mode and its stock: a flash product at 0 is shown sold out. */
  isFlashSale?: boolean;
  flashSaleStock?: number | null;
  categories: CategoryData[];
  images: { id: string; url: string; alt: string | null; order: number; isPrimary: boolean }[];
  labels: { id: string; name: string; color: string | null }[];
}

export interface ShopInfo {
  id: string;
  name: string;
  slug: string;
}

// ── Helpers ──────────────────────────────────────

function fmtPrice(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

/** Public unit price of a product now, for a line being added. null for an unknown cut option. */
function unitPriceNow(product: ProductPricing, cutOption?: string): number | null {
  const price = resolveUnitPrice(product, { isPro: false, cutOption, now: new Date() });
  return price.ok ? price.unitPriceCents : null;
}

// ── Main Client Component ────────────────────────

interface Props {
  products: ProductData[];
  categories: CategoryData[];
  shop: ShopInfo;
  proStatus?: { isPro: boolean; status?: string; companyName?: string };
}

export function ShopProductsClient({ products, categories, shop, proStatus: _proStatus }: Props) {
  const [activeCat, setActiveCat] = useState<string>("Tout");
  const [selectedProduct, setSelectedProduct] = useState<WeightSheetProduct | null>(null);
  const [selectedTrancheProduct, setSelectedTrancheProduct] = useState<TrancheSheetProduct | null>(
    null
  );
  const [detailProduct, setDetailProduct] = useState<ProductCardData | null>(null);
  const { addItem, updateQty, itemCount, totalCents, state } = useCart();
  const now = useMountedNow();

  const shopRef = useMemo(
    () => ({ id: shop.id, name: shop.name, slug: shop.slug }),
    [shop.id, shop.name, shop.slug]
  );
  const cartCount = state.shopId === shop.id ? itemCount : 0;

  const filtered = useMemo(
    () =>
      activeCat === "Tout"
        ? products
        : products.filter((p) => p.categories.some((c) => c.id === activeCat)),
    [activeCat, products]
  );

  // Map ProductData to ProductCardData
  const cardProducts: ProductCardData[] = useMemo(
    () =>
      filtered.map((p) => ({
        id: p.id,
        shopId: shop.id,
        name: p.name,
        description: p.description,
        imageUrl: p.imageUrl,
        priceCents: p.priceCents,
        unit: p.unit as "KG" | "PIECE" | "BARQUETTE" | "TRANCHE",
        inStock: p.inStock,
        tags: p.tags,
        origin: p.origin,
        halalOrg: p.halalOrg,
        race: p.race,
        popular: p.popular,
        promoPct: p.promoPct,
        promoEnd: p.promoEnd,
        promoType: p.promoType,
        freshness: p.freshness,
        customerNote: p.customerNote,
        variants: p.variants,
        weightPerPiece: p.weightPerPiece,
        pieceLabel: p.pieceLabel,
        weightMargin: p.weightMargin,
        minWeightG: p.minWeightG,
        cutOptions: p.cutOptions,
        promoFixedCents: p.promoFixedCents,
        packContent: p.packContent,
        packWeight: p.packWeight,
        packOldPriceCents: p.packOldPriceCents,
        originRegion: p.originRegion,
        raceDescription: p.raceDescription,
        elevageMode: p.elevageMode,
        elevageDetail: p.elevageDetail,
        halalMethod: p.halalMethod,
        freshDate: p.freshDate,
        freshDetail: p.freshDetail,
        isAntiGaspi: p.isAntiGaspi ?? false,
        antiGaspiOrigPriceCents: p.antiGaspiOrigPriceCents ?? null,
        antiGaspiStock: p.antiGaspiStock ?? null,
        antiGaspiReason: p.antiGaspiReason ?? null,
        isFlashSale: p.isFlashSale ?? false,
        flashSaleStock: p.flashSaleStock ?? null,
        category: p.categories[0],
        images: p.images,
        labels: p.labels,
      })),
    [filtered, shop.id]
  );

  // Separate promo products from non-promo
  const isPromo = useCallback(
    (p: ProductCardData) =>
      p.inStock && !limitedStockSoldOut(p) && displayedProductPromo(p, now) !== null,
    [now]
  );

  const promoProducts = useMemo(() => cardProducts.filter(isPromo), [cardProducts, isPromo]);

  const nonPromoProducts = useMemo(
    () => (activeCat === "Tout" ? cardProducts.filter((p) => !isPromo(p)) : cardProducts),
    [cardProducts, activeCat, isPromo]
  );

  /** Resolve the best image for a product — same logic as ProductCard */
  const getProductImage = useCallback((p: ProductCardData) => {
    return p.images?.length > 0
      ? p.images[0].url
      : resolveProductImage({ name: p.name, imageUrl: p.imageUrl, category: p.category.name });
  }, []);

  /** Adds a counted product (PIECE, BARQUETTE) at its current public price. */
  const addCounted = useCallback(
    (p: ProductCardData, selection: ProductSheetSelection) => {
      if (p.unit !== "PIECE" && p.unit !== "BARQUETTE") return;
      const priceCents = unitPriceNow(p);
      if (priceCents === null) return;
      const line = { productId: p.id, unit: p.unit, variant: selection.variant };
      addItem(
        {
          ...line,
          id: cartLineId(line),
          name: p.name,
          imageUrl: getProductImage(p),
          priceCents,
          quantity: selection.quantity,
          category: p.category.name,
        },
        shopRef
      );
      const label = selection.variant ? `${p.name} (${selection.variant})` : p.name;
      toast.success(`${label} ajouté au panier`, {
        icon: <ShoppingBag size={14} />,
        duration: 1500,
      });
      navigator.vibrate?.(50);
    },
    [addItem, shopRef, getProductImage]
  );

  const handleAdd = useCallback(
    (p: ProductCardData) => {
      if (!p.inStock || limitedStockSoldOut(p)) return;
      const original = products.find((prod) => prod.id === p.id);
      if (p.unit === "KG") {
        setSelectedProduct({
          id: p.id,
          name: p.name,
          description: p.description || "",
          imageUrl: getProductImage(p),
          category: p.category.name,
          unit: p.unit,
          priceCents: p.priceCents,
          promoPct: p.promoPct,
          promoType: p.promoType,
          promoEnd: p.promoEnd,
          promoFixedCents: p.promoFixedCents,
          pricedAt: new Date(),
          minWeightG: original?.minWeightG,
          weightStepG: original?.weightStepG,
          maxWeightG: original?.maxWeightG,
          origin: p.origin,
          halalOrg: p.halalOrg,
          race: p.race,
          freshness: p.freshness,
          originRegion: p.originRegion,
          raceDescription: p.raceDescription,
          elevageMode: p.elevageMode,
          elevageDetail: p.elevageDetail,
          halalMethod: p.halalMethod,
          freshDate: p.freshDate,
          freshDetail: p.freshDetail,
          variants: original?.variants,
          weightPerPiece: original?.weightPerPiece,
          pieceLabel: original?.pieceLabel,
          weightMargin: original?.weightMargin,
          cutOptions: original?.cutOptions,
        });
        return;
      }
      if (p.unit === "TRANCHE") {
        setSelectedTrancheProduct({
          id: p.id,
          name: p.name,
          description: p.description || "",
          imageUrl: getProductImage(p),
          category: p.category.name,
          priceCents: p.priceCents,
          promoPct: p.promoPct,
          promoType: p.promoType,
          promoEnd: p.promoEnd,
          promoFixedCents: p.promoFixedCents,
          pricedAt: new Date(),
          origin: p.origin,
          halalOrg: p.halalOrg,
          race: p.race,
          freshness: p.freshness,
          originRegion: p.originRegion,
          raceDescription: p.raceDescription,
          elevageMode: p.elevageMode,
          elevageDetail: p.elevageDetail,
          halalMethod: p.halalMethod,
          freshDate: p.freshDate,
          freshDetail: p.freshDetail,
          sliceOptions: (original?.sliceOptions as TrancheSheetProduct["sliceOptions"]) ?? null,
        });
        return;
      }
      // If product has variants, open detail sheet for variant selection
      if (original?.variants && original.variants.length > 0) {
        setDetailProduct(p);
        return;
      }
      addCounted(p, { quantity: 1 });
    },
    [addCounted, products, getProductImage]
  );

  const addWeighed = useCallback(
    (item: CartItem, label: string) => {
      if (checkLineQuantity(item) !== null) {
        toast.error("Cette quantité ne peut pas être commandée en ligne");
        return;
      }
      addItem(item, shopRef);
      toast.success(`${label} ajouté`, { icon: <ShoppingBag size={14} />, duration: 1500 });
      navigator.vibrate?.(50);
    },
    [addItem, shopRef]
  );

  const handleWeightConfirm = useCallback(
    (weightG: number, selection: WeightSelection) => {
      if (!selectedProduct) return;
      const priceCents = unitPriceNow(selectedProduct, selection.cutOption);
      if (priceCents === null) {
        toast.error("Cette découpe n'est plus proposée");
        return;
      }
      const line = {
        productId: selectedProduct.id,
        unit: "KG" as const,
        weightGrams: weightG,
        variant: selection.variant,
        cutOption: selection.cutOption,
        pieceCount: selection.pieceCount,
      };
      const details = [selection.variant, formatGrams(weightG)].filter(Boolean).join(", ");
      addWeighed(
        {
          ...line,
          id: cartLineId(line),
          name: selectedProduct.name,
          imageUrl: selectedProduct.imageUrl,
          priceCents,
          quantity: 1,
          category: selectedProduct.category,
          pieceLabel: selection.pieceLabel,
        },
        `${selectedProduct.name} (${details})`
      );
      setSelectedProduct(null);
    },
    [selectedProduct, addWeighed]
  );

  const handleTrancheConfirm = useCallback(
    (sliceCount: number, thickness: ThicknessKey, estimatedWeightG: number) => {
      if (!selectedTrancheProduct) return;
      const priceCents = unitPriceNow(selectedTrancheProduct);
      if (priceCents === null) return;
      const line = {
        productId: selectedTrancheProduct.id,
        unit: "TRANCHE" as const,
        weightGrams: estimatedWeightG,
        thickness,
        sliceCount,
      };
      addWeighed(
        {
          ...line,
          id: cartLineId(line),
          name: selectedTrancheProduct.name,
          imageUrl: selectedTrancheProduct.imageUrl,
          priceCents,
          quantity: 1,
          category: selectedTrancheProduct.category,
        },
        `${selectedTrancheProduct.name} (${sliceCount} tranches)`
      );
      setSelectedTrancheProduct(null);
    },
    [selectedTrancheProduct, addWeighed]
  );

  // Cart items for this shop (for inline stepper)
  const cartItems = useMemo(
    () =>
      state.shopId === shop.id ? state.items.map((i) => ({ id: i.id, quantity: i.quantity })) : [],
    [state.shopId, state.items, shop.id]
  );

  const handleIncrement = useCallback(
    (productId: string) => {
      const item = state.items.find((i) => i.id === productId);
      if (item) updateQty(productId, item.quantity + 1);
    },
    [state.items, updateQty]
  );

  const handleDecrement = useCallback(
    (productId: string) => {
      const item = state.items.find((i) => i.id === productId);
      if (item) updateQty(productId, item.quantity - 1);
    },
    [state.items, updateQty]
  );

  return (
    <>
      {/* ── Sticky category pills ── */}
      <div className="sticky top-0 z-20 border-b border-gray-200/50 bg-[#f8f6f3]/95 backdrop-blur-xl dark:border-white/[0.06] dark:bg-[#0a0a0a]/95">
        <div className="flex gap-2 overflow-x-auto px-4 py-2.5" style={{ scrollbarWidth: "none" }}>
          <button
            onClick={() => setActiveCat("Tout")}
            className={`min-h-[36px] shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition-all ${
              activeCat === "Tout"
                ? "border border-[#DC2626] bg-[#DC2626] text-white"
                : "border border-gray-200 text-gray-500 dark:border-white/10 dark:text-gray-400"
            }`}
          >
            Tout
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCat(c.id)}
              className={`min-h-[36px] shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                activeCat === c.id
                  ? "border border-[#DC2626] bg-[#DC2626] text-white"
                  : "border border-gray-200 text-gray-500 dark:border-white/10 dark:text-gray-400"
              }`}
            >
              {c.emoji ? `${c.emoji} ` : ""}
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* ── Promo section ── */}
      {activeCat === "Tout" && promoProducts.length > 0 && (
        <div className="mb-1 px-3 pt-2">
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-[#DC2626]">Promos</p>
          <ProductGrid
            products={promoProducts}
            onAdd={handleAdd}
            onTap={setDetailProduct}
            cartItems={cartItems}
            onIncrement={handleIncrement}
            onDecrement={handleDecrement}
          />
        </div>
      )}

      {/* ── Product grid ── */}
      <ProductGrid
        products={nonPromoProducts}
        onAdd={handleAdd}
        onTap={setDetailProduct}
        cartItems={cartItems}
        onIncrement={handleIncrement}
        onDecrement={handleDecrement}
      />

      {/* ── Bottom cart bar — sticky, glassmorphism, slide-up entrance ── */}
      {cartCount > 0 && (
        <div
          className="fixed inset-x-0 bottom-16 z-50 animate-[slideUp_0.3s_ease-out] border-t border-gray-200/50 dark:border-white/[0.08] md:bottom-0"
          style={{
            background: "rgba(20,20,20,0.95)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            padding: "10px 16px",
            paddingBottom: "calc(10px + env(safe-area-inset-bottom, 0px))",
          }}
        >
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            {/* Left: badge + "Panier" + total */}
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#DC2626] text-xs font-bold text-white">
                {cartCount}
              </span>
              <span className="text-sm font-semibold text-white">Panier</span>
              <span className="text-sm font-bold text-[#DC2626]">{fmtPrice(totalCents)}</span>
            </div>

            {/* Right: "Commander →" button */}
            <Link
              href="/panier"
              className="flex items-center gap-1.5 rounded-xl bg-[#DC2626] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#b91c1c]"
            >
              Commander <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      )}

      {/* ── WeightSheet ── */}
      <WeightSheet
        product={selectedProduct}
        onConfirm={handleWeightConfirm}
        onClose={() => setSelectedProduct(null)}
      />

      {/* ── TrancheSheet ── */}
      <TrancheSheet
        product={selectedTrancheProduct}
        onConfirm={handleTrancheConfirm}
        onClose={() => setSelectedTrancheProduct(null)}
      />

      {/* ── Product detail bottom sheet ── */}
      <ProductSheet
        product={detailProduct}
        onAdd={(selection) => {
          if (!detailProduct) return;
          if (detailProduct.unit === "PIECE" || detailProduct.unit === "BARQUETTE") {
            addCounted(detailProduct, selection);
            return;
          }
          // KG and TRANCHE open their weight or slice sheet
          handleAdd(detailProduct);
        }}
        onClose={() => setDetailProduct(null)}
      />
    </>
  );
}
