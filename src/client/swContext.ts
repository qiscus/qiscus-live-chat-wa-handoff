/**
 * The small context the service worker needs to decide whether a push is a
 * reply worth announcing: which handoff room, and who "self" is. Written by the
 * page into IndexedDB (the one store both realms can read), read by sw.js.
 * No token is stored here.
 *
 * One entry per service-worker scope: the root worker (Worker env config) reads
 * CTX_KEY; a per-app worker (scope `<base>a/<app>/`, config from qismo-api)
 * reads the entry keyed by its own scope path, so apps never see each other's
 * room.
 *
 * The names MUST match public/sw.js (asserted in sw.test.ts).
 */
import type { SwContext } from "./controller"

export const CTX_DB = "qiscus-handoff-push"
export const CTX_STORE = "ctx"
export const CTX_KEY = "current"

/** IndexedDB key of the context the worker with this scope reads (undefined = the root worker). */
export function ctxKey(scope?: string): string {
  return scope || CTX_KEY
}

function open(idb: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = idb.open(CTX_DB, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(CTX_STORE)) req.result.createObjectStore(CTX_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function writeSwContext(idb: IDBFactory, ctx: SwContext | null, scope?: string): Promise<void> {
  const db = await open(idb)
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(CTX_STORE, "readwrite")
      const store = tx.objectStore(CTX_STORE)
      const req = ctx
        ? store.put({ appId: ctx.appId, roomId: ctx.roomId, selfEmail: ctx.selfEmail }, ctxKey(scope))
        : store.delete(ctxKey(scope))
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}
