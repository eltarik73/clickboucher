"use client";

import { Toaster as SonnerToaster } from "sonner";
import { useTheme } from "@/components/providers/ThemeProvider";

export function Toaster() {
  const { theme } = useTheme();
  return <SonnerToaster position="top-center" richColors theme={theme} />;
}
