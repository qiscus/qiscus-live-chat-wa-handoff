/**
 * Helpers for the hosted room page (public/live-handover-room.html), bundled
 * as /js/push/handoff-room.js and exposed as `window.HandoffRoom`.
 *
 * The room only persists or resumes a session when its parent frame is THIS
 * origin (our /widget.html). Embedded anywhere else, it behaves exactly as
 * before and never writes or reads the stored SDK login.
 */
import { type KeyValueStorage, type StoredSession, loadSession, saveSession } from "./session"

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
): boolean {
  if (!trustedParent(w)) return false
  const user = (userData as { user?: unknown } | null)?.user as StoredSession["user"] | undefined
  try {
    saveSession(storage, { appId, roomId: String(roomId), user: user as StoredSession["user"] }, now)
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

declare global {
  interface Window {
    HandoffRoom?: {
      trustedParent(): boolean
      persistLogin(appId: string, roomId: string, userData: unknown): boolean
      resumeSession(appId: string): StoredSession | null
    }
  }
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  window.HandoffRoom = {
    trustedParent: () => trustedParent(window),
    persistLogin: (appId, roomId, userData) => persistLogin(window, window.localStorage, appId, roomId, userData, Date.now()),
    resumeSession: (appId) => resumeSession(window, window.localStorage, appId, Date.now()),
  }
}
