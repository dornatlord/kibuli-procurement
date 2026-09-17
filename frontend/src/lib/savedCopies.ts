// Copies of what the server last sent, kept on this computer so pages still
// open without internet: staff sometimes work from home with no Wi-Fi. Each
// person's copies are kept apart, and removed when they sign out.

const CACHE_PREFIX = "kibuli-data-";
// Marks when everything needed offline was last saved in one go.
const FULL_SAVE = "/__full_save__";
let owner: number | null = null;

interface SavedCopy<T> {
  savedAt: number;
  data: T;
}

/** Whose copies to read and write: the person signed in, or nobody. */
export function setCopyOwner(userId: number | null) {
  owner = userId;
}

export const copyOwner = () => owner;

const address = (path: string) => `${location.origin}/__saved__${path}`;

/**
 * Save `data` as `forOwner`'s copy of `path`. Skipped if someone else has
 * signed in since the data was requested, so one person's data never lands
 * in another's copies.
 */
export async function saveCopy(path: string, data: unknown, forOwner: number | null) {
  if (forOwner === null || forOwner !== owner || !("caches" in window)) return;
  try {
    const cache = await caches.open(CACHE_PREFIX + forOwner);
    await cache.put(address(path), new Response(JSON.stringify({ savedAt: Date.now(), data })));
  } catch {
    // Storage full or switched off: the page still works while online.
  }
}

export async function readCopy<T>(path: string): Promise<SavedCopy<T> | null> {
  if (owner === null || !("caches" in window)) return null;
  try {
    const cache = await caches.open(CACHE_PREFIX + owner);
    const hit = await cache.match(address(path));
    return hit ? ((await hit.json()) as SavedCopy<T>) : null;
  } catch {
    return null;
  }
}

export async function markFullSave(forOwner: number | null) {
  await saveCopy(FULL_SAVE, true, forOwner);
}

export async function lastFullSave(): Promise<number | null> {
  return (await readCopy<boolean>(FULL_SAVE))?.savedAt ?? null;
}

/** Remove every saved copy on this computer, for everyone. */
export async function forgetCopies() {
  if (!("caches" in window)) return;
  try {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.startsWith(CACHE_PREFIX)).map((n) => caches.delete(n)));
  } catch {
    // Nothing more to do; copies are only ever read for their owner.
  }
}
