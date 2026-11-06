/**
 * OmniForm embed in the Live Chat widget: which message links open in the
 * in-widget sheet, which `postMessage` events from the framed page are
 * believed, and how the answers posted back into the room are read.
 *
 * Contract (OmniForm team, addon-omniform-fe `docs/embed-customer-view.md`):
 * - Only `embed_url` = `<form origin>/e/<token>` may be framed. `/f/<token>`
 *   answers `frame-ancestors 'none'`, so it keeps opening in a new tab.
 * - The page posts status-only objects to `"*"`: `omniform:ready`,
 *   `omniform:resize {height}`, `omniform:submitted`,
 *   `omniform:state {state}` and `omniform:close`. It never carries the token,
 *   an answer or room data, and listens to nothing from the host. Answers reach
 *   the room through qismo-api, never through the browser.
 *
 * Config comes from the Blade page (`QiscusUI.omniForm`, see
 * `resources/views/iframes/v5/multichannel-widget.blade.php`):
 * `{ enabled: boolean, allowedOrigins: string[], labels?: {...} }`.
 *
 * The link token is a bearer secret: nothing here logs or stores a URL.
 */

/** `/e/<token>` with an optional trailing slash, same rule as the embed page's `isEmbedPath`. */
export const EMBED_PATH = /^\/e\/[^/?#]+\/?$/;

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** `https://host[:port]` exactly as `URL#origin` prints it: no path, no wildcard, no credentials. */
export function isCanonicalHttpsOrigin(value) {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname.indexOf('*') === -1 &&
      !url.username &&
      !url.password &&
      url.origin === value
    );
  } catch (e) {
    return false;
  }
}

/**
 * The allowlist: an array (or a JSON array string) of canonical https origins.
 * Anything malformed (bad JSON, one bad entry) denies every origin: a typo
 * must never widen what may be framed.
 */
export function parseOmniFormOrigins(value) {
  let list = value;
  if (typeof list === 'string') {
    if (!list) return [];
    try {
      list = JSON.parse(list);
    } catch (e) {
      return [];
    }
  }
  return Array.isArray(list) && list.every(isCanonicalHttpsOrigin) ? list.slice() : [];
}

/**
 * The OmniForm settings the page gave the widget: off unless `enabled` is
 * exactly `true` and at least one valid origin is allowed.
 */
export function omniFormConfig(ui) {
  const raw = ui && isRecord(ui.omniForm) ? ui.omniForm : {};
  const origins = parseOmniFormOrigins(raw.allowedOrigins);
  return {
    enabled: raw.enabled === true && origins.length > 0,
    origins,
    labels: isRecord(raw.labels) ? raw.labels : {},
  };
}

/**
 * The URL to frame when `href` is an OmniForm embed link on an allowed origin,
 * else null (the link keeps its normal behaviour). The URL is used as given:
 * `/f/` is never rewritten to `/e/`, and the query is left alone.
 */
export function omniFormEmbedUrl(href, origins, ownOrigin) {
  try {
    const url = new URL(href);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    if (!EMBED_PATH.test(url.pathname)) return null;
    if (!origins || origins.indexOf(url.origin) === -1) return null;
    // A same-origin frame with allow-scripts + allow-same-origin could lift its own sandbox.
    if (ownOrigin && url.origin === ownOrigin) return null;
    return url.href;
  } catch (e) {
    return null;
  }
}

/** One of the documented events with valid fields, else null. Extra fields are ignored. */
export function parseEmbedEvent(data) {
  if (!isRecord(data) || typeof data.type !== 'string') return null;
  switch (data.type) {
    case 'omniform:ready':
    case 'omniform:submitted':
    case 'omniform:close':
      return { type: data.type };
    case 'omniform:resize': {
      const height = data.height;
      return typeof height === 'number' && isFinite(height) && height > 0
        ? { type: 'omniform:resize', height }
        : null;
    }
    case 'omniform:state':
      return data.state === 'expired' || data.state === 'submitted' || data.state === 'unavailable'
        ? { type: 'omniform:state', state: data.state }
        : null;
    default:
      return null;
  }
}

/**
 * Accepts a `message` event only from the framed page itself: its origin is
 * the embed origin AND its source is that iframe's window. Any other window
 * can post the same shapes.
 */
export function embedEventFrom(event, embedOrigin, frameWindow) {
  if (!event || !frameWindow || event.origin !== embedOrigin || event.source !== frameWindow) {
    return null;
  }
  return parseEmbedEvent(event.data);
}

/**
 * OmniForm answers posted into the room by qismo-api, as the customer, after
 * the form was submitted in the embed. Shared contract with qismo-api
 * (`docs/omniform-submissions.md` there):
 *
 * - comment `type: 'text'`, `message` = plain-text fallback;
 * - `extras = { sub_type: 'interactive', interactive: { type: 'nfm_reply',
 *   nfm_reply: { name: 'omniform', body: <form name>, response_json: <JSON string> } },
 *   omniform: {...} }` (the WhatsApp Flow reply shape, so bots reuse their
 *   nfm_reply handling);
 * - `response_json` parses to `{ schema: 'qiscus.omniform.answers.v1',
 *   form_name, fields: [{ label, display_value }], attachments: [{ name, url }] }`.
 *
 * Anything that does not match exactly returns null, and the message falls
 * back to its text. Labels and values are kept as sent. Everything is customer
 * input: it is rendered through text interpolation only, never v-html.
 */
export const OMNIFORM_ANSWERS_SCHEMA = 'qiscus.omniform.answers.v1';

function httpsUrl(value) {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : undefined;
  } catch (e) {
    return undefined;
  }
}

/**
 * The OmniForm answers carried by a message's `extras`, or null when they are
 * not (exactly) there.
 */
export function parseOmniFormAnswer(extras) {
  if (!isRecord(extras) || extras.sub_type !== 'interactive') return null;
  const interactive = extras.interactive;
  if (!isRecord(interactive) || interactive.type !== 'nfm_reply') return null;
  const reply = interactive.nfm_reply;
  if (!isRecord(reply) || reply.name !== 'omniform' || typeof reply.response_json !== 'string') {
    return null;
  }

  let response;
  try {
    response = JSON.parse(reply.response_json);
  } catch (e) {
    return null;
  }
  if (!isRecord(response) || response.schema !== OMNIFORM_ANSWERS_SCHEMA) return null;

  let formName = '';
  if (typeof response.form_name === 'string') formName = response.form_name;
  else if (typeof reply.body === 'string') formName = reply.body;
  if (!Array.isArray(response.fields)) return null;
  const attachmentsRaw = response.attachments === undefined || response.attachments === null
    ? []
    : response.attachments;
  if (!Array.isArray(attachmentsRaw)) return null;

  const fields = [];
  for (let i = 0; i < response.fields.length; i += 1) {
    const raw = response.fields[i];
    if (!isRecord(raw) || typeof raw.label !== 'string' || typeof raw.display_value !== 'string') {
      return null;
    }
    fields.push({ label: raw.label, value: raw.display_value });
  }

  const attachments = [];
  for (let i = 0; i < attachmentsRaw.length; i += 1) {
    const raw = attachmentsRaw[i];
    if (!isRecord(raw) || typeof raw.name !== 'string' || typeof raw.url !== 'string') return null;
    const url = httpsUrl(raw.url);
    attachments.push(url ? { name: raw.name, url } : { name: raw.name });
  }

  if (!fields.length && !attachments.length) return null;
  return { formName, fields, attachments };
}

/** Ids of the OmniForm answer messages among `comments` (used to spot a new one). */
export function omniFormAnswerIds(comments) {
  const ids = [];
  (comments || []).forEach((comment) => {
    if (comment && parseOmniFormAnswer(comment.extras)) {
      ids.push(String(comment.unique_id || comment.id));
    }
  });
  return ids;
}

/** English defaults; the page may override any of them through `QiscusUI.omniForm.labels`. */
export const OMNIFORM_LABELS = {
  title: 'Form',
  close: 'Close form',
  loading: 'Loading form…',
  failed: "The form didn't load here.",
  failedTimeout:
    "The form didn't respond within {seconds} seconds. The connection may be slow, or the form server may be unreachable.",
  failedNoReady:
    "The form page opened but didn't finish starting. The form site may not allow being shown in this chat, or it returned an error.",
  failedFrameError: "Your browser couldn't load the form page.",
  failedInvalidUrl: 'This form link is not valid.',
  details: 'Details',
  openInNewTab: 'Open in a new tab',
  submitted: 'Form sent.',
  expired: 'This form link has expired.',
  alreadySubmitted: 'This form has already been filled in.',
  unavailable: 'This form is not available.',
  attachments: 'Attachments',
  sending: 'Sending form…',
};

/**
 * A label with `{name}` placeholders filled; page overrides win when they are
 * non-empty strings.
 */
export function omniFormLabel(labels, key, params) {
  const override = labels && typeof labels[key] === 'string' && labels[key] ? labels[key] : null;
  let text = override || OMNIFORM_LABELS[key] || key;
  if (params) {
    Object.keys(params).forEach((name) => {
      text = text.split(`{${name}}`).join(String(params[name]));
    });
  }
  return text;
}
