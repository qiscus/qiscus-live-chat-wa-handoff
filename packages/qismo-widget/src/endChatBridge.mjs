// Customer "End chat" bridge for the WA -> Live Chat handover room.
//
// The room iframe never sees the invite token (it only holds the 120s
// identity_token). It asks its parent with `qiscus:customer-end-chat`; this
// handler -- in the page that still holds the token -- performs the close and
// answers the iframe with `qiscus:customer-end-chat-result`.
//
// Pure (no DOM/globals) so it is unit-tested in test/end-chat-bridge.test.mjs.
export const END_CHAT_REQUEST = "qiscus:customer-end-chat";
export const END_CHAT_RESULT = "qiscus:customer-end-chat-result";

const originOf = (src) => {
  try {
    return new URL(src).origin;
  } catch (e) {
    return null;
  }
};

/**
 * @param {object} deps
 * @param {() => {contentWindow: Window, src: string} | null} deps.getFrame room iframe element
 * @param {() => string | null} deps.getToken original invite token (null on the query/props path)
 * @param {() => void} deps.clearToken drop the token once the link is spent
 * @param {(token: string, signal?: AbortSignal | null) => Promise<boolean>} deps.close POST /live_handover/close, resolves true on success
 * @param {number} [deps.timeoutMs=14000] abort and release the retry lock before the room UI times out
 * @returns {(e: {data: any, source: any, origin: string}) => boolean} true when the message was an
 *          end-chat request (handled or deliberately ignored), false when it is not ours.
 */
export function createEndChatBridge({ getFrame, getToken, clearToken, close, timeoutMs = 14000 }) {
  let nextRequestId = 0;
  let activeRequestId = null;

  return function handle(e) {
    if (!e || !e.data || e.data.event_name !== END_CHAT_REQUEST) return false;

    // Only the room iframe this page created, at the origin it was loaded from.
    const frame = getFrame();
    const origin = frame && originOf(frame.src);
    if (!frame || !frame.contentWindow || !origin) return true;
    if (e.source !== frame.contentWindow || e.origin !== origin) return true;

    const token = getToken();
    if (!token || activeRequestId !== null) return true;

    const requestId = ++nextRequestId;
    activeRequestId = requestId;
    const reply = (ok) => frame.contentWindow.postMessage({ event_name: END_CHAT_RESULT, ok }, origin);
    const controller = typeof AbortController === "undefined" ? null : new AbortController();
    let timeout;
    const finish = (ok) => {
      if (activeRequestId !== requestId) return;
      activeRequestId = null;
      clearTimeout(timeout);
      if (ok) clearToken();
      reply(ok);
    };

    // The room has a slightly longer UI timeout; abort here so a retry cannot be
    // locked behind a fetch that never settles. Ignore any stale late result.
    timeout = setTimeout(() => {
      if (controller) controller.abort();
      finish(false);
    }, timeoutMs);
    Promise.resolve()
      .then(() => close(token, controller ? controller.signal : null))
      .then(
        (ok) => ok === true,
        () => false
      )
      .then(finish);
    return true;
  };
}
