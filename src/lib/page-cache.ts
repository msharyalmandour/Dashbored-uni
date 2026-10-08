/**
 * RENDERED SLIDE PAGES, KEPT IN THE BROWSER.
 *
 * Why this exists at all, which is not obvious until you look at the URLs:
 * every file in this app lives in private Storage and is reached through a
 * SIGNED url, and a signature is issued fresh on every request. Same deck,
 * same path, a different URL each time — so the browser's HTTP cache never
 * hits. Drawing a cover for five decks on a course page would re-download
 * five PDFs on every single visit, which on a phone is tens of megabytes to
 * show five thumbnails the student has already seen.
 *
 * So what is cached is not the file, it is the PICTURE: one small PNG per
 * page, keyed by the row id rather than by the URL that happened to fetch it.
 * After the first visit a cover costs one IndexedDB read and no network at
 * all, and the deck itself is never downloaded again just to draw it.
 *
 * EVERYTHING HERE IS ALLOWED TO FAIL. IndexedDB throws outright in some
 * private windows, is absent during server rendering, can be disabled, and
 * can evict whatever it likes whenever it likes. Every function below returns
 * null or quietly does nothing instead of propagating, because the fallback —
 * render the page again — is always available and always correct. A cache that
 * can take the screen down with it is worse than no cache.
 */

const DB_NAME = "slide-pages";
const STORE = "pages";
const VERSION = 1;

/**
 * Bumped when the renderer changes in a way that makes stored pictures wrong
 * (a different scale, a different background). Part of every key, so a bump
 * abandons the old entries rather than requiring them to be deleted — eviction
 * will collect them.
 */
const RENDER_VERSION = 1;

/**
 * A stored picture is identified by the row, the page and the width it was
 * drawn at — never by the signed URL, which is different on every request and
 * would make the cache miss every time while filling up.
 */
export function pageKey(slideId: string, page: number, width: number): string {
  return `${RENDER_VERSION}:${slideId}:${page}:${Math.round(width)}`;
}

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, VERSION);
    } catch {
      /* Throws synchronously in some private-browsing modes. */
      return resolve(null);
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

/** The stored picture for a key, or null if there is not one. */
export async function readPage(key: string): Promise<Blob | null> {
  const db = await open();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
      request.onsuccess = () => {
        const value: unknown = request.result;
        /* Anything that is not a Blob is treated as absent rather than
           trusted: this store survives across deploys, so a value written by
           an older version of this file can still be sitting in it. */
        resolve(value instanceof Blob ? value : null);
      };
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    } finally {
      db.close();
    }
  });
}

/** Keep a picture. Silent on failure — the caller has already drawn it. */
export async function writePage(key: string, blob: Blob): Promise<void> {
  const db = await open();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(blob, key);
      tx.oncomplete = () => resolve();
      /* A quota error lands here. There is nothing useful to do about it: the
         page is on screen, and the next visit will simply draw it again. */
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    } finally {
      db.close();
    }
  });
}

/** A canvas as a PNG blob, or null if the browser declines. */
export function toBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    } catch {
      /* Tainted canvas — a cross-origin image drawn without CORS. The picture
         is on screen; it just cannot be read back out. */
      resolve(null);
    }
  });
}
