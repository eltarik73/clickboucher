"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Package, Scale, Plus, Edit3, Eye, EyeOff, Flame, ChevronDown, ChevronUp, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { TogglePill } from "@/components/ui/toggle-pill";
import { formatPrice, formatWeight, UNSPLASH } from "@/lib/utils";

// ── Mock Data ────────────────────────────────

interface Product {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  category: string;
  unit: "KG" | "PIECE" | "BARQUETTE";
  priceCents: number;
  proPriceCents: number | null;
  isInStock: boolean;
  stockQty: number | null;
}

const INITIAL_PRODUCTS: Product[] = [
  { id: "p1", name: "Entrecôte", description: "Maturée 21 jours", imageUrl: UNSPLASH.products[0], category: "Bœuf", unit: "KG", priceCents: 3200, proPriceCents: 2600, isInStock: true, stockQty: null },
  { id: "p2", name: "Côte de bœuf", description: "Race Salers, maturée 30j", imageUrl: UNSPLASH.products[1], category: "Bœuf", unit: "KG", priceCents: 3800, proPriceCents: 3100, isInStock: true, stockQty: null },
  { id: "p3", name: "Filet mignon porc", description: "Fermier", imageUrl: UNSPLASH.products[2], category: "Porc", unit: "KG", priceCents: 1890, proPriceCents: 1550, isInStock: true, stockQty: null },
  { id: "p4", name: "Merguez maison", description: "Barquette de 6", imageUrl: UNSPLASH.products[3], category: "Charcuterie", unit: "BARQUETTE", priceCents: 890, proPriceCents: 690, isInStock: true, stockQty: 20 },
  { id: "p5", name: "Saucisses Toulouse", description: "Pur porc", imageUrl: UNSPLASH.products[4], category: "Charcuterie", unit: "BARQUETTE", priceCents: 790, proPriceCents: 620, isInStock: true, stockQty: 15 },
  { id: "p6", name: "Poulet fermier", description: "Label Rouge", imageUrl: UNSPLASH.products[5], category: "Volaille", unit: "PIECE", priceCents: 1490, proPriceCents: 1200, isInStock: true, stockQty: 8 },
  { id: "p7", name: "Rôti de veau", description: "Ficelé main", imageUrl: UNSPLASH.products[6], category: "Veau", unit: "KG", priceCents: 2800, proPriceCents: 2300, isInStock: true, stockQty: null },
  { id: "p8", name: "Gigot d'agneau", description: "Agneau des Alpes", imageUrl: UNSPLASH.products[7], category: "Agneau", unit: "KG", priceCents: 2600, proPriceCents: 2100, isInStock: false, stockQty: null },
];

const INITIAL_OFFERS = [
  { id: "off1", productId: "p1", name: "Entrecôte maturée 21j", originalCents: 3200, discountCents: 2200, quantity: 5, remainingQty: 3, expiresAt: new Date(Date.now() + 2 * 3600_000), isSponsored: true },
];

type Tab = "products" | "offers";

export default function BoucherCataloguePage() {
  const [tab, setTab] = useState<Tab>("products");
  const [products, setProducts] = useState(INITIAL_PRODUCTS);
  const [offers, setOffers] = useState(INITIAL_OFFERS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editStock, setEditStock] = useState("");

  const categories = Array.from(new Set(products.map((p) => p.category)));
  const inStockCount = products.filter((p) => p.isInStock).length;
  const outOfStockCount = products.length - inStockCount;

  const toggleStock = (id: string) => {
    setProducts(products.map((p) => p.id === id ? { ...p, isInStock: !p.isInStock } : p));
  };

  const startEdit = (product: Product) => {
    setEditingId(product.id);
    setEditPrice(String(product.priceCents / 100));
    setEditStock(product.stockQty !== null ? String(product.stockQty) : "");
  };

  const saveEdit = (id: string) => {
    setProducts(products.map((p) => {
      if (p.id !== id) return p;
      return {
        ...p,
        priceCents: Math.round(parseFloat(editPrice) * 100),
        stockQty: editStock ? parseInt(editStock) : p.stockQty,
      };
    }));
    setEditingId(null);
  };

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Stats */}
      <div className="flex gap-2">
        <div className="flex-1 p-3 rounded-2xl bg-green-50 dark:bg-green-950/30 border border-green-200 text-center">
          <p className="text-2xl font-display font-bold text-green-700">{inStockCount}</p>
          <p className="text-xs text-green-600">En stock</p>
        </div>
        <div className="flex-1 p-3 rounded-2xl bg-gray-50 dark:bg-gray-900/30 border border-gray-200 text-center">
          <p className="text-2xl font-display font-bold text-gray-500">{outOfStockCount}</p>
          <p className="text-xs text-gray-500">Épuisés</p>
        </div>
        <div className="flex-1 p-3 rounded-2xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200 text-center">
          <p className="text-2xl font-display font-bold text-orange-700">{offers.length}</p>
          <p className="text-xs text-orange-600">Offres DM</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <TogglePill active={tab === "products"} onClick={() => setTab("products")} label={`Produits (${products.length})`} />
        <TogglePill active={tab === "offers"} onClick={() => setTab("offers")} label={`Dernière minute (${offers.length})`} icon={<Flame size={13} />} />
      </div>

      {/* Products Tab */}
      {tab === "products" && (
        <div className="space-y-5">
          {categories.map((cat) => (
            <div key={cat}>
              <h3 className="font-display font-semibold text-sm mb-2 text-muted-foreground uppercase tracking-wider">{cat}</h3>
              <div className="space-y-2">
                {products.filter((p) => p.category === cat).map((product) => {
                  const isEditing = editingId === product.id;

                  return (
                    <div key={product.id} className={`premium-card p-3 ${!product.isInStock ? "opacity-60" : ""}`}>
                      <div className="flex gap-3">
                        <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                          <Image src={product.imageUrl} alt={product.name} fill className="object-cover" sizes="56px" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-sm truncate">{product.name}</h4>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => isEditing ? saveEdit(product.id) : startEdit(product)}
                                className="p-1.5 rounded-lg hover:bg-muted"
                              >
                                {isEditing ? <Check size={14} className="text-green-600" /> : <Edit3 size={13} />}
                              </button>
                              <button
                                onClick={() => toggleStock(product.id)}
                                className={`p-1.5 rounded-lg hover:bg-muted ${product.isInStock ? "text-green-600" : "text-gray-400"}`}
                              >
                                {product.isInStock ? <Eye size={14} /> : <EyeOff size={14} />}
                              </button>
                            </div>
                          </div>

                          {isEditing ? (
                            <div className="flex gap-2 mt-1">
                              <div className="flex-1">
                                <label className="text-[10px] text-muted-foreground">Prix (€)</label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={editPrice}
                                  onChange={(e) => setEditPrice(e.target.value)}
                                  className="h-8 text-sm"
                                />
                              </div>
                              {product.stockQty !== null && (
                                <div className="w-20">
                                  <label className="text-[10px] text-muted-foreground">Stock</label>
                                  <Input
                                    type="number"
                                    value={editStock}
                                    onChange={(e) => setEditStock(e.target.value)}
                                    className="h-8 text-sm"
                                  />
                                </div>
                              )}
                              <Button variant="outline" size="sm" className="h-8 mt-auto" onClick={() => setEditingId(null)}>
                                <X size={12} />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-sm font-bold">{formatPrice(product.priceCents)}{product.unit === "KG" ? "/kg" : ""}</span>
                              {product.proPriceCents && (
                                <Badge variant="outline" className="text-[10px]">PRO: {formatPrice(product.proPriceCents)}</Badge>
                              )}
                              {product.unit === "KG" && <Badge variant="outline" className="text-[10px]"><Scale size={9} className="mr-0.5" />Poids</Badge>}
                              {product.stockQty !== null && (
                                <Badge variant={product.stockQty < 5 ? "warning" : "secondary"} className="text-[10px]">
                                  Stock: {product.stockQty}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Offers Tab */}
      {tab === "offers" && (
        <div className="space-y-3">
          {offers.map((offer) => {
            const discount = Math.round(((offer.originalCents - offer.discountCents) / offer.originalCents) * 100);
            const hoursLeft = Math.max(0, Math.round((offer.expiresAt.getTime() - Date.now()) / 3600_000 * 10) / 10);

            return (
              <div key={offer.id} className="premium-card p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm">{offer.name}</h4>
                  <div className="flex items-center gap-1.5">
                    {offer.isSponsored && <Badge variant="sponsored" className="text-[10px]">Sponsorisé</Badge>}
                    <Badge variant="destructive" className="text-xs">-{discount}%</Badge>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-primary">{formatPrice(offer.discountCents)}</span>
                    <span className="text-muted-foreground line-through text-xs">{formatPrice(offer.originalCents)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{offer.remainingQty}/{offer.quantity} restants</span>
                    <span>{hoursLeft}h restantes</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 h-8 text-xs">Modifier</Button>
                  <Button variant="destructive" size="sm" className="h-8 text-xs">Terminer</Button>
                </div>
              </div>
            );
          })}

          <Button variant="outline" className="w-full gap-1">
            <Plus size={16} />
            Créer une offre dernière minute
          </Button>
        </div>
      )}
    </div>
  );
}
