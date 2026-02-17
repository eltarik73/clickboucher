// src/components/shop/ReviewCard.tsx — Single review display
"use client";

import { Star } from "lucide-react";

export interface ReviewData {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  user: {
    firstName: string;
    lastInitial: string;
  };
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `il y a ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `il y a ${days}j`;
  const months = Math.floor(days / 30);
  return `il y a ${months} mois`;
}

export function ReviewCard({ review }: { review: ReviewData }) {
  return (
    <div className="p-3.5 bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10">
      {/* Header: name + stars + date */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-[#DC2626]/10 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-[#DC2626]">
              {review.user.firstName[0]?.toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {review.user.firstName} {review.user.lastInitial}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  size={11}
                  className={s <= review.rating
                    ? "fill-yellow-400 text-yellow-400"
                    : "fill-transparent text-gray-300 dark:text-gray-600"
                  }
                />
              ))}
            </div>
          </div>
        </div>
        <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0">
          {timeAgo(review.createdAt)}
        </span>
      </div>

      {/* Comment */}
      {review.comment && (
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
          {review.comment}
        </p>
      )}
    </div>
  );
}
