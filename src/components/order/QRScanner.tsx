// src/components/order/QRScanner.tsx — QR code scanner for boucher pickup confirmation
"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, X, CheckCircle, AlertCircle } from "lucide-react";

type Props = {
  onScan: (qrCode: string) => Promise<{ success: boolean; message?: string }>;
  onClose: () => void;
};

export default function QRScanner({ onScan, onClose }: Props) {
  const scannerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const html5QrRef = useRef<any>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let scanner: any = null;

    async function initScanner() {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (!scannerRef.current) return;

        const scannerId = "qr-scanner-region";
        scanner = new Html5Qrcode(scannerId);
        html5QrRef.current = scanner;
        setScanning(true);

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          async (decodedText: string) => {
            setScanning(false);
            try { await scanner?.stop(); } catch {}
            const res = await onScan(decodedText);
            setResult({
              success: res.success,
              message: res.message || (res.success ? "Retrait confirmé !" : "QR code invalide"),
            });
          },
          () => {} // ignore errors during scanning
        );
      } catch {
        setError("Impossible d'accéder à la caméra");
      }
    }

    initScanner();

    return () => {
      try { scanner?.stop(); } catch {}
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#141414] rounded-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-white/10">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-red-600" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Scanner le QR</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Scanner area */}
        <div className="p-4">
          {!result && !error && (
            <>
              <div
                id="qr-scanner-region"
                ref={scannerRef}
                className="w-full aspect-square rounded-lg overflow-hidden bg-black"
              />
              {scanning && (
                <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-3">
                  Placez le QR code du client dans le cadre
                </p>
              )}
            </>
          )}

          {result && (
            <div className={`flex flex-col items-center gap-3 py-8 ${result.success ? "text-green-600" : "text-red-600"}`}>
              {result.success ? (
                <CheckCircle className="w-16 h-16" />
              ) : (
                <AlertCircle className="w-16 h-16" />
              )}
              <p className="text-lg font-semibold">{result.message}</p>
              <button
                onClick={onClose}
                className="mt-4 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                Fermer
              </button>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center gap-3 py-8 text-red-600">
              <AlertCircle className="w-12 h-12" />
              <p className="text-sm text-center">{error}</p>
              <button
                onClick={onClose}
                className="mt-4 px-6 py-2 bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-300 rounded-lg"
              >
                Fermer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
