"use client";

import { useState, useCallback } from "react";
import { useVisiblePolling } from "@/hooks/useVisiblePolling";

export type AppNotification = {
  id: string;
  type: string;
  message: string;
  orderId: string | null;
  read: boolean;
  createdAt: string;
};

/** `enabled = false` : aucun appel réseau (visiteur non connecté). */
export function useNotifications(enabled = true) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return false;
      const json = await res.json();
      setNotifications(json.data || []);
      return true;
    } catch {
      return false;
    }
  }, []);

  // Rafraîchi toutes les 30 s, uniquement onglet visible (backoff si l'API échoue)
  useVisiblePolling(fetchNotifications, 30_000, enabled);

  const markAsRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    await fetch(`/api/notifications/${id}/read`, { method: "PATCH" }).catch(() => {});
  }, []);

  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await fetch("/api/notifications/all/read", { method: "PATCH" }).catch(() => {});
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount, markAsRead, markAllAsRead, refetch: fetchNotifications };
}
