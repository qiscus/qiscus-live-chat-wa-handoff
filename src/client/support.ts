/**
 * Can this browser receive Web Push for the handoff page?
 *
 * iOS/iPadOS only exposes Push to Home Screen web apps (16.4+); a Safari tab
 * has no PushManager. That case gets Add-to-Home-Screen guidance instead of a
 * dead button.
 */
export type SupportState = "supported" | "unsupported" | "ios-install"

export interface SupportProbe {
  isSecureContext: boolean
  serviceWorker: boolean
  pushManager: boolean
  notification: boolean
  userAgent: string
  standalone: boolean
  maxTouchPoints: number
}

export function isIos(userAgent: string, maxTouchPoints: number): boolean {
  if (/iPad|iPhone|iPod/.test(userAgent)) return true
  // iPadOS 13+ reports a desktop Safari UA; touch points give it away.
  return /Macintosh/.test(userAgent) && maxTouchPoints > 1
}

export function detectSupport(p: SupportProbe): SupportState {
  const ios = isIos(p.userAgent, p.maxTouchPoints)
  if (ios && !p.standalone) return "ios-install"
  if (!p.isSecureContext || !p.serviceWorker || !p.pushManager || !p.notification) return "unsupported"
  return "supported"
}

/** Probe the real browser. Only called in the page, never in tests. */
export function probeBrowser(w: Window & typeof globalThis): SupportProbe {
  const nav = w.navigator as Navigator & { standalone?: boolean }
  return {
    isSecureContext: !!w.isSecureContext,
    serviceWorker: "serviceWorker" in nav,
    pushManager: "PushManager" in w,
    notification: "Notification" in w,
    userAgent: nav.userAgent || "",
    standalone: nav.standalone === true || !!w.matchMedia?.("(display-mode: standalone)").matches,
    maxTouchPoints: nav.maxTouchPoints || 0,
  }
}
