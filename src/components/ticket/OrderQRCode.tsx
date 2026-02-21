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
    : "https://clickboucher-production.up.railway.app";

  const url = `${baseUrl}/suivi/${orderId}`;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="bg-white p-3 rounded-xl">
        <QRCodeSVG value={url} size={size} />
      </div>
      <p className="text-[10px] text-gray-400">Scanner pour le suivi</p>
    </div>
  );
}
