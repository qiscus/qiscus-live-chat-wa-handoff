/**
 * The small context the service worker needs to decide whether a push is a
 * reply worth announcing: which handoff room, and who "self" is. Written by the
 * page into IndexedDB (the one store both realms can read), read by sw.js.
 * No token is stored here.
 *
 * One entry per service-worker scope: the legacy root worker (Worker-env
 * config) keeps CTX_KEY; a per-app worker (scope /a/<app>/) reads the entry
 * keyed by its own scope, so apps on one origin never see each other's room.
 *
 * The names MUST match public/sw.js (asserted in sw.test.ts).
 */
import type { SwContext } from "./controller"

export const CTX_DB = "qiscus-handoff-push"
export const CTX_STORE = "ctx"
export const CTX_KEY = "current"

/** IndexedDB key of the context a worker with this scope reads (undefined / "/" = legacy root). */
export function ctxKey(scope?: string): string {
  return scope && scope !== "/" ? scope : CTX_KEY
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
      const key = ctxKey(scope)
      const req = ctx
        ? store.put({ appId: ctx.appId, roomId: ctx.roomId, selfEmail: ctx.selfEmail, ...(ctx.resume ? { resume: ctx.resume } : {}) }, key)
        : store.delete(key)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}
