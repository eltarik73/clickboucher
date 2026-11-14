// Mode cuisine : la page est prérendue sans stockage navigateur ni horloge du client. Le rendu
// d'hydratation doit produire le même HTML que le serveur, même quand le son a déjà été activé
// dans la session et que le mode simple est mémorisé (rechargement de la tablette).
import { act } from "@testing-library/react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import KitchenModePage from "@/app/(boucher)/boucher/commandes/page";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise<Response>(() => undefined))
  );
  sessionStorage.clear();
  localStorage.clear();
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.unstubAllGlobals();
  sessionStorage.clear();
  localStorage.clear();
});

describe("mode cuisine : hydratation", () => {
  it("hydrate sans écart quand le son est déjà activé et le mode simple mémorisé", async () => {
    const serverHtml = renderToString(<KitchenModePage />);
    sessionStorage.setItem("audioUnlocked", "true");
    localStorage.setItem("klikgo-simple-mode", "true");
    container = document.createElement("div");
    container.innerHTML = serverHtml;
    document.body.appendChild(container);
    const hydrationErrors: unknown[] = [];

    await act(async () => {
      root = hydrateRoot(container!, <KitchenModePage />, {
        onRecoverableError: (error) => hydrationErrors.push(error),
      });
    });

    expect(hydrationErrors).toEqual([]);
    expect(container.textContent).toContain("Chargement des commandes");
  });
});
