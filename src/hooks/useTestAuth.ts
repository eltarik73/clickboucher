"use client";
// @security: test-only — Client-side role switching hook
// Activation: ?testmode=<secret> in URL → calls /api/test-mode/activate (server validates)
// Deactivation: calls DELETE /api/test-mode/activate
//
// IMPORTANT: this hook NEVER compares the secret in the browser.
// The secret is verified server-side only — the client just relays it.

import { useState, useEffect, useCallback } from "react";
import { TEST_USERS, type TestRole } from "@/lib/auth/test-auth";

type StatusResp = {
  success: boolean;
  data?: { enabled: boolean; activated: boolean; role: string | null };
};

export function useTestAuth() {
  const [enabled, setEnabled] = useState(false);
  const [activated, setActivated] = useState(false);
  const [role, setRole] = useState<TestRole>("CLIENT");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // 1. Check current activation status from server
      let status: StatusResp | null = null;
      try {
        const r = await fetch("/api/test-mode/status", { credentials: "include" });
        status = (await r.json()) as StatusResp;
      } catch {
        status = null;
      }
      if (cancelled) return;

      const isEnabled = !!status?.data?.enabled;
      setEnabled(isEnabled);

      // 2. If URL has ?testmode=<secret>, send to server for activation
      const params = new URLSearchParams(window.location.search);
      const secret = params.get("testmode");

      if (secret && isEnabled) {
        const desiredRole =
          (sessionStorage.getItem("klikgo-test-role") as TestRole | null) || "CLIENT";
        try {
          const resp = await fetch("/api/test-mode/activate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ secret, role: desiredRole }),
          });
          if (resp.ok) {
            const j = await resp.json();
            const activatedRole = (j?.data?.role || "CLIENT") as TestRole;
            sessionStorage.setItem("klikgo-test-role", activatedRole);
            setActivated(true);
            setRole(TEST_USERS[activatedRole] ? activatedRole : "CLIENT");
          }
        } catch {
          // ignore
        }
        // Clean URL
        const url = new URL(window.location.href);
        url.searchParams.delete("testmode");
        window.history.replaceState({}, "", url.toString());
        return;
      }

      // 3. No URL secret — reflect server state
      if (status?.data?.activated) {
        const r = (status.data.role || "CLIENT") as TestRole;
        setActivated(true);
        if (TEST_USERS[r]) setRole(r);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const switchRole = useCallback((newRole: TestRole) => {
    setRole(newRole);
    sessionStorage.setItem("klikgo-test-role", newRole);
    // Update cookie via server (re-activate with same secret-less request not possible)
    // We just set the role cookie client-side here — the server already trusts an activated session.
    document.cookie = `klikgo-test-role=${newRole};path=/;max-age=86400;SameSite=Lax`;

    const redirects: Record<TestRole, string> = {
      CLIENT: "/",
      BOUCHER: "/boucher/dashboard",
      ADMIN: "/webmaster",
    };
    window.location.href = redirects[newRole];
  }, []);

  const deactivate = useCallback(async () => {
    try {
      await fetch("/api/test-mode/activate", { method: "DELETE", credentials: "include" });
    } catch {
      // ignore
    }
    sessionStorage.removeItem("klikgo-test-role");
    document.cookie = "klikgo-test-activated=;path=/;max-age=0";
    document.cookie = "klikgo-test-role=;path=/;max-age=0";
    setActivated(false);
    window.location.href = "/";
  }, []);

  const user = TEST_USERS[role];

  return { enabled, activated, role, user, switchRole, deactivate };
}
