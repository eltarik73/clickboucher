// src/components/pwa/ServiceWorkerRegistration.tsx — Register SW on mount
"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => {
          // SW registered successfully
        })
        .catch(() => {
          // SW registration failed — non-critical
        });
    }
  }, []);

  return null;
}
