"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Wrapper: 5 taps rapides sur children → redirige vers /webmaster
 * Reset après 2s sans tap.
 */
export function SecretTapLogo({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [, setCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTap = useCallback(() => {
    setCount((prev) => {
      const next = prev + 1;

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCount(0), 2000);

      if (next >= 5) {
        setCount(0);
        router.push("/webmaster");
      }

      return next;
    });
  }, [router]);

  return (
    <button
      type="button"
      onClick={handleTap}
      className="bg-transparent border-none cursor-pointer p-0 select-none"
    >
      {children}
    </button>
  );
}
