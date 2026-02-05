"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, Btn, StickyHeader, BackBtn } from "@/components/ui/shared";
import type { CartItem } from "@/types";

const SLOTS = ["15:00", "15:30", "16:00", "16:30", "17:00"];

export default function CheckoutPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [slot, setSlot] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem("cb_cart");
    if (raw) setCart(JSON.parse(raw));
  }, []);

  const total = cart.reduce((s, c) => s + c.publicPrice * c.qty, 0);

  // Confirmation screen
  if (step === 3) {
    return (
      <div className="min-h-screen bg-stone-50 grid place-items-center">
        <div className="animate-scale-in text-center px-10">
          <div className="w-[76px] h-[76px] rounded-full bg-green-50 grid place-items-center mx-auto text-[34px]">
            ✓
          </div>
          <h2 className="font-display text-xl font-bold mt-5">Commande confirmée !</h2>
          <p className="text-sm text-stone-500 mt-2">Retrait prévu à {slot}</p>
          <p className="text-xs text-stone-500 mt-1">
            Tu recevras une notification quand ta commande sera prête.
          </p>
          <Btn
            className="mt-6"
            onClick={() => {
              localStorage.removeItem("cb_cart");
              window.dispatchEvent(new Event("cart-updated"));
              router.push("/decouvrir");
            }}
          >
            Retour à l&apos;accueil
          </Btn>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <StickyHeader>
        <BackBtn onClick={() => router.push("/panier")} />
        <p className="font-display text-[17px] font-bold flex-1">Checkout</p>
        <div className="flex gap-1.5">
          {[1, 2].map((s) => (
            <div
              key={s}
              className={`w-2 h-2 rounded-full ${
                step >= s ? "bg-[#7A1023]" : "bg-stone-200"
              }`}
            />
          ))}
        </div>
      </StickyHeader>

      <main className="mx-auto max-w-[480px] px-5 py-7">
        {/* Step 1: Slot */}
        {step === 1 && (
          <div className="animate-fade-up">
            <h2 className="font-display text-xl font-bold">Créneau de retrait</h2>
            <p className="text-sm text-stone-500 mt-1.5">
              Quand veux-tu récupérer ta commande ?
            </p>
            <div className="mt-5 grid grid-cols-3 gap-2.5">
              {SLOTS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSlot(s)}
                  className={`p-3.5 rounded-[14px] text-sm font-semibold transition-all ${
                    slot === s
                      ? "border-2 border-[#7A1023] bg-[#FDF2F4] text-[#7A1023]"
                      : "border border-stone-200 bg-white text-stone-900 hover:bg-stone-50"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <Btn
              size="lg"
              className="w-full mt-6"
              onClick={() => setStep(2)}
              disabled={!slot}
            >
              Continuer
            </Btn>
          </div>
        )}

        {/* Step 2: Payment mock */}
        {step === 2 && (
          <div className="animate-fade-up">
            <h2 className="font-display text-xl font-bold">Paiement</h2>
            <p className="text-sm text-stone-500 mt-1.5">Paiement sécurisé (simulation)</p>

            <Card className="mt-5 p-5">
              <div>
                <label className="text-[11px] font-semibold text-stone-500">Numéro de carte</label>
                <div className="mt-1.5 px-3.5 py-3 rounded-[10px] border border-stone-200 text-sm text-stone-400">
                  4242 •••• •••• 4242
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5 mt-3.5">
                <div>
                  <label className="text-[11px] font-semibold text-stone-500">Expiration</label>
                  <div className="mt-1.5 px-3.5 py-3 rounded-[10px] border border-stone-200 text-sm text-stone-400">
                    12/26
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-stone-500">CVC</label>
                  <div className="mt-1.5 px-3.5 py-3 rounded-[10px] border border-stone-200 text-sm text-stone-400">
                    •••
                  </div>
                </div>
              </div>
            </Card>

            <div className="mt-5 p-4 rounded-[14px] bg-stone-100 flex justify-between">
              <span className="text-sm text-stone-500">Total</span>
              <span className="text-[17px] font-extrabold">{total.toFixed(2)} €</span>
            </div>

            <Btn size="lg" className="w-full mt-5" onClick={() => setStep(3)}>
              Payer {total.toFixed(2)} €
            </Btn>
          </div>
        )}
      </main>
    </div>
  );
}
