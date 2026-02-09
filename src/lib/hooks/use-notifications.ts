"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export type AppNotification = {
  id: string;
  orderId: string;
  orderNumber: string;
  status: string;
  shopName: string;
  updatedAt: string;
  read: boolean;
};

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const readIdsRef = useRef<Set<string>>(new Set());

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const json = await res.json();
      const items: AppNotification[] = (json.data || []).map(
        (n: AppNotification) => ({
          ...n,
          read: readIdsRef.current.has(n.id),
        })
      );
      setNotifications(items);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAsRead = useCallback((id: string) => {
    readIdsRef.current.add(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => {
      for (const n of prev) readIdsRef.current.add(n.id);
      return prev.map((n) => ({ ...n, read: true }));
    });
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount, markAsRead, markAllAsRead };
}
