"use client";

import React, { useState } from "react";
import { AlertTriangle, RefreshCw, Trash2, Phone, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/utils";

interface StockItem {
  id: string;
  name: string;
  quantity: number;
  availableQty: number;
  unitPriceCents: number;
}

interface StockIssueWizardProps {
  orderId: string;
  orderNumber: string;
  items: StockItem[];
  onResolve: (itemId: string, action: "REPLACE" | "REMOVE" | "CONTACT", replacementName?: string) => void;
  onClose: () => void;
}

export function StockIssueWizard({ orderId, orderNumber, items, onResolve, onClose }: StockIssueWizardProps) {
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const [replacementNames, setReplacementNames] = useState<Record<string, string>>({});

  const handleResolve = (itemId: string, action: "REPLACE" | "REMOVE" | "CONTACT") => {
    onResolve(itemId, action, replacementNames[itemId]);
    setResolved(new Set([...resolved, itemId]));
  };

  const allResolved = items.every((i) => resolved.has(i.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle size={18} className="text-destructive" />
          <div>
            <h3 className="font-display font-bold text-sm">Rupture de stock</h3>
            <p className="text-xs text-muted-foreground font-mono">{orderNumber}</p>
          </div>
        </div>
        <button aria-label="Fermer" onClick={onClose} className="p-2 rounded-full hover:bg-muted">
          <X size={16} />
        </button>
      </div>

      {items.map((item) => {
        const isResolved = resolved.has(item.id);

        return (
          <div key={item.id} className={`premium-card p-3 space-y-3 ${isResolved ? "opacity-50" : ""}`}>
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">{item.name}</h4>
              {isResolved ? (
                <Badge variant="success" className="text-xs gap-1"><Check size={10} />Résolu</Badge>
              ) : (
                <Badge variant="destructive" className="text-xs">
                  {item.availableQty}/{item.quantity} dispo
                </Badge>
              )}
            </div>

            {!isResolved && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Le client a commandé {item.quantity} × {item.name}, mais seulement {item.availableQty} disponible{item.availableQty > 1 ? "s" : ""}. Que faire ?
                </p>

                {/* Option: Replace */}
                <div className="flex gap-2">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Nom du remplacement..."
                      value={replacementNames[item.id] || ""}
                      onChange={(e) => setReplacementNames({ ...replacementNames, [item.id]: e.target.value })}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm"
                    />
                  </div>
                  <Button
                    size="sm"
                    className="h-9 gap-1 text-xs"
                    onClick={() => handleResolve(item.id, "REPLACE")}
                    disabled={!replacementNames[item.id]}
                  >
                    <RefreshCw size={12} />
                    Remplacer
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-9 text-xs gap-1"
                    onClick={() => handleResolve(item.id, "REMOVE")}
                  >
                    <Trash2 size={12} />
                    Retirer ({formatPrice(-item.unitPriceCents * item.quantity)})
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1 h-9 text-xs gap-1"
                    onClick={() => handleResolve(item.id, "CONTACT")}
                  >
                    <Phone size={12} />
                    Contacter client
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {allResolved && (
        <Button className="w-full" onClick={onClose}>
          <Check size={16} className="mr-1" />
          Tout résolu — Reprendre la préparation
        </Button>
      )}
    </div>
  );
}
