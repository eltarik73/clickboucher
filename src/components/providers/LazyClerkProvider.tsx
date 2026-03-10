"use client";

import { Component, useEffect, useState, type ReactNode } from "react";

// Singleton — Clerk module loaded once, shared across renders
let clerkLoadPromise: Promise<[any, any]> | null = null;
function loadClerk() {
  if (!clerkLoadPromise) {
    clerkLoadPromise = Promise.all([
      import("@clerk/nextjs"),
      import("@clerk/localizations"),
    ]);
  }
  return clerkLoadPromise;
}

/**
 * Error boundary for the brief window between first paint and Clerk load.
 * Catches "useUser must be used within ClerkProvider" errors and shows a spinner.
 * Once ClerkProvider mounts, this boundary is unmounted entirely.
 */
class ClerkLoadingBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black">
          <div className="w-8 h-8 border-2 border-[#DC2626] border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * LazyClerkProvider — loads Clerk asynchronously after first paint.
 *
 * SSR: renders {children} immediately (no Clerk overhead, no 250KiB JS).
 * Client: imports @clerk/nextjs, wraps children with ClerkProvider.
 *
 * Pages using Clerk hooks (useUser, SignedIn, etc.) see a brief spinner
 * on direct navigation until Clerk loads (~100ms).
 */
export function LazyClerkProvider({ children }: { children: ReactNode }) {
  const [ctx, setCtx] = useState<{ Provider: any; frFR: any } | null>(null);

  useEffect(() => {
    loadClerk().then(([clerk, loc]) => {
      setCtx({ Provider: clerk.ClerkProvider, frFR: loc.frFR });
    });
  }, []);

  if (ctx) {
    return <ctx.Provider localization={ctx.frFR}>{children}</ctx.Provider>;
  }

  // Before Clerk loads: render children with error boundary for safety
  return <ClerkLoadingBoundary>{children}</ClerkLoadingBoundary>;
}
