"use client";

import Image, { ImageProps } from "next/image";
import { useState } from "react";

const PLACEHOLDER_SHOP = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='400' fill='%23e5e7eb'%3E%3Crect width='600' height='400'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='48' fill='%239ca3af'%3E%F0%9F%8F%AA%3C/text%3E%3C/svg%3E";
const PLACEHOLDER_PRODUCT = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' fill='%23e5e7eb'%3E%3Crect width='400' height='400'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='48' fill='%239ca3af'%3E%F0%9F%A5%A9%3C/text%3E%3C/svg%3E";

interface SafeImageProps extends Omit<ImageProps, "onError"> {
  type?: "shop" | "product";
}

export function SafeImage({ type = "product", src, alt, ...props }: SafeImageProps) {
  const [error, setError] = useState(false);
  const fallback = type === "shop" ? PLACEHOLDER_SHOP : PLACEHOLDER_PRODUCT;

  return (
    <Image
      {...props}
      src={error ? fallback : src}
      alt={alt}
      onError={() => setError(true)}
    />
  );
}
