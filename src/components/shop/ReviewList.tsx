// src/components/shop/ReviewList.tsx — Reviews section for boutique page
"use client";

import { useState, useEffect } from "react";
import { Star, MessageSquare } from "lucide-react";
import { ReviewCard, type ReviewData } from "./ReviewCard";

interface Props {
  shopId: string;
  rating: number;
  ratingCount: number;
}

export function ReviewList({ shopId, rating, ratingCount }: Props) {
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetch(`/api/reviews?shopId=${shopId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          setReviews(data.data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [shopId]);

  const displayed = showAll ? reviews : reviews.slice(0, 3);

  return (
    <div className="px-4 py-4">
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
          <MessageSquare size={14} className="text-[#DC2626]" />
          Avis clients
        </h3>
        {ratingCount > 0 && (
          <div className="flex items-center gap-1">
            <Star size={12} className="fill-yellow-400 text-yellow-400" />
            <span className="text-sm font-bold text-gray-900 dark:text-white">
              {rating.toFixed(1)}
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              ({ratingCount})
            </span>
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10 p-4 animate-pulse">
              <div className="h-3 bg-gray-200 dark:bg-white/10 rounded w-1/3 mb-2" />
              <div className="h-2.5 bg-gray-100 dark:bg-white/5 rounded w-2/3" />
            </div>
          ))}
        </div>
      )}

      {/* Reviews */}
      {!loading && reviews.length > 0 && (
        <div className="space-y-2">
          {displayed.map((r) => (
            <ReviewCard key={r.id} review={r} />
          ))}

          {reviews.length > 3 && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              className="w-full py-2.5 text-xs font-semibold text-[#DC2626] hover:bg-[#DC2626]/5 rounded-xl transition-colors"
            >
              Voir les {reviews.length} avis
            </button>
          )}
        </div>
      )}

      {/* Empty */}
      {!loading && reviews.length === 0 && (
        <div className="text-center py-6">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Aucun avis pour le moment
          </p>
        </div>
      )}
    </div>
  );
}
