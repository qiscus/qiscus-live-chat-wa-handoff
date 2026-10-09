/**
 * Register / unregister this browser's FCM token for the handoff CUSTOMER,
 * through the existing Qiscus SDK endpoint the mobile SDKs use:
 *
 *   POST {SDK}/api/v2/sdk/set_user_device_token
 *   POST {SDK}/api/v2/sdk/remove_user_device_token
 *   body {device_token, device_platform: "web", is_development: false}
 *
 * `web` (ClientPlatformWeb = 5) is accepted by qiscus-sdk-api since
 * 1.79.1-qismo-stable. Authentication is the customer's own SDK session
 * (QISCUS-SDK-APP-ID / -USER-ID / -TOKEN), so the upstream decides which user
 * the token belongs to — the page cannot register a token for anyone else.
 *
 * The host is a constant (the same one the hosted room uses); nothing from the
 * URL or the page can redirect these calls elsewhere.
 */
import type { SdkUser, StoredSession } from "./session"

export const SDK_BASE_URL = "https://api3.qiscus.com"
export const DEVICE_PLATFORM = "web"

export interface DeviceTokenResult {
  ok: boolean
  status: number
  /** Safe to log: never contains a token. */
  error?: string
}

// FCM registration tokens are ~150-200 chars of [A-Za-z0-9_:-].
const TOKEN_RE = /^[A-Za-z0-9_:\-]{20,1024}$/

type Creds = Pick<StoredSession, "appId" | "user">

async function call(
  fetchFn: typeof fetch,
  path: "set_user_device_token" | "remove_user_device_token",
  session: Creds,
  deviceToken: string,
): Promise<DeviceTokenResult> {
  if (!TOKEN_RE.test(deviceToken)) return { ok: false, status: 0, error: "invalid-token" }
  try {
    const res = await fetchFn(`${SDK_BASE_URL}/api/v2/sdk/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "QISCUS-SDK-APP-ID": session.appId,
        "QISCUS-SDK-USER-ID": session.user.email,
        "QISCUS-SDK-TOKEN": session.user.token,
      },
      body: JSON.stringify({ device_token: deviceToken, device_platform: DEVICE_PLATFORM, is_development: false }),
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
    })
    if (res.ok) return { ok: true, status: res.status }
    return { ok: false, status: res.status, error: `http-${res.status}` }
  } catch {
    return { ok: false, status: 0, error: "network" }
  }
}

export function setDeviceToken(fetchFn: typeof fetch, session: Creds, deviceToken: string) {
  return call(fetchFn, "set_user_device_token", session, deviceToken)
}

export function removeDeviceToken(fetchFn: typeof fetch, session: Creds, deviceToken: string) {
  return call(fetchFn, "remove_user_device_token", session, deviceToken)
}

export interface VerifyResult {
  ok: boolean
  status: number
  /** The customer's SDK login (email + SDK token). Never logged. */
  user?: SdkUser
  error?: string
}

/**
 * Cross-origin room only: turn the exchange's identity token into the
 * customer's SDK login, the same call the room iframe makes
 * (`QiscusSDK.core.verifyIdentityToken`). The nonce inside the token is not
 * consumed and an existing user's SDK token is not rotated, so the room's own
 * login is unaffected. The identity token lives ~120 s and is never stored.
 */
export async function verifyIdentityToken(fetchFn: typeof fetch, appId: string, identityToken: string): Promise<VerifyResult> {
  if (!identityToken || identityToken.length > 8192) return { ok: false, status: 0, error: "invalid-identity-token" }
  try {
    const res = await fetchFn(`${SDK_BASE_URL}/api/v2/sdk/auth/verify_identity_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "QISCUS-SDK-APP-ID": appId },
      body: JSON.stringify({ identity_token: identityToken }),
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
    })
    if (!res.ok) return { ok: false, status: res.status, error: `http-${res.status}` }
    const body = (await res.json().catch(() => null)) as { results?: { user?: unknown } } | null
    const user = body?.results?.user as SdkUser | undefined
    if (!user || typeof user.email !== "string" || typeof user.token !== "string") return { ok: false, status: res.status, error: "bad-response" }
    return { ok: true, status: res.status, user }
  } catch {
    return { ok: false, status: 0, error: "network" }
  }
}
