// src/hooks/useVisiblePolling.ts — Polling léger : onglet visible uniquement, single-flight, backoff sur échec
"use client";

import { useEffect, useRef } from "react";

/** Premier nouvel essai rapide après un échec (ex. cookie Clerk expiré au retour sur l'onglet). */
const FAST_RETRY_MS = 5_000;
/** Plafond du backoff exponentiel (15 min). */
const MAX_BACKOFF_MS = 900_000;
/** Au-delà, le compteur d'échecs n'augmente plus. */
const MAX_FAILURES = 6;

/** Cadence du suivi d'une commande tant que tout va bien. */
const ORDER_POLL_MS = 5_000;
/** Plafond du backoff du suivi de commande. */
const ORDER_MAX_BACKOFF_MS = 60_000;
/** Essais 401/403 avant abandon quand la commande n'a jamais pu être chargée. */
const ORDER_AUTH_MAX_TRIES = 3;

/**
 * Délai avant le prochain appel d'un poller de fond.
 * `failures` = nombre d'échecs consécutifs (0 après un succès).
 * Succès : cadence normale. 1er échec : nouvel essai rapide. Ensuite : backoff exponentiel plafonné.
 */
export function nextPollDelay(intervalMs: number, failures: number): number {
  if (failures <= 0) return intervalMs;
  if (failures === 1) return Math.min(FAST_RETRY_MS, intervalMs);
  return Math.max(intervalMs, Math.min(intervalMs * 2 ** (failures - 1), MAX_BACKOFF_MS));
}

/**
 * Délai avant le prochain appel du suivi d'une commande (/commande/[id]), ou `null` pour arrêter.
 * `httpStatus` = statut de la dernière réponse (0 = erreur réseau).
 * `failures` = nombre d'échecs consécutifs, dernier appel inclus (0 = succès).
 * - 404 : arrêt définitif.
 * - 401/403 sans aucun chargement réussi (lien anonyme ou commande d'un autre compte) : 3 essais puis arrêt.
 * - Tout autre échec : jamais d'arrêt, backoff 5 → 10 → 20 → 40 → 60 s.
 */
export function nextOrderPollDelay({
  httpStatus,
  everLoaded,
  failures,
}: {
  httpStatus: number;
  everLoaded: boolean;
  failures: number;
}): number | null {
  if (failures <= 0) return ORDER_POLL_MS;
  if (httpStatus === 404) return null;
  if (!everLoaded && (httpStatus === 401 || httpStatus === 403)) {
    return failures >= ORDER_AUTH_MAX_TRIES ? null : ORDER_POLL_MS;
  }
  return Math.min(ORDER_POLL_MS * 2 ** (failures - 1), ORDER_MAX_BACKOFF_MS);
}

type WakeEvent = "focus" | "online";

interface VisiblePollingOptions {
  /** Appelé au réveil (onglet de nouveau visible, ou événement `wakeOn`) juste avant l'appel immédiat. */
  onWake?: () => void;
  /** Événements `window` qui déclenchent aussi un réveil. */
  wakeOn?: readonly WakeEvent[];
}

/**
 * Boucle de polling sans React. `tick` fait un appel et renvoie le délai (ms) avant le suivant,
 * ou `null` pour arrêter définitivement ; il ne doit pas lever d'exception.
 * - Aucun appel tant que l'onglet est caché ; appel immédiat quand il redevient visible.
 * - Single-flight : un réveil pendant un appel en cours ne démarre pas une seconde chaîne.
 * Renvoie la fonction d'arrêt (timer + listeners).
 */
export function startVisiblePolling(
  tick: () => Promise<number | null>,
  { onWake, wakeOn = [] }: VisiblePollingOptions = {}
): () => void {
  let stopped = false;
  let inFlight = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clearTimer = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  const stop = () => {
    stopped = true;
    clearTimer();
    document.removeEventListener("visibilitychange", wake);
    wakeOn.forEach((evt) => window.removeEventListener(evt, wake));
  };

  const run = async () => {
    if (stopped || inFlight || document.visibilityState !== "visible") return;
    inFlight = true;
    let delay: number | null = null;
    try {
      delay = await tick();
    } finally {
      inFlight = false;
    }
    if (stopped) return;
    if (delay === null) {
      stop();
      return;
    }
    clearTimer();
    timer = setTimeout(run, delay);
  };

  function wake() {
    if (stopped || document.visibilityState !== "visible") return;
    clearTimer();
    onWake?.();
    void run();
  }

  document.addEventListener("visibilitychange", wake);
  wakeOn.forEach((evt) => window.addEventListener(evt, wake));
  void run();

  return stop;
}

/**
 * Appelle `fn` au montage puis toutes les `intervalMs`, uniquement quand l'onglet est visible.
 * `fn` renvoie `false` (ou lève) pour signaler un échec : nouvel essai à 5 s puis backoff
 * exponentiel jusqu'à 15 min. Le retour sur l'onglet (ou du réseau) relance tout de suite.
 */
export function useVisiblePolling(
  fn: () => Promise<boolean | void>,
  intervalMs: number,
  enabled = true
): void {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!enabled) return;
    let failures = 0;

    return startVisiblePolling(
      async () => {
        let ok = true;
        try {
          ok = (await fnRef.current()) !== false;
        } catch {
          ok = false;
        }
        failures = ok ? 0 : Math.min(failures + 1, MAX_FAILURES);
        return nextPollDelay(intervalMs, failures);
      },
      {
        onWake: () => {
          failures = 0;
        },
        wakeOn: ["online"],
      }
    );
  }, [intervalMs, enabled]);
}
