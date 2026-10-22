// Regression: WA -> Live Chat customer "End chat" (QA TC-KL-05).
//
// The hosted room (iframe) only asks; the parent page (FullWidget.svelte) is the
// one that still holds the original invite token, so it performs the close.
// Run: `node --test test/*.test.mjs` from qismo-widget/.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  createEndChatBridge,
  END_CHAT_REQUEST,
  END_CHAT_RESULT,
} from "../src/endChatBridge.mjs";

const IFRAME_ORIGIN = "https://omnichannel.qiscus.com";

function setup({ token = "invite.jwt.token", close, timeoutMs } = {}) {
  const posted = [];
  const contentWindow = { postMessage: (msg, origin) => posted.push({ msg, origin }) };
  const frame = { contentWindow, src: `${IFRAME_ORIGIN}/iframes/v5/app/live-handover-room?x=1` };
  const closed = [];
  let currentToken = token;
  const bridge = createEndChatBridge({
    getFrame: () => frame,
    getToken: () => currentToken,
    clearToken: () => {
      currentToken = null;
    },
    close:
      close ||
      ((t) => {
        closed.push(t);
        return Promise.resolve(true);
      }),
    timeoutMs,
  });
  const request = (over = {}) => ({
    source: contentWindow,
    origin: IFRAME_ORIGIN,
    data: { event_name: END_CHAT_REQUEST },
    ...over,
  });
  return { bridge, posted, closed, contentWindow, request, getToken: () => currentToken };
}

const flush = () => new Promise((r) => setImmediate(r));

test("closes with the original invite token and answers only the room iframe", async () => {
  const { bridge, posted, closed, request } = setup();
  assert.equal(bridge(request()), true);
  await flush();
  assert.deepEqual(closed, ["invite.jwt.token"]);
  assert.deepEqual(posted, [{ msg: { event_name: END_CHAT_RESULT, ok: true }, origin: IFRAME_ORIGIN }]);
});

test("ignores a request that is not from the room iframe window", async () => {
  const { bridge, posted, closed, request } = setup();
  bridge(request({ source: { postMessage() {} } }));
  bridge(request({ source: null }));
  await flush();
  assert.deepEqual(closed, []);
  assert.deepEqual(posted, []);
});

test("ignores a request whose origin is not the iframe origin", async () => {
  const { bridge, posted, closed, request } = setup();
  bridge(request({ origin: "https://evil.example" }));
  await flush();
  assert.deepEqual(closed, []);
  assert.deepEqual(posted, []);
});

test("does nothing when this page has no invite token (query/props path)", async () => {
  const { bridge, posted, closed, request } = setup({ token: null });
  bridge(request());
  await flush();
  assert.deepEqual(closed, []);
  assert.deepEqual(posted, []);
});

test("does not claim unrelated messages", () => {
  const { bridge, request } = setup();
  assert.equal(bridge(request({ data: { event_name: "qiscus:session-ready" } })), false);
  assert.equal(bridge(request({ data: "hello" })), false);
  assert.equal(bridge({ data: null }), false);
});

test("failure answers ok:false and keeps the token so the customer can retry", async () => {
  let attempt = 0;
  const tokens = [];
  const { bridge, posted, request } = setup({
    close: (t) => {
      tokens.push(t);
      attempt += 1;
      return attempt === 1 ? Promise.reject(new Error("network")) : Promise.resolve(true);
    },
  });
  bridge(request());
  await flush();
  assert.equal(posted[0].msg.ok, false);

  bridge(request());
  await flush();
  assert.deepEqual(tokens, ["invite.jwt.token", "invite.jwt.token"]);
  assert.equal(posted[1].msg.ok, true);
});

test("a second request while one is in flight does not close twice", async () => {
  let resolve;
  const calls = [];
  const { bridge, request } = setup({
    close: (t) => {
      calls.push(t);
      return new Promise((r) => (resolve = r));
    },
  });
  bridge(request());
  bridge(request());
  await flush();
  resolve(true);
  await flush();
  assert.equal(calls.length, 1);
});

test("a timed-out close releases the lock, aborts, and ignores a stale late result", async () => {
  const pending = [];
  const signals = [];
  let calls = 0;
  const { bridge, posted, request, getToken } = setup({
    timeoutMs: 5,
    close: (_token, signal) => {
      calls += 1;
      signals.push(signal);
      return new Promise((resolve) => pending.push(resolve));
    },
  });

  bridge(request());
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(posted.length, 1);
  assert.equal(posted[0].msg.ok, false);
  assert.equal(getToken(), "invite.jwt.token");
  assert.equal(signals[0].aborted, true);

  bridge(request());
  await flush();
  assert.equal(calls, 2);
  assert.equal(signals[1].aborted, false);
  pending[1](true);
  await flush();
  assert.equal(posted.length, 2);
  assert.equal(posted[1].msg.ok, true);
  assert.equal(getToken(), null);

  pending[0](true);
  await flush();
  assert.equal(posted.length, 2);
  assert.equal(getToken(), null);
});

test("after a successful close the token is dropped and not reused", async () => {
  const { bridge, closed, request } = setup();
  bridge(request());
  await flush();
  bridge(request());
  await flush();
  assert.equal(closed.length, 1);
});

// ---- opt-in scope: only the handover room page turns the control on ----

// handoff-widget-standalone: the room is the static page served by the Worker.
const pages = new URL("../../../public/", import.meta.url);
const read = (name) => readFileSync(new URL(name, pages), "utf8");

test("only live-handover-room opts in; the hosted page never gets the control", () => {
  assert.match(read("live-handover-room.html"), /customerEndChat:\s*true/);
  assert.doesNotMatch(read("widget.html"), /customerEndChat:/);
});

test("the room accepts the close result only from its parent window", () => {
  const blade = read("live-handover-room.html");
  const at = blade.indexOf(END_CHAT_RESULT);
  assert.ok(at > -1, "room page handles the result message");
  assert.match(blade.slice(at - 400, at + 400), /e\.source\s*!==\s*window\.parent/);
});

test("the shared SDK renders the control only behind the opt-in option", () => {
  const ui = new URL("../../qiscus-ui-vue/src/components/", import.meta.url);
  const header = readFileSync(new URL("ChatHeader.vue", ui), "utf8");
  assert.match(header, /qcw-end-chat-btn\(v-if="customerEndChat"/);
  assert.match(header, /options\.customerEndChat/);
});
