"use client";

import { useState, type ChangeEvent } from "react";

/** What the field lets through while typing: up to 5 euro digits, then a dot or a comma and up to 2 cent digits. */
const DRAFT_PATTERN = /^\d{0,5}(?:[.,]\d{0,2})?$/;
const AMOUNT_PATTERN = /^(\d{0,5})(?:[.,](\d{0,2}))?$/;

/**
 * A price typed in euros ('12.50', '12,5', '8', '.5') as integer cents, computed on the digits
 * (no float). null when the text is empty or is not an amount ('.', 'abc', '1.234').
 */
export function parseEuroDraft(draft: string): number | null {
  const match = AMOUNT_PATTERN.exec(draft.trim());
  if (match === null) return null;
  const euros = match[1];
  const cents = match[2] ?? "";
  if (euros === "" && cents === "") return null;
  return Number(euros || "0") * 100 + Number(cents.padEnd(2, "0"));
}

function centsToDraft(priceCents: number): string {
  if (priceCents === 0) return "";
  return `${Math.floor(priceCents / 100)}.${String(priceCents % 100).padStart(2, "0")}`;
}

interface CutOptionPriceInputProps {
  priceCents: number;
  onPriceCentsChange: (priceCents: number) => void;
  className?: string;
  "aria-label": string;
}

/**
 * Price per kilogram of a cut option. The text stays as typed ('12.' keeps its dot) and the parent
 * holds integer cents; an empty field is 0 cents, which the product validators refuse on save.
 */
export function CutOptionPriceInput({
  priceCents,
  onPriceCentsChange,
  className,
  "aria-label": ariaLabel,
}: CutOptionPriceInputProps) {
  const [draft, setDraft] = useState(() => centsToDraft(priceCents));

  // The parent changed the price itself (preset, row removed above: rows are keyed by index).
  const draftFromParent = centsToDraft(priceCents);
  if ((parseEuroDraft(draft) ?? 0) !== priceCents && draft !== draftFromParent) {
    setDraft(draftFromParent);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const text = event.target.value;
    if (text !== "" && !DRAFT_PATTERN.test(text)) return;
    setDraft(text);
    onPriceCentsChange(parseEuroDraft(text) ?? 0);
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={draft}
      onChange={handleChange}
      aria-label={ariaLabel}
      className={className}
    />
  );
}
