// Stockage d'images en mémoire, pour les tests : remplace le transport sortant (Vercel Blob) à la
// frontière src/lib/images/store.ts. Il rend des URL de l'hôte Blob épinglé, comme le vrai, et
// enregistre chaque écriture et chaque effacement pour que le test les vérifie.
import { imageBlobHost } from "@/lib/images/durable-url";
import type { ImageStore } from "@/lib/images/store";

export interface MemoryStoreOptions {
  /** Numéro (à partir de 0) de l'écriture qui échoue, pour simuler une panne du stockage. */
  failPutAt?: number;
  /** Chaque effacement échoue. */
  failDel?: boolean;
  /** Origine des URL rendues (par défaut https://<hôte Blob épinglé>). */
  urlBase?: string;
}

export interface MemoryPut {
  pathname: string;
  url: string;
  contentType: string;
  bytes: Uint8Array;
}

export class MemoryImageStore implements ImageStore {
  readonly kind = "blob" as const;
  readonly files = new Map<string, Uint8Array>();
  readonly puts: MemoryPut[] = [];
  readonly dels: string[] = [];
  private putAttempts = 0;

  constructor(private readonly options: MemoryStoreOptions = {}) {}

  async put(pathname: string, bytes: Uint8Array, contentType: "image/webp"): Promise<{ url: string }> {
    const attempt = this.putAttempts;
    this.putAttempts += 1;
    if (this.options.failPutAt === attempt) throw new Error("panne simulée du stockage");
    const url = `${this.options.urlBase ?? `https://${imageBlobHost()}`}/${pathname}`;
    this.puts.push({ pathname, url, contentType, bytes });
    this.files.set(url, bytes);
    return { url };
  }

  async del(url: string): Promise<void> {
    this.dels.push(url);
    if (this.options.failDel) throw new Error("effacement simulé en échec");
    this.files.delete(url);
  }

  /** Dépose un fichier comme s'il avait été écrit plus tôt (image déjà dans la galerie). */
  seed(url: string, bytes: Uint8Array = new Uint8Array([1, 2, 3])): void {
    this.files.set(url, bytes);
  }
}
