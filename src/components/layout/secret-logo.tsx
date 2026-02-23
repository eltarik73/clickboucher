"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { KlikLogo, KlikWordmark } from "@/components/ui/KlikLogo";

export function SecretTapLogo() {
  const router = useRouter();
  const { userId } = useAuth();
  const [, setCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTap = useCallback(() => {
    setCount((prev) => {
      const next = prev + 1;

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCount(0), 3000);

      if (next >= 5) {
        setCount(0);
        // Check admin role before redirecting
        if (userId) {
          fetch("/api/auth/check-admin")
            .then((res) => {
              if (res.ok) {
                router.push("/admin");
              }
            })
            .catch(() => {});
        }
      }

      return next;
    });
  }, [router, userId]);

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
