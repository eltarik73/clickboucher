"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { KlikLogo, KlikWordmark } from "@/components/ui/KlikLogo";

export function SecretTapLogo() {
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
      onClick={handleTap}
      className="flex items-center gap-2 bg-transparent border-none cursor-pointer p-0 select-none"
    >
      <KlikLogo size={28} />
      <KlikWordmark size="sm" />
    </button>
  );
}
