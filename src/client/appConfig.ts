/**
 * Per-app Web Push config, loaded by the page from qismo-api once the app code
 * is known (the invite exchange tells it):
 *
 *   GET {baseUrl}/api/v2/live_handover/push_config?app_code=<code>
 *     -> 200 {"status":"configured","firebase":{...},"vapidKey":"..."}
 *     -> 200 {"status":"unconfigured"}   |  400 malformed code
 *
 * Trust: the host is the page's own validated `baseUrl` (the same host the
 * invite is exchanged with), never a URL query value of its own and never a
 * postMessage. The body is validated with the Worker's rules
 * (invalidFirebaseFields); anything unusable -> null -> the caller falls back
 * to the Worker env config, so an app without backend config (or a backend
 * that does not have the endpoint yet) behaves exactly as before.
 *
 * Precedence (resolveAppConfig): a configured backend answer WINS over the
 * Worker env for that app, and counts as "app enabled" for it (no
 * PUSH_APP_CODES entry needed). Otherwise the env result is used untouched.
 */
import { type FirebaseWebConfig, type PushConfig, invalidFirebaseFields } from "../push/config"
import { APP_CODE_RE } from "./session"

export const PUSH_CONFIG_PATH = "/api/v2/live_handover/push_config"
export const QISCUS_HOST = /(^|\.)qiscus\.(com|io)$/

/** How long the room swap / opt-in may wait for the backend before using env. */
export const APP_CONFIG_TIMEOUT_MS = 4000

export interface AppPushConfig {
  firebase: FirebaseWebConfig
  vapidKey: string
}

/**
 * widget.html's allowlist for `baseUrl`, re-applied here because this bundle
 * must not trust the page to have done it: https on qiscus.com / qiscus.io
 * (and subdomains), or localhost / 127.0.0.1 over http(s). Returns the origin.
 *
 * `selfOrigin` is passed only when qismo-api serves this app under a path prefix
 * (see base.ts): then the page's own origin is the API itself and is accepted
 * whatever its host is, e.g. a custom domain.
 */
export function parseBaseUrl(raw: string, selfOrigin?: string): string | null {
  try {
    const url = new URL(raw)
    if (selfOrigin && url.origin === selfOrigin) return url.origin
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1"
    if ((url.protocol === "https:" && QISCUS_HOST.test(url.hostname)) || (local && /^https?:$/.test(url.protocol))) return url.origin
  } catch {}
  return null
}

/** The service-worker scope that holds one app's push subscription (`base` = the app's path prefix, see base.ts). */
export function appScope(appCode: string, base = "/"): string {
  return `${base}a/${appCode}/`
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "")

export function parseAppPushConfig(body: unknown): AppPushConfig | null {
  const b = body as { status?: unknown; firebase?: Record<string, unknown> | null; vapidKey?: unknown } | null
  if (!b || typeof b !== "object" || b.status !== "configured") return null
  const fb = b.firebase
  if (!fb || typeof fb !== "object") return null
  const apiKey = str(fb.apiKey)
  const projectId = str(fb.projectId)
  const senderId = str(fb.messagingSenderId)
  const appId = str(fb.appId)
  const authDomain = str(fb.authDomain)
  const vapidKey = str(b.vapidKey)
  // Present-but-not-a-string values must not pass as "absent".
  if (["apiKey", "projectId", "messagingSenderId", "appId", "authDomain"].some((k) => fb[k] != null && typeof fb[k] !== "string")) return null
  if (b.vapidKey != null && typeof b.vapidKey !== "string") return null
  if (!apiKey || !projectId || !senderId || !appId || !vapidKey) return null
  if (invalidFirebaseFields({ apiKey, projectId, senderId, appId, vapidKey, authDomain }).length) return null
  const firebase: FirebaseWebConfig = { apiKey, projectId, messagingSenderId: senderId, appId }
  if (authDomain) firebase.authDomain = authDomain
  return { firebase, vapidKey }
}

/** The app's config from qismo-api, or null for anything that is not a valid configured answer. */
export async function fetchAppPushConfig(
  fetchFn: typeof fetch,
  baseUrl: string,
  appCode: string,
  timeoutMs = APP_CONFIG_TIMEOUT_MS,
): Promise<AppPushConfig | null> {
  if (!APP_CODE_RE.test(appCode)) return null
  const timer = new AbortController()
  const t = setTimeout(() => timer.abort(), timeoutMs)
  try {
    const res = await fetchFn(`${baseUrl}${PUSH_CONFIG_PATH}?app_code=${encodeURIComponent(appCode)}`, {
      credentials: "omit",
      signal: timer.signal,
    })
    if (!res.ok) return null
    return parseAppPushConfig(await res.json())
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

export function resolveAppConfig(env: PushConfig, backend: AppPushConfig | null, appCode: string, base = "/"): PushConfig {
  if (!backend) return env
  return {
    status: "configured",
    firebase: backend.firebase,
    vapidKey: backend.vapidKey,
    appCodes: [appCode],
    source: "backend",
    swScope: appScope(appCode, base),
  }
}
