// @vitest-environment node
// public/sw.js exécuté tel quel dans un faux contexte de service worker : gestionnaires collectés
// par self.addEventListener, CacheStorage en mémoire, fetch simulé (le réseau est la frontière).
// Régressions attrapées : pages privées (/panier, /commandes, /boucher/...) copiées dans Cache
// Storage puis resservies hors ligne, réponses `private` ou `no-store` stockées, charges RSC et
// images optimisées accumulées sans limite, ancien cache `klikgo-v1` jamais supprimé.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

const ORIGIN = "https://klikandgo.app";
const SOURCE = fs.readFileSync(path.join(process.cwd(), "public/sw.js"), "utf8");

interface FakeRequest {
  url: string;
  method: string;
  mode: string;
  headers: Headers;
}

type Network = (request: FakeRequest) => Promise<Response>;

interface FakeEvent {
  request?: FakeRequest;
  data?: { json: () => unknown };
  respondWith: (response: Promise<Response> | Response) => void;
  waitUntil: (promise: Promise<unknown>) => void;
}

/** CacheStorage en mémoire : un cache par nom, entrées indexées par URL absolue. */
class FakeCaches {
  readonly stores = new Map<string, Map<string, Response>>();

  private static key(request: FakeRequest | string): string {
    return typeof request === "string" ? new URL(request, ORIGIN).href : request.url;
  }

  async open(name: string) {
    const store = this.stores.get(name) ?? new Map<string, Response>();
    this.stores.set(name, store);
    return {
      put: async (request: FakeRequest | string, response: Response) => {
        store.set(FakeCaches.key(request), response);
      },
      match: async (request: FakeRequest | string) => store.get(FakeCaches.key(request)),
      addAll: async (urls: string[]) => {
        for (const url of urls)
          store.set(FakeCaches.key(url), new Response(`précache ${url}`, { status: 200 }));
      },
    };
  }

  async match(request: FakeRequest | string): Promise<Response | undefined> {
    for (const store of this.stores.values()) {
      const hit = store.get(FakeCaches.key(request));
      if (hit) return hit;
    }
    return undefined;
  }

  async keys(): Promise<string[]> {
    return [...this.stores.keys()];
  }

  async delete(name: string): Promise<boolean> {
    return this.stores.delete(name);
  }

  urls(): string[] {
    return [...this.stores.values()].flatMap((store) => [...store.keys()]);
  }
}

function request(pathOrUrl: string, init: Partial<Omit<FakeRequest, "url">> = {}): FakeRequest {
  return {
    url: new URL(pathOrUrl, ORIGIN).href,
    method: init.method ?? "GET",
    mode: init.mode ?? "no-cors",
    headers: init.headers ?? new Headers(),
  };
}

const navigation = (pathname: string): FakeRequest =>
  request(pathname, { mode: "navigate", headers: new Headers({ Accept: "text/html" }) });

function networkResponse(
  body: string,
  init: { status?: number; cacheControl?: string } = {}
): Response {
  const headers = new Headers();
  if (init.cacheControl !== undefined) headers.set("Cache-Control", init.cacheControl);
  const response = new Response(body, { status: init.status ?? 200, headers });
  // Une réponse construite vaut type "default" ; celle d'un fetch de même origine vaut "basic".
  Object.defineProperty(response, "type", { value: "basic" });
  return response;
}

const offline: Network = () => Promise.reject(new TypeError("Failed to fetch"));

function loadWorker(network: Network) {
  const handlers = new Map<string, (event: FakeEvent) => void>();
  const caches = new FakeCaches();
  const fetchCalls: string[] = [];
  const showNotification = vi.fn(async (_title: string, _options: object) => undefined);
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, handler: (event: FakeEvent) => void) =>
      handlers.set(type, handler),
    skipWaiting: async () => undefined,
    clients: { claim: async () => undefined },
    registration: { showNotification },
  };
  const fetchStub = (req: FakeRequest) => {
    fetchCalls.push(req.url);
    return network(req);
  };
  new Function("self", "caches", "fetch", "URL", SOURCE)(self, caches, fetchStub, URL);

  async function dispatch(type: string, init: Pick<FakeEvent, "request" | "data"> = {}) {
    let responded: Promise<Response> | undefined;
    const extensions: Promise<unknown>[] = [];
    const handler = handlers.get(type);
    if (!handler) throw new Error(`aucun gestionnaire « ${type} »`);
    handler({
      ...init,
      respondWith: (response) => {
        responded = Promise.resolve(response);
      },
      waitUntil: (promise) => {
        extensions.push(promise);
      },
    });
    const response = responded === undefined ? undefined : await responded;
    // waitUntil peut être appelé pendant la réponse (écriture en cache) : tout attendre.
    for (let i = 0; i < extensions.length; i += 1) await extensions[i];
    return { intercepted: responded !== undefined, response };
  }

  return { caches, fetchCalls, showNotification, dispatch };
}

async function installedWorker(network: Network) {
  const worker = loadWorker(network);
  await worker.dispatch("install");
  await worker.dispatch("activate");
  return worker;
}

describe("public/sw.js — installation et activation", () => {
  it("supprime l'ancien cache klikgo-v1 et ne garde que klikgo-v2", async () => {
    const worker = loadWorker(offline);
    const legacy = await worker.caches.open("klikgo-v1");
    await legacy.put(`${ORIGIN}/commandes`, new Response("commandes privées"));

    await worker.dispatch("install");
    await worker.dispatch("activate");

    expect(await worker.caches.keys()).toEqual(["klikgo-v2"]);
    expect(await worker.caches.match(`${ORIGIN}/commandes`)).toBeUndefined();
  });

  it("précache la page hors ligne mais pas la page d'accueil", async () => {
    const worker = await installedWorker(offline);

    expect(worker.caches.urls()).toContain(`${ORIGIN}/offline.html`);
    expect(worker.caches.urls()).not.toContain(`${ORIGIN}/`);
  });
});

describe("public/sw.js — navigations", () => {
  it("sert une navigation réussie depuis le réseau sans la stocker", async () => {
    const page = networkResponse("<html>boutique</html>", {
      cacheControl: "s-maxage=300, stale-while-revalidate",
    });
    const worker = await installedWorker(async () => page);

    const { response } = await worker.dispatch("fetch", {
      request: navigation("/boutique/el-fathe"),
    });

    expect(response).toBe(page);
    expect(worker.caches.urls()).not.toContain(`${ORIGIN}/boutique/el-fathe`);
  });

  it("hors ligne, sert /offline.html et jamais une copie d'une page visitée", async () => {
    let online = true;
    const worker = await installedWorker((req) =>
      online ? Promise.resolve(networkResponse(`<html>${req.url}</html>`)) : offline(req)
    );
    await worker.dispatch("fetch", { request: navigation("/commandes") });
    online = false;

    const { response } = await worker.dispatch("fetch", { request: navigation("/commandes") });

    expect(response).toBe(await worker.caches.match(`${ORIGIN}/offline.html`));
    expect(await response?.text()).toBe("précache /offline.html");
  });
});

describe("public/sw.js — fichiers statiques", () => {
  it("stocke un fichier statique de même origine répondu 200 sans Cache-Control, puis le sert du cache", async () => {
    const network = vi.fn<Network>(async () => networkResponse("console.log(1)"));
    const worker = await installedWorker(network);
    const chunk = request("/_next/static/chunks/app-1a2b.js");

    const first = await worker.dispatch("fetch", { request: chunk });
    const second = await worker.dispatch("fetch", { request: chunk });

    expect(await first.response?.text()).toBe("console.log(1)");
    expect(worker.caches.urls()).toContain(`${ORIGIN}/_next/static/chunks/app-1a2b.js`);
    expect(await second.response?.text()).toBe("console.log(1)");
    expect(network).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["Cache-Control private", { cacheControl: "private, max-age=0" }],
    ["Cache-Control no-store", { cacheControl: "no-store" }],
    ["Cache-Control NO-STORE en majuscules", { cacheControl: "no-cache, NO-STORE" }],
    ["statut 404", { status: 404 }],
  ])("ne stocke pas une réponse avec %s, mais la transmet", async (_label, init) => {
    const answer = networkResponse("contenu", init);
    const worker = await installedWorker(async () => answer);

    const { response } = await worker.dispatch("fetch", {
      request: request("/icons/avatar-client.png"),
    });

    expect(response).toBe(answer);
    expect(worker.caches.urls()).not.toContain(`${ORIGIN}/icons/avatar-client.png`);
  });
});

describe("public/sw.js — requêtes non interceptées", () => {
  it.each([
    [
      "une charge RSC (en-tête RSC: 1)",
      request("/panier?_rsc=1x2y3", { mode: "cors", headers: new Headers({ RSC: "1" }) }),
    ],
    [
      "une image optimisée /_next/image",
      request("/_next/image?url=%2Fimg%2Fproducts%2Fboeuf-1.jpg&w=640&q=60"),
    ],
    ["une image d'une autre origine", request("https://images.unsplash.com/photo-123.jpg")],
    [
      "un script Clerk",
      request("https://clerk.klikandgo.app/npm/@clerk/clerk-js@5/dist/clerk.browser.js"),
    ],
    ["un appel /api/", request("/api/cart", { mode: "cors" })],
    ["une requête POST", request("/panier", { method: "POST", mode: "cors" })],
  ])("laisse passer %s sans respondWith ni stockage", async (_label, req) => {
    const worker = await installedWorker(async () => networkResponse("réseau"));
    const before = worker.caches.urls();

    const { intercepted } = await worker.dispatch("fetch", { request: req });

    expect(intercepted).toBe(false);
    expect(worker.fetchCalls).toEqual([]);
    expect(worker.caches.urls()).toEqual(before);
  });
});

describe("public/sw.js — notifications push (inchangées)", () => {
  it("affiche la notification reçue avec son lien et son étiquette", async () => {
    const worker = await installedWorker(offline);
    const payload = {
      title: "Commande prête",
      body: "Votre commande vous attend",
      url: "/suivi/abc",
      tag: "order-abc",
    };

    await worker.dispatch("push", { data: { json: () => payload } });

    expect(worker.showNotification).toHaveBeenCalledWith(
      "Commande prête",
      expect.objectContaining({
        body: "Votre commande vous attend",
        data: { url: "/suivi/abc" },
        tag: "order-abc",
      })
    );
  });
});
