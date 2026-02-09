"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
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

export function QRScanner({ onClose, onScanned }: {
  onClose: () => void;
  onScanned: () => void;
}) {
  const [scanning, setScanning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<string>("qr-reader-" + Math.random().toString(36).slice(2));

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

    try {
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
      const message = err instanceof Error ? err.message : "Impossible d'acceder a la camera";
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

  async function handleScan(qrCode: string, scanner: Html5Qrcode) {
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

    try {
      // Try to find the order with this QR code
      const ordersRes = await fetch("/api/orders");
      if (!ordersRes.ok) {
        setResult({ success: false, message: "Erreur lors de la recherche de la commande" });
        return;
      }

      const ordersJson = await ordersRes.json();
      const orders = ordersJson.data || [];
      const order = orders.find((o: { qrCode: string | null; status: string }) =>
        o.qrCode === qrCode && o.status === "READY"
      );

      if (!order) {
        setResult({ success: false, message: "QR code invalide ou commande non prete" });
        return;
      }

      // Mark as picked up
      const res = await fetch(`/api/orders/${order.id}/picked-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrCode }),
      });

      if (res.ok) {
        setResult({
          success: true,
          orderNumber: order.orderNumber,
          clientName: order.user
            ? `${order.user.firstName} ${order.user.lastName}`
            : "Client",
          itemCount: order.items?.length || 0,
        });
        onScanned();
      } else {
        const json = await res.json();
        setResult({
          success: false,
          message: json.error?.message || "Erreur lors de la validation",
        });
      }
    } catch {
      setResult({ success: false, message: "Erreur de connexion au serveur" });
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Scanner viewport */}
      <div
        id={containerRef.current}
        className={`w-full rounded-xl overflow-hidden bg-black ${scanning ? "min-h-[300px]" : "hidden"}`}
      />

      {/* Start / Processing states */}
      {!scanning && !result && !processing && (
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center">
            <Camera size={32} className="text-gray-400" />
          </div>
          <p className="text-sm text-gray-500 text-center">
            Scannez le QR code sur le telephone du client pour valider le retrait
          </p>
          <Button
            onClick={startScanner}
            disabled={starting}
            className="bg-[#8b2500] hover:bg-[#6d1d00] gap-2"
          >
            {starting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Camera size={16} />
            )}
            {starting ? "Demarrage..." : "Ouvrir la camera"}
          </Button>
        </div>
      )}

      {processing && (
        <div className="flex flex-col items-center gap-3 py-8">
          <Loader2 size={32} className="animate-spin text-[#8b2500]" />
          <p className="text-sm text-gray-500">Verification en cours...</p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-4">
          {result.success ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center space-y-2">
              <CheckCircle size={40} className="text-emerald-500 mx-auto" />
              <p className="text-lg font-bold text-emerald-800">
                Commande recuperee !
              </p>
              <div className="text-sm text-emerald-700 space-y-0.5">
                <p className="font-mono font-semibold">{result.orderNumber}</p>
                <p>{result.clientName}</p>
                <p className="text-emerald-600">
                  {result.itemCount} article{(result.itemCount || 0) > 1 ? "s" : ""}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center space-y-2">
              <XCircle size={40} className="text-red-400 mx-auto" />
              <p className="text-lg font-bold text-red-800">QR invalide</p>
              <p className="text-sm text-red-600">{result.message}</p>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => { setResult(null); startScanner(); }}
            >
              Scanner un autre
            </Button>
            <Button
              className="flex-1 bg-[#8b2500] hover:bg-[#6d1d00]"
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
          className="w-full gap-2"
          onClick={stopScanner}
        >
          <X size={16} /> Arreter le scanner
        </Button>
      )}
    </div>
  );
}
