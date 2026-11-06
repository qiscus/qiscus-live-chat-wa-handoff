// OmniForm components of the widget: the sheet's runtime behaviour (Vue 2,
// unmounted, with a stub window) and the shipped templates (answers are text
// only, the frame is sandboxed, the "Sending form…" bubble is wired).

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { compileTemplate } = require('./helpers/sfc');

const FORM = 'https://form.example.com';
const URL_E = `${FORM}/e/tok_abc123`;

// A window the sheet can listen on, with timers it can clear.
function stubWindow() {
  const target = new EventTarget();
  target.innerHeight = 600;
  target.navigator = { userAgent: 'node' };
  target.setTimeout = setTimeout;
  target.clearTimeout = clearTimeout;
  target.opened = [];
  target.open = (...args) => target.opened.push(args);
  return target;
}

function message(origin, source, data) {
  const event = new Event('message');
  Object.assign(event, { origin, source, data });
  return event;
}

async function withSheet(run) {
  const previousWindow = global.window;
  global.window = stubWindow();
  // eslint-disable-next-line global-require
  const Vue = require('vue');
  Vue.config.productionTip = false;
  Vue.config.devtools = false;
  // eslint-disable-next-line global-require
  const { loadVueScript } = require('./helpers/esm');
  const options = loadVueScript('components/OmniFormSheet.vue');
  const warn = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args);
  const vm = new Vue(Object.assign({}, options, { propsData: { url: URL_E } }));
  const frameWindow = {};
  vm.$refs.frame = { contentWindow: frameWindow };
  const emitted = [];
  vm.$on('submitted', () => emitted.push('submitted'));
  vm.$on('close', () => emitted.push('close'));
  try {
    await vm.$nextTick();
    await run({ vm, frameWindow, emitted, warnings });
    await vm.$nextTick();
  } finally {
    vm.$destroy();
    console.warn = warn;
    global.window = previousWindow;
  }
}

test('sheet: frames the URL and believes only its own frame on the form origin', () =>
  withSheet(({ vm, frameWindow, emitted }) => {
    assert.strictEqual(vm.frameSrc, URL_E);
    assert.strictEqual(vm.phase, 'loading');

    window.dispatchEvent(message('https://evil.example.com', frameWindow, { type: 'omniform:ready' }));
    window.dispatchEvent(message(FORM, {}, { type: 'omniform:ready' }));
    assert.strictEqual(vm.phase, 'loading');

    window.dispatchEvent(message(FORM, frameWindow, { type: 'omniform:ready' }));
    assert.strictEqual(vm.phase, 'ready');

    window.dispatchEvent(message(FORM, frameWindow, { type: 'omniform:submitted' }));
    assert.deepStrictEqual(emitted, ['submitted']);
    assert.strictEqual(vm.announcement, 'Form sent.');

    window.dispatchEvent(message(FORM, frameWindow, { type: 'omniform:close' }));
    assert.deepStrictEqual(emitted, ['submitted', 'close']);
  }));

test('sheet: resize is capped to the panel; bad events are ignored', () =>
  withSheet(({ vm, frameWindow }) => {
    window.dispatchEvent(message(FORM, frameWindow, { type: 'omniform:resize', height: 300.2 }));
    assert.strictEqual(vm.frameHeight, 301);
    window.dispatchEvent(message(FORM, frameWindow, { type: 'omniform:resize', height: 5000 }));
    assert.strictEqual(vm.frameHeight, 600 - 64);
    window.dispatchEvent(message(FORM, frameWindow, { type: 'omniform:resize', height: -1 }));
    assert.strictEqual(vm.frameHeight, 600 - 64);
    window.dispatchEvent(message(FORM, frameWindow, { type: 'omniform:state', state: 'expired' }));
    assert.strictEqual(vm.announcement, 'This form link has expired.');
  }));

test('sheet: a frame that loads but never says ready falls back without the URL', () =>
  withSheet(({ vm, warnings }) => {
    vm.onFrameLoad();
    vm.fail('loaded_without_ready', FORM, Date.now() - 15000);
    assert.strictEqual(vm.phase, 'failed');
    assert.match(vm.failureDetail, /^reason=loaded_without_ready origin=https:\/\/form\.example\.com waited_ms=\d+$/);
    assert.strictEqual(warnings.length, 1);
    assert.ok(!JSON.stringify(warnings).includes('tok_abc123'), 'token leaked into the console');
    assert.ok(!vm.failureDetail.includes('tok_abc123'), 'token leaked into the detail line');

    vm.openInNewTab();
    assert.deepStrictEqual(window.opened, [[URL_E, '_blank', 'noopener,noreferrer']]);
  }));

test('sheet: closing stops listening and clears the frame', () =>
  withSheet(async ({ vm, frameWindow, emitted }) => {
    vm.url = null;
    await vm.$nextTick();
    assert.strictEqual(vm.frameSrc, '');
    window.dispatchEvent(message(FORM, frameWindow, { type: 'omniform:close' }));
    assert.deepStrictEqual(emitted, []);
  }));

test('sheet template: sandboxed frame, no referrer, own close button', () => {
  const html = compileTemplate('OmniFormSheet.vue');
  assert.match(html, /sandbox="allow-scripts allow-same-origin allow-forms allow-popups"/);
  assert.match(html, /referrerpolicy="no-referrer"/);
  assert.match(html, /data-omniform-close/);
  assert.ok(!/v-html/.test(html), 'sheet must not render HTML');
});

test('answers template: customer input is text only, links https from the parser', () => {
  const html = compileTemplate('CommentOmniFormAnswer.vue');
  assert.ok(!/v-html/.test(html), 'answers must never be rendered as HTML');
  assert.match(html, /rel="noopener noreferrer"/);
});

test('Comment: OmniForm answers replace the text fallback', () => {
  const html = compileTemplate('Comment.vue');
  assert.match(html, /<comment-omni-form-answer v-if="omniFormAnswer"/);
  assert.match(html, /!isFlowResponse\(\) &amp;&amp; !omniFormAnswer|!isFlowResponse\(\) && !omniFormAnswer/);
});

test('ChatWindow/CommentList: link clicks are intercepted and the sending bubble is wired', () => {
  const chatWindow = compileTemplate('ChatWindow.vue');
  assert.match(chatWindow, /class="qcw-main" @click\.capture="onOmniFormLinkClick"/);
  assert.match(chatWindow, /<omni-form-sheet/);
  const list = compileTemplate('CommentList.vue');
  assert.match(list, /v-if="omniFormSending"/);
  assert.match(list, /data-omniform-sending/);
});

test('room page: the OmniForm config marker precedes the SDK bundle', () => {
  // Handoff copy: the Worker (src/worker.ts) replaces the marker with
  // window.qiscusOmniForm; MCF does this in a Blade partial instead.
  const root = path.resolve(__dirname, '../../..');
  const src = fs.readFileSync(path.join(root, 'public/live-handover-room.html'), 'utf8');
  const marker = src.indexOf('<!-- omniform-config -->');
  const bundle = src.indexOf('<script src="../../../js/qiscus-sdk.3.2.12.js"></script>');
  assert.ok(marker > -1 && bundle > marker, 'config must precede the bundle');
});
