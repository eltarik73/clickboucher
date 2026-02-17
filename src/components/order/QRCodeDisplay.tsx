// src/components/order/QRCodeDisplay.tsx — Display QR code for order pickup
"use client";

import { useEffect, useRef } from "react";
import { QrCode } from "lucide-react";

type Props = {
  qrCode: string;
  orderNumber: string;
  size?: number;
};

export default function QRCodeDisplay({ qrCode, orderNumber, size = 200 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    async function generateQR() {
      try {
        const QRCode = (await import("qrcode")).default;
        if (canvasRef.current) {
          await QRCode.toCanvas(canvasRef.current, qrCode, {
            width: size,
            margin: 2,
            color: {
              dark: "#000000",
              light: "#FFFFFF",
            },
          });
        }
      } catch {
        // QR generation failed
      }
    }
    generateQR();
  }, [qrCode, size]);

  return (
    <div className="flex flex-col items-center gap-4 p-6 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#141414]">
      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
        <QrCode className="w-5 h-5" />
        <span className="text-sm font-medium">QR Code de retrait</span>
      </div>

      <div className="bg-white p-3 rounded-lg">
        <canvas ref={canvasRef} />
      </div>

      <div className="text-center">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Présentez ce code au boucher
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 font-mono">
          {orderNumber}
        </p>
      </div>
    </div>
  );
}
