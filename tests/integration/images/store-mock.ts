// The image store of the photo integration tests: the store a test puts in `storage.store` (an
// in-memory double, tests/fixtures/images/memory-store.ts) is the one getImageStore() serves. With
// none, getImageStore() throws StoreUnavailableError, as on a deployment without a store. Each test
// file declares the mock (vi.mock is hoisted only inside its own file):
//   vi.mock("@/lib/images/store", async (importOriginal) =>
//     (await import("./store-mock")).imageStoreModule(importOriginal)
//   );
import { StoreUnavailableError } from "@/lib/images/errors";
import type { ImageStore } from "@/lib/images/store";

export const storage: { store: ImageStore | null } = { store: null };

/** vi.mock factory of @/lib/images/store: the real module, getImageStore() serving storage.store. */
export async function imageStoreModule(importOriginal: <T>() => Promise<T>) {
  const actual = await importOriginal<typeof import("@/lib/images/store")>();
  return {
    ...actual,
    getImageStore: (): ImageStore => {
      if (storage.store === null) throw new StoreUnavailableError();
      return storage.store;
    },
  };
}
