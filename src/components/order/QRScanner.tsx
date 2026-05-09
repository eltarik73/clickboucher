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
            try {
              await scanner?.stop();
            } catch {}
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
      try {
        scanner?.stop();
      } catch {}
    };
  }, [onScan]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-scanner-title"
    >
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white dark:bg-[#141414]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-white/10">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-red-600" aria-hidden="true" />
            <h3 id="qr-scanner-title" className="font-semibold text-gray-900 dark:text-white">
              Scanner le QR
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-white/10"
            aria-label="Fermer le scanner"
          >
            <X className="h-5 w-5 text-gray-500 dark:text-gray-400" aria-hidden="true" />
          </button>
        </div>

        {/* Scanner area */}
        <div className="p-4">
          {!result && !error && (
            <>
              <div
                id="qr-scanner-region"
                ref={scannerRef}
                className="aspect-square w-full overflow-hidden rounded-lg bg-black"
              />
              {scanning && (
                <p className="mt-3 text-center text-sm text-gray-500 dark:text-gray-400">
                  Placez le QR code du client dans le cadre
                </p>
              )}
            </>
          )}

          {result && (
            <div
              className={`flex flex-col items-center gap-3 py-8 ${result.success ? "text-green-600" : "text-red-600"}`}
            >
              {result.success ? (
                <CheckCircle className="h-16 w-16" />
              ) : (
                <AlertCircle className="h-16 w-16" />
              )}
              <p className="text-lg font-semibold">{result.message}</p>
              <button
                onClick={onClose}
                className="mt-4 rounded-lg bg-red-600 px-6 py-2 text-white transition hover:bg-red-700"
              >
                Fermer
              </button>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center gap-3 py-8 text-red-600">
              <AlertCircle className="h-12 w-12" />
              <p className="text-center text-sm">{error}</p>
              <button
                onClick={onClose}
                className="mt-4 rounded-lg bg-gray-200 px-6 py-2 text-gray-700 dark:bg-white/10 dark:text-gray-300"
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
