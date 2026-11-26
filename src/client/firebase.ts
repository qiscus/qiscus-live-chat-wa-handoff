/**
 * FCM web token minting with the official firebase/messaging client.
 * Built separately as /js/push/firebase.js (ESM) and loaded with a dynamic
 * import only when push is configured and the user opts in, so the chat page
 * does not pay for Firebase otherwise.
 *
 * Only the public web-app config + VAPID public key are used. The token is
 * minted against OUR service worker: /sw.js for the Worker env config, or
 * /a/<app>/sw.js for an app whose config comes from qismo-api (the registration
 * passed in). Firebase's own firebase-messaging-sw.js is never registered.
 * A per-app config may come without a VAPID key: getToken then runs without
 * `vapidKey` and Firebase uses its default key.
 */
import { type FirebaseApp, getApps, initializeApp } from "firebase/app"
import { getId, getInstallations } from "firebase/installations"
import { type GetTokenOptions, getMessaging, getToken as fbGetToken, isSupported } from "firebase/messaging"
import type { ConfiguredPushConfig } from "./controller"

const APP_NAME = "qiscus-handoff"

/** One Firebase app per web app: different apps on this origin may use different projects. */
function app(cfg: ConfiguredPushConfig): FirebaseApp {
  const ours = getApps().filter((a) => a.name === APP_NAME || a.name.startsWith(`${APP_NAME}-`))
  const same = ours.find((a) => a.options.projectId === cfg.firebase.projectId && a.options.appId === cfg.firebase.appId)
  if (same) return same
  return initializeApp(cfg.firebase, ours.length ? `${APP_NAME}-${Date.now()}` : APP_NAME)
}

/** getToken options: `vapidKey` only when the config has one (else Firebase's default key). */
export function tokenOptions(cfg: Pick<ConfiguredPushConfig, "vapidKey">, registration: ServiceWorkerRegistration): GetTokenOptions {
  return cfg.vapidKey ? { vapidKey: cfg.vapidKey, serviceWorkerRegistration: registration } : { serviceWorkerRegistration: registration }
}

async function messaging(cfg: ConfiguredPushConfig) {
  if (!(await isSupported())) throw new Error("messaging-unsupported")
  return getMessaging(app(cfg))
}

/**
 * Token minting runs in named stages so a failure on a customer's phone says
 * WHERE it broke ("installations", "token"), not just Safari's bare
 * "TypeError: Load failed". A network-level TypeError is retried once (iOS
 * WebKit drops fetches around app switches and permission prompts); if it
 * fails again, a no-cors probe tells "googleapis unreachable" (content
 * blocker, DNS filter, network) apart from a request-specific failure.
 */
export class PushStageError extends Error {
  constructor(
    readonly stage: string,
    readonly original: unknown,
    note = "",
  ) {
    super(`${stage}${note ? ` (${note})` : ""} — ${describe(original)}`)
    this.name = "PushStageError"
  }
}

function describe(e: unknown): string {
  const err = e as { name?: unknown; code?: unknown; message?: unknown } | null
  const parts = [err?.name, err?.code, err?.message].filter((x): x is string => typeof x === "string" && x.length > 0)
  return parts.length ? [...new Set(parts)].join(": ") : String(e)
}

const isNetworkError = (e: unknown) => e instanceof TypeError

const PROBE_URL = "https://firebaseinstallations.googleapis.com/"

async function googleReachable(): Promise<boolean> {
  try {
    await fetch(PROBE_URL, { mode: "no-cors", cache: "no-store" })
    return true
  } catch {
    return false
  }
}

async function stage<T>(name: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (first) {
    if (!isNetworkError(first)) throw new PushStageError(name, first)
    await new Promise((r) => setTimeout(r, 1000))
    try {
      return await fn()
    } catch (second) {
      const note = isNetworkError(second) ? ((await googleReachable()) ? "retried" : "retried, googleapis unreachable") : "retried"
      throw new PushStageError(name, second, note)
    }
  }
}

export async function getToken(cfg: ConfiguredPushConfig, registration: ServiceWorkerRegistration): Promise<string> {
  const m = await stage("messaging", () => messaging(cfg))
  // Firebase Installation first: same call getToken makes internally, but on
  // its own so its failure is labelled separately from the FCM registration.
  await stage("installations", () => getId(getInstallations(app(cfg))))
  return stage("token", () => fbGetToken(m, tokenOptions(cfg, registration)))
}

// Revocation deliberately does not use firebase's deleteToken(): without a
// getToken() earlier in the same page load it registers Firebase's default
// /firebase-messaging-sw.js (absent here). Unsubscribing the push subscription
// of OUR worker stops delivery at the push service instead; the next getToken()
// sees the subscription is gone and mints a fresh token. See main.ts.
