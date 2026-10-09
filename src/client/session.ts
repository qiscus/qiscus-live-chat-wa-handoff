/**
 * The customer's handoff session, persisted on THIS origin so the page can be
 * resumed after a refresh, a notification click or a PWA relaunch.
 *
 * What is stored is the customer's own Qiscus SDK login (the `user` object
 * `verify_identity_token` returned: email + SDK token + refresh token), the
 * same thing the standard Qiscus widget keeps in localStorage. It is NOT the
 * one-time invite token and NOT the 120 s identity_token — both are consumed
 * and are never written anywhere. Nothing here ever goes into a URL.
 *
 * The room iframe (same origin) writes it right after its SDK login; the top
 * page reads it. Bounded by SESSION_MAX_AGE_MS, which is the longest session
 * window qismo-api allows (LiveHandover.Config session_ttl_range, 172 800 s).
 */

export const SESSION_KEY = "qiscus-handoff:session:v1"
export const PREVIOUS_SESSION_KEY = "qiscus-handoff:previous-session:v1"
export const SESSION_MAX_AGE_MS = 48 * 60 * 60 * 1000

export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface SdkUser {
  email: string
  token: string
  [extra: string]: unknown
}

export interface StoredSession {
  v: 1
  appId: string
  roomId: string
  user: SdkUser
  savedAt: number
  expiresAt: number
}

export type LoadResult =
  | { state: "none" }
  | { state: "valid"; session: StoredSession }
  | { state: "expired"; session: StoredSession }

export const APP_CODE_RE = /^[A-Za-z0-9_-]{1,64}$/
export const ROOM_ID_RE = /^\d{1,20}$/

// Never persisted, whatever the SDK puts on the user object.
const DROP_FIELDS = ["identity_token", "password", "secret_key"]

function isSdkUser(u: unknown): u is SdkUser {
  const o = u as Record<string, unknown> | null
  return (
    !!o &&
    typeof o === "object" &&
    typeof o.email === "string" &&
    o.email.length > 0 &&
    o.email.length <= 256 &&
    typeof o.token === "string" &&
    o.token.length > 0 &&
    o.token.length <= 4096
  )
}

function parse(raw: string | null): StoredSession | null {
  if (!raw) return null
  try {
    const s = JSON.parse(raw) as StoredSession
    if (
      s &&
      s.v === 1 &&
      typeof s.appId === "string" &&
      APP_CODE_RE.test(s.appId) &&
      typeof s.roomId === "string" &&
      ROOM_ID_RE.test(s.roomId) &&
      isSdkUser(s.user) &&
      Number.isFinite(s.savedAt) &&
      Number.isFinite(s.expiresAt)
    ) {
      return s
    }
  } catch {}
  return null
}

export function saveSession(
  storage: KeyValueStorage,
  input: { appId: string; roomId: string; user: SdkUser },
  now: number,
): StoredSession {
  if (!APP_CODE_RE.test(input.appId)) throw new Error("invalid app id")
  if (!ROOM_ID_RE.test(String(input.roomId))) throw new Error("invalid room id")
  if (!isSdkUser(input.user)) throw new Error("invalid sdk user")
  const user = { ...input.user }
  for (const f of DROP_FIELDS) delete (user as Record<string, unknown>)[f]
  const session: StoredSession = {
    v: 1,
    appId: input.appId,
    roomId: String(input.roomId),
    user,
    savedAt: now,
    expiresAt: now + SESSION_MAX_AGE_MS,
  }
  storage.setItem(SESSION_KEY, JSON.stringify(session))
  return session
}

export function loadSession(storage: KeyValueStorage, now: number): LoadResult {
  const raw = storage.getItem(SESSION_KEY)
  const s = parse(raw)
  if (!s) {
    if (raw !== null) storage.removeItem(SESSION_KEY)
    return { state: "none" }
  }
  // savedAt in the future, or a window longer than we ever grant: tampered.
  if (s.savedAt > now + 5 * 60 * 1000 || s.expiresAt - s.savedAt > SESSION_MAX_AGE_MS) {
    storage.removeItem(SESSION_KEY)
    return { state: "none" }
  }
  if (now >= s.expiresAt) {
    storage.removeItem(SESSION_KEY)
    return { state: "expired", session: s }
  }
  return { state: "valid", session: s }
}

export function clearSession(storage: KeyValueStorage): void {
  storage.removeItem(SESSION_KEY)
}

/**
 * A new invite replaces whoever was signed in. The current session is moved
 * aside (resume can no longer pick it up) and kept only so its push
 * registration can be torn down with its own credentials once the new
 * identity is known. If an earlier stash is still pending, it is kept: it is
 * the one that still owns a registration.
 */
export function stashSessionForInvite(storage: KeyValueStorage): void {
  const current = storage.getItem(SESSION_KEY)
  storage.removeItem(SESSION_KEY)
  if (current && parse(current) && storage.getItem(PREVIOUS_SESSION_KEY) === null) {
    storage.setItem(PREVIOUS_SESSION_KEY, current)
  }
}

export function takePreviousSession(storage: KeyValueStorage): StoredSession | null {
  const prev = parse(storage.getItem(PREVIOUS_SESSION_KEY))
  storage.removeItem(PREVIOUS_SESSION_KEY)
  return prev
}

export function sameIdentity(
  a: { appId: string; user: { email: string } } | null | undefined,
  b: { appId: string; user: { email: string } } | null | undefined,
): boolean {
  return !!a && !!b && a.appId === b.appId && a.user.email === b.user.email
}
