"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function SecretTapLogo() {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTap = useCallback(() => {
    setCount((prev) => {
      const next = prev + 1;

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCount(0), 2000);

      if (next >= 5) {
        setCount(0);
        // Navigate to webmaster login
        router.push("/webmaster");
      }

      return next;
    });
  }, [router]);

  return (
    <button
      onClick={handleTap}
      className="flex items-center gap-2 bg-transparent border-none cursor-pointer p-0 select-none"
    >
      <span className="text-[22px]">🥩</span>
      <span className="font-display text-[19px] font-extrabold text-[#DC2626] tracking-tight">
        ClickBoucher
      </span>
    </button>
  );
}
