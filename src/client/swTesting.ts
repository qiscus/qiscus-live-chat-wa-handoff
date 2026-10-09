// Test-only fakes for evaluating public/sw.js outside a browser (SYNTHETIC).

type Listener = (event: any) => void

export function fakeIndexedDB() {
  const dbs = new Map<string, Map<string, Map<string, unknown>>>()
  const req = (fn: () => unknown) => {
    const r: any = { onsuccess: null, onerror: null, result: undefined }
    queueMicrotask(() => {
      try {
        r.result = fn()
        r.onsuccess?.({ target: r })
      } catch (e) {
        r.error = e
        r.onerror?.({ target: r })
      }
    })
    return r
  }
  return {
    dbs,
    open(name: string) {
      const r: any = { onsuccess: null, onerror: null, onupgradeneeded: null, result: undefined }
      queueMicrotask(() => {
        const isNew = !dbs.has(name)
        if (isNew) dbs.set(name, new Map())
        const stores = dbs.get(name)!
        const db = {
          objectStoreNames: { contains: (s: string) => stores.has(s) },
          createObjectStore: (s: string) => stores.set(s, new Map()),
          transaction: (s: string) => {
            const tx: any = { oncomplete: null, onerror: null }
            const store = stores.get(s)
            if (!store) throw new Error("NotFoundError")
            tx.objectStore = () => ({
              get: (k: string) => req(() => store.get(k)),
              put: (v: unknown, k: string) => req(() => (store.set(k, structuredClone(v)), k)),
              delete: (k: string) => req(() => (store.delete(k), undefined)),
            })
            setTimeout(() => tx.oncomplete?.({}), 0)
            return tx
          },
          close() {},
        }
        r.result = db
        if (isNew) r.onupgradeneeded?.({ target: r })
        r.onsuccess?.({ target: r })
      })
      return r
    },
  }
}

export interface SwHarness {
  listeners: Map<string, Listener[]>
  shown: { title: string; options: any; closed: boolean }[]
  opened: string[]
  focused: string[]
  windows: { url: string; focused: boolean; visibilityState: string }[]
  cache: Map<string, Map<string, Response>>
  indexedDB: ReturnType<typeof fakeIndexedDB>
  dispatch(type: string, event: any): Promise<void>
  fetchCalls: string[]
}

export async function loadServiceWorker(source: string, origin = "https://handoff.example.invalid"): Promise<SwHarness> {
  const listeners = new Map<string, Listener[]>()
  const shown: SwHarness["shown"] = []
  const opened: string[] = []
  const focused: string[] = []
  const windows: SwHarness["windows"] = []
  const cache = new Map<string, Map<string, Response>>()
  const idb = fakeIndexedDB()
  const fetchCalls: string[] = []

  const registration = {
    scope: origin + "/",
    async showNotification(title: string, options: any) {
      shown.push({ title, options, closed: false })
    },
    async getNotifications(filter?: { tag?: string }) {
      return shown
        .filter((n) => !n.closed && (!filter?.tag || n.options?.tag === filter.tag))
        .map((n) => ({ ...n.options, close: () => (n.closed = true) }))
    },
  }
  const self: any = {
    location: new URL(origin + "/sw.js"),
    registration,
    addEventListener(type: string, fn: Listener) {
      if (!listeners.has(type)) listeners.set(type, [])
      listeners.get(type)!.push(fn)
    },
    skipWaiting: async () => {},
  }
  const clients = {
    async matchAll() {
      return windows.map((w) => ({
        url: w.url,
        focused: w.focused,
        visibilityState: w.visibilityState,
        focus: async () => {
          focused.push(w.url)
        },
      }))
    },
    async openWindow(url: string) {
      opened.push(url)
    },
    async claim() {},
  }
  const caches = {
    async open(name: string) {
      if (!cache.has(name)) cache.set(name, new Map())
      const c = cache.get(name)!
      return {
        addAll: async (urls: string[]) => urls.forEach((u) => c.set(new URL(u, origin).href, new Response("cached:" + u))),
        match: async (r: Request | string) => c.get(typeof r === "string" ? new URL(r, origin).href : r.url)?.clone(),
        put: async (r: Request, res: Response) => void c.set(r.url, res),
      }
    },
    async keys() {
      return [...cache.keys()]
    },
    async delete(name: string) {
      return cache.delete(name)
    },
    async match(r: Request | string) {
      const href = typeof r === "string" ? new URL(r, origin).href : r.url
      for (const c of cache.values()) if (c.has(href)) return c.get(href)!.clone()
      return undefined
    },
  }
  const fakeFetch = async (r: Request | string) => {
    const url = typeof r === "string" ? r : r.url
    fetchCalls.push(url)
    if (url.includes("offline-test")) throw new TypeError("synthetic offline")
    return new Response("network:" + url)
  }

  // eslint-disable-next-line no-new-func
  const run = new Function("self", "clients", "caches", "indexedDB", "fetch", "URL", "Response", source)
  run(self, clients, caches, idb, fakeFetch, URL, Response)

  async function dispatch(type: string, init: any) {
    const pending: Promise<unknown>[] = []
    const event = {
      ...init,
      waitUntil: (p: Promise<unknown>) => pending.push(p),
      respondWith: (p: Promise<Response> | Response) => pending.push(Promise.resolve(p).then((r) => (event.response = r))),
      response: undefined as Response | undefined,
    }
    for (const fn of listeners.get(type) || []) fn(event)
    await Promise.all(pending)
    Object.assign(init, { response: event.response, handled: pending.length > 0 })
  }

  return { listeners, shown, opened, focused, windows, cache, indexedDB: idb, dispatch, fetchCalls }
}
