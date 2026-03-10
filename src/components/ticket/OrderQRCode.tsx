"use client";

import { QRCodeSVG } from "qrcode.react";

interface Props {
  orderId: string;
  qrCodeEnabled: boolean;
  size?: number;
}

/**
 * QR Code conditionnel — s'affiche UNIQUEMENT si shop.qrCodeEnabled === true
 * Encode l'URL /suivi/{orderId}
 */
export default function OrderQRCode({ orderId, qrCodeEnabled, size = 120 }: Props) {
  if (!qrCodeEnabled) return null;

  const baseUrl = typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

  const url = `${baseUrl}/suivi/${orderId}`;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="bg-white dark:bg-gray-900 p-3 rounded-xl">
        <QRCodeSVG value={url} size={size} />
      </div>
      <p className="text-[10px] text-gray-500 dark:text-gray-400">Scanner pour le suivi</p>
    </div>
  );
}
