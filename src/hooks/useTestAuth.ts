"use client";
// @security: test-only — Client-side role switching hook
// Activation: ?testmode=<secret> in URL → sets sessionStorage + cookie
// Deactivation: clears sessionStorage + cookies

import { useState, useEffect, useCallback } from "react";
import { TEST_USERS, type TestRole, getTestSecret } from "@/lib/auth/test-auth";

const ACTIVATED_KEY = "klikgo-test-activated";
const ROLE_KEY = "klikgo-test-role";

export function useTestAuth() {
  const [activated, setActivated] = useState(false);
  const [role, setRole] = useState<TestRole>("CLIENT");

  useEffect(() => {
    // 1. Check URL for secret activation
    const params = new URLSearchParams(window.location.search);
    const secret = params.get("testmode");
    const expectedSecret = getTestSecret();

    if (secret && expectedSecret && secret === expectedSecret) {
      // Activate test mode
      sessionStorage.setItem(ACTIVATED_KEY, "true");
      document.cookie = `${ACTIVATED_KEY}=true;path=/;max-age=86400;SameSite=Lax`;
      // Set default role
      const savedRole = sessionStorage.getItem(ROLE_KEY) as TestRole | null;
      const initialRole = savedRole && TEST_USERS[savedRole] ? savedRole : "CLIENT";
      sessionStorage.setItem(ROLE_KEY, initialRole);
      document.cookie = `${ROLE_KEY}=${initialRole};path=/;max-age=86400;SameSite=Lax`;
      setActivated(true);
      setRole(initialRole);

      // Clean URL (remove ?testmode= param)
      const url = new URL(window.location.href);
      url.searchParams.delete("testmode");
      window.history.replaceState({}, "", url.toString());
      return;
    }

    // 2. Check sessionStorage for existing activation
    const isActive = sessionStorage.getItem(ACTIVATED_KEY) === "true";
    if (isActive) {
      setActivated(true);
      // Ensure cookie is set (in case it was cleared)
      document.cookie = `${ACTIVATED_KEY}=true;path=/;max-age=86400;SameSite=Lax`;
      const savedRole = (sessionStorage.getItem(ROLE_KEY) || "CLIENT") as TestRole;
      if (TEST_USERS[savedRole]) {
        setRole(savedRole);
        document.cookie = `${ROLE_KEY}=${savedRole};path=/;max-age=86400;SameSite=Lax`;
      }
    }
  }, []);

  const switchRole = useCallback((newRole: TestRole) => {
    setRole(newRole);
    sessionStorage.setItem(ROLE_KEY, newRole);
    document.cookie = `${ROLE_KEY}=${newRole};path=/;max-age=86400;SameSite=Lax`;

    // Redirect to the right section
    const redirects: Record<TestRole, string> = {
      CLIENT: "/",
      BOUCHER: "/boucher/dashboard",
      ADMIN: "/webmaster",
    };
    window.location.href = redirects[newRole];
  }, []);

  const deactivate = useCallback(() => {
    // Clear sessionStorage
    sessionStorage.removeItem(ACTIVATED_KEY);
    sessionStorage.removeItem(ROLE_KEY);
    // Clear cookies
    document.cookie = `${ACTIVATED_KEY}=;path=/;max-age=0`;
    document.cookie = `${ROLE_KEY}=;path=/;max-age=0`;
    setActivated(false);
    // Reload to go back to normal Clerk mode
    window.location.href = "/";
  }, []);

  const user = TEST_USERS[role];

  return { activated, role, user, switchRole, deactivate };
}
