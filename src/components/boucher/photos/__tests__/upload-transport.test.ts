// @vitest-environment node
// Réponse de POST /api/uploads/image vue du navigateur : toute réponse, JSON ou non (413 et 504
// text/plain de Vercel), devient un message français ; jamais « Unexpected token … JSON ».
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  interpretUploadResponse,
  sendUpload,
  type UploadOutcome,
} from "@/components/boucher/photos/upload-transport";
import {
  UPLOAD_ENDPOINT,
  UPLOAD_FORM_FIELDS,
  UPLOAD_MAX_BYTES,
  UPLOAD_MESSAGES_FR,
} from "@/lib/images/upload-contract";

const RESULT = {
  id: "cm3img0001",
  url: "https://nzqbbcqekyom7ajd.public.blob.vercel-storage.com/shops/s1/product/0f8fad5b-d9cb-469f-a165-70867728950e.webp",
  thumbUrl:
    "https://nzqbbcqekyom7ajd.public.blob.vercel-storage.com/shops/s1/product/0f8fad5b-d9cb-469f-a165-70867728950e-t.webp",
  width: 2048,
  height: 1536,
};
const JSON_TYPE = "application/json; charset=utf-8";

function apiError(code: string, message: string): string {
  return JSON.stringify({ success: false, error: { code, message } });
}

function message(outcome: UploadOutcome): string {
  if (outcome.ok) throw new Error("succès inattendu");
  return outcome.messageFr;
}

describe("interpretUploadResponse", () => {
  it("200 JSON with a valid result → ok with the result", () => {
    expect(
      interpretUploadResponse(200, JSON_TYPE, JSON.stringify({ success: true, data: RESULT }))
    ).toEqual({
      ok: true,
      result: RESULT,
    });
  });

  it("200 JSON without thumbUrl → UNEXPECTED", () => {
    const { thumbUrl: _thumbUrl, ...withoutThumb } = RESULT;
    expect(
      message(
        interpretUploadResponse(
          200,
          JSON_TYPE,
          JSON.stringify({ success: true, data: withoutThumb })
        )
      )
    ).toBe(UPLOAD_MESSAGES_FR.UNEXPECTED);
  });

  it("200 that is not JSON (an HTML page, a JSON body sent as text) → UNEXPECTED", () => {
    expect(message(interpretUploadResponse(200, "text/html", "<!doctype html><html></html>"))).toBe(
      UPLOAD_MESSAGES_FR.UNEXPECTED
    );
    expect(
      message(
        interpretUploadResponse(200, "text/plain", JSON.stringify({ success: true, data: RESULT }))
      )
    ).toBe(UPLOAD_MESSAGES_FR.UNEXPECTED);
    expect(message(interpretUploadResponse(200, JSON_TYPE, "{ tronqué"))).toBe(
      UPLOAD_MESSAGES_FR.UNEXPECTED
    );
  });

  it("413 text/plain from the platform → HTTP_413", () => {
    expect(message(interpretUploadResponse(413, "text/plain", "Request Entity Too Large"))).toBe(
      UPLOAD_MESSAGES_FR.HTTP_413
    );
    expect(message(interpretUploadResponse(413, null, ""))).toBe(UPLOAD_MESSAGES_FR.HTTP_413);
  });

  it("502, 503 and 504 without a JSON message → TIMEOUT", () => {
    for (const status of [502, 503, 504]) {
      expect(
        message(
          interpretUploadResponse(status, "text/plain", "An error occurred with your deployment")
        )
      ).toBe(UPLOAD_MESSAGES_FR.TIMEOUT);
    }
  });

  it("422 JSON → the server's French message", () => {
    expect(
      message(
        interpretUploadResponse(422, JSON_TYPE, apiError("IMAGE_REJECTED", UPLOAD_MESSAGES_FR.HEIC))
      )
    ).toBe(UPLOAD_MESSAGES_FR.HEIC);
  });

  it("503 JSON from the route (store down) → the server's message", () => {
    const body = apiError("SERVICE_DISABLED", UPLOAD_MESSAGES_FR.STORE_UNAVAILABLE);
    expect(message(interpretUploadResponse(503, JSON_TYPE, body))).toBe(
      UPLOAD_MESSAGES_FR.STORE_UNAVAILABLE
    );
  });

  it("429 → the server's quota message when JSON, a generic one otherwise", () => {
    const quota = UPLOAD_MESSAGES_FR.QUOTA(12);
    expect(message(interpretUploadResponse(429, JSON_TYPE, apiError("RATE_LIMITED", quota)))).toBe(
      quota
    );
    expect(message(interpretUploadResponse(429, "text/plain", "Too Many Requests"))).toBe(
      UPLOAD_MESSAGES_FR.GENERIC(429)
    );
  });

  it("401 → SESSION, whatever the body; 403 → the server's reason, SESSION without one", () => {
    expect(
      message(
        interpretUploadResponse(
          401,
          JSON_TYPE,
          apiError("UNAUTHORIZED", "Authentification requise")
        )
      )
    ).toBe(UPLOAD_MESSAGES_FR.SESSION);
    expect(message(interpretUploadResponse(401, "text/html", "<html>"))).toBe(
      UPLOAD_MESSAGES_FR.SESSION
    );
    expect(
      message(
        interpretUploadResponse(403, JSON_TYPE, apiError("FORBIDDEN", "Accès réservé aux bouchers"))
      )
    ).toBe("Accès réservé aux bouchers");
    expect(message(interpretUploadResponse(403, "text/plain", "Forbidden"))).toBe(
      UPLOAD_MESSAGES_FR.SESSION
    );
  });

  it("status 0 (network cut, CORS, abort) → NETWORK", () => {
    expect(message(interpretUploadResponse(0, null, ""))).toBe(UPLOAD_MESSAGES_FR.NETWORK);
  });

  it("any other status → GENERIC with the status", () => {
    expect(message(interpretUploadResponse(500, "text/html", "<html>Internal</html>"))).toBe(
      UPLOAD_MESSAGES_FR.GENERIC(500)
    );
    expect(
      message(interpretUploadResponse(400, JSON_TYPE, JSON.stringify({ success: false })))
    ).toBe(UPLOAD_MESSAGES_FR.GENERIC(400));
  });

  it("never yields a message about parsing", () => {
    const bodies = [
      "",
      "Request Entity Too Large",
      "<html>",
      "{",
      "null",
      "[]",
      '{"error":42}',
      '{"error":{"message":""}}',
    ];
    const statuses = [0, 200, 201, 400, 401, 403, 404, 405, 413, 422, 429, 500, 502, 503, 504];
    for (const status of statuses) {
      for (const contentType of [null, "text/plain", "text/html", JSON_TYPE]) {
        for (const body of bodies) {
          const outcome = interpretUploadResponse(status, contentType, body);
          expect(outcome.ok).toBe(false);
          expect(message(outcome)).not.toMatch(/Unexpected token|JSON|undefined|null|\[object/);
          expect(message(outcome).length).toBeGreaterThan(10);
        }
      }
    }
  });
});

/** XMLHttpRequest factice : enregistre l'ouverture, l'envoi, et laisse le test jouer la réponse. */
class FakeXhr {
  static instances: FakeXhr[] = [];
  method = "";
  url = "";
  sent: unknown = null;
  status = 0;
  responseText = "";
  responseType = "";
  private contentType: string | null = null;
  readonly upload: {
    onprogress:
      | ((event: { lengthComputable: boolean; loaded: number; total: number }) => void)
      | null;
  } = {
    onprogress: null,
  };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  constructor() {
    FakeXhr.instances.push(this);
  }
  open(method: string, url: string): void {
    this.method = method;
    this.url = url;
  }
  send(body: unknown): void {
    this.sent = body;
  }
  getResponseHeader(name: string): string | null {
    return name.toLowerCase() === "content-type" ? this.contentType : null;
  }
  respond(status: number, contentType: string | null, body: string): void {
    this.status = status;
    this.contentType = contentType;
    this.responseText = body;
    this.onload?.();
  }
}

describe("sendUpload", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    FakeXhr.instances = [];
  });

  it("throws before opening any request for a blob of 4 MiB + 1 byte", () => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
    const blob = new Blob([new Uint8Array(UPLOAD_MAX_BYTES + 1)], { type: "image/jpeg" });
    expect(() => sendUpload(blob, "photo.jpg", "PRODUCT", () => {})).toThrow(RangeError);
    expect(FakeXhr.instances).toHaveLength(0);
  });

  it("posts the shared upload form, reports progress, and interprets the answer", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
    const ratios: number[] = [];
    const blob = new Blob([new Uint8Array(UPLOAD_MAX_BYTES)], { type: "image/jpeg" });
    const pending = sendUpload(blob, "IMG_1.jpg", "REFERENCE", (ratio) => ratios.push(ratio));
    const [xhr] = FakeXhr.instances;
    expect([xhr.method, xhr.url]).toEqual(["POST", UPLOAD_ENDPOINT]);
    const form = xhr.sent as FormData;
    expect(form.get(UPLOAD_FORM_FIELDS.purpose)).toBe("REFERENCE");
    expect((form.get(UPLOAD_FORM_FIELDS.file) as File).name).toBe("IMG_1.jpg");
    expect((form.get(UPLOAD_FORM_FIELDS.file) as File).size).toBe(UPLOAD_MAX_BYTES);

    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 450, total: 1000 });
    xhr.upload.onprogress?.({ lengthComputable: false, loaded: 10, total: 0 });
    xhr.respond(200, JSON_TYPE, JSON.stringify({ success: true, data: RESULT }));
    expect(await pending).toEqual({ ok: true, result: RESULT });
    expect(ratios).toEqual([0.45]);
  });

  it("a network error or an abort resolves to NETWORK, a 504 text/plain to TIMEOUT", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
    const blob = new Blob([new Uint8Array(10)], { type: "image/jpeg" });
    const failed = sendUpload(blob, "a.jpg", "PRODUCT", () => {});
    FakeXhr.instances[0].onerror?.();
    expect(await failed).toEqual({ ok: false, messageFr: UPLOAD_MESSAGES_FR.NETWORK });

    const aborted = sendUpload(blob, "a.jpg", "PRODUCT", () => {});
    FakeXhr.instances[1].onabort?.();
    expect(await aborted).toEqual({ ok: false, messageFr: UPLOAD_MESSAGES_FR.NETWORK });

    const timedOut = sendUpload(blob, "a.jpg", "PRODUCT", () => {});
    FakeXhr.instances[2].respond(
      504,
      "text/plain",
      "An error occurred with your deployment\n\nFUNCTION_INVOCATION_TIMEOUT"
    );
    expect(await timedOut).toEqual({ ok: false, messageFr: UPLOAD_MESSAGES_FR.TIMEOUT });
  });
});
