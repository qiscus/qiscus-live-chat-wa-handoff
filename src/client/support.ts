/**
 * Can this browser receive Web Push for the handoff page?
 *
 * iOS/iPadOS only exposes Push to Home Screen web apps (16.4+); a Safari tab
 * has no PushManager. That case gets Add-to-Home-Screen guidance instead of a
 * dead button. Inside an in-app browser (WhatsApp, Instagram, ...) the share
 * sheet has no "Add to Home Screen" at all, so that case is sent to Safari
 * first ("ios-open-safari").
 */
export type SupportState = "supported" | "unsupported" | "ios-install" | "ios-open-safari"

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

const IN_APP_TOKENS = /WhatsApp|FBAN|FBAV|FB_IAB|Instagram|Barcelona|Line\/|Twitter|LinkedInApp|musical_ly|BytedanceWebview|MicroMessenger|Telegram|Snapchat/

/**
 * iOS in-app browser, by user agent. App-embedded WKWebViews carry an app token
 * or lack Safari's trailing "Safari/" token. An SFSafariViewController looks
 * exactly like Safari and is not detectable: it gets the normal install
 * guidance, which also offers "open in Safari".
 */
export function isIosInAppBrowser(userAgent: string): boolean {
  return IN_APP_TOKENS.test(userAgent) || !/Safari\//.test(userAgent)
}

export function detectSupport(p: SupportProbe): SupportState {
  const ios = isIos(p.userAgent, p.maxTouchPoints)
  if (ios && !p.standalone) return isIosInAppBrowser(p.userAgent) ? "ios-open-safari" : "ios-install"
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
