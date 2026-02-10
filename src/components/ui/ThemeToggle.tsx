"use client";

import { useTheme } from "@/components/providers/ThemeProvider";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Mode clair" : "Mode sombre"}
      className="w-9 h-9 rounded-full flex items-center justify-center transition-colors bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-white"
    >
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
