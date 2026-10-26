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
