"use client";

import { useState } from "react";
import { Star } from "lucide-react";

type Size = "sm" | "md" | "lg";

const SIZE_MAP: Record<Size, number> = {
  sm: 16,
  md: 24,
  lg: 32,
};

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  size?: Size;
  className?: string;
}

export function StarRating({
  value,
  onChange,
  size = "md",
  className = "",
}: StarRatingProps) {
  const [hover, setHover] = useState(0);
  const px = SIZE_MAP[size];
  const interactive = !!onChange;

  return (
    <div className={`flex items-center gap-0.5 ${className}`}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= (hover || value);

        return interactive ? (
          <button
            key={star}
            type="button"
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange(star)}
            className="p-0.5 transition-transform duration-150 hover:scale-110 active:scale-95"
          >
            <Star
              size={px}
              className={`transition-colors duration-150 ${
                filled
                  ? "fill-yellow-400 text-yellow-400"
                  : "fill-transparent text-gray-300 dark:text-gray-600"
              }`}
            />
          </button>
        ) : (
          <Star
            key={star}
            size={px}
            className={
              filled
                ? "fill-yellow-400 text-yellow-400"
                : "fill-transparent text-gray-300 dark:text-gray-600"
            }
          />
        );
      })}
    </div>
  );
}
