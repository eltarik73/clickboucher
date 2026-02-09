"use client";

import { useState, useEffect, createContext, useContext, useCallback, useRef } from "react";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type NotifType = "success" | "error" | "warning" | "info";

interface Notification {
  id: string;
  type: NotifType;
  message: string;
}

interface NotificationContextType {
  notify: (type: NotifType, message: string) => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function useNotify() {
  const ctx = useContext(NotificationContext);
  if (!ctx) return { notify: () => {} };
  return ctx;
}

// ─────────────────────────────────────────────
// Style map
// ─────────────────────────────────────────────
const STYLES: Record<NotifType, { bg: string; icon: typeof CheckCircle }> = {
  success: { bg: "bg-emerald-600", icon: CheckCircle },
  error:   { bg: "bg-red-600",     icon: XCircle },
  warning: { bg: "bg-amber-500",   icon: AlertTriangle },
  info:    { bg: "bg-blue-600",    icon: Info },
};

// ─────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const counterRef = useRef(0);

  const notify = useCallback((type: NotifType, message: string) => {
    const id = `notif-${++counterRef.current}`;
    setNotifications((prev) => [...prev, { id, type, message }]);

    // Auto-dismiss after 5s
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 5000);
  }, []);

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return (
    <NotificationContext.Provider value={{ notify }}>
      {children}
      {/* Toast stack */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {notifications.map((notif) => (
          <NotificationToastItem key={notif.id} notif={notif} onDismiss={dismiss} />
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

// ─────────────────────────────────────────────
// Single toast item
// ─────────────────────────────────────────────
function NotificationToastItem({
  notif,
  onDismiss,
}: {
  notif: Notification;
  onDismiss: (id: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const style = STYLES[notif.type];
  const Icon = style.icon;

  useEffect(() => {
    // Trigger slide-in
    requestAnimationFrame(() => setVisible(true));
  }, []);

  return (
    <div
      className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg transition-all duration-300 ${style.bg} ${
        visible ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0"
      }`}
    >
      <Icon size={18} className="text-white shrink-0" />
      <p className="text-sm font-medium text-white flex-1">{notif.message}</p>
      <button
        onClick={() => onDismiss(notif.id)}
        className="p-1 rounded-lg hover:bg-white/20 transition-colors shrink-0"
      >
        <X size={14} className="text-white" />
      </button>
    </div>
  );
}
