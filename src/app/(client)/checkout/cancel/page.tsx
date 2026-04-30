// src/app/(client)/checkout/cancel/page.tsx
// Page affichée quand le client annule le paiement Stripe Checkout.
// Permet de relancer le paiement ou d'annuler la commande.
"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { XCircle, RotateCcw, Home, Loader2 } from "lucide-react";

export default function CheckoutCancelPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = searchParams.get("order");
  const [retrying, setRetrying] = useState(false);

  async function retryPayment() {
    if (!orderId) return;
    setRetrying(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/checkout-session`, {
        method: "POST",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast.error(json.error?.message || "Impossible de relancer le paiement");
        setRetrying(false);
        return;
      }
      const json = await res.json();
      if (json.data?.url) {
        window.location.href = json.data.url;
      } else {
        toast.error("URL Stripe manquante");
        setRetrying(false);
      }
    } catch {
      toast.error("Erreur de connexion");
      setRetrying(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#0a0a0a] px-4 py-8">
      <div className="max-w-md mx-auto space-y-4">
        <Card className="bg-white dark:bg-[#141414] border-0 shadow-sm overflow-hidden">
          <CardContent className="p-6 text-center space-y-3">
            <div className="w-16 h-16 mx-auto rounded-full bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center">
              <XCircle className="w-9 h-9 text-amber-600 dark:text-amber-400" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Paiement annulé
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Tu as annulé le paiement avant la finalisation. Aucun montant n&apos;a été débité.
            </p>
            {orderId && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Tu peux relancer le paiement ou abandonner cette commande.
              </p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-2">
          {orderId && (
            <Button
              onClick={retryPayment}
              disabled={retrying}
              className="w-full bg-[#DC2626] hover:bg-[#b91c1c] text-white h-11 rounded-xl"
            >
              {retrying ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Relancer le paiement
                </>
              )}
            </Button>
          )}
          <Link href="/panier">
            <Button variant="outline" className="w-full h-11 rounded-xl">
              Modifier mon panier
            </Button>
          </Link>
          <Button
            onClick={() => router.push("/")}
            variant="ghost"
            className="w-full h-11 rounded-xl"
          >
            <Home className="w-4 h-4 mr-2" />
            Retour à l&apos;accueil
          </Button>
        </div>
      </div>
    </div>
  );
}
