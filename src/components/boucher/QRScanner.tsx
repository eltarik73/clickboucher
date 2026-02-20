"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  CheckCircle,
  XCircle,
  Camera,
  X,
} from "lucide-react";

type ScanResult = {
  success: boolean;
  orderNumber?: string;
  clientName?: string;
  itemCount?: number;
  message?: string;
};

export function QRScanner({
  onClose,
  onScanned,
}: {
  onClose: () => void;
  onScanned: () => void;
}) {
  const [scanning, setScanning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scannerRef = useRef<any>(null);
  const containerRef = useRef<string>(
    "qr-reader-" + Math.random().toString(36).slice(2)
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current.clear();
        scannerRef.current = null;
      }
    };
  }, []);

  async function startScanner() {
    setStarting(true);
    setResult(null);
    setScannedCode(null);

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(containerRef.current);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => handleScan(decodedText, scanner),
        () => {} // ignore errors during scanning
      );

      setScanning(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Impossible d'accéder à la caméra";
      setResult({ success: false, message });
    } finally {
      setStarting(false);
    }
  }

  async function stopScanner() {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {
        // ignore
      }
      scannerRef.current = null;
    }
    setScanning(false);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function handleScan(qrCode: string, scanner: any) {
    // Stop scanning immediately
    try {
      await scanner.stop();
      scanner.clear();
    } catch {
      // ignore
    }
    scannerRef.current = null;
    setScanning(false);
    setProcessing(true);
    setScannedCode(qrCode);

    try {
      // Direct server-side QR lookup + pickup confirmation
      const res = await fetch("/api/boucher/orders/pickup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrCode }),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        setResult({
          success: true,
          orderNumber: json.data.orderNumber,
          clientName: json.data.clientName || "Client",
          itemCount: json.data.itemCount || 0,
        });
        onScanned();
      } else {
        setResult({
          success: false,
          message: json.error?.message || "QR code invalide ou commande non prete",
        });
      }
    } catch {
      setResult({
        success: false,
        message: "Erreur de connexion au serveur",
      });
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Scanner viewport */}
      <div
        id={containerRef.current}
        className={`w-full rounded-xl overflow-hidden bg-black ${
          scanning ? "min-h-[300px]" : "hidden"
        }`}
      />

      {/* Start state */}
      {!scanning && !result && !processing && (
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center">
            <Camera size={32} className="text-gray-400 dark:text-gray-500" />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
            Scannez le QR code sur le t&eacute;l&eacute;phone du client pour
            valider le retrait
          </p>
          <Button
            onClick={startScanner}
            disabled={starting}
            className="bg-[#DC2626] hover:bg-[#b91c1c] gap-2"
          >
            {starting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Camera size={16} />
            )}
            {starting ? "Démarrage..." : "\ud83d\udcf1 Scanner le QR code"}
          </Button>
        </div>
      )}

      {/* Processing state */}
      {processing && (
        <div className="flex flex-col items-center gap-3 py-8">
          <Loader2 size={32} className="animate-spin text-[#DC2626]" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            V&eacute;rification en cours...
          </p>
          {scannedCode && (
            <div className="bg-gray-50 dark:bg-[#0a0a0a] rounded-lg px-4 py-2 mt-1">
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                Code scann&eacute;
              </p>
              <p className="font-mono text-sm text-gray-700 dark:text-gray-300 text-center break-all">
                {scannedCode.slice(0, 12)}
                {scannedCode.length > 12 ? "..." : ""}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-4">
          {result.success ? (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-5 text-center space-y-2">
              <CheckCircle
                size={40}
                className="text-emerald-500 dark:text-emerald-400 mx-auto"
              />
              <p className="text-lg font-bold text-emerald-800 dark:text-emerald-300">
                ✅ Commande r&eacute;cup&eacute;r&eacute;e !
              </p>
              <div className="text-sm text-emerald-700 dark:text-emerald-400 space-y-0.5">
                <p className="font-mono font-semibold">
                  {result.orderNumber}
                </p>
                <p>{result.clientName}</p>
                <p className="text-emerald-600 dark:text-emerald-500">
                  {result.itemCount} article
                  {(result.itemCount || 0) > 1 ? "s" : ""}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-5 text-center space-y-2">
              <XCircle
                size={40}
                className="text-red-400 dark:text-red-500 mx-auto"
              />
              <p className="text-lg font-bold text-red-800 dark:text-red-300">
                ❌ QR invalide
              </p>
              <p className="text-sm text-red-600 dark:text-red-400">
                {result.message}
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/10"
              onClick={() => {
                setResult(null);
                setScannedCode(null);
                startScanner();
              }}
            >
              Scanner un autre
            </Button>
            <Button
              className="flex-1 bg-[#DC2626] hover:bg-[#b91c1c]"
              onClick={onClose}
            >
              Fermer
            </Button>
          </div>
        </div>
      )}

      {/* Stop button when scanning */}
      {scanning && (
        <Button
          variant="outline"
          className="w-full gap-2 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/10"
          onClick={stopScanner}
        >
          <X size={16} /> Arr&ecirc;ter le scanner
        </Button>
      )}
    </div>
  );
}
