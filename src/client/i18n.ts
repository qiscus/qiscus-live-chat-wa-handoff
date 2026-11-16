export type CustomerLocale = "en" | "id"

export interface CustomerMessages {
  offer: string
  onlyYou: string
  enable: string
  later: string
  close: string
  busy: string
  enabled: string
  off: string
  denied: string
  iosInstall: string
  iosInstallSteps: string[]
  iosNoAddOption: string
  iosOpenSafari: string
  iosOpenSafariSteps: string[]
  androidOpenBrowser: string
  androidOpenBrowserSteps: string[]
  copyLink: string
  copied: string
  copyFailed: string
  paste: string
  error: string
  errorBrowser: string
  errorBlocked: string
  errorBlockedSteps: string[]
  retry: string
  errorCode: string
  pasteIntro: string
  pastePlaceholder: string
  pasteGo: string
  pasteBad: string
  "page.connecting": string
  "page.missing_token": string
  "page.already_used": string
  "page.invalid_token": string
  "page.session_over": string
  "page.too_many_requests": string
  "page.network_error": string
  "page.invalid_script": string
  "page.session_expired": string
  "page.no_session": string
  "page.unknown": string
  "page.room_error_title": string
  "page.room_error_message": string
  "page.offline": string
  "page.offline_retry": string
}

const en: CustomerMessages = {
  offer: "Want to get notified when an agent replies, even after you close this page?",
  onlyYou: "Only visible to you",
  enable: "Enable notifications",
  later: "Later",
  close: "Close",
  busy: "Enabling notifications…",
  enabled: "Notifications are on. We'll let you know when an agent replies.",
  off: "Turn off",
  denied: "Notifications are blocked in this browser. To receive alerts when an agent replies, allow notifications for this site in your browser settings.",
  iosInstall: "To get Live Chat notifications, add it to your Home Screen (iOS 16.4+):",
  iosInstallSteps: [
    "Tap “Copy link” below.",
    "Tap Share, then “Add to Home Screen” (make sure “Open as Web App” is on).",
    "Open Live Chat from your Home Screen, then tap “Paste”.",
  ],
  iosNoAddOption: "Don't see “Add to Home Screen”? Open this page in Safari first.",
  iosOpenSafari: "To get notifications in Live Chat, open this page in Safari and add it to your Home Screen:",
  iosOpenSafariSteps: [
    "Tap the ⋯ menu on this page, then choose “Open in Safari” / “Open in browser”.",
    "Or tap “Copy link”, open Safari, then paste it into the address bar.",
    "In Safari, follow the next prompts to add it to your Home Screen.",
  ],
  androidOpenBrowser: "To get Live Chat notifications, open this page in Chrome (or another browser):",
  androidOpenBrowserSteps: [
    "Tap the ⋮ menu in the upper-right corner, then choose “Open in Chrome” / “Open in browser”.",
    "Or tap “Copy link”, open Chrome, then paste it into the address bar.",
    "In Chrome, tap “Enable notifications”.",
  ],
  copyLink: "Copy link",
  copied: "Link copied",
  copyFailed: "Could not copy link",
  paste: "Paste",
  error: "Notifications couldn't be enabled. Try again later.",
  errorBrowser: "Notifications aren't available in this browser. Open the invitation link in Google Chrome, Microsoft Edge, Firefox, or Safari, then enable notifications there.",
  errorBlocked: "Notifications are blocked by a content/ad blocker on this device. To enable them:",
  errorBlockedSteps: [
    "iPhone/iPad: Go to Settings → Safari → Extensions and turn off content blockers (e.g. Firefox Focus, AdGuard, 1Blocker).",
    "Also turn off any VPN or ad-blocking DNS, if enabled.",
    "Close Live Chat, reopen it, then tap “Try again”.",
  ],
  retry: "Try again",
  errorCode: "Code",
  pasteIntro: "Paste the invitation link from WhatsApp to continue the conversation in this app.",
  pastePlaceholder: "https://…",
  pasteGo: "Continue",
  pasteBad: "We couldn't recognize that link. Copy the invitation link from your WhatsApp message, then paste it here.",
  "page.connecting": "Connecting…",
  "page.missing_token": "This link is incomplete. Please request a new link through WhatsApp.",
  "page.already_used": "This link has already been used. Send us another message on WhatsApp to get a new link.",
  "page.invalid_token": "This link is invalid or has expired. Please request a new one.",
  "page.session_over": "This conversation has moved back to WhatsApp. Please check your WhatsApp.",
  "page.too_many_requests": "Too many attempts. Please try again shortly.",
  "page.network_error": "Unable to connect to the server. Check your connection and reload the page.",
  "page.invalid_script": "The widget configuration is invalid.",
  "page.session_expired": "Your chat session has ended. Please request a new link through WhatsApp.",
  "page.no_session": "There is no active conversation in this app yet.",
  "page.unknown": "Something went wrong. Please reload the page.",
  "page.room_error_title": "Oops...",
  "page.room_error_message": "Something went wrong. Please try again by refreshing your browser.",
  "page.offline": "You're offline. Check your internet connection, then try again.",
  "page.offline_retry": "Try again",
}

const id: CustomerMessages = {
  offer: "Mau dapat notifikasi saat agen membalas, meski halaman ini ditutup?",
  onlyYou: "Hanya terlihat oleh Anda",
  enable: "Aktifkan notifikasi",
  later: "Nanti",
  close: "Tutup",
  busy: "Mengaktifkan notifikasi…",
  enabled: "Notifikasi aktif. Kami akan memberi tahu saat agen membalas.",
  off: "Matikan",
  denied: "Notifikasi diblokir di browser ini. Jika ingin diberi tahu saat agen membalas, izinkan notifikasi untuk situs ini di pengaturan browser.",
  iosInstall: "Kalau ingin mendapatkan notifikasi di Live Chat, Anda perlu memasangnya di Layar Utama (iOS 16.4+):",
  iosInstallSteps: [
    "Ketuk “Salin link” di bawah.",
    "Ketuk tombol Bagikan, lalu “Tambah ke Layar Utama” (pastikan “Buka sebagai Web App” aktif).",
    "Buka Live Chat dari Layar Utama, lalu ketuk “Tempel”.",
  ],
  iosNoAddOption: "Tidak ada pilihan “Tambah ke Layar Utama”? Buka halaman ini di Safari dulu.",
  iosOpenSafari: "Kalau ingin mendapatkan notifikasi di Live Chat, Anda perlu membukanya di Safari lalu memasangnya di Layar Utama:",
  iosOpenSafariSteps: [
    "Ketuk menu ⋯ di halaman ini, lalu pilih buka di Safari / browser.",
    "Atau ketuk “Salin link”, buka Safari, lalu tempel di kolom alamat.",
    "Di Safari, ikuti petunjuk berikutnya untuk menambahkan ke Layar Utama.",
  ],
  androidOpenBrowser: "Kalau ingin mendapatkan notifikasi di Live Chat, Anda perlu membukanya di Chrome (atau browser lain):",
  androidOpenBrowserSteps: [
    "Ketuk menu ⋮ di pojok kanan atas, lalu pilih “Buka di Chrome” / “Buka di browser”.",
    "Atau ketuk “Salin link”, buka Chrome, lalu tempel di kolom alamat.",
    "Di Chrome, ketuk “Aktifkan notifikasi”.",
  ],
  copyLink: "Salin link",
  copied: "Link disalin",
  copyFailed: "Gagal menyalin",
  paste: "Tempel",
  error: "Notifikasi belum bisa diaktifkan. Coba lagi nanti.",
  errorBrowser: "Notifikasi belum bisa diaktifkan di browser ini. Coba buka link undangan di Google Chrome, Microsoft Edge, Firefox, atau Safari, lalu aktifkan notifikasi di sana.",
  errorBlocked: "Notifikasi diblokir oleh pemblokir konten/iklan di perangkat ini. Agar bisa aktif:",
  errorBlockedSteps: [
    "iPhone/iPad: buka Settings → Safari → Extensions, matikan pemblokir konten (mis. Firefox Focus, AdGuard, 1Blocker).",
    "Matikan juga VPN atau DNS pemblokir iklan bila ada.",
    "Tutup Live Chat, buka lagi, lalu ketuk “Coba lagi”.",
  ],
  retry: "Coba lagi",
  errorCode: "Kode",
  pasteIntro: "Tempel link undangan dari WhatsApp untuk melanjutkan percakapan di aplikasi ini.",
  pastePlaceholder: "https://…",
  pasteGo: "Lanjutkan",
  pasteBad: "Link tidak dikenali. Salin link undangan dari pesan WhatsApp, lalu tempel di sini.",
  "page.connecting": "Menghubungkan…",
  "page.missing_token": "Link tidak lengkap. Silakan minta link baru lewat WhatsApp.",
  "page.already_used": "Link ini sudah dipakai. Kirim pesan lagi di WhatsApp untuk mendapat link baru.",
  "page.invalid_token": "Link tidak berlaku atau sudah kedaluwarsa. Silakan minta link baru.",
  "page.session_over": "Percakapan ini sudah dilanjutkan di WhatsApp. Silakan cek WhatsApp Anda.",
  "page.too_many_requests": "Terlalu banyak percobaan. Coba lagi sesaat lagi.",
  "page.network_error": "Gagal terhubung ke server. Periksa koneksi Anda dan muat ulang halaman.",
  "page.invalid_script": "Konfigurasi widget tidak valid.",
  "page.session_expired": "Sesi percakapan sudah berakhir. Silakan minta link baru lewat WhatsApp.",
  "page.no_session": "Belum ada percakapan aktif di aplikasi ini.",
  "page.unknown": "Terjadi kesalahan. Silakan muat ulang halaman.",
  "page.room_error_title": "Ups...",
  "page.room_error_message": "Terjadi kesalahan. Silakan muat ulang browser Anda.",
  "page.offline": "Anda sedang offline. Periksa koneksi internet, lalu coba lagi.",
  "page.offline_retry": "Coba lagi",
}

export const MESSAGES: Record<CustomerLocale, CustomerMessages> = { en, id }

/** Resolve the first supported language from the browser preference list; English is the fallback. */
export function resolveCustomerLocale(preferences?: string | readonly string[] | null): CustomerLocale {
  const languages = typeof preferences === "string"
    ? [preferences]
    : Array.isArray(preferences) ? preferences : []
  for (const language of languages) {
    if (typeof language !== "string") continue
    if (/^id(?:[-_]|$)/i.test(language)) return "id"
    if (/^en(?:[-_]|$)/i.test(language)) return "en"
  }
  return "en"
}

export function localizedText(locale: CustomerLocale, key: string): string {
  const current = MESSAGES[locale] as unknown as Record<string, unknown>
  const fallback = MESSAGES.en as unknown as Record<string, unknown>
  const value = current[key] ?? fallback[key]
  return typeof value === "string" ? value : key
}
