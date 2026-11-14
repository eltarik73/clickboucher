// @vitest-environment node
// Retouche vue du navigateur (src/components/boucher/photos/retouch-request.ts) :
// - la photo du produit n'est proposée d'emblée comme source que si c'est un fichier de notre
//   magasin Blob (la route de retouche exige une URL absolue que le fournisseur sait lire) ;
// - toute réponse, JSON ou non (413 et 504 text/plain de Vercel), devient un message français ;
// - la demande envoie une URL absolue, même pour un fichier du magasin local.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  interpretRetouchResponse,
  requestRetouch,
  retouchSourceUrl,
  RETOUCH_ENDPOINT,
  type RetouchOutcome,
} from "@/components/boucher/photos/retouch-request";
import { UPLOAD_MESSAGES_FR } from "@/lib/images/upload-contract";

const STORE = "https://nzqbbcqekyom7ajd.public.blob.vercel-storage.com";
const SOURCE = `${STORE}/shops/s1/retouch-source/0f8fad5b-d9cb-469f-a165-70867728950e.webp`;
const RESULT = { originalUrl: SOURCE, images: [{ id: "cm3img0001", url: `${STORE}/shops/s1/retouched/1-v0.png` }] };
const JSON_TYPE = "application/json; charset=utf-8";

function message(outcome: RetouchOutcome): string {
  if (outcome.ok) throw new Error("succès inattendu");
  return outcome.messageFr;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("retouchSourceUrl — la photo du produit proposée comme source", () => {
  it.each<[string, string | null | undefined, string | undefined]>([
    ["fichier de notre magasin Blob", SOURCE, SOURCE],
    ["photo historique de notre magasin", `${STORE}/products/product-1772114082715-3e9f77cb76d4b0eb.webp`, `${STORE}/products/product-1772114082715-3e9f77cb76d4b0eb.webp`],
    ["« Photo actuelle » du catalogue du site (/img)", "/img/products/merguez.jpg", undefined],
    ["fichier du magasin local (relatif)", "/local-images/shops/s1/product/0f8fad5b-d9cb-469f-a165-70867728950e.webp", undefined],
    ["photo Unsplash historique", "https://images.unsplash.com/photo-1?w=400", undefined],
    ["URL replicate.delivery expirée", "https://x.replicate.delivery/a.png", undefined],
    ["aucune photo (null)", null, undefined],
    ["aucune photo (undefined)", undefined, undefined],
  ])("%s", (_case, url, expected) => {
    vi.stubEnv("NEXT_PUBLIC_IMAGE_BLOB_HOST", "");
    expect(retouchSourceUrl(url)).toBe(expected);
  });
});

describe("interpretRetouchResponse", () => {
  it("201 JSON avec des retouches → ok avec le résultat", () => {
    expect(interpretRetouchResponse(201, JSON_TYPE, JSON.stringify({ success: true, data: RESULT }))).toEqual({
      ok: true,
      result: RESULT,
    });
  });

  it("413 text/plain de la plateforme → message français, jamais « Unexpected token »", () => {
    const text = "Request Entity Too Large\n\nFUNCTION_PAYLOAD_TOO_LARGE";
    expect(message(interpretRetouchResponse(413, "text/plain; charset=utf-8", text))).toBe(UPLOAD_MESSAGES_FR.HTTP_413);
  });

  it("504 text/plain (retouche trop longue) → TIMEOUT", () => {
    const text = "An error occurred with your deployment\n\nFUNCTION_INVOCATION_TIMEOUT";
    expect(message(interpretRetouchResponse(504, "text/plain", text))).toBe(UPLOAD_MESSAGES_FR.TIMEOUT);
  });

  it("erreur JSON de la route → son message français", () => {
    const body = JSON.stringify({ success: false, error: { code: "INTERNAL_ERROR", message: "Toutes les retouches ont échoué" } });
    expect(message(interpretRetouchResponse(500, JSON_TYPE, body))).toBe("Toutes les retouches ont échoué");
  });

  it("201 sans le résultat attendu → UNEXPECTED", () => {
    expect(message(interpretRetouchResponse(201, JSON_TYPE, JSON.stringify({ success: true, data: {} })))).toBe(
      UPLOAD_MESSAGES_FR.UNEXPECTED
    );
  });
});

describe("requestRetouch", () => {
  it("envoie l'URL absolue de la source, même relative (magasin local), et lit la réponse", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true, data: RESULT }), {
      status: 201,
      headers: { "content-type": JSON_TYPE },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const outcome = await requestRetouch(
      { sourceUrl: "/local-images/shops/s1/retouch-source/a.webp", preset: "STUDIO_LIGHT", variations: 4, usage: "PRODUCT" },
      "http://localhost:3211"
    );

    expect(outcome).toEqual({ ok: true, result: RESULT });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(RETOUCH_ENDPOINT);
    expect(JSON.parse(String(init.body))).toEqual({
      imageUrl: "http://localhost:3211/local-images/shops/s1/retouch-source/a.webp",
      preset: "STUDIO_LIGHT",
      variations: 4,
      usage: "PRODUCT",
    });
  });

  it("une coupure réseau → NETWORK ; un 413 text/plain → HTTP_413", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));
    const request = { sourceUrl: SOURCE, preset: "STUDIO_LIGHT", variations: 4, usage: "PRODUCT" } as const;
    expect(message(await requestRetouch(request, "https://klikandgo.app"))).toBe(UPLOAD_MESSAGES_FR.NETWORK);

    vi.stubGlobal("fetch", vi.fn(async () => new Response("Request Entity Too Large", { status: 413, headers: { "content-type": "text/plain" } })));
    expect(message(await requestRetouch(request, "https://klikandgo.app"))).toBe(UPLOAD_MESSAGES_FR.HTTP_413);
  });
});
