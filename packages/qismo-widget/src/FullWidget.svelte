<svelte:options accessors />

<script>
  /**
   * FullWidget — halaman chat berdiri sendiri, HANYA iframe #qcw-iframe.
   *
   * Beda dari App.svelte (bundle qismo-v5.js):
   *   - tanpa welcome message, attention grabber, login form, channel form
   *   - tanpa trigger button
   *   - tanpa gating localStorage['qismo-widget'] sebagai penanda "sudah login"
   *
   * Dua jalur identitas, dipilih otomatis saat mount:
   *
   *   1) TOKEN (produksi, handoff WA -> Live Chat) -- ada invite token di URL
   *      fragment (#t=...) atau prop `token`. Menukarnya lewat
   *      POST /live_handover/exchange (spec §3 langkah 7); TIDAK PERNAH
   *      memanggil initiate_chat (Ancaman 1, §5) -- identitas di-resolve
   *      SERVER-SIDE dari token bertanda tangan. Begitu exchange sukses, iframe
   *      menunjuk route /iframes/v5/<app_code>/live-handover-room (room yang
   *      SUDAH dibuat), bukan /full-widget. `appId` TIDAK dibutuhkan di jalur
   *      ini -- `app_code` datang dari hasil exchange, karena itu snippet yang
   *      sama bisa dipasang di halaman fallback qismo-api yang generik lintas
   *      app (lihat QismoApi.LiveHandover.Page).
   *
   *   2) QUERY/PROPS (dev/demo) -- tanpa token: identitas dari prop `identity`
   *      atau query string halaman (?channel_id=&display_name=&unique_id=).
   *      Ini jalur LAMA, dipertahankan untuk widget-builder preview/demo.
   *      PERHATIAN: identitas di query string adalah IDENTIFIKASI, bukan
   *      AUTENTIKASI (lihat catatan `who()` di bawah) -- jangan pakai untuk
   *      produksi handoff.
   *
   * Kalau tidak ada token DAN tidak ada identitas lengkap, komponen tidak
   * merender apa pun -- tidak ada form sebagai fallback di kedua jalur.
   *
   * ponytail: ukuran/posisi iframe diatur CSS halaman (`#qcw-iframe { ... }`),
   * bukan JS. Pindahkan ke JS hanya kalau iframe perlu di-resize tanpa reload.
   */
  import { onMount, onDestroy } from "svelte";
  import aes from "crypto-js/aes";
  import {
    _ajax,
    generateDefaultConfig,
    setDefaultConfig,
    parseUrlParams,
    convertHex,
  } from "./helper.js";

  /**
   * App code (mis. "zalda-vvq7pksvblaiy7s"). WAJIB untuk jalur query/props;
   * TIDAK dibutuhkan untuk jalur token (app_code datang dari /exchange).
   */
  export let appId = null;
  /** true = backend staging. */
  export let staging = false;
  /** { channel_id, qismoIframeUrl, baseUrl, appVersion, extras, room_badge, merge_properties } */
  export let options = {};
  /** { display_name, unique_id, extra_fields? } -- jalur query/props saja. */
  export let identity = null;
  /**
   * Invite token untuk handoff WA -> Live Chat (spec §3 langkah 7). Opsional:
   * kalau tidak diisi, komponen membaca URL fragment sendiri (#t=...) --
   * fragment tidak pernah dikirim ke server (Ancaman 2, §5), dan ini yang
   * membuat snippet ini bisa ditempel APA ADANYA sebagai halaman fallback
   * generik (redirector yang mengirim customer ke sini sudah menaruh token
   * di fragment). Begitu ada token (prop atau fragment), identity/query
   * diabaikan total -- dua jalur tidak pernah tercampur.
   */
  export let token = null;
  /**
   * Dipanggil untuk event: 'qiscus:handoff-exchanging' | 'qiscus:handoff-ready'
   * | 'qiscus:handoff-error' (jalur token, { code, message } dari respons
   * /exchange: already_used | invalid_token | session_over |
   * too_many_requests | missing_token | network_error) -- serta event lama
   * dari dalam room (login-success, room-changed, ...) untuk jalur query/props.
   */
  export let onEvent = null;
  /** Ambil /api/v2/app/config/public-widget untuk color_widget + qismoIframeUrl. Jalur query/props saja. */
  export let fetchConfig = true;
  /**
   * Baca channel_id / display_name / unique_id dari query string HALAMAN saat load,
   * sehingga satu halaman statis bisa melayani banyak customer:
   *
   *   https://livechat.client.com/?channel_id=1430&display_name=Rina&unique_id=628123456789
   *
   * Prop menang atas query — halaman yang sudah tahu identitasnya (mis. setelah
   * memanggil /live_handover/exchange sendiri) tidak perlu menaruhnya di URL.
   * Set false untuk mematikan pembacaan query sepenuhnya.
   *
   * PERHATIAN: identitas di query string adalah IDENTIFIKASI, bukan AUTENTIKASI —
   * siapa pun yang menebak/menukar unique_id orang lain akan membuka room live chat
   * orang itu (room live chat menetap: dicari lewat user_id + session_id kosong).
   * Pakai ini untuk dev/uji dan halaman yang URL-nya sudah ditanda-tangani; jalur
   * token di atas adalah yang aman untuk produksi.
   */
  export let readQueryParams = true;

  let el = null;
  let didExchange = false; // guard: satu token hanya boleh ditukar sekali per mount

  // Query string halaman host (bukan query di src <script>).
  const qs = () =>
    readQueryParams && typeof location !== "undefined"
      ? new URLSearchParams(location.search)
      : new URLSearchParams("");

  const fromQuery = (name) => {
    const v = qs().get(name);
    return v !== null && v !== "" ? v : undefined;
  };

  // A page_url may choose an environment without changing the embed snippet,
  // but only among these exact origins. baseUrl receives the invite token
  // (/exchange) and the iframe gets identity_token plus the whole chat, so a
  // wildcard over *.qiscus.com would trust any staging box or a subdomain
  // that can be taken over. Anything else in the query is ignored.
  const ALLOWED_ORIGINS = [
    "https://qismo.qiscus.com",
    "https://omnichannel.qiscus.com",
    "https://qismo-stag2.qiscus.io",
  ];
  // Replaced at build time (rollup.config.js): true only for `rollup -c -w`.
  // A production bundle never honours a local origin.
  const DEV_BUILD = __QISMO_DEV_BUILD__;
  const LOCAL_HOSTS = ["localhost", "127.0.0.1"];
  const allowedOrigin = (value) => {
    if (!value) return undefined;
    let url;
    try {
      url = new URL(value);
    } catch (e) {
      return undefined;
    }
    if (ALLOWED_ORIGINS.indexOf(url.origin) !== -1) return url.origin;
    const local =
      DEV_BUILD &&
      (url.protocol === "http:" || url.protocol === "https:") &&
      LOCAL_HOSTS.indexOf(url.hostname) !== -1;
    return local ? url.origin : undefined;
  };

  // Query params take precedence over snippet props; production is the default.
  const runtimeOptions = () =>
    Object.assign({}, options, {
      baseUrl:
        allowedOrigin(fromQuery("baseUrl")) || options.baseUrl || "https://qismo.qiscus.com",
      qismoIframeUrl:
        allowedOrigin(fromQuery("iframeUrl")) ||
        options.qismoIframeUrl ||
        "https://omnichannel.qiscus.com",
    });

  // Prop menang; query mengisi yang kosong. (Svelte 3.17 memakai acorn lama:
  // `??` dan `?.` gagal di-parse, jadi pakai helper eksplisit.)
  const pilih = (dariProp, namaQuery) =>
    dariProp !== undefined && dariProp !== null && dariProp !== ""
      ? dariProp
      : fromQuery(namaQuery);

  const channelId = () => pilih(options.channel_id, "channel_id");
  const who = () => ({
    display_name: pilih(identity && identity.display_name, "display_name"),
    unique_id: pilih(identity && identity.unique_id, "unique_id"),
    extra_fields: pilih(identity && identity.extra_fields, "extra_fields"),
  });

  // window.qismoConfig = "config bag" bersama yang juga ditulis helper.js.
  const cfg = () =>
    window.qismoConfig || (window.qismoConfig = generateDefaultConfig(staging, runtimeOptions()));

  // --- Jalur TOKEN (di-merge dari QismoHandover.svelte) ---

  const takeToken = () => {
    if (token) return token;
    if (typeof location === "undefined") return null;
    const m = /[#&]t=([^&]+)/.exec(location.hash || "");
    return m ? decodeURIComponent(m[1]) : null;
  };

  const notify = (eventName, detail) => onEvent && onEvent({ event_name: eventName, ...(detail || {}) });

  // Bentuk sama dengan full-widget/multichannel-widget: identitas di-AES dengan
  // app_code sebagai passphrase, Blade dekripsi balik. Di sini yang dienkripsi
  // adalah hasil /exchange (room_id, identity_token, name, avatar), bukan
  // input mentah dari browser -- AES-nya obfuskasi kosmetik seperti pola lama,
  // keamanannya sudah selesai di exchange (lihat kepala file).
  const handoverRoomParams = (result) =>
    parseUrlParams({
      app_id: result.app_code,
      room_id: encodeURIComponent(aes.encrypt(`${result.room_id}`, result.app_code).toString()),
      identity_token: encodeURIComponent(
        aes.encrypt(`${result.identity_token}`, result.app_code).toString()
      ),
      name: encodeURIComponent(aes.encrypt(`${result.name}`, result.app_code).toString()),
      avatar: result.avatar
        ? encodeURIComponent(aes.encrypt(`${result.avatar}`, result.app_code).toString())
        : "",
      staging,
      color_widget: convertHex(cfg().colorWidget, 100),
    });

  const openHandoverRoom = (result) => {
    if (document.getElementById("qcw-iframe")) return;
    el = document.createElement("iframe");
    el.id = "qcw-iframe";
    el.src = `${cfg().qismoIframeUrl}/iframes/v5/${result.app_code}/live-handover-room${handoverRoomParams(result)}`;
    document.body.appendChild(el);
    notify("qiscus:handoff-ready", {
      room_id: result.room_id,
      resumed: result.resumed,
      history_seeded: result.history_seeded,
    });
  };

  // Bentuk error dari live_handover_controller.ex: 401 { status, error, code },
  // 429 { status, errors }, 422 { status, errors }. `code` cuma ada di 401.
  const errorDetail = (body) => {
    if (body && body.code) return { code: body.code, message: body.error };
    if (body && body.status === 429) return { code: "too_many_requests", message: "Too many requests attempt" };
    if (body && body.errors) return { code: "invalid_params", message: body.errors };
    return { code: "network_error", message: "gagal menghubungi server" };
  };

  const exchangeToken = (t) => {
    if (didExchange) return; // StrictMode-style double mount, jti sudah dipakai
    didExchange = true;
    notify("qiscus:handoff-exchanging");
    // _ajax REJECT di dua kasus: (a) request.onload dengan status>=400, memanggil
    // failFn(body) -- body membawa status/code/errors dari qismo; (b)
    // request.onerror (network putus/CORS), memanggil failFn() TANPA argumen.
    // Bedakan dua kasus itu DI DALAM failFn (bukan lewat .catch tambahan) --
    // .catch di belakang promise ini akan menimpa notify yang sudah benar
    // dengan "network_error" karena promise SELALU reject di kedua kasus.
    _ajax({
      type: "POST",
      url: `${cfg().qismoBaseUrl}/api/v2/live_handover/exchange`,
      appVersion: `${options.appVersion}`,
      data: { token: t },
      successFn: (res) => openHandoverRoom(res.data || res),
      failFn: (body) => notify("qiscus:handoff-error", errorDetail(body)),
    }).catch(() => {}); // sudah dinotify lewat failFn; cegah unhandled rejection saja
  };

  // --- Jalur QUERY/PROPS (existing) ---

  const open = () => {
    const { display_name, unique_id } = who();
    const kurang = [
      !channelId() && "channel_id",
      !display_name && "display_name",
      !unique_id && "unique_id",
    ].filter(Boolean);
    if (kurang.length) {
      console.warn(
        `[full-widget] wajib tapi kosong: ${kurang.join(", ")} — ` +
          "isi lewat props atau query string halaman " +
          "(?channel_id=…&display_name=…&unique_id=…). Tidak ada form login sebagai fallback."
      );
      return;
    }
    if (document.getElementById("qcw-iframe")) return;
    el = document.createElement("iframe");
    el.id = "qcw-iframe";
    el.src = `${cfg().qismoIframeUrl}/iframes/v5/${appId}/full-widget/${channelId()}${params()}`;
    document.body.appendChild(el);
  };

  const params = () => {
    const { display_name, unique_id, extra_fields } = who();
    return parseUrlParams({
      display_name: encodeURIComponent(aes.encrypt(`${display_name}`, appId).toString()),
      channel_id: encodeURIComponent(aes.encrypt(`${channelId()}`, appId).toString()),
      unique_id: encodeURIComponent(aes.encrypt(`${unique_id}`, appId).toString()),
      app_id: appId,
      staging,
      color_widget: convertHex(cfg().colorWidget, 100),
      ...(extra_fields && { extra_fields: encodeURIComponent(extra_fields) }),
      ...(options.extras && { extras: options.extras }),
      ...(options.room_badge && { room_badge: options.room_badge }),
      ...(options.merge_properties && { merge_properties: options.merge_properties }),
    });
  };

  const onMessage = (e) => e.data && e.data.event_name && onEvent && onEvent(e.data);

  // Safety net untuk iOS: Safari biasanya menggeser halaman ini supaya composer di
  // dalam iframe room tidak tertutup keyboard, tapi kadang di fokus pertama tidak,
  // dan composer baru terlihat setelah tap kedua. Viewport iframe tidak berubah saat
  // keyboard muncul (ukurannya dikunci halaman ini), jadi hanya halaman ini yang bisa
  // menggeser. iOS mengukur client rect relatif ke area yang terlihat, jadi iframe
  // tertutup kalau bottom-nya melewati visualViewport.height; composer ada di dasar
  // iframe, jadi geser sampai dasar iframe tepat di atas keyboard -- posisi yang sama
  // dengan geseran Safari. Geser sejauh selisihnya saja: saat keyboard terbuka iOS
  // membolehkan scroll melewati dasar halaman, jadi scrollTo(scrollHeight) kebablasan
  // dan menyisakan ruang kosong di atas keyboard.
  let revealTimer;
  const revealRoomComposer = () => {
    const vv = window.visualViewport;
    if (!vv || !el || document.activeElement !== el) return;
    const hidden = el.getBoundingClientRect().bottom - vv.height;
    if (hidden > 1) window.scrollBy(0, hidden);
  };
  // Hanya iOS: hitungan rect di atas perilaku WebKit iOS, browser lain mengukur rect
  // terhadap layout viewport. Cek yang sama dengan body.is-ios di blade v5, plus
  // iPadOS mode desktop (user agent Mac tapi layar sentuh).
  const isIOS = () => {
    const ua = navigator.userAgent.toLowerCase();
    return /ipad|iphone|ipod/.test(ua) || (ua.includes("macintosh") && navigator.maxTouchPoints > 1);
  };
  // Tunggu animasi keyboard (~300ms) supaya geseran Safari, kalau terjadi, duluan.
  const onViewportResize = () => {
    clearTimeout(revealTimer);
    revealTimer = setTimeout(revealRoomComposer, 350);
  };

  onMount(() => {
    window.addEventListener("message", onMessage);
    if (window.visualViewport && isIOS()) window.visualViewport.addEventListener("resize", onViewportResize);
    setDefaultConfig(null, runtimeOptions()); // defaults + page_url environment override

    const t = takeToken();
    if (t) {
      // Ancaman 2: buang token dari address bar SEBELUM dipakai, bukan sesudah --
      // fragment yang tertinggal bisa terbaca dari browser history/back-forward
      // cache walau exchange belum selesai.
      if (typeof history !== "undefined" && typeof location !== "undefined") {
        history.replaceState(null, "", location.pathname + location.search);
      }
      exchangeToken(t);
      return; // jalur token TIDAK PERNAH jatuh ke jalur query/props di bawah
    }

    if (!fetchConfig) return open();
    _ajax({
      type: "GET",
      url: `${cfg().qismoBaseUrl}/api/v2/app/config/public-widget/${appId}/${channelId()}`,
      appVersion: `${options.appVersion}`,
      successFn: (res) => {
        setDefaultConfig(res && res.data ? res.data.widget : null, options);
        open();
      },
      failFn: open, // tema gagal != alasan room tidak dibuka
    });
  });

  onDestroy(() => {
    window.removeEventListener("message", onMessage);
    if (window.visualViewport) window.visualViewport.removeEventListener("resize", onViewportResize);
    clearTimeout(revealTimer);
    if (el) el.remove();
  });
</script>

<!-- Tanpa markup: komponen ini hanya menempelkan iframe ke body. -->
