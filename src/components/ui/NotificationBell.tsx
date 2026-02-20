"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { useNotifications, type AppNotification } from "@/lib/hooks/use-notifications";
import Link from "next/link";

const TYPE_LABELS: Record<string, { icon: string; color: string }> = {
  ORDER_PENDING:   { icon: "🔔", color: "text-amber-600" },
  ORDER_ACCEPTED:  { icon: "✅", color: "text-emerald-600" },
  ORDER_DENIED:    { icon: "❌", color: "text-red-600" },
  ORDER_READY:     { icon: "🎉", color: "text-emerald-600" },
  ORDER_PICKED_UP: { icon: "📦", color: "text-blue-600" },
  STOCK_ISSUE:     { icon: "⚠️", color: "text-amber-600" },
  PRO_VALIDATED:   { icon: "🌟", color: "text-emerald-600" },
  PRO_REJECTED:    { icon: "😞", color: "text-red-600" },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "A l'instant";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}j`;
}

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleNotifClick = (notif: AppNotification) => {
    if (!notif.read) markAsRead(notif.id);
    setOpen(false);
  };

  return (
    <div ref={dropdownRef} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen(!open)}
        aria-label="Notifications"
        className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-zinc-100 dark:bg-white/10 hover:bg-zinc-200 dark:hover:bg-white/15 transition-colors"
      >
        <Bell size={16} strokeWidth={2} className="text-zinc-700 dark:text-white" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[1rem] h-4 rounded-full bg-[#DC2626] text-white text-[10px] font-bold flex items-center justify-center px-1 animate-scale-in">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-11 w-80 max-h-96 bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-2xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/10">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-1 text-xs text-[#DC2626] hover:text-[#b91c1c] transition-colors"
              >
                <CheckCheck size={14} />
                Tout lire
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-72">
            {notifications.length === 0 ? (
              <div className="py-10 text-center">
                <Bell size={28} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                <p className="text-sm text-gray-400">Aucune notification</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const meta = TYPE_LABELS[notif.type] || { icon: "📌", color: "text-gray-600" };
                const content = (
                  <div
                    key={notif.id}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleNotifClick(notif); }}
                    onClick={() => handleNotifClick(notif)}
                    className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors ${
                      !notif.read ? "bg-[#DC2626]/5 dark:bg-[#DC2626]/10" : ""
                    }`}
                  >
                    <span className="text-lg shrink-0 mt-0.5">{meta.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug ${!notif.read ? "font-semibold text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-400"}`}>
                        {notif.message}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-1">
                        {timeAgo(notif.createdAt)}
                      </p>
                    </div>
                    {!notif.read && (
                      <span className="w-2 h-2 rounded-full bg-[#DC2626] shrink-0 mt-2" />
                    )}
                  </div>
                );

                return notif.orderId ? (
                  <Link key={notif.id} href={`/commande/${notif.orderId}`}>
                    {content}
                  </Link>
                ) : (
                  <div key={notif.id}>{content}</div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
