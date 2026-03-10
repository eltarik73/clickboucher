"use client";

import { useState } from "react";
import { Check, X, Loader2, Tag } from "lucide-react";

export function PromoCodeInput({
  cartTotal,
  cartProductIds,
  onApply,
}: {
  cartTotal: number;
  cartProductIds: string[];
  onApply: (result: {
    discount: number;
    offerName: string;
    offerCode: string;
    freeProductId?: string;
  }) => void;
}) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<{
    discount: number;
    offerName: string;
    offerCode: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/checkout/validate-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: trimmed,
          cartTotal,
          cartProductIds,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error?.message || "Code invalide");
        return;
      }

      const data = json.data;

      const result = {
        discount: data.discount,
        offerName: data.offer?.name || trimmed,
        offerCode: trimmed,
        freeProductId: data.freeProductId,
      };

      setApplied({
        discount: result.discount,
        offerName: result.offerName,
        offerCode: result.offerCode,
      });
      onApply(result);
    } catch {
      setError("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = () => {
    setApplied(null);
    setCode("");
    setError(null);
    onApply({ discount: 0, offerName: "", offerCode: "" });
  };

  // Applied state
  if (applied) {
    return (
      <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
            Code appliqu&eacute; !{" "}
            <span className="font-bold">
              -{applied.discount.toFixed(2).replace(".", ",")}€
            </span>
          </span>
          <span className="font-mono text-xs bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 px-2 py-0.5 rounded">
            {applied.offerCode}
          </span>
        </div>
        <button
          onClick={handleRemove}
          className="text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          aria-label="Retirer le code"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex">
        <div className="relative flex-1">
          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-gray-400" />
          <input
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setError(null);
            }}
            placeholder="Code promo"
            className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-l-xl text-sm font-mono uppercase placeholder:text-gray-400 dark:placeholder:text-gray-500 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500"
            disabled={loading}
          />
        </div>
        <button
          type="submit"
          disabled={loading || !code.trim()}
          className="bg-red-600 hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed text-white text-sm font-medium px-4 rounded-r-xl transition-colors flex items-center gap-1.5"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            "Appliquer"
          )}
        </button>
      </form>

      {error && (
        <p className="text-red-500 text-xs mt-1.5 pl-1">{error}</p>
      )}
    </div>
  );
}
