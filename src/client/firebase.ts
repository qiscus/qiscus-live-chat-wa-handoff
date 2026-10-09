/**
 * FCM web token minting with the official firebase/messaging client.
 * Built separately as /js/push/firebase.js (ESM) and loaded with a dynamic
 * import only when push is configured and the user opts in, so the chat page
 * does not pay for Firebase otherwise.
 *
 * Only the public web-app config + VAPID public key are used. The token is
 * minted against OUR service worker (/sw.js); Firebase's own
 * firebase-messaging-sw.js is never registered.
 */
import { type FirebaseApp, getApps, initializeApp } from "firebase/app"
import { getMessaging, getToken as fbGetToken, isSupported } from "firebase/messaging"
import type { ConfiguredPushConfig } from "./controller"

const APP_NAME = "qiscus-handoff"

function app(cfg: ConfiguredPushConfig): FirebaseApp {
  const existing = getApps().find((a) => a.name === APP_NAME)
  if (existing) {
    const o = existing.options
    if (o.projectId === cfg.firebase.projectId && o.appId === cfg.firebase.appId) return existing
  }
  return initializeApp(cfg.firebase, existing ? `${APP_NAME}-${Date.now()}` : APP_NAME)
}

async function messaging(cfg: ConfiguredPushConfig) {
  if (!(await isSupported())) throw new Error("messaging-unsupported")
  return getMessaging(app(cfg))
}

export async function getToken(cfg: ConfiguredPushConfig, registration: ServiceWorkerRegistration): Promise<string> {
  return fbGetToken(await messaging(cfg), { vapidKey: cfg.vapidKey, serviceWorkerRegistration: registration })
}

// Revocation deliberately does not use firebase's deleteToken(): without a
// getToken() earlier in the same page load it registers Firebase's default
// /firebase-messaging-sw.js (absent here). Unsubscribing the push subscription
// of OUR worker stops delivery at the push service instead; the next getToken()
// sees the subscription is gone and mints a fresh token. See main.ts.
