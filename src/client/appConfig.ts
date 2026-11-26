/**
 * Per-app Web Push config from qismo-api (contract: live-chat-web-push
 * CONTRACT.md, "Widget (wa-handoff) consumption"):
 *
 *   GET {baseUrl}/api/v2/live_handover/push_config?app_code=<code>
 *     200 {"status":"configured","firebase":{apiKey,authDomain?,projectId,messagingSenderId,appId},"vapidKey"?:"..."}
 *     200 {"status":"unconfigured"}       400 {"status":"invalid"}
 *
 * Trust: `baseUrl` is the page's own validated qismo origin (origins.ts exact
 * allowlist, re-checked here) or the one stored with the session, never a raw
 * query value and never a postMessage. The answer is validated with the same
 * rules as the Worker env (push/config.ts invalidFirebaseFields). Anything that
 * is not a valid `configured` answer (unconfigured, 400, 5xx, timeout, network
 * error, a bad field) gives null, and the caller keeps the Worker/container env
 * config exactly as before.
 *
 * Precedence (resolveAppConfig): a configured answer WINS over the env for that
 * app and counts as "app enabled" (no PUSH_APP_CODES entry needed). Its push
 * subscription lives in the app's own service-worker scope, `<base>a/<app>/`,
 * so two apps with different Firebase projects never share one.
 */
import { type FirebaseWebConfig, type PushConfig, invalidFirebaseFields, isAppCode } from "../push/config"
import { isApiOrigin } from "./origins"

export const PUSH_CONFIG_PATH = "/api/v2/live_handover/push_config"

/** How long the page waits for qismo-api before it uses the env config. */
export const APP_CONFIG_TIMEOUT_MS = 4000

export interface AppPushConfig {
  firebase: FirebaseWebConfig
  /** Absent = Firebase's default VAPID key. */
  vapidKey?: string
}

/** The service-worker scope (and script directory) of one app: `<base>a/<appCode>/`. */
export function appScope(base: string, appCode: string): string {
  return `${base}a/${appCode}/`
}

const FIREBASE_FIELDS = ["apiKey", "authDomain", "projectId", "messagingSenderId", "appId"] as const

/** A valid `configured` answer, or null. */
export function parseAppPushConfig(body: unknown): AppPushConfig | null {
  if (!body || typeof body !== "object") return null
  const b = body as { status?: unknown; firebase?: unknown; vapidKey?: unknown }
  if (b.status !== "configured" || !b.firebase || typeof b.firebase !== "object") return null
  const fb = b.firebase as Record<string, unknown>
  // A present value of the wrong type is malformed, not absent.
  if (FIREBASE_FIELDS.some((k) => fb[k] != null && typeof fb[k] !== "string")) return null
  if (b.vapidKey != null && typeof b.vapidKey !== "string") return null
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "")
  const apiKey = str(fb.apiKey)
  const projectId = str(fb.projectId)
  const senderId = str(fb.messagingSenderId)
  const appId = str(fb.appId)
  const authDomain = str(fb.authDomain)
  const vapidKey = str(b.vapidKey)
  if (!apiKey || !projectId || !senderId || !appId) return null
  if (invalidFirebaseFields({ apiKey, projectId, senderId, appId, vapidKey, authDomain }).length) return null
  const firebase: FirebaseWebConfig = { apiKey, projectId, messagingSenderId: senderId, appId }
  if (authDomain) firebase.authDomain = authDomain
  return vapidKey ? { firebase, vapidKey } : { firebase }
}

/**
 * The app's config from qismo-api at `apiOrigin`, or null. `href` is the page
 * URL (loopback dev hosts are allowed only while the page itself is loopback).
 */
export async function fetchAppPushConfig(
  fetchFn: typeof fetch,
  apiOrigin: string,
  appCode: string,
  href?: string,
  timeoutMs = APP_CONFIG_TIMEOUT_MS,
): Promise<AppPushConfig | null> {
  if (!isAppCode(appCode) || !isApiOrigin(apiOrigin, href)) return null
  const abort = new AbortController()
  const timer = setTimeout(() => abort.abort(), timeoutMs)
  try {
    const res = await fetchFn(`${apiOrigin}${PUSH_CONFIG_PATH}?app_code=${encodeURIComponent(appCode)}`, {
      method: "GET",
      // A simple CORS GET (no preflight); qismo-api answers with
      // Access-Control-Allow-Origin * and Cache-Control max-age=300.
      credentials: "omit",
      signal: abort.signal,
    })
    if (res.status !== 200) return null
    return parseAppPushConfig(await res.json())
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** The config to use for `appCode`: the backend answer when there is one, else the env config untouched. */
export function resolveAppConfig(env: PushConfig, backend: AppPushConfig | null, appCode: string, base: string): PushConfig {
  if (!backend) return env
  return {
    status: "configured",
    firebase: backend.firebase,
    ...(backend.vapidKey ? { vapidKey: backend.vapidKey } : {}),
    appCodes: [appCode],
    // Only the env knows PUSH_ROOM_ORIGINS; qismo-api does not provide it.
    roomOrigins: env.status === "configured" ? env.roomOrigins : [],
    swScope: appScope(base, appCode),
  }
}
