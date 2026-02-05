"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Phone, CreditCard, Banknote, Shield, Check, Loader2 } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { useCart } from "@/lib/hooks/use-cart";
import { formatPrice } from "@/lib/utils";

type Step = "phone" | "otp" | "payment" | "confirming" | "done";

export default function CheckoutPage() {
  const router = useRouter();
  const { state, totalCents, itemCount, clear } = useCart();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CB_ONLINE");
  const [acceptedRules, setAcceptedRules] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const hasWeightItems = state.items.some((i) => i.unit === "KG");
  const maxTotal = Math.round(totalCents * 1.1);

  const handleSendOtp = () => {
    if (phone.length >= 10) setStep("otp");
  };

  const handleVerifyOtp = () => {
    if (otp.length >= 4) setStep("payment");
  };

  const handleConfirm = async () => {
    if (hasWeightItems && !acceptedRules) return;
    setStep("confirming");
    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 2000));
    setIsLoading(false);
    setStep("done");
    setTimeout(() => {
      clear();
      router.push("/suivi/order-demo");
    }, 1500);
  };

  return (
    <PageContainer>
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-zinc-100">
        <div className="flex items-center gap-3 h-14 px-4">
          <button onClick={() => step === "phone" ? router.back() : setStep(step === "otp" ? "phone" : step === "payment" ? "otp" : "payment")} className="flex items-center justify-center w-9 h-9 rounded-full bg-zinc-100 tap-scale">
            <ArrowLeft size={17} />
          </button>
          <h1 className="text-base font-bold">Paiement</h1>
          <div className="ml-auto flex gap-1.5">
            {["phone", "otp", "payment"].map((s, i) => (
              <div key={s} className={`w-8 h-1 rounded-full transition-colors ${["phone", "otp", "payment"].indexOf(step) >= i ? "bg-primary" : "bg-zinc-200"}`} />
            ))}
          </div>
        </div>
      </header>

      <div className="px-4 py-6 space-y-6 max-w-md mx-auto">
        {/* Step: Phone */}
        {step === "phone" && (
          <div className="animate-fade-in-up space-y-5">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-zinc-100 flex items-center justify-center mx-auto mb-3">
                <Phone size={24} className="text-zinc-600" />
              </div>
              <h2 className="text-lg font-bold">Votre numéro</h2>
              <p className="text-[13px] text-zinc-500 mt-1">Pour vous notifier quand c&apos;est prêt.</p>
            </div>
            <input
              type="tel"
              placeholder="06 12 34 56 78"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full h-12 px-4 rounded-2xl bg-zinc-100 text-center text-lg font-semibold tracking-wider placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button onClick={handleSendOtp} disabled={phone.length < 10} className="w-full py-3.5 rounded-full bg-primary text-white text-[13px] font-semibold disabled:opacity-40 transition-opacity tap-scale">
              Continuer sans compte
            </button>
            <p className="text-[11px] text-zinc-400 text-center">Un code de vérification sera envoyé par SMS.</p>
          </div>
        )}

        {/* Step: OTP */}
        {step === "otp" && (
          <div className="animate-fade-in-up space-y-5">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-zinc-100 flex items-center justify-center mx-auto mb-3">
                <Shield size={24} className="text-zinc-600" />
              </div>
              <h2 className="text-lg font-bold">Vérification</h2>
              <p className="text-[13px] text-zinc-500 mt-1">Code envoyé au {phone}</p>
            </div>
            <input
              type="text"
              inputMode="numeric"
              placeholder="• • • •"
              maxLength={4}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              className="w-full h-14 px-4 rounded-2xl bg-zinc-100 text-center text-2xl font-bold tracking-[0.5em] placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button onClick={handleVerifyOtp} disabled={otp.length < 4} className="w-full py-3.5 rounded-full bg-primary text-white text-[13px] font-semibold disabled:opacity-40 transition-opacity tap-scale">
              Vérifier
            </button>
            <button onClick={() => setStep("phone")} className="w-full text-[12px] text-zinc-400 text-center">Modifier le numéro</button>
          </div>
        )}

        {/* Step: Payment */}
        {step === "payment" && (
          <div className="animate-fade-in-up space-y-5">
            <h2 className="text-lg font-bold">Récapitulatif</h2>

            {/* Items recap */}
            <div className="rounded-2xl bg-zinc-50 border border-zinc-100 p-3 space-y-2">
              {state.items.map((item) => (
                <div key={item.id} className="flex justify-between text-[12px]">
                  <span className="text-zinc-600">{item.name} × {item.quantity}</span>
                  <span className="font-semibold">{formatPrice(item.priceCents * item.quantity)}</span>
                </div>
              ))}
              <div className="border-t border-zinc-200 pt-2 flex justify-between">
                <span className="text-[13px] font-bold">Total estimé</span>
                <span className="text-[13px] font-extrabold">{formatPrice(totalCents)}</span>
              </div>
              {hasWeightItems && (
                <div className="flex justify-between text-[11px] text-zinc-400">
                  <span>Plafond (+10%)</span>
                  <span>{formatPrice(maxTotal)}</span>
                </div>
              )}
            </div>

            {/* Payment methods */}
            <div className="space-y-2">
              <h3 className="text-[13px] font-bold">Mode de paiement</h3>
              {[
                { id: "CB_ONLINE", label: "Payer en CB (recommandé)", icon: CreditCard, sub: "Paiement sécurisé" },
                { id: "CASH", label: "Payer en boutique", icon: Banknote, sub: "Espèces ou CB sur place" },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setPaymentMethod(m.id)}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border transition-all tap-scale ${paymentMethod === m.id ? "border-primary bg-primary/4" : "border-zinc-200 bg-white"}`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${paymentMethod === m.id ? "bg-primary/10" : "bg-zinc-100"}`}>
                    <m.icon size={17} className={paymentMethod === m.id ? "text-primary" : "text-zinc-500"} />
                  </div>
                  <div className="text-left flex-1">
                    <span className="text-[13px] font-semibold block">{m.label}</span>
                    <span className="text-[11px] text-zinc-400">{m.sub}</span>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === m.id ? "border-primary" : "border-zinc-300"}`}>
                    {paymentMethod === m.id && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                  </div>
                </button>
              ))}
            </div>

            {/* Weight rules checkbox */}
            {hasWeightItems && (
              <label className="flex items-start gap-3 p-3 rounded-2xl bg-amber-50 border border-amber-200/50 cursor-pointer">
                <input type="checkbox" checked={acceptedRules} onChange={(e) => setAcceptedRules(e.target.checked)} className="mt-0.5 accent-primary w-4 h-4" />
                <span className="text-[11px] text-amber-700 leading-relaxed">
                  J&apos;accepte la règle ±10% sur les produits au poids et la validation obligatoire au-delà.
                </span>
              </label>
            )}

            <button
              onClick={handleConfirm}
              disabled={hasWeightItems && !acceptedRules}
              className="w-full py-3.5 rounded-full bg-primary text-white text-[13px] font-semibold disabled:opacity-40 transition-opacity tap-scale shadow-md shadow-primary/20"
            >
              {paymentMethod === "CB_ONLINE" ? "Payer & confirmer" : "Confirmer (paiement en boutique)"}
            </button>
          </div>
        )}

        {/* Step: Confirming */}
        {step === "confirming" && (
          <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
            <Loader2 size={40} className="text-primary animate-spin mb-4" />
            <p className="text-sm text-zinc-500">Confirmation en cours…</p>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <div className="flex flex-col items-center justify-center py-20 animate-scale-in text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <Check size={32} className="text-green-600" />
            </div>
            <h2 className="text-xl font-bold mb-1">Commande confirmée !</h2>
            <p className="text-sm text-zinc-500">Redirection vers le suivi…</p>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
