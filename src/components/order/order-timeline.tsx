"use client";

import React from "react";
import { Check, Clock, Scale, AlertTriangle, Package, ShoppingBag, X } from "lucide-react";

interface TimelineEvent {
  id: string;
  status: string;
  message: string;
  detail?: string | null;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; color: string }> = {
  PENDING: { icon: <Clock size={14} />, color: "bg-blue-500" },
  ACCEPTED: { icon: <Check size={14} />, color: "bg-green-500" },
  PREPARING: { icon: <ShoppingBag size={14} />, color: "bg-yellow-500" },
  WEIGHING: { icon: <Scale size={14} />, color: "bg-orange-500" },
  WEIGHT_REVIEW: { icon: <AlertTriangle size={14} />, color: "bg-red-500" },
  STOCK_ISSUE: { icon: <AlertTriangle size={14} />, color: "bg-red-500" },
  READY: { icon: <Package size={14} />, color: "bg-green-600" },
  PICKED_UP: { icon: <Check size={14} />, color: "bg-green-700" },
  CANCELLED: { icon: <X size={14} />, color: "bg-gray-500" },
};

export function OrderTimeline({ events }: { events: TimelineEvent[] }) {
  return (
    <div className="space-y-0">
      {events.map((event, idx) => {
        const config = STATUS_CONFIG[event.status] || STATUS_CONFIG.PENDING;
        const isLast = idx === events.length - 1;
        const time = new Date(event.createdAt);

        return (
          <div key={event.id} className="flex gap-3">
            {/* Timeline line + dot */}
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full ${config.color} text-white flex items-center justify-center flex-shrink-0 ${isLast ? "ring-4 ring-primary/10" : ""}`}>
                {config.icon}
              </div>
              {!isLast && <div className="w-0.5 flex-1 bg-border min-h-[24px]" />}
            </div>

            {/* Content */}
            <div className={`pb-5 ${isLast ? "" : ""}`}>
              <p className={`text-sm font-medium ${isLast ? "text-foreground" : "text-muted-foreground"}`}>
                {event.message}
              </p>
              {event.detail && (
                <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-line">{event.detail}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {time.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
