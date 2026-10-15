/**
 * Push opt-in for the hosted handoff page, on the existing Qiscus FCM path.
 *
 *   explicit click -> Notification permission -> FCM web token (firebase/messaging,
 *   public web config + VAPID from /push/config) -> set_user_device_token
 *   (device_platform "web") as the handoff CUSTOMER -> SW context for filtering.
 *
 * Delivery is done by Qiscus's existing sender (qiscus-sdk-api sendPN ->
 * Flash /v1/pn/room). This page sends nothing and holds no sender credential.
 *
 * Identity rules:
 *  - a registration belongs to exactly one (app, SDK user); any other identity
 *    showing up on this device (new invite, different customer) removes it with
 *    the OWNER's credentials before the new one registers;
 *  - session end (conversation resolved, expiry, upstream rejection) and
 *    revoked permission remove it as well;
 *  - nothing is registered without the user's explicit click on this device.
 */
import type { PushConfig } from "../push/config"
import { removeDeviceToken, setDeviceToken, verifyIdentityToken } from "./sdkDeviceToken"
import {
  type KeyValueStorage,
  type StoredSession,
  clearSession,
  loadSession,
  saveSession,
  sameIdentity,
  stashSessionForInvite,
  takePreviousSession,
} from "./session"
import type { SupportState } from "./support"

export const REG_KEY = "qiscus-handoff:push-registration:v1"
export const OPT_IN_KEY = "qiscus-handoff:push-opt-in:v1"

export type ConfiguredPushConfig = Extract<PushConfig, { status: "configured" }>

export type PushUiState =
  | { kind: "hidden" }
  | { kind: "unconfigured"; missing: string[]; invalid: string[] }
  | { kind: "unsupported" }
  | { kind: "ios-install" }
  | { kind: "ios-open-safari" }
  | { kind: "android-open-browser" }
  | { kind: "cross-origin-room" }
  | { kind: "app-not-enabled" }
  | { kind: "offer" }
  | { kind: "busy" }
  | { kind: "enabled" }
  | { kind: "denied" }
  | { kind: "error"; reason: string; detail?: string }

/** What the page saw of the invite exchange. In memory only, never stored. */
export interface ExchangeCapture {
  appId: string
  roomId: string
  identityToken: string
}

/**
 * A short, display-safe description of a thrown error, for the on-page error
 * notice (operators cannot read the console after the page is reopened).
 * Long token-like runs are cut out, so nothing credential-shaped is shown.
 */
export function errorDetail(e: unknown): string {
  const err = e as { name?: unknown; code?: unknown; message?: unknown } | null
  const parts = [err?.name, err?.code, err?.message].filter((x): x is string => typeof x === "string" && x.length > 0)
  const raw = parts.length ? [...new Set(parts)].join(": ") : String(e)
  return raw.replace(/[A-Za-z0-9_:.\-]{40,}/g, "…").replace(/\s+/g, " ").trim().slice(0, 200)
}

export interface SwContext {
  appId: string
  roomId: string
  selfEmail: string
  /** Same-origin /widget.html URL a notification click reopens (per-app scopes only). */
  resume?: string
}

export interface PushDeps {
  storage: KeyValueStorage
  fetch: typeof fetch
  now(): number
  support(): SupportState
  permission(): NotificationPermission
  requestPermission(): Promise<NotificationPermission>
  /** Config for one app (backend config wins over the Worker env), or the env config when the app is unknown. */
  loadConfig(appId?: string): Promise<PushConfig>
  /** The resume URL for this page's backend (see SwContext.resume); only used for per-app scopes. */
  resumeUrl?(): string | undefined
  fcm: {
    getToken(cfg: ConfiguredPushConfig): Promise<string>
    /** `swScope` undefined = the legacy root-scope subscription. */
    deleteToken(target: { swScope?: string }): Promise<void>
  }
  /** `scope` selects whose context is written/cleared (undefined = legacy root). */
  swContext: { write(ctx: SwContext | null, scope?: string): Promise<void> }
  onState(state: PushUiState): void
  /** Operator debug trail. Never receives a token, an e-mail or message content. */
  debug?(...args: unknown[]): void
}

interface Registration {
  v: 1
  fcmToken: string
  appId: string
  userEmail: string
  roomId: string
  at: number
  /** SW scope holding this subscription; absent = the legacy root scope. */
  scope?: string
}

type Creds = Pick<StoredSession, "appId" | "user">

export class PushController {
  private cfgs = new Map<string, PushConfig>()

  constructor(private deps: PushDeps) {}

  // ---------------------------------------------------------------- lifecycle

  /** A new invite (#t=) arrived: the current identity can no longer resume. */
  beginInvite(): void {
    stashSessionForInvite(this.deps.storage)
    this.emit({ kind: "hidden" })
  }

  /** The invite could not be exchanged: the old identity is still gone. */
  async inviteFailed(): Promise<void> {
    await this.teardownPrevious()
    this.emit({ kind: "hidden" })
  }

  /**
   * The room iframe is not on this origin, so its SDK login is unreachable.
   * TEMPORARY: when that origin is in the config's roomOrigins and the page saw
   * the exchange, the page verifies the identity token itself and continues as
   * if a same-origin room had stored the session.
   */
  async crossOriginRoom(room?: { origin: string | null; exchange: ExchangeCapture | null }): Promise<void> {
    const cfg = await this.config(room?.exchange?.appId)
    const origin = room?.origin ?? null
    const allowed = cfg.status === "configured" && !!origin && cfg.roomOrigins.includes(origin)
    if (!allowed || !room?.exchange) {
      this.log("cross-origin room not adopted", {
        origin,
        allowedOrigins: cfg.status === "configured" ? cfg.roomOrigins : [],
        exchangeSeen: !!room?.exchange,
      })
      await this.teardownPrevious()
      this.emit({ kind: "cross-origin-room" })
      return
    }
    const { appId, roomId, identityToken } = room.exchange
    const r = await verifyIdentityToken(this.deps.fetch, appId, identityToken)
    this.log("verify_identity_token (cross-origin room)", { ok: r.ok, status: r.status, error: r.error, appId, roomId })
    if (!r.ok || !r.user) {
      await this.teardownPrevious()
      this.emit({ kind: "cross-origin-room" })
      return
    }
    try {
      saveSession(this.deps.storage, { appId, roomId, user: r.user }, this.deps.now())
    } catch (e) {
      this.log("cross-origin session not stored", String(e))
      await this.teardownPrevious()
      this.emit({ kind: "cross-origin-room" })
      return
    }
    await this.sessionReady()
  }

  /** The same-origin room logged in and stored the session. */
  async sessionReady(): Promise<void> {
    const loaded = loadSession(this.deps.storage, this.deps.now())
    const prev = takePreviousSession(this.deps.storage)
    const session = loaded.state === "valid" ? loaded.session : null
    if (prev && !sameIdentity(prev, session)) await this.teardown(prev)
    if (!session) {
      if (loaded.state === "expired") await this.teardown(loaded.session)
      this.emit({ kind: "hidden" })
      return
    }
    // A registration owned by someone we hold no credentials for: drop it locally.
    const reg = this.loadReg()
    if (reg && !this.ownedBy(reg, session)) await this.teardown(null)
    await this.refresh(session)
  }

  /** Conversation resolved: stop pushes and forget the session. */
  async sessionClosed(): Promise<void> {
    const loaded = loadSession(this.deps.storage, this.deps.now())
    await this.teardown(loaded.state === "none" ? null : loaded.session)
    clearSession(this.deps.storage)
    this.emit({ kind: "hidden" })
  }

  /** The stored SDK login was rejected upstream on resume. */
  async sessionInvalid(): Promise<void> {
    await this.sessionClosed()
  }

  /**
   * Called on a page load WITHOUT an invite. Returns the session to resume, or
   * null. Never touches the network for a valid session.
   */
  async resume(): Promise<StoredSession | null> {
    await this.teardownPrevious()
    const loaded = loadSession(this.deps.storage, this.deps.now())
    if (loaded.state === "valid") return loaded.session
    if (loaded.state === "expired") await this.teardown(loaded.session)
    else if (this.loadReg()) await this.teardown(null)
    return null
  }

  // -------------------------------------------------------------- user actions

  /** Explicit opt-in. Must run from a user gesture (permission prompt). */
  async enable(): Promise<void> {
    const ctx = await this.context()
    if (!ctx) return
    const { session, cfg } = ctx
    this.emit({ kind: "busy" })
    let perm = this.deps.permission()
    this.log("enable clicked", { permission: perm })
    if (perm !== "granted") {
      try {
        perm = await this.deps.requestPermission()
      } catch {
        perm = this.deps.permission()
      }
      this.log("permission prompt answered", perm)
    }
    if (perm === "denied") {
      this.deps.storage.removeItem(OPT_IN_KEY)
      this.emit({ kind: "denied" })
      return
    }
    if (perm !== "granted") {
      this.emit({ kind: "offer" })
      return
    }
    this.deps.storage.setItem(OPT_IN_KEY, "1")
    this.emit(await this.ensureRegistered(session, cfg))
  }

  async disable(): Promise<void> {
    const loaded = loadSession(this.deps.storage, this.deps.now())
    this.deps.storage.removeItem(OPT_IN_KEY)
    await this.teardown(loaded.state === "none" ? null : loaded.session)
    this.emit(loaded.state === "valid" ? { kind: "offer" } : { kind: "hidden" })
  }

  // ------------------------------------------------------------------ internals

  private async refresh(session: StoredSession): Promise<void> {
    const ctx = await this.context(session)
    if (!ctx) return
    const perm = this.deps.permission()
    const reg = this.loadReg()
    if (perm === "denied") {
      this.deps.storage.removeItem(OPT_IN_KEY)
      if (reg) await this.teardown(session)
      this.emit({ kind: "denied" })
      return
    }
    if (perm !== "granted") {
      if (reg) await this.teardown(session)
      this.emit({ kind: "offer" })
      return
    }
    if (this.deps.storage.getItem(OPT_IN_KEY) !== "1") {
      if (reg) await this.teardown(session)
      this.emit({ kind: "offer" })
      return
    }
    this.emit(await this.ensureRegistered(session, ctx.cfg))
  }

  /** Session + config + support + app allowlist, emitting the blocking state if any. */
  private async context(given?: StoredSession): Promise<{ session: StoredSession; cfg: ConfiguredPushConfig } | null> {
    let session = given ?? null
    if (!session) {
      const loaded = loadSession(this.deps.storage, this.deps.now())
      session = loaded.state === "valid" ? loaded.session : null
    }
    if (!session) {
      this.emit({ kind: "hidden" })
      return null
    }
    const cfg = await this.config(session.appId)
    if (cfg.status !== "configured") {
      this.log("push config not usable", { missing: cfg.missing, invalid: cfg.invalid })
      this.emit({ kind: "unconfigured", missing: cfg.missing, invalid: cfg.invalid })
      return null
    }
    if (cfg.appCodes && !cfg.appCodes.includes(session.appId)) {
      this.log("app not in PUSH_APP_CODES", { appId: session.appId, allowed: cfg.appCodes })
      if (this.loadReg()) await this.teardown(session)
      this.emit({ kind: "app-not-enabled" })
      return null
    }
    const support = this.deps.support()
    if (support !== "supported") {
      this.log("browser support", support)
      this.emit({ kind: support })
      return null
    }
    return { session, cfg }
  }

  private async ensureRegistered(session: StoredSession, cfg: ConfiguredPushConfig): Promise<PushUiState> {
    let token: string
    try {
      token = await this.deps.fcm.getToken(cfg)
    } catch (e) {
      this.log("FCM token minting failed", String(e))
      return { kind: "error", reason: "fcm", detail: errorDetail(e) }
    }
    this.log("FCM token minted", { projectId: cfg.firebase.projectId })
    const reg = this.loadReg()
    const sameToken = !!reg && reg.fcmToken === token && this.ownedBy(reg, session)
    if (!sameToken) {
      const r = await setDeviceToken(this.deps.fetch, session, token)
      this.log("set_user_device_token", { ok: r.ok, status: r.status, appId: session.appId, roomId: session.roomId })
      if (!r.ok) return { kind: "error", reason: r.error || "register", detail: `set_user_device_token HTTP ${r.status || "-"}` }
      // Rotated token: the old one must not keep receiving.
      if (reg && reg.fcmToken !== token && this.ownedBy(reg, session)) {
        await removeDeviceToken(this.deps.fetch, session, reg.fcmToken)
      }
    }
    // The registration moved to another service-worker scope (e.g. the backend
    // started serving config for an app that was on the Worker env): the old
    // scope's subscription must not keep receiving.
    if (reg && this.ownedBy(reg, session) && reg.scope !== cfg.swScope) {
      await this.safe(() => this.deps.fcm.deleteToken({ swScope: reg.scope }))
      await this.safe(() => this.deps.swContext.write(null, reg.scope))
    }
    this.saveReg({
      v: 1,
      fcmToken: token,
      appId: session.appId,
      userEmail: session.user.email,
      roomId: session.roomId,
      at: this.deps.now(),
      ...(cfg.swScope ? { scope: cfg.swScope } : {}),
    })
    const resume = cfg.swScope ? this.deps.resumeUrl?.() : undefined
    await this.safe(() =>
      this.deps.swContext.write(
        { appId: session.appId, roomId: session.roomId, selfEmail: session.user.email, ...(resume ? { resume } : {}) },
        cfg.swScope,
      ),
    )
    return { kind: "enabled" }
  }

  private async teardownPrevious(): Promise<void> {
    const prev = takePreviousSession(this.deps.storage)
    if (prev) await this.teardown(prev)
  }

  /**
   * Remove this device's registration. Upstream removal only happens with the
   * owner's own credentials; without them the FCM token is still deleted, which
   * stops delivery at the push service.
   */
  private async teardown(owner: Creds | null): Promise<void> {
    const reg = this.loadReg()
    if (!reg) return
    if (owner && this.ownedBy(reg, owner)) {
      await removeDeviceToken(this.deps.fetch, owner, reg.fcmToken)
    }
    // The scope comes from the registration itself, not from a config that may
    // no longer load (backend down, app since unconfigured).
    await this.safe(() => this.deps.fcm.deleteToken({ swScope: reg.scope }))
    this.deps.storage.removeItem(REG_KEY)
    await this.safe(() => this.deps.swContext.write(null, reg.scope))
  }

  private ownedBy(reg: Registration, who: Creds): boolean {
    return reg.appId === who.appId && reg.userEmail === who.user.email
  }

  private async config(appId?: string): Promise<PushConfig> {
    const key = appId ?? ""
    let cfg = this.cfgs.get(key)
    if (!cfg) {
      try {
        cfg = await this.deps.loadConfig(appId)
      } catch {
        return { status: "unconfigured", missing: [], invalid: [] }
      }
      this.cfgs.set(key, cfg)
    }
    return cfg
  }

  private loadReg(): Registration | null {
    try {
      const r = JSON.parse(this.deps.storage.getItem(REG_KEY) || "null") as Registration | null
      if (r && r.v === 1 && typeof r.fcmToken === "string" && typeof r.appId === "string" && typeof r.userEmail === "string") return r
    } catch {}
    if (this.deps.storage.getItem(REG_KEY) !== null) this.deps.storage.removeItem(REG_KEY)
    return null
  }

  private saveReg(r: Registration): void {
    this.deps.storage.setItem(REG_KEY, JSON.stringify(r))
  }

  private async safe(fn: () => Promise<unknown>): Promise<void> {
    try {
      await fn()
    } catch {}
  }

  private emit(state: PushUiState): void {
    this.log("state", state)
    this.deps.onState(state)
  }

  private log(...args: unknown[]): void {
    try {
      this.deps.debug?.(...args)
    } catch {}
  }
}
