"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Card, Btn, StickyHeader, BackBtn, Badge, EmptyState } from "@/components/ui/shared";
import type { CartItem } from "@/types";

export default function PanierPage() {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);

  // Load cart from localStorage
  useEffect(() => {
    const raw = localStorage.getItem("cb_cart");
    if (raw) setCart(JSON.parse(raw));

    const handler = () => {
      const updated = localStorage.getItem("cb_cart");
      if (updated) setCart(JSON.parse(updated));
    };
    window.addEventListener("cart-updated", handler);
    return () => window.removeEventListener("cart-updated", handler);
  }, []);

  // Persist cart changes
  const updateCart = (newCart: CartItem[]) => {
    setCart(newCart);
    localStorage.setItem("cb_cart", JSON.stringify(newCart));
  };

  const total = cart.reduce((s, c) => s + c.publicPrice * c.qty, 0);

  return (
    <div className="min-h-screen bg-stone-50">
      <StickyHeader>
        <BackBtn onClick={() => router.push("/decouvrir")} />
        <p className="font-display text-[17px] font-bold flex-1">Mon panier</p>
        {cart.length > 0 && <Badge>{cart.length} article{cart.length > 1 ? "s" : ""}</Badge>}
      </StickyHeader>

      <main className="mx-auto max-w-[560px] px-5 py-7">
        {cart.length === 0 ? (
          <EmptyState
            icon="🛒"
            title="Ton panier est vide"
            sub="Ajoute des produits depuis une boucherie."
            action={
              <Btn className="mt-4" onClick={() => router.push("/decouvrir")}>
                Découvrir les boucheries
              </Btn>
            }
          />
        ) : (
          <>
            <div className="flex flex-col gap-2.5">
              {cart.map((item, i) => (
                <Card
                  key={item.id}
                  className="p-4 animate-fade-up"
                  style={{ animationDelay: `${i * 50}ms` } as React.CSSProperties}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-semibold">{item.name}</p>
                      <p className="text-xs text-stone-500 mt-0.5">
                        {item.publicPrice.toFixed(2)} € / {item.unit}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          if (item.qty <= 1)
                            updateCart(cart.filter((c) => c.id !== item.id));
                          else
                            updateCart(
                              cart.map((c) =>
                                c.id === item.id ? { ...c, qty: c.qty - 1 } : c
                              )
                            );
                        }}
                        className="w-[30px] h-[30px] rounded-full border border-stone-200 bg-white grid place-items-center text-[15px] hover:bg-stone-50 transition"
                      >
                        −
                      </button>
                      <span className="text-sm font-bold min-w-[18px] text-center">
                        {item.qty}
                      </span>
                      <button
                        onClick={() =>
                          updateCart(
                            cart.map((c) =>
                              c.id === item.id ? { ...c, qty: c.qty + 1 } : c
                            )
                          )
                        }
                        className="w-[30px] h-[30px] rounded-full border-none bg-[#7A1023] text-white grid place-items-center text-[15px] hover:bg-[#9B1B32] transition"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Total + CTA */}
            <div className="mt-6 p-5 rounded-[20px] bg-[#FDF2F4] border border-[#EDCCD2]">
              <div className="flex justify-between items-center">
                <span className="text-sm text-stone-500">Total estimé</span>
                <span className="font-display text-2xl font-extrabold text-[#7A1023]">
                  {total.toFixed(2)} €
                </span>
              </div>
              <p className="text-[11px] text-stone-400 mt-1.5">
                Le poids exact sera ajusté au retrait.
              </p>
              <Btn
                size="lg"
                className="w-full mt-4"
                onClick={() =>
                  isSignedIn
                    ? router.push("/checkout")
                    : router.push("/sign-in?redirect_url=/checkout")
                }
              >
                {isSignedIn ? "Valider la commande" : "Se connecter pour commander"}
              </Btn>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
