import React from "react";
import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  padBottom?: boolean;
}

export function PageContainer({
  children,
  className,
  padBottom = true,
}: PageContainerProps) {
  return (
    <main
      className={cn(
        "mx-auto min-h-dvh w-full max-w-4xl",
        padBottom && "pb-safe",
        className
      )}
    >
      {children}
    </main>
  );
}
