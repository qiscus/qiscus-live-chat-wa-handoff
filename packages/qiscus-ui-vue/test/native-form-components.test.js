// Live Chat native form components: the shipped templates (text only, wired
// into Comment / CommentList / ChatWindow without breaking the other
// interactive branches), the sheet's runtime behaviour (Vue 2, unmounted) and
// the real Comment / ChatWindow code paths for masking and sending.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');
const { compileTemplate } = require('./helpers/sfc');
const { loadSrc, loadVueScript } = require('./helpers/esm');

const nf = loadSrc('lib/nativeForm.js');
const read = name => fs.readFileSync(path.join(__dirname, '../src/components', name), 'utf8');

function contractExtras() {
  return {
    type: 'interactive_wa',
    sub_type: 'form',
    header: { type: 'text', value: 'Booking' },
    body: 'Mohon isi data berikut untuk booking.',
    action: { button: 'Isi form' },
    form: {
      schema: 'qiscus.form.v1',
      id: 'booking-v1',
      title: 'Booking',
      fields: [
        { name: 'full_name', type: 'text_input', label: 'Nama', required: true },
        { name: 'services', type: 'checkbox', label: 'Layanan', options: [{ id: 'a', title: 'Pijat' }, { id: 'b', title: 'Refleksi' }] },
        { name: 'consent', type: 'opt_in', label: 'Setuju', required: true },
      ],
    },
  };
}

// ---------------------------------------------------------------- templates

test('new native form components never use v-html', () => {
  ['CommentNativeForm.vue', 'NativeFormSheet.vue'].forEach((name) => {
    assert.ok(!/v-html|innerHTML|domProps/.test(read(name)), `${name} source`);
  });
  ['CommentNativeForm.vue', 'NativeFormSheet.vue', 'CommentOmniFormAnswer.vue'].forEach((name) => {
    assert.ok(!/v-html/.test(compileTemplate(name)), `${name} template`);
  });
});

test('sheet reuses the OmniForm shell and its dialog semantics', () => {
  const html = compileTemplate('NativeFormSheet.vue');
  ['qcw-omniform', 'qcw-omniform__overlay', 'qcw-omniform__sheet', 'qcw-omniform__header',
    'qcw-omniform__title', 'qcw-omniform__close', 'qcw-omniform__sr'].forEach((cls) => {
    assert.match(html, new RegExp(`class="[^"]*\\b${cls}\\b`), cls);
  });
  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-modal="true"/);
  assert.match(html, /@keydown\.esc="emitClose"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /<form[^>]*novalidate[^>]*@submit\.prevent="submit"/);
  // One control per field type.
  assert.match(html, /<select/);
  assert.match(html, /<textarea/);
  assert.match(html, /type="date"/);
  assert.match(html, /type="radio"/);
  assert.match(html, /type="checkbox"/);
  assert.match(html, /:min="field\.minDate \|\| null"/);
  assert.match(html, /:max="field\.maxDate \|\| null"/);
  assert.match(html, /:maxlength="field\.maxChars"/);
  assert.match(html, /role="alert"[^>]*data-native-form-submit-error|data-native-form-submit-error[^>]*role="alert"/);
  assert.match(html, /:disabled="sending"/);
});

test('bubble shows header/body/footer and a CTA that is disabled once answered', () => {
  const html = compileTemplate('CommentNativeForm.vue');
  assert.match(html, /\{\{ form\.header \}\}/);
  assert.match(html, /\{\{ bodyText \}\}/);
  assert.match(html, /\{\{ form\.footer \}\}/);
  assert.match(html, /<button[^>]*type="button"[^>]*data-native-form-open/);
  assert.match(html, /:disabled="!canOpen"/);
});

test('Comment.vue wires the native form branch without breaking list/flow/cta branches', () => {
  const html = compileTemplate('Comment.vue');
  const order = ['v-else-if="isMessageFlowInteractive"', 'v-else-if="isInteractiveCtaUrl"',
    'v-else-if="nativeForm"', 'v-else-if="isFbAdsComment"'];
  let last = -1;
  order.forEach((needle) => {
    const at = html.indexOf(needle);
    assert.ok(at > last, `${needle} in order`);
    last = at;
  });
  assert.match(html, /v-if="isInteractiveListMessage"/, 'list_message branch still there');
  assert.match(html, /<comment-native-form[^>]*:form="nativeForm"[^>]*@open="onNativeFormOpen"/);
  assert.match(html, /<comment-omni-form-answer[^>]*v-if="nativeFormAnswer"[^>]*source="form"[^>]*:mask-values="!!\(core &amp;&amp; core\.UI &amp;&amp; core\.UI\.maskFlowResponse\)"|<comment-omni-form-answer[^>]*v-if="nativeFormAnswer"[^>]*source="form"[^>]*:mask-values="!!\(core && core\.UI && core\.UI\.maskFlowResponse\)"/);
  assert.match(html, /!isFlowResponse\(\) &(amp;)?&(amp;)? !omniFormAnswer &(amp;)?&(amp;)? !nativeFormAnswer/,
    'the answer bubble does not also print its message text');
  const source = read('Comment.vue');
  assert.match(source, /'isNativeForm',\n\s+'nativeFormStatus',/);
  // WA Flow replies stay on their own renderer: 'form' is not swallowed.
  assert.match(source, /nfm_reply\.name === 'flow'/);
});

test('CommentList flags sub_type form and passes the answered status', () => {
  const html = compileTemplate('CommentList.vue');
  assert.match(html, /:isNativeForm="comment\.type === 'text' &(amp;)?&(amp;)? comment\.extras\.type === 'interactive_wa' &(amp;)?&(amp;)? comment\.extras\.sub_type === 'form'/);
  assert.match(html, /:nativeFormStatus="nativeFormStatuses\[String\(comment\.id\)\] \|\| null"/);
  assert.match(html, /@native-form-open="onNativeFormOpen"/);
  // The other interactive flags are untouched.
  assert.match(html, /comment\.extras\.sub_type === 'list_message'/);
  assert.match(html, /comment\.extras\.sub_type === 'cta_url'/);
});

test('ChatWindow mounts the native form sheet next to the OmniForm sheet', () => {
  const html = compileTemplate('ChatWindow.vue');
  assert.match(html, /<omni-form-sheet[\s\S]*<native-form-sheet/);
  assert.match(html, /<native-form-sheet[^>]*:form="nativeForm\.form"[^>]*:send="sendNativeForm"/);
  assert.match(html, /<native-form-sheet[^>]*:brand-color="core\.UI\.colors &(amp;)?&(amp;)? core\.UI\.colors\.bubleRightColor"/);
  assert.match(html, /<comment-list[^>]*@native-form-open="openNativeForm"/);
});

// ---------------------------------------------------------------- Comment.vue masking

const commentSource = read('Comment.vue');
const answerBody = commentSource.match(/nativeFormAnswer\(\) \{([\s\S]*?)\n    \},/);
const readAnswer = vm.runInNewContext(`(function () {${answerBody[1]}\n})`, {
  parseNativeFormAnswer: nf.parseNativeFormAnswer,
  isNativeFormAnswerExtras: nf.isNativeFormAnswerExtras,
});

test('answers render as the answer card; masked values never reach the card text', () => {
  const form = nf.parseNativeForm(contractExtras());
  const extras = nf.buildAnswerExtras(form, { full_name: 'Ani Secret', services: ['a'], consent: true }, 1);
  const context = { core: { UI: { maskFlowResponse: true } }, comment: { message: 'Booking', extras } };
  const answer = readAnswer.call(context);
  assert.equal(answer.formName, 'Booking');
  assert.deepEqual(answer.fields.map(f => f.label), ['Nama', 'Layanan', 'Setuju']);
  // The card masks every value with the same switch as WA Flow / OmniForm.
  const card = compileTemplate('CommentOmniFormAnswer.vue');
  assert.match(card, /maskValues \? '\*{8}' : field\.value/);
});

test('malformed masked answers get a placeholder; unmasked fall back to the title text', () => {
  const context = {
    core: { UI: { maskFlowResponse: true } },
    comment: { message: 'Booking', extras: {
      sub_type: 'interactive',
      interactive: { type: 'nfm_reply', nfm_reply: { name: 'form', response_json: '{"private":"Ani"' } },
    } },
  };
  const masked = readAnswer.call(context);
  assert.equal(masked.fields[0].value, '********');
  context.core.UI.maskFlowResponse = false;
  assert.equal(readAnswer.call(context), null);
});

// ---------------------------------------------------------------- ChatWindow send

const windowSource = read('ChatWindow.vue');
function method(name) {
  const m = windowSource.match(new RegExp(`\\n    ${name}\\(([^)]*)\\) \\{([\\s\\S]*?)\\n    \\},`));
  assert.ok(m, `${name} exists`);
  return vm.runInNewContext(`(function (${m[1]}) {${m[2]}\n})`, {
    answerUniqueId: nf.answerUniqueId,
    buildAnswerExtras: nf.buildAnswerExtras,
    parseNativeForm: nf.parseNativeForm,
    isNativeFormAnswered: nf.isNativeFormAnswered,
    globalThis: { performance: { now: () => 0.5, timeOrigin: 1700000000000 } },
    Promise,
    Error,
    Array,
    String,
  });
}

function chatWindow(sendImpl) {
  const formComment = { id: 123456789, type: 'text', message: 'Mohon isi', extras: contractExtras() };
  const sent = [];
  const callbacks = [];
  const ctx = {
    core: {
      selected: { id: 77, comments: [formComment] },
      _pendingComments: [],
      options: { sentMessageCallback: res => callbacks.push(res) },
      sendComment(...args) {
        sent.push(args);
        return sendImpl(args, ctx);
      },
    },
    nativeForm: { comment: null, form: null, opener: null, draft: null, drafts: {}, submittedIds: [], uniqueIds: {} },
    $set(obj, key, value) { obj[key] = value; },
    $delete(obj, key) { delete obj[key]; },
  };
  ctx.openNativeForm = method('openNativeForm').bind(ctx);
  ctx.sendNativeForm = method('sendNativeForm').bind(ctx);
  ctx.dropFailedNativeFormAnswer = method('dropFailedNativeFormAnswer').bind(ctx);
  return { ctx, formComment, sent, callbacks };
}

test('submitting posts the contract answer as the visitor and marks the form answered', async () => {
  const { ctx, formComment, sent, callbacks } = chatWindow(() => Promise.resolve({ id: 1 }));
  ctx.openNativeForm(formComment, null);
  assert.ok(ctx.nativeForm.form, 'sheet opened');
  await ctx.sendNativeForm({ full_name: 'Ani', services: [], consent: true });
  assert.equal(sent.length, 1);
  const [roomId, text, uniqueId, type, payload, extras] = sent[0];
  assert.equal(roomId, 77);
  assert.equal(text, 'Booking', 'message is the form title only');
  assert.equal(uniqueId, '77_form_123456789_1700000000000.5');
  assert.equal(type, 'text');
  assert.equal(payload, null);
  assert.equal(extras.interactive.nfm_reply.name, 'form');
  const response = JSON.parse(extras.interactive.nfm_reply.response_json);
  assert.equal(response.form_message_id, 123456789);
  assert.deepEqual(response.values, { full_name: 'Ani', consent: true });
  assert.deepEqual(ctx.nativeForm.submittedIds, ['123456789']);
  assert.deepEqual(callbacks, [{ id: 1 }]);
  // One-shot: it does not open again.
  ctx.nativeForm.form = null;
  ctx.openNativeForm(formComment, null);
  assert.equal(ctx.nativeForm.form, null);
});

test('a retry reuses the unique id and drops the failed local copy', async () => {
  let attempt = 0;
  const { ctx, formComment, sent } = chatWindow((args, c) => {
    attempt += 1;
    // Like the SDK: the pending comment is pushed first, then marked failed.
    const local = { unique_id: args[2], extras: args[5], isFailed: attempt === 1 };
    c.core.selected.comments.push(local);
    if (attempt === 1) c.core._pendingComments.push(local); // eslint-disable-line no-underscore-dangle
    return attempt === 1 ? Promise.reject(new Error('offline')) : Promise.resolve({ id: 2 });
  });
  ctx.openNativeForm(formComment, null);
  await assert.rejects(ctx.sendNativeForm({ full_name: 'Ani', consent: true }));
  assert.deepEqual(ctx.nativeForm.submittedIds, []);
  await ctx.sendNativeForm({ full_name: 'Ani', consent: true });
  assert.equal(sent[0][2], sent[1][2], 'same unique id on retry');
  const copies = ctx.core.selected.comments.filter(c => c.unique_id === sent[0][2]);
  assert.equal(copies.length, 1, 'one answer bubble left');
  assert.equal(copies[0].isFailed, false);
  assert.equal(ctx.core._pendingComments.length, 0); // eslint-disable-line no-underscore-dangle
});

test('invalid or already answered forms do not open', () => {
  const { ctx, formComment } = chatWindow(() => Promise.resolve({}));
  ctx.openNativeForm({ id: 1, type: 'text', extras: { type: 'interactive_wa', sub_type: 'form', form: {} } }, null);
  assert.equal(ctx.nativeForm.form, null);
  const form = nf.parseNativeForm(contractExtras());
  ctx.core.selected.comments.push({ type: 'text', extras: nf.buildAnswerExtras(form, { full_name: 'A', consent: true }, formComment.id) });
  ctx.openNativeForm(formComment, null);
  assert.equal(ctx.nativeForm.form, null);
});

// ---------------------------------------------------------------- sheet runtime

async function withSheet(props, run) {
  // eslint-disable-next-line global-require
  const Vue = require('vue');
  Vue.config.productionTip = false;
  Vue.config.devtools = false;
  const options = loadVueScript('components/NativeFormSheet.vue');
  const sheet = new Vue(Object.assign({}, options, { propsData: props }));
  const emitted = [];
  sheet.$on('submitted', () => emitted.push(['submitted']));
  sheet.$on('close', values => emitted.push(['close', values]));
  try {
    await sheet.$nextTick();
    await run({ sheet, emitted, Vue });
  } finally {
    sheet.$destroy();
  }
}

test('sheet: invalid submit shows errors and sends nothing', async () => {
  const calls = [];
  const form = nf.parseNativeForm(contractExtras());
  await withSheet({ form, send: v => calls.push(v) }, async ({ sheet }) => {
    assert.equal(sheet.shownError(form.fields[0]), null, 'no error before blur/submit');
    sheet.submit();
    assert.equal(calls.length, 0);
    assert.equal(sheet.attempted, true);
    assert.equal(sheet.errorText(form.fields[0]), 'This field is required');
    assert.equal(sheet.announcement, 'Please check the highlighted fields.');
  });
});

test('sheet: valid submit sends once, locks while sending, then emits submitted', async () => {
  const form = nf.parseNativeForm(contractExtras());
  let resolve;
  const calls = [];
  const send = (values) => {
    calls.push(values);
    return new Promise((r) => { resolve = r; });
  };
  await withSheet({ form, send }, async ({ sheet, emitted }) => {
    sheet.setValue(form.fields[0], 'Ani');
    sheet.toggleOption(form.fields[1], 'b', true);
    sheet.setValue(form.fields[2], true);
    const pending = sheet.submit();
    sheet.submit();
    await Promise.resolve();
    assert.equal(sheet.sending, true);
    assert.equal(sheet.submitText, 'Sending…');
    assert.equal(calls.length, 1, 'no double submit');
    assert.deepEqual(calls[0], { full_name: 'Ani', services: ['b'], consent: true });
    resolve();
    await pending;
    assert.deepEqual(emitted, [['submitted']]);
  });
});

test('sheet: a failed send shows the error and a retry', async () => {
  const form = nf.parseNativeForm(contractExtras());
  let attempt = 0;
  const send = () => {
    attempt += 1;
    return attempt === 1 ? Promise.reject(new Error('x')) : Promise.resolve();
  };
  await withSheet({ form, send, labels: { retry: 'Coba lagi' } }, async ({ sheet, emitted }) => {
    sheet.setValue(form.fields[0], 'Ani');
    sheet.setValue(form.fields[2], true);
    await sheet.submit();
    assert.equal(sheet.failed, true);
    assert.equal(sheet.sending, false);
    assert.equal(sheet.submitText, 'Coba lagi', 'page label override');
    await sheet.submit();
    assert.equal(attempt, 2);
    assert.deepEqual(emitted, [['submitted']]);
  });
});

test('sheet: a draft is restored and close hands the values back', async () => {
  const form = nf.parseNativeForm(contractExtras());
  await withSheet({ form, draft: { full_name: 'Draft', services: ['a'], consent: 'bad' } }, async ({ sheet, emitted }) => {
    assert.equal(sheet.values.full_name, 'Draft');
    assert.deepEqual(sheet.values.services, ['a']);
    assert.equal(sheet.values.consent, false, 'a draft value of the wrong type is ignored');
    sheet.emitClose();
    assert.equal(emitted[0][0], 'close');
    assert.equal(emitted[0][1].full_name, 'Draft');
  });
});

test('sheet: an answer resolving after another form opened does not close that one', async () => {
  const form = nf.parseNativeForm(contractExtras());
  let resolve;
  await withSheet({ form, send: () => new Promise((r) => { resolve = r; }) }, async ({ sheet, emitted }) => {
    sheet.setValue(form.fields[0], 'Ani');
    sheet.setValue(form.fields[2], true);
    const pending = sheet.submit();
    await Promise.resolve();
    sheet.$props.form = nf.parseNativeForm(contractExtras()); // eslint-disable-line no-param-reassign
    await sheet.$nextTick();
    resolve();
    await pending;
    assert.deepEqual(emitted, []);
  });
});
