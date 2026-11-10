/**
 * Helpers for the hosted room page (public/live-handover-room.html), bundled
 * as /js/push/handoff-room.js and exposed as `window.HandoffRoom`.
 *
 * The room only persists or resumes a session when its parent frame is THIS
 * origin (our /widget.html). Embedded anywhere else, it behaves exactly as
 * before and never writes or reads the stored SDK login.
 */
import { DEFAULT_SDK_ORIGIN, pickSdkOrigin } from "./origins"
import { type KeyValueStorage, type StoredSession, loadSession, saveSession, sessionSdk } from "./session"

export function trustedParent(w: Window): boolean {
  try {
    if (w.parent === w) return false
    return w.parent.location.origin === w.location.origin
  } catch {
    return false
  }
}

/** Store the SDK login after an identity-token login. Returns whether it stored. */
export function persistLogin(
  w: Window,
  storage: KeyValueStorage,
  appId: string,
  roomId: string,
  userData: unknown,
  now: number,
  sdk: string = DEFAULT_SDK_ORIGIN,
): boolean {
  if (!trustedParent(w)) return false
  const user = (userData as { user?: unknown } | null)?.user as StoredSession["user"] | undefined
  try {
    saveSession(storage, { appId, roomId: String(roomId), user: user as StoredSession["user"], sdk }, now)
    return true
  } catch {
    return false
  }
}

/** The stored session for this app, for a resume load. */
export function resumeSession(w: Window, storage: KeyValueStorage, appId: string, now: number): StoredSession | null {
  if (!trustedParent(w)) return null
  const loaded = loadSession(storage, now)
  if (loaded.state !== "valid" || loaded.session.appId !== appId) return null
  return loaded.session
}

/**
 * The SDK host for the room: on a resume, the stored login's own host; on an
 * invite, `?sdk_base_url=` (set by QismoFull from the page's sdkBaseUrl) when it
 * is one of origins.ts SDK_ORIGINS. Absent = the ID host; anything else = null,
 * and the room refuses to start rather than log in against a foreign host.
 */
export function roomSdkOrigin(query: string, resumed: StoredSession | null, href?: string): string | null {
  if (resumed) return sessionSdk(resumed)
  return pickSdkOrigin(new URLSearchParams(query).get("sdk_base_url"), href)
}

declare global {
  interface Window {
    HandoffRoom?: {
      trustedParent(): boolean
      persistLogin(appId: string, roomId: string, userData: unknown, sdk?: string): boolean
      resumeSession(appId: string): StoredSession | null
      sdkOrigin(resumed: StoredSession | null): string | null
    }
  }
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  window.HandoffRoom = {
    trustedParent: () => trustedParent(window),
    persistLogin: (appId, roomId, userData, sdk) => persistLogin(window, window.localStorage, appId, roomId, userData, Date.now(), sdk),
    resumeSession: (appId) => resumeSession(window, window.localStorage, appId, Date.now()),
    sdkOrigin: (resumed) => roomSdkOrigin(location.search, resumed),
  }
}
