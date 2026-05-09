"use client";

// src/components/AnalyticsConsent.tsx
// Audit sécurité CTO #2 + RGPD 2026-05-09 : Plausible Analytics est
// cookieless mais la CNIL exige tout de même information utilisateur.
// Bandeau discret bottom + persistance choix localStorage.
//
// Si l'utilisateur refuse, le script Plausible n'est jamais chargé.
// Si l'utilisateur accepte, Plausible se charge via le hook (lazyOnload).

import { useEffect, useState } from "react";
import Script from "next/script";
import { X } from "lucide-react";

const STORAGE_KEY = "klikgo-analytics-consent";
type Consent = "accepted" | "refused" | null;

function readConsent(): Consent {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "accepted" || v === "refused" ? v : null;
  } catch {
    return null;
  }
}

function writeConsent(value: "accepted" | "refused") {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Quota ou private browsing — ignorer silencieusement
  }
}

export function AnalyticsConsent() {
  const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  const [consent, setConsent] = useState<Consent>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setConsent(readConsent());
    setHydrated(true);
  }, []);

  if (!plausibleDomain) return null;
  if (!hydrated) return null;

  const accept = () => {
    writeConsent("accepted");
    setConsent("accepted");
  };
  const refuse = () => {
    writeConsent("refused");
    setConsent("refused");
  };

  return (
    <>
      {/* Plausible chargé seulement si consenti */}
      {consent === "accepted" && (
        <Script
          defer
          data-domain={plausibleDomain}
          src="https://plausible.io/js/script.js"
          strategy="lazyOnload"
        />
      )}

      {/* Bandeau seulement si choix pas encore fait */}
      {consent === null && (
        <div
          role="dialog"
          aria-labelledby="analytics-consent-title"
          aria-describedby="analytics-consent-desc"
          className="fixed bottom-4 left-4 right-4 z-[60] mx-auto max-w-2xl rounded-2xl border border-[#ece8e3] bg-white p-4 shadow-2xl dark:border-white/10 dark:bg-[#141414] sm:bottom-6 sm:p-5"
          style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h2
                id="analytics-consent-title"
                className="text-sm font-bold text-gray-900 dark:text-white"
              >
                Statistiques anonymes
              </h2>
              <p
                id="analytics-consent-desc"
                className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-400"
              >
                Klik&amp;Go utilise Plausible Analytics pour mesurer l&apos;audience de manière
                anonyme et respectueuse de votre vie privée (sans cookie, sans suivi cross-site).
                Aucune donnée personnelle n&apos;est collectée.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={accept}
                  className="rounded-full bg-[#DC2626] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#b91c1c]"
                >
                  Accepter
                </button>
                <button
                  onClick={refuse}
                  className="rounded-full border border-[#ece8e3] bg-white px-4 py-2 text-xs font-semibold text-gray-700 transition hover:border-gray-400 dark:border-white/10 dark:bg-white/5 dark:text-gray-200"
                >
                  Refuser
                </button>
                <a
                  href="/politique-de-confidentialite"
                  className="inline-flex items-center px-3 py-2 text-xs font-medium text-gray-500 underline hover:text-[#DC2626] dark:text-gray-400"
                >
                  En savoir plus
                </a>
              </div>
            </div>
            <button
              onClick={refuse}
              aria-label="Fermer (équivalent à refuser)"
              className="shrink-0 rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-white/10"
            >
              <X size={16} className="text-gray-400" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
