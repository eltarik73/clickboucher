"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { IconButton } from "@/components/ui/icon-button";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <IconButton
      variant="subtle"
      label="Mode sombre"
      aria-pressed={theme === "dark"}
      onClick={toggleTheme}
      icon={
        <>
          <Moon size={18} className="dark:hidden" />
          <Sun size={18} className="hidden dark:block" />
        </>
      }
    />
  );
}
