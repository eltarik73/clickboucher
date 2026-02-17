"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { useAuth } from "@clerk/nextjs";

interface FavoriteButtonProps {
  shopId: string;
  initialFavorite?: boolean;
  size?: number;
  className?: string;
  onToggle?: (isFavorite: boolean) => void;
}

export function FavoriteButton({
  shopId,
  initialFavorite = false,
  size = 20,
  className = "",
  onToggle,
}: FavoriteButtonProps) {
  const { userId } = useAuth();
  const [isFavorite, setIsFavorite] = useState(initialFavorite);
  const [animating, setAnimating] = useState(false);

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!userId) return;

    // Optimistic update
    setIsFavorite((prev) => !prev);
    setAnimating(true);
    setTimeout(() => setAnimating(false), 300);

    try {
      const res = await fetch(`/api/shops/${shopId}/favorite`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsFavorite(data.data.isFavorite);
        onToggle?.(data.data.isFavorite);
      } else {
        setIsFavorite((prev) => !prev);
      }
    } catch {
      setIsFavorite((prev) => !prev);
    }
  };

  if (!userId) return null;

  return (
    <button
      onClick={handleToggle}
      className={`flex items-center justify-center transition-transform duration-300 ${
        animating ? "scale-125" : "scale-100"
      } ${className}`}
      aria-label={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
    >
      <Heart
        size={size}
        className={`transition-colors duration-200 ${
          isFavorite
            ? "fill-[#DC2626] text-[#DC2626]"
            : "fill-transparent text-white drop-shadow-md"
        }`}
        strokeWidth={2}
      />
    </button>
  );
}
