// Profile section « Marge de pesée »: the weighing tolerance reused by the customer's next orders,
// saved through PATCH /api/users/me { weighTolerance }. Nothing is checked for a customer who never
// chose: he chooses here or at his next order.
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { WeighToleranceChoice } from "@/components/cart/WeighToleranceChoice";
import { apiErrorMessage } from "@/lib/api/error-message";
import type { WeighToleranceChoice as Choice } from "@/lib/pricing/tolerance";

/** Null once saved; else the API's error message, or a generic one when the answer carries none. */
async function saveTolerance(choice: Choice): Promise<string | null> {
  const res = await fetch("/api/users/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ weighTolerance: choice }),
  }).catch((error: unknown) => {
    if (error instanceof TypeError) return null;
    throw error;
  });
  if (res === null) return "Erreur réseau : votre choix n'est pas enregistré. Réessayez.";
  // A body that is not the success envelope is an unexpected answer: shown as « not saved ».
  const body: unknown = await res.json().catch(() => null);
  const saved =
    res.ok &&
    typeof body === "object" &&
    body !== null &&
    "success" in body &&
    body.success === true;
  return saved ? null : apiErrorMessage(body, "Votre choix n'a pas été enregistré. Réessayez.");
}

export default function WeighToleranceSetting({ initial }: { initial: Choice | null }) {
  const [saved, setSaved] = useState(initial);
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (value === null) return;
    setSaving(true);
    setError(null);
    const failure = await saveTolerance(value);
    setSaving(false);
    if (failure !== null) {
      setError(failure);
      return;
    }
    setSaved(value);
    toast.success("Marge de pesée enregistrée");
  };

  return (
    <section>
      <WeighToleranceChoice
        value={value}
        saved={saved}
        estimatedTotalCents={null}
        onChange={setValue}
        disabled={saving}
      >
        <p role="alert" className="text-xs text-red-700 dark:text-red-400 [&:not(:empty)]:mt-2">
          {error ?? ""}
        </p>
        <Button
          type="button"
          onClick={() => void save()}
          disabled={value === null || value === saved}
          loading={saving}
          className="mt-3 w-full bg-[#DC2626] text-white hover:bg-[#b91c1c] disabled:opacity-50"
        >
          {saving ? "Enregistrement…" : "Enregistrer ma marge"}
        </Button>
      </WeighToleranceChoice>
    </section>
  );
}
