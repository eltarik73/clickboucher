"use client";

import { Card, Badge, Btn } from "@/components/ui/shared";

const PRO_REQUESTS = [
  { id: "pr1", name: "Restaurant Le Savoyard", contact: "Pierre D.", type: "Restaurant", status: "pending" as const, date: "04/02/2026" },
  { id: "pr2", name: "Traiteur Alpes Events", contact: "Sarah K.", type: "Traiteur", status: "approved" as const, date: "02/02/2026" },
];

export default function WebmasterDemandesPage() {
  return (
    <div className="flex flex-col gap-2.5">
      {PRO_REQUESTS.map((r, i) => (
        <Card
          key={r.id}
          className="p-4 animate-fade-up"
          style={{ animationDelay: `${i * 70}ms` } as React.CSSProperties}
        >
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold">{r.name}</p>
                <Badge variant={r.status === "approved" ? "open" : "express"}>
                  {r.status === "approved" ? "✓ Approuvé" : "⏳ En attente"}
                </Badge>
              </div>
              <p className="text-[11px] text-stone-500 mt-1">
                {r.contact} • {r.type} • {r.date}
              </p>
            </div>
            {r.status === "pending" && (
              <div className="flex gap-1.5">
                <Btn size="sm" variant="success">Approuver</Btn>
                <Btn size="sm" variant="danger">Refuser</Btn>
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
