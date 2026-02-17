// src/components/pwa/PushPrompt.tsx — Prompt to enable push notifications
"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, X } from "lucide-react";

export default function PushPrompt() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Only show if: browser supports push, permission not yet decided, user hasn't dismissed
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (Notification.permission !== "default") return;
    if (sessionStorage.getItem("push-prompt-dismissed")) return;

    // Show after a delay (after first order or page load)
    const timer = setTimeout(() => setShow(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleEnable = useCallback(async () => {
    setLoading(true);
    try {
      // Get VAPID key
      const keyRes = await fetch("/api/push/subscribe");
      const keyJson = await keyRes.json();
      const vapidPublicKey = keyJson.data?.vapidPublicKey;

      if (!vapidPublicKey) {
        console.warn("[PushPrompt] VAPID key not configured");
        setShow(false);
        return;
      }

      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setShow(false);
        return;
      }

      // Register service worker if not already
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey).buffer as ArrayBuffer,
      });

      // Send subscription to server
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });

      setShow(false);
    } catch (error) {
      console.error("[PushPrompt] Error:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDismiss = useCallback(() => {
    setShow(false);
    sessionStorage.setItem("push-prompt-dismissed", "1");
  }, []);

  if (!show) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 max-w-md mx-auto animate-in slide-in-from-bottom-4">
      <div className="bg-white dark:bg-[#141414] rounded-2xl border border-[#ece8e3] dark:border-white/10 shadow-xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
            <Bell className="w-5 h-5 text-[#DC2626]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              Activez les notifications
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Soyez prévenu quand votre commande est prête au retrait
            </p>
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={handleEnable}
                disabled={loading}
                className="px-4 py-2 bg-[#DC2626] text-white text-xs font-semibold rounded-xl hover:bg-[#b91c1c] transition-colors disabled:opacity-50"
              >
                {loading ? "Activation..." : "Activer"}
              </button>
              <button
                onClick={handleDismiss}
                className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                Plus tard
              </button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
