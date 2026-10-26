/**
 * Public Web Push (FCM) configuration for the hosted handoff page.
 *
 * Everything here is a PUBLIC client identifier: the Firebase web-app config
 * and the Web Push certificate's VAPID *public* key. They come from the same
 * Firebase project whose service-account JSON is uploaded to the Qiscus app
 * (Omnichannel > Settings > Notifications, or the Omnichannel mobile-PN
 * activation). The service-account JSON itself never belongs here: the
 * Worker sends nothing, the existing Qiscus sender (Flash) does.
 *
 * Missing or malformed values switch push off and are reported by NAME only,
 * so `/push/config` can say exactly what is missing without echoing anything.
 */

export const PUSH_ENV_KEYS = [
  "FIREBASE_API_KEY",
  "FIREBASE_AUTH_DOMAIN",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_MESSAGING_SENDER_ID",
  "FIREBASE_APP_ID",
  "FIREBASE_VAPID_KEY",
  "PUSH_APP_CODES",
  "PUSH_ROOM_ORIGINS",
] as const

export type PushEnvKey = (typeof PUSH_ENV_KEYS)[number]
export type PushEnv = Partial<Record<PushEnvKey, string | undefined>>

export interface FirebaseWebConfig {
  apiKey: string
  authDomain?: string
  projectId: string
  messagingSenderId: string
  appId: string
}

export type PushConfig =
  | {
      status: "configured"
      firebase: FirebaseWebConfig
      vapidKey: string
      /** null = every app may enable push. */
      appCodes: string[] | null
      /**
       * TEMPORARY: origins of a CROSS-origin room iframe (e.g. the default
       * https://omnichannel.qiscus.com) for which the page may still enable
       * push, by verifying the exchange's identity token itself. Empty = only
       * the same-origin room. Meant to come from the WA handoff "Allowed
       * domains" setting once qismo-api exposes it publicly; until then the
       * Worker's PUSH_ROOM_ORIGINS.
       */
      roomOrigins: string[]
      /**
       * Set by the PAGE only (never emitted by the Worker's /push/config):
       * this config came from qismo-api for one app, and that app's push
       * subscription lives in its own service-worker scope. Absent = the
       * Worker env config and the legacy root-scope registration.
       */
      source?: "backend"
      swScope?: string
    }
  | {
      status: "unconfigured"
      missing: PushEnvKey[]
      invalid: PushEnvKey[]
    }

const REQUIRED: PushEnvKey[] = [
  "FIREBASE_API_KEY",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_MESSAGING_SENDER_ID",
  "FIREBASE_APP_ID",
  "FIREBASE_VAPID_KEY",
]

const API_KEY = /^AIza[0-9A-Za-z_-]{35}$/
const PROJECT_ID = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/
const SENDER_ID = /^\d{6,20}$/
const APP_ID = /^1:(\d{6,20}):web:[0-9a-f]{6,40}$/
const HOSTNAME = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/
const APP_CODE = /^[A-Za-z0-9_-]{1,64}$/

function base64UrlBytes(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null
  try {
    const b64 = value.replace(/-/g, "+").replace(/_/g, "/")
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4)
    const bin = atob(padded)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  } catch {
    return null
  }
}

/** A VAPID public key is an uncompressed P-256 point: 65 bytes, 0x04 first. */
export function isVapidPublicKey(value: string): boolean {
  const bytes = base64UrlBytes(value)
  return !!bytes && bytes.length === 65 && bytes[0] === 0x04
}

/**
 * A bare https origin (http only for localhost), or a wildcard such as
 * `https://*.qiscus.io` (https only), or null. A wildcard matches any subdomain
 * of the given host, never the host itself, so `https://*.qiscus.io` covers
 * qismo-stag2.qiscus.io, qismo-stag3.qiscus.io, ... without a deploy per host.
 * Paths, queries, credentials and ports on wildcards are refused.
 */
function asRoomOrigin(value: string): string | null {
  const wild = /^https:\/\/\*\.([^/?#:@*]+)$/.exec(value)
  if (wild) return HOSTNAME.test(wild[1]) && wild[1].includes(".") ? `https://*.${wild[1].toLowerCase()}` : null
  if (value.includes("*")) return null // a wildcard is only valid as the whole leftmost label
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1"
  if (!(url.protocol === "https:" || (local && url.protocol === "http:"))) return null
  if (url.username || url.password || url.search || url.hash || (url.pathname !== "/" && url.pathname !== "")) return null
  if (value.replace(/\/$/, "") !== url.origin) return null
  return url.origin
}

/** True when `origin` equals an allowed entry or is a subdomain matched by a `https://*.host` entry. */
export function roomOriginAllowed(origin: string | null | undefined, allowed: readonly string[]): boolean {
  if (!origin) return false
  let url: URL
  try {
    url = new URL(origin)
  } catch {
    return false
  }
  if (url.origin !== origin) return false
  return allowed.some((entry) => {
    if (entry === origin) return true
    const wild = /^https:\/\/\*\.(.+)$/.exec(entry)
    return !!wild && url.protocol === "https:" && url.port === "" && url.hostname.endsWith(`.${wild[1]}`) && HOSTNAME.test(url.hostname)
  })
}

/**
 * The one place the Firebase web-config rules live. Used for the Worker env
 * (readPushConfig) and for per-app config fetched from qismo-api in the page
 * (src/client/appConfig.ts). Empty values are skipped (reported as missing by
 * the caller); returns the NAMES of values that are present but malformed.
 */
export function invalidFirebaseFields(v: {
  apiKey: string
  projectId: string
  senderId: string
  appId: string
  vapidKey: string
  authDomain: string
}): PushEnvKey[] {
  const invalid: PushEnvKey[] = []
  if (v.apiKey && !API_KEY.test(v.apiKey)) invalid.push("FIREBASE_API_KEY")
  if (v.projectId && !PROJECT_ID.test(v.projectId)) invalid.push("FIREBASE_PROJECT_ID")
  if (v.senderId && !SENDER_ID.test(v.senderId)) invalid.push("FIREBASE_MESSAGING_SENDER_ID")
  if (v.appId) {
    const m = APP_ID.exec(v.appId)
    // The app id embeds the project number; a mismatch means two projects
    // were mixed up, and a token minted that way would never deliver.
    if (!m || (v.senderId && m[1] !== v.senderId)) invalid.push("FIREBASE_APP_ID")
  }
  if (v.vapidKey && !isVapidPublicKey(v.vapidKey)) invalid.push("FIREBASE_VAPID_KEY")
  if (v.authDomain && !HOSTNAME.test(v.authDomain)) invalid.push("FIREBASE_AUTH_DOMAIN")
  return invalid
}

export function readPushConfig(env: PushEnv): PushConfig {
  const get = (k: PushEnvKey) => {
    const v = env[k]
    return typeof v === "string" ? v.trim() : ""
  }

  const missing = REQUIRED.filter((k) => !get(k))
  const apiKey = get("FIREBASE_API_KEY")
  const projectId = get("FIREBASE_PROJECT_ID")
  const senderId = get("FIREBASE_MESSAGING_SENDER_ID")
  const appId = get("FIREBASE_APP_ID")
  const vapidKey = get("FIREBASE_VAPID_KEY")
  const authDomain = get("FIREBASE_AUTH_DOMAIN")
  const appCodesRaw = get("PUSH_APP_CODES")
  const roomOriginsRaw = get("PUSH_ROOM_ORIGINS")

  const invalid = invalidFirebaseFields({ apiKey, projectId, senderId, appId, vapidKey, authDomain })

  let appCodes: string[] | null = null
  if (appCodesRaw) {
    const list = appCodesRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    if (list.length === 0 || !list.every((c) => APP_CODE.test(c))) invalid.push("PUSH_APP_CODES")
    else appCodes = list
  }

  let roomOrigins: string[] = []
  if (roomOriginsRaw) {
    const list = roomOriginsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map(asRoomOrigin)
    if (list.length === 0 || list.some((o) => o === null)) invalid.push("PUSH_ROOM_ORIGINS")
    else roomOrigins = [...new Set(list as string[])]
  }

  if (missing.length || invalid.length) return { status: "unconfigured", missing, invalid }

  const firebase: FirebaseWebConfig = { apiKey, projectId, messagingSenderId: senderId, appId }
  if (authDomain) firebase.authDomain = authDomain
  return { status: "configured", firebase, vapidKey, appCodes, roomOrigins }
}
