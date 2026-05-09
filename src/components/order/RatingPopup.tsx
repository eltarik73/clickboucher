// src/components/order/RatingPopup.tsx — Post-pickup rating popup (Uber Eats style)
"use client";

import { useState } from "react";
import { Star, X, Send } from "lucide-react";

type Props = {
  orderId: string;
  shopName: string;
  onClose: () => void;
  onSubmitted?: (rating: number) => void;
};

export default function RatingPopup({ orderId, shopName, onClose, onSubmitted }: Props) {
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (rating === 0) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/orders/${orderId}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment: comment || undefined }),
      });

      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || "Erreur lors de la notation");
        return;
      }

      setSubmitted(true);
      onSubmitted?.(rating);
      setTimeout(onClose, 2000);
    } catch {
      setError("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rating-thanks-title"
      >
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center dark:bg-[#141414]">
          <div className="mb-4 text-5xl" aria-hidden="true">
            {rating >= 4 ? "🎉" : rating >= 3 ? "👍" : "🙏"}
          </div>
          <h3
            id="rating-thanks-title"
            className="text-lg font-semibold text-gray-900 dark:text-white"
          >
            Merci pour votre avis !
          </h3>
          <div
            className="mt-3 flex justify-center gap-1"
            role="img"
            aria-label={`Note attribuée : ${rating} sur 5 étoiles`}
          >
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                aria-hidden="true"
                className={`h-6 w-6 ${s <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rating-popup-title"
    >
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white dark:bg-[#141414]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 p-4 dark:border-white/10">
          <h3 id="rating-popup-title" className="font-semibold text-gray-900 dark:text-white">
            Comment était votre commande ?
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-white/10"
            aria-label="Fermer la fenêtre de notation"
          >
            <X className="h-5 w-5 text-gray-500 dark:text-gray-400" aria-hidden="true" />
          </button>
        </div>

        <div className="p-6">
          <p className="mb-4 text-center text-sm text-gray-500 dark:text-gray-400">{shopName}</p>

          {/* Stars — audit a11y 2026-05-09 : aria-label par étoile + role radiogroup */}
          <div
            className="mb-6 flex justify-center gap-2"
            role="radiogroup"
            aria-label="Notez votre commande sur 5 étoiles"
          >
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                role="radio"
                aria-checked={s === rating}
                aria-label={`${s} étoile${s > 1 ? "s" : ""}`}
                onMouseEnter={() => setHoveredStar(s)}
                onMouseLeave={() => setHoveredStar(0)}
                onClick={() => setRating(s)}
                className="rounded transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DC2626] focus-visible:ring-offset-2"
              >
                <Star
                  aria-hidden="true"
                  className={`h-10 w-10 transition-colors ${
                    s <= (hoveredStar || rating)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-gray-200 dark:text-gray-700"
                  }`}
                />
              </button>
            ))}
          </div>

          {/* Labels */}
          {rating > 0 && (
            <p className="mb-4 text-center text-sm font-medium text-gray-600 dark:text-gray-400">
              {rating === 1 && "Décevant"}
              {rating === 2 && "Passable"}
              {rating === 3 && "Correct"}
              {rating === 4 && "Très bien"}
              {rating === 5 && "Excellent !"}
            </p>
          )}

          {/* Comment */}
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Un commentaire ? (optionnel)"
            rows={3}
            maxLength={1000}
            className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-transparent focus:ring-2 focus:ring-red-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
          />

          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={rating === 0 || loading}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-3 font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <>
                <Send className="h-4 w-4" />
                Envoyer mon avis
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
