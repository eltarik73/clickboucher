// src/hooks/use-stored-flag.ts — a "true"/"false" flag kept in the browser's session or local
// storage, read only after mount. The server has no storage: reading it in the first render would
// make the hydration render differ from the server HTML (React errors #418 / #422).
"use client";

import { useEffect, useState } from "react";

export type FlagStorage = "session" | "local";

function readFlag(area: FlagStorage, key: string): boolean {
  try {
    const storage = area === "session" ? window.sessionStorage : window.localStorage;
    return storage.getItem(key) === "true";
  } catch {
    return false;
  }
}

/**
 * The flag stored under `key`: null during the server render and the hydration render, then the
 * stored value (false when absent or unreadable). The setter changes the state only; the caller
 * writes the storage.
 */
export function useStoredFlag(
  area: FlagStorage,
  key: string
): [boolean | null, (value: boolean) => void] {
  const [value, setValue] = useState<boolean | null>(null);
  useEffect(() => {
    setValue(readFlag(area, key));
  }, [area, key]);
  return [value, setValue];
}
