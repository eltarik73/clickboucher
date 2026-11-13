// Helpers client pour le mode test.
//
// Le cookie `klikgo-test-activated` est posé par /api/test-mode/activate avec
// httpOnly:false : le navigateur peut donc savoir, sans appel réseau, si une
// session de test est active. Hors mode test (100 % du trafic de prod), cela
// évite d'interroger /api/test-mode/status et les endpoints par-utilisateur
// à chaque page vue (chaque appel = 1 middleware + 1 fonction facturés).

const TEST_COOKIE_RE = /(?:^|;\s*)klikgo-test-activated=true(?:;|$)/;

/** `true` si la chaîne de cookies contient le cookie d'activation du mode test. */
export function cookieStringHasTestMode(cookie: string): boolean {
  return TEST_COOKIE_RE.test(cookie);
}

/** `true` si le cookie d'activation du mode test est présent (toujours `false` côté serveur). */
export function hasTestModeCookie(): boolean {
  if (typeof document === "undefined") return false;
  return cookieStringHasTestMode(document.cookie);
}

/** `true` si l'URL courante porte `?testmode=…` (tentative d'activation). */
export function urlHasTestModeParam(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has("testmode");
}
