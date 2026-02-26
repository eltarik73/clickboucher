"use client";
// @security: test-only — Client-side role switching hook

import { useState, useEffect } from "react";
import { TEST_USERS, type TestRole } from "@/lib/auth/test-auth";

const STORAGE_KEY = "klikgo-test-role";

export function useTestAuth() {
  const [role, setRole] = useState<TestRole>("CLIENT");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as TestRole | null;
    if (saved && TEST_USERS[saved]) {
      setRole(saved);
      // Sync cookie for server-side
      document.cookie = `klikgo-test-role=${saved};path=/;max-age=86400`;
    }
  }, []);

  const switchRole = (newRole: TestRole) => {
    setRole(newRole);
    localStorage.setItem(STORAGE_KEY, newRole);
    document.cookie = `klikgo-test-role=${newRole};path=/;max-age=86400`;

    // Rediriger vers la bonne section
    const redirects: Record<TestRole, string> = {
      CLIENT: "/decouvrir",
      BOUCHER: "/boucher/commandes",
      ADMIN: "/webmaster",
    };
    window.location.href = redirects[newRole];
  };

  const user = TEST_USERS[role];

  return { role, user, switchRole, isTestMode: true };
}
