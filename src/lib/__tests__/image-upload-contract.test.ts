// @vitest-environment node
// Contrat de l'envoi de photo (src/lib/images/upload-contract.ts) : le formulaire construit par le
// navigateur est exactement celui que lit la route.
import { describe, expect, it } from "vitest";
import {
  REGISTRY_USAGE_BY_PURPOSE,
  UPLOAD_ENDPOINT,
  UPLOAD_FORM_FIELDS,
  UPLOAD_MAX_BYTES,
  UPLOAD_MESSAGES_FR,
  UPLOAD_PURPOSES,
  UPLOAD_RETRY_ABOVE_BYTES,
  buildUploadForm,
  parseUploadForm,
  uploadResultSchema,
} from "@/lib/images/upload-contract";

const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

describe("constantes", () => {
  it("plafonds et route", () => {
    expect(UPLOAD_ENDPOINT).toBe("/api/uploads/image");
    expect(UPLOAD_MAX_BYTES).toBe(4_194_304);
    expect(UPLOAD_RETRY_ABOVE_BYTES).toBe(3_670_016);
    expect(UPLOAD_FORM_FIELDS).toEqual({ file: "file", purpose: "purpose" });
  });

  it("usage du registre par type d'envoi", () => {
    expect(REGISTRY_USAGE_BY_PURPOSE).toEqual({
      PRODUCT: "PRODUCT",
      RETOUCH_SOURCE: "RETOUCH_SOURCE",
      REFERENCE: "PRODUCT",
    });
  });

  it("messages à nombre", () => {
    expect(UPLOAD_MESSAGES_FR.QUOTA(12)).toBe("Limite atteinte : 30 photos par heure. Réessayez dans 12 min.");
    expect(UPLOAD_MESSAGES_FR.GENERIC(500)).toBe("L'envoi a échoué (erreur 500). Réessayez.");
  });
});

describe("buildUploadForm → parseUploadForm", () => {
  it.each(UPLOAD_PURPOSES)("aller-retour pour %s", async (purpose) => {
    const file = new Blob([JPEG_BYTES], { type: "image/jpeg" });
    const form = buildUploadForm(file, purpose, "vitrine.jpg");

    const sent = form.get(UPLOAD_FORM_FIELDS.file);
    expect(sent).toBeInstanceOf(File);
    expect((sent as File).name).toBe("vitrine.jpg");

    const parsed = parseUploadForm(form);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.purpose).toBe(purpose);
    expect(new Uint8Array(await parsed.file.arrayBuffer())).toEqual(JPEG_BYTES);
  });

  it("nom de fichier par défaut photo.jpg", () => {
    const form = buildUploadForm(new Blob([JPEG_BYTES]), "PRODUCT");
    expect((form.get("file") as File).name).toBe("photo.jpg");
  });

  it("sans fichier → NO_FILE", () => {
    const form = new FormData();
    form.append("purpose", "PRODUCT");
    expect(parseUploadForm(form)).toEqual({ ok: false, messageFr: UPLOAD_MESSAGES_FR.NO_FILE });
  });

  it("un texte à la place du fichier → NO_FILE", () => {
    const form = new FormData();
    form.append("file", "pas une photo");
    form.append("purpose", "PRODUCT");
    expect(parseUploadForm(form)).toEqual({ ok: false, messageFr: UPLOAD_MESSAGES_FR.NO_FILE });
  });

  it("type d'envoi inconnu → BAD_PURPOSE", () => {
    const form = new FormData();
    form.append("file", new Blob([JPEG_BYTES]), "a.jpg");
    form.append("purpose", "CAMPAIGN");
    expect(parseUploadForm(form)).toEqual({ ok: false, messageFr: UPLOAD_MESSAGES_FR.BAD_PURPOSE });
  });

  it("type d'envoi absent → BAD_PURPOSE", () => {
    const form = new FormData();
    form.append("file", new Blob([JPEG_BYTES]), "a.jpg");
    expect(parseUploadForm(form)).toEqual({ ok: false, messageFr: UPLOAD_MESSAGES_FR.BAD_PURPOSE });
  });

  it("ne contrôle pas la taille (persistImage applique le plafond)", () => {
    const big = new Blob([new Uint8Array(UPLOAD_MAX_BYTES + 1)]);
    expect(parseUploadForm(buildUploadForm(big, "PRODUCT")).ok).toBe(true);
  });
});

describe("uploadResultSchema", () => {
  const valid = { id: "img1", url: "/local-images/a/b.webp", thumbUrl: "/local-images/a/b-t.webp", width: 2048, height: 1536 };

  it("accepte une réponse complète", () => {
    expect(uploadResultSchema.parse(valid)).toEqual(valid);
  });

  it("refuse une réponse sans thumbUrl", () => {
    const { thumbUrl: _omitted, ...withoutThumb } = valid;
    expect(uploadResultSchema.safeParse(withoutThumb).success).toBe(false);
  });

  it("refuse une dimension nulle ou fractionnaire", () => {
    expect(uploadResultSchema.safeParse({ ...valid, width: 0 }).success).toBe(false);
    expect(uploadResultSchema.safeParse({ ...valid, height: 10.5 }).success).toBe(false);
  });
});
