/**
 * OmniForm embed settings for the handoff room page.
 *
 * Port of multichannel-frontend's `iframes/v5/_omniform-config.blade.php`
 * (config/app.php `omniform_widget_enabled` / `omniform_allowed_origins`).
 * The room bundle (packages/qiscus-ui-vue, src/lib/omniForm.js) seeds
 * `QiscusUI.omniForm` from `window.qiscusOmniForm` and re-validates every
 * origin, allowing none if one is malformed. Off by default.
 */

export const OMNIFORM_ENV_KEYS = ["OMNIFORM_WIDGET_ENABLED", "OMNIFORM_ALLOWED_ORIGINS"] as const

export type OmniformEnv = Partial<Record<(typeof OMNIFORM_ENV_KEYS)[number], string | undefined>>

export interface OmniformConfig {
  enabled: boolean
  allowedOrigins: string[]
}

/** Same truthiness as PHP FILTER_VALIDATE_BOOLEAN: 1/true/on/yes. */
const isTrue = (v: string | undefined): boolean => /^(1|true|on|yes)$/i.test((v ?? "").trim())

export function readOmniformConfig(env: OmniformEnv): OmniformConfig {
  return {
    enabled: isTrue(env.OMNIFORM_WIDGET_ENABLED),
    allowedOrigins: (env.OMNIFORM_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  }
}

export const OMNIFORM_MARKER = "<!-- omniform-config -->"

/** `<script>` that defines window.qiscusOmniForm; `<` is escaped so a value can never close the tag. */
export function omniformScript(cfg: OmniformConfig): string {
  const json = JSON.stringify(cfg).replace(/</g, "\\u003c")
  return `<script>window.qiscusOmniForm = ${json};</script>`
}
