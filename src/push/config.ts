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

export function readPushConfig(env: PushEnv): PushConfig {
  const get = (k: PushEnvKey) => {
    const v = env[k]
    return typeof v === "string" ? v.trim() : ""
  }

  const missing = REQUIRED.filter((k) => !get(k))
  const invalid: PushEnvKey[] = []

  const apiKey = get("FIREBASE_API_KEY")
  const projectId = get("FIREBASE_PROJECT_ID")
  const senderId = get("FIREBASE_MESSAGING_SENDER_ID")
  const appId = get("FIREBASE_APP_ID")
  const vapidKey = get("FIREBASE_VAPID_KEY")
  const authDomain = get("FIREBASE_AUTH_DOMAIN")
  const appCodesRaw = get("PUSH_APP_CODES")

  if (apiKey && !API_KEY.test(apiKey)) invalid.push("FIREBASE_API_KEY")
  if (projectId && !PROJECT_ID.test(projectId)) invalid.push("FIREBASE_PROJECT_ID")
  if (senderId && !SENDER_ID.test(senderId)) invalid.push("FIREBASE_MESSAGING_SENDER_ID")
  if (appId) {
    const m = APP_ID.exec(appId)
    // The app id embeds the project number; a mismatch means two projects
    // were mixed up, and a token minted that way would never deliver.
    if (!m || (senderId && m[1] !== senderId)) invalid.push("FIREBASE_APP_ID")
  }
  if (vapidKey && !isVapidPublicKey(vapidKey)) invalid.push("FIREBASE_VAPID_KEY")
  if (authDomain && !HOSTNAME.test(authDomain)) invalid.push("FIREBASE_AUTH_DOMAIN")

  let appCodes: string[] | null = null
  if (appCodesRaw) {
    const list = appCodesRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    if (list.length === 0 || !list.every((c) => APP_CODE.test(c))) invalid.push("PUSH_APP_CODES")
    else appCodes = list
  }

  if (missing.length || invalid.length) return { status: "unconfigured", missing, invalid }

  const firebase: FirebaseWebConfig = { apiKey, projectId, messagingSenderId: senderId, appId }
  if (authDomain) firebase.authDomain = authDomain
  return { status: "configured", firebase, vapidKey, appCodes }
}
