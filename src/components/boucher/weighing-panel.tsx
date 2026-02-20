"use client";

import React, { useState } from "react";
import { Scale, Check, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatPrice, formatWeight } from "@/lib/utils";

interface WeighItem {
  id: string;
  name: string;
  requestedWeight: number;
  unitPriceCents: number;
}

interface WeighResult {
  id: string;
  actualWeight: number;
  deviation: number;
  exceeds: boolean;
  adjustedPrice: number;
}

interface WeighingPanelProps {
  orderId: string;
  orderNumber: string;
  items: WeighItem[];
  onSubmit: (results: WeighResult[]) => void;
  onCancel: () => void;
}

export function WeighingPanel({ orderId: _orderId, orderNumber, items, onSubmit, onCancel }: WeighingPanelProps) {
  const [weights, setWeights] = useState<Record<string, number>>(
    Object.fromEntries(items.map((i) => [i.id, i.requestedWeight]))
  );

  const results: WeighResult[] = items.map((item) => {
    const actual = weights[item.id] || 0;
    const deviation = ((actual - item.requestedWeight) / item.requestedWeight) * 100;
    const adjustedPrice = Math.round((actual / 1000) * item.unitPriceCents);
    return {
      id: item.id,
      actualWeight: actual,
      deviation: Math.round(deviation * 10) / 10,
      exceeds: deviation > 10,
      adjustedPrice,
    };
  });

  const hasExceeding = results.some((r) => r.exceeds);
  const hasUnderweight = results.some((r) => r.deviation < -10);
  const totalAdjustment = results.reduce(
    (sum, r, i) => sum + (r.adjustedPrice - Math.round((items[i].requestedWeight / 1000) * items[i].unitPriceCents)),
    0
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scale size={18} className="text-primary" />
          <div>
            <h3 className="font-display font-bold text-sm">Pesée</h3>
            <p className="text-xs text-muted-foreground font-mono">{orderNumber}</p>
          </div>
        </div>
        <button aria-label="Annuler" onClick={onCancel} className="p-2 rounded-full hover:bg-muted">
          <X size={16} />
        </button>
      </div>

      {/* Weight inputs per item */}
      {items.map((item, idx) => {
        const result = results[idx];
        const deviationColor = result.exceeds ? "text-red-600" : result.deviation < -10 ? "text-orange-600" : "text-green-600";

        return (
          <div key={item.id} className="premium-card p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">{item.name}</h4>
              <Badge variant="outline" className="text-xs">
                Demandé : {formatWeight(item.requestedWeight)}
              </Badge>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">Poids réel (g)</label>
                <Input
                  type="number"
                  min={0}
                  step={10}
                  value={weights[item.id]}
                  onChange={(e) => setWeights({ ...weights, [item.id]: Number(e.target.value) })}
                  className="h-12 text-lg font-mono text-center"
                  autoFocus={idx === 0}
                />
              </div>
              <div className="text-right space-y-1 min-w-[80px]">
                <p className={`text-sm font-bold ${deviationColor}`}>
                  {result.deviation > 0 ? "+" : ""}{result.deviation}%
                </p>
                <p className="text-xs text-muted-foreground">{formatPrice(result.adjustedPrice)}</p>
                {result.exceeds && (
                  <Badge variant="destructive" className="text-[10px]">
                    <AlertTriangle size={10} className="mr-0.5" />
                    &gt;+10%
                  </Badge>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Summary */}
      <div className="p-3 rounded-xl bg-muted/50 space-y-1.5">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Ajustement total</span>
          <span className={`font-bold ${totalAdjustment > 0 ? "text-red-600" : totalAdjustment < 0 ? "text-green-600" : ""}`}>
            {totalAdjustment > 0 ? "+" : ""}{formatPrice(totalAdjustment)}
          </span>
        </div>
        {hasExceeding && (
          <p className="text-xs text-red-600 flex items-center gap-1">
            <AlertTriangle size={11} />
            Écart &gt;+10% : la validation du client sera requise
          </p>
        )}
        {hasUnderweight && (
          <p className="text-xs text-orange-600 flex items-center gap-1">
            <AlertTriangle size={11} />
            Poids insuffisant (&lt;-10%) : complétez ou demandez l&apos;accord du client
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onCancel}>
          Annuler
        </Button>
        <Button
          className="flex-1 gap-1"
          onClick={() => onSubmit(results)}
          disabled={hasUnderweight || results.some((r) => r.actualWeight <= 0)}
        >
          <Check size={16} />
          Valider pesée
        </Button>
      </div>
    </div>
  );
}
