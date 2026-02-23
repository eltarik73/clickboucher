// useKitchenNotifications — Browser notifications + title blink + favicon badge
// Only for /boucher/commandes (kitchen mode)
"use client";

import { useEffect, useRef, useCallback } from "react";

const DEFAULT_TITLE = "Mode Cuisine | Klik&Go";
const ALERT_TITLE = "\uD83D\uDD34 Nouvelle commande !";

type NotificationOrder = {
  id: string;
  orderNumber: string;
  displayNumber?: string | null;
  totalCents: number;
  items: { quantity: number }[];
};

/**
 * Request notification permission on mount (kitchen page only).
 * Send browser notification when new order arrives and tab is NOT focused.
 * Blink page title and swap favicon when pending > 0.
 */
export function useKitchenNotifications(pendingCount: number) {
  const titleIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const originalFaviconRef = useRef<string>("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // ── Request notification permission on mount ──
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // ── Title blinking when pending > 0 ──
  useEffect(() => {
    if (pendingCount > 0) {
      let showAlert = true;
      titleIntervalRef.current = setInterval(() => {
        document.title = showAlert ? ALERT_TITLE : DEFAULT_TITLE;
        showAlert = !showAlert;
      }, 1000);
    } else {
      // Reset title
      if (titleIntervalRef.current) {
        clearInterval(titleIntervalRef.current);
        titleIntervalRef.current = null;
      }
      document.title = DEFAULT_TITLE;
    }

    return () => {
      if (titleIntervalRef.current) {
        clearInterval(titleIntervalRef.current);
        titleIntervalRef.current = null;
      }
    };
  }, [pendingCount]);

  // ── Favicon badge when pending > 0 ──
  useEffect(() => {
    // Store original favicon on first run
    if (!originalFaviconRef.current) {
      const existing = document.querySelector<HTMLLinkElement>("link[rel='icon']");
      originalFaviconRef.current = existing?.href || "/icons/icon-192.png";
    }

    if (pendingCount > 0) {
      setFaviconWithBadge(pendingCount);
    } else {
      restoreFavicon();
    }

    return () => {
      restoreFavicon();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCount]);

  // ── Send browser notification (called from parent on new order) ──
  const sendOrderNotification = useCallback((order: NotificationOrder) => {
    // Only notify when tab is NOT visible
    if (document.visibilityState === "visible") return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const ticketNumber = order.displayNumber || `#${order.orderNumber}`;
    const itemCount = order.items.reduce((sum, i) => sum + i.quantity, 0);
    const total = (order.totalCents / 100).toFixed(2).replace(".", ",") + " \u20AC";

    const notification = new Notification("Nouvelle commande !", {
      body: `Commande ${ticketNumber} - ${itemCount} article${itemCount > 1 ? "s" : ""} - ${total}`,
      icon: "/icons/icon-192.png",
      tag: `order-${order.id}`,
      requireInteraction: true,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  }, []);

  // ── Favicon helpers ──
  function setFaviconWithBadge(count: number) {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
      canvasRef.current.width = 64;
      canvasRef.current.height = 64;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Load original favicon image
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      ctx.clearRect(0, 0, 64, 64);
      ctx.drawImage(img, 0, 0, 64, 64);

      // Draw red badge circle
      ctx.fillStyle = "#DC2626";
      ctx.beginPath();
      ctx.arc(50, 14, 14, 0, 2 * Math.PI);
      ctx.fill();

      // Draw count text
      ctx.fillStyle = "#fff";
      ctx.font = "bold 18px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(count > 9 ? "9+" : String(count), 50, 15);

      // Apply as favicon
      applyFavicon(canvas.toDataURL("image/png"));
    };
    img.src = originalFaviconRef.current;
  }

  function restoreFavicon() {
    if (originalFaviconRef.current) {
      applyFavicon(originalFaviconRef.current);
    }
  }

  function applyFavicon(href: string) {
    let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = href;
  }

  return { sendOrderNotification };
}
