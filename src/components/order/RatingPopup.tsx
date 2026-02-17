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
      <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-[#141414] rounded-2xl p-8 text-center max-w-sm w-full">
          <div className="text-5xl mb-4">
            {rating >= 4 ? "🎉" : rating >= 3 ? "👍" : "🙏"}
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Merci pour votre avis !</h3>
          <div className="flex justify-center gap-1 mt-3">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className={`w-6 h-6 ${s <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white dark:bg-[#141414] rounded-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-white/10">
          <h3 className="font-semibold text-gray-900 dark:text-white">Comment était votre commande ?</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-4">
            {shopName}
          </p>

          {/* Stars */}
          <div className="flex justify-center gap-2 mb-6">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                onMouseEnter={() => setHoveredStar(s)}
                onMouseLeave={() => setHoveredStar(0)}
                onClick={() => setRating(s)}
                className="transition-transform hover:scale-110"
              >
                <Star
                  className={`w-10 h-10 transition-colors ${
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
            <p className="text-center text-sm font-medium text-gray-600 dark:text-gray-400 mb-4">
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
            className="w-full border border-gray-200 dark:border-white/10 rounded-xl p-3 text-sm resize-none bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
          />

          {error && (
            <p className="text-sm text-red-600 mt-2">{error}</p>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={rating === 0 || loading}
            className="w-full mt-4 flex items-center justify-center gap-2 bg-red-600 text-white py-3 rounded-xl font-medium hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4" />
                Envoyer mon avis
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
