"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Phone, CreditCard, Banknote, Building2, Shield, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageContainer } from "@/components/layout/page-container";
import { useCart } from "@/lib/hooks/use-cart";
import { formatPrice } from "@/lib/utils";

type Step = "phone" | "otp" | "payment" | "confirming" | "done";

const PAYMENT_METHODS = [
  { id: "CB_ONLINE", label: "Carte bancaire en ligne", icon: CreditCard, description: "Paiement sécurisé immédiat" },
  { id: "CB_SHOP", label: "Carte bancaire au retrait", icon: CreditCard, description: "Payer à la boutique" },
  { id: "CASH", label: "Espèces au retrait", icon: Banknote, description: "Payer en liquide à la boutique" },
];

export default function CheckoutPage() {
  const router = useRouter();
  const { state, totalCents, itemCount, clear } = useCart();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CB_ONLINE");
  const [isLoading, setIsLoading] = useState(false);

  if (state.items.length === 0) {
    router.push("/panier");
    return null;
  }

  const handleSendOtp = () => {
    if (phone.length < 10) return;
    setIsLoading(true);
    // Mock OTP send
    setTimeout(() => {
      setIsLoading(false);
      setStep("otp");
    }, 800);
  };

  const handleVerifyOtp = () => {
    if (otp.length !== 6) return;
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setStep("payment");
    }, 600);
  };

  const handleConfirmOrder = () => {
    setStep("confirming");
    setTimeout(() => {
      setStep("done");
      // Don't clear cart yet — show confirmation first
    }, 1500);
  };

  const handleGoToTracking = () => {
    clear();
    router.push("/commandes");
  };

  return (
    <PageContainer padBottom={false}>
      <header className="sticky top-0 z-40 glass border-b border-border/60">
        <div className="flex items-center gap-3 h-14 px-4">
          <Link href="/panier" className="flex items-center justify-center w-10 h-10 rounded-full bg-muted hover:bg-muted/80 tap-scale">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="font-display text-subtitle">Commander</h1>
            <p className="text-xs text-muted-foreground">{state.shopName}</p>
          </div>
        </div>
      </header>

      <div className="px-4 py-6">
        {/* Progress Steps */}
        <div className="flex items-center gap-2 mb-8">
          {["Téléphone", "Vérification", "Paiement"].map((label, i) => {
            const stepIdx = ["phone", "otp", "payment"].indexOf(step);
            const isActive = i <= stepIdx || step === "confirming" || step === "done";
            return (
              <React.Fragment key={label}>
                <div className={`flex items-center gap-1.5 ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isActive ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    {i <= stepIdx - 1 || step === "done" ? <Check size={12} /> : i + 1}
                  </div>
                  <span className="text-xs font-medium hidden sm:inline">{label}</span>
                </div>
                {i < 2 && <div className={`flex-1 h-0.5 ${isActive && i < stepIdx ? "bg-primary" : "bg-muted"}`} />}
              </React.Fragment>
            );
          })}
        </div>

        {/* Step: Phone */}
        {step === "phone" && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Phone size={24} className="text-primary" />
              </div>
              <h2 className="font-display text-title">Votre numéro</h2>
              <p className="text-body text-muted-foreground">Nous vous enverrons un code de vérification par SMS.</p>
            </div>
            <div className="space-y-3">
              <Input
                type="tel"
                placeholder="06 12 34 56 78"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^0-9+]/g, ""))}
                className="text-center text-lg h-14"
                autoFocus
              />
              <Button className="w-full h-12" onClick={handleSendOtp} disabled={phone.length < 10 || isLoading}>
                {isLoading ? <Loader2 size={18} className="animate-spin" /> : "Envoyer le code"}
              </Button>
            </div>
          </div>
        )}

        {/* Step: OTP */}
        {step === "otp" && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Shield size={24} className="text-primary" />
              </div>
              <h2 className="font-display text-title">Vérification</h2>
              <p className="text-body text-muted-foreground">Entrez le code reçu au {phone}</p>
            </div>
            <div className="space-y-3">
              <Input
                type="text"
                inputMode="numeric"
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                className="text-center text-2xl tracking-[0.5em] h-14 font-mono"
                autoFocus
              />
              <Button className="w-full h-12" onClick={handleVerifyOtp} disabled={otp.length !== 6 || isLoading}>
                {isLoading ? <Loader2 size={18} className="animate-spin" /> : "Vérifier"}
              </Button>
              <button className="w-full text-sm text-muted-foreground hover:text-primary" onClick={() => setStep("phone")}>
                Changer de numéro
              </button>
            </div>
          </div>
        )}

        {/* Step: Payment */}
        {step === "payment" && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="font-display text-title">Mode de paiement</h2>
              <p className="text-body text-muted-foreground">Comment souhaitez-vous régler ?</p>
            </div>

            <div className="space-y-2.5">
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method.id}
                  onClick={() => setPaymentMethod(method.id)}
                  className={`w-full premium-card p-4 flex items-center gap-3 text-left transition-all ${
                    paymentMethod === method.id
                      ? "ring-2 ring-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    paymentMethod === method.id ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}>
                    <method.icon size={18} />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{method.label}</p>
                    <p className="text-xs text-muted-foreground">{method.description}</p>
                  </div>
                  {paymentMethod === method.id && (
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check size={12} className="text-primary-foreground" />
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* Order Summary */}
            <div className="premium-card p-4 space-y-2.5">
              <h3 className="font-display font-semibold text-sm">Récapitulatif</h3>
              {state.items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{item.name} x{item.quantity}</span>
                  <span>{formatPrice(item.unit === "KG" && item.weightGrams ? Math.round((item.weightGrams / 1000) * item.priceCents) * item.quantity : item.priceCents * item.quantity)}</span>
                </div>
              ))}
              <div className="border-t border-border/60 pt-2 flex justify-between font-bold">
                <span>Total</span>
                <span className="font-display">{formatPrice(totalCents)}</span>
              </div>
            </div>

            <Button className="w-full h-14 text-base shadow-elevated" size="lg" onClick={handleConfirmOrder}>
              Confirmer la commande — {formatPrice(totalCents)}
            </Button>
          </div>
        )}

        {/* Step: Confirming */}
        {step === "confirming" && (
          <div className="text-center py-16 space-y-4">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Loader2 size={32} className="text-primary animate-spin" />
            </div>
            <h2 className="font-display text-title">Confirmation en cours...</h2>
            <p className="text-body text-muted-foreground">Votre commande est en cours de traitement.</p>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <div className="text-center py-12 space-y-6">
            <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
              <Check size={36} className="text-green-600" />
            </div>
            <div className="space-y-2">
              <h2 className="font-display text-title">Commande confirmée !</h2>
              <p className="text-body text-muted-foreground">Votre commande chez {state.shopName} a bien été enregistrée.</p>
            </div>

            <div className="premium-card p-4 text-left space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Numéro</span>
                <span className="font-mono font-bold">CB-{new Date().toISOString().slice(0, 10).replace(/-/g, "")}-001</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Boutique</span>
                <span>{state.shopName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Articles</span>
                <span>{itemCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className="font-bold">{formatPrice(totalCents)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Paiement</span>
                <Badge variant="outline">{paymentMethod === "CB_ONLINE" ? "CB en ligne" : paymentMethod === "CB_SHOP" ? "CB au retrait" : "Espèces"}</Badge>
              </div>
            </div>

            <div className="space-y-2.5">
              <Button className="w-full h-12" size="lg" onClick={handleGoToTracking}>
                Suivre ma commande
              </Button>
              <Button variant="outline" className="w-full" asChild>
                <Link href="/decouvrir">Retour à l&apos;accueil</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
