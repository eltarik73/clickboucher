"use client";

import dynamic from "next/dynamic";

const ServiceWorkerRegistration = dynamic(
  () => import("@/components/pwa/ServiceWorkerRegistration"),
  { ssr: false }
);
const InstallPrompt = dynamic(() => import("@/components/pwa/InstallPrompt"), { ssr: false });
const OfflineBanner = dynamic(() => import("@/components/pwa/OfflineBanner"), { ssr: false });
const TestRoleSwitcher = dynamic(
  () => import("@/components/test/TestRoleSwitcher").then((m) => m.TestRoleSwitcher),
  { ssr: false }
);
// Cookie consent RGPD (audit CTO #2 2026-05-09) — lazy car bandeau visible
// uniquement après hydration côté client.
const AnalyticsConsent = dynamic(
  () => import("@/components/AnalyticsConsent").then((m) => m.AnalyticsConsent),
  { ssr: false }
);

// Îlots purement client du layout racine : Next 15 refuse qu'un Server Component
// déclare un import dynamique sans rendu serveur.
export function RootIslands() {
  return (
    <>
      <ServiceWorkerRegistration />
      <OfflineBanner />
      <InstallPrompt />
      <AnalyticsConsent />
      <TestRoleSwitcher />
    </>
  );
}
