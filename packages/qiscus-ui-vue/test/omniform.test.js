// OmniForm embed in the widget (src/lib/omniForm.js): which links are framed,
// which postMessage events are believed, and how answers posted by qismo-api
// are read. Ported from omnichannel-fe-monorepo apps/widget/src/chat/
// omniForm.spec.ts + omniFormAnswer.spec.ts so both widgets keep one contract.

const test = require('node:test');
const assert = require('node:assert');
const { loadSrc } = require('./helpers/esm');

const {
  omniFormEmbedUrl,
  parseOmniFormOrigins,
  omniFormConfig,
  parseEmbedEvent,
  embedEventFrom,
  parseOmniFormAnswer,
  omniFormAnswerIds,
  omniFormLabel,
} = loadSrc('lib/omniForm.js');

const FORM = 'https://form.example.com';
const TOKEN = 'tok_abc123';

test('omniFormEmbedUrl: accepts /e/<token> on an allowed https origin, as given', () => {
  assert.strictEqual(omniFormEmbedUrl(`${FORM}/e/${TOKEN}`, [FORM]), `${FORM}/e/${TOKEN}`);
  assert.strictEqual(omniFormEmbedUrl(`${FORM}/e/${TOKEN}/`, [FORM]), `${FORM}/e/${TOKEN}/`);
  assert.strictEqual(omniFormEmbedUrl(`${FORM}/e/${TOKEN}?lang=id`, [FORM]), `${FORM}/e/${TOKEN}?lang=id`);
});

test('omniFormEmbedUrl: never frames /f/ and never rewrites it to /e/', () => {
  assert.strictEqual(omniFormEmbedUrl(`${FORM}/f/${TOKEN}`, [FORM]), null);
});

test('omniFormEmbedUrl: rejects other paths, schemes, origins and credentials', () => {
  [
    `${FORM}/e/`,
    `${FORM}/e/${TOKEN}/extra`,
    `${FORM}/x/e/${TOKEN}`,
    `http://form.example.com/e/${TOKEN}`,
    `https://evil.example.com/e/${TOKEN}`,
    `https://form.example.com.evil.com/e/${TOKEN}`,
    `https://user:pass@form.example.com/e/${TOKEN}`,
    `https://form.example.com:8443/e/${TOKEN}`,
    `javascript:alert(1)`,
    'not a url',
    '',
  ].forEach((href) => {
    assert.strictEqual(omniFormEmbedUrl(href, [FORM]), null, href);
  });
});

test('omniFormEmbedUrl: allows nothing with an empty allowlist', () => {
  assert.strictEqual(omniFormEmbedUrl(`${FORM}/e/${TOKEN}`, []), null);
  assert.strictEqual(omniFormEmbedUrl(`${FORM}/e/${TOKEN}`, undefined), null);
});

test('omniFormEmbedUrl: refuses a form on the widget origin itself (sandbox escape)', () => {
  assert.strictEqual(omniFormEmbedUrl(`${FORM}/e/${TOKEN}`, [FORM], FORM), null);
  assert.strictEqual(
    omniFormEmbedUrl(`${FORM}/e/${TOKEN}`, [FORM], 'https://widget.example.com'),
    `${FORM}/e/${TOKEN}`,
  );
});

test('parseOmniFormOrigins: arrays or JSON arrays of canonical https origins', () => {
  assert.deepStrictEqual(parseOmniFormOrigins([FORM, 'https://a.example.com:8443']), [
    FORM,
    'https://a.example.com:8443',
  ]);
  assert.deepStrictEqual(parseOmniFormOrigins(JSON.stringify([FORM])), [FORM]);
  assert.deepStrictEqual(parseOmniFormOrigins(''), []);
  assert.deepStrictEqual(parseOmniFormOrigins(undefined), []);
});

test('parseOmniFormOrigins: one bad entry or bad JSON denies everything', () => {
  [
    [FORM, 'http://form.example.com'],
    [FORM, `${FORM}/`],
    [FORM, 'https://*.example.com'],
    [FORM, 'https://user@form.example.com'],
    [FORM, 'https://form.example.com/path'],
    [FORM, 42],
    `[${FORM}]`,
    '{"a":1}',
    FORM,
  ].forEach((value) => {
    assert.deepStrictEqual(parseOmniFormOrigins(value), [], JSON.stringify(value));
  });
});

test('omniFormConfig: on only for enabled === true with at least one valid origin', () => {
  assert.deepStrictEqual(omniFormConfig({ omniForm: { enabled: true, allowedOrigins: [FORM] } }).enabled, true);
  [
    undefined,
    {},
    { omniForm: null },
    { omniForm: { enabled: 'true', allowedOrigins: [FORM] } },
    { omniForm: { enabled: 1, allowedOrigins: [FORM] } },
    { omniForm: { enabled: true, allowedOrigins: [] } },
    { omniForm: { enabled: true, allowedOrigins: [FORM, 'nope'] } },
    { omniForm: { enabled: false, allowedOrigins: [FORM] } },
  ].forEach((ui) => {
    assert.strictEqual(omniFormConfig(ui).enabled, false, JSON.stringify(ui));
  });
});

test('parseEmbedEvent: reads the five documented events', () => {
  assert.deepStrictEqual(parseEmbedEvent({ type: 'omniform:ready' }), { type: 'omniform:ready' });
  assert.deepStrictEqual(parseEmbedEvent({ type: 'omniform:submitted' }), { type: 'omniform:submitted' });
  assert.deepStrictEqual(parseEmbedEvent({ type: 'omniform:close' }), { type: 'omniform:close' });
  assert.deepStrictEqual(parseEmbedEvent({ type: 'omniform:resize', height: 420.5 }), {
    type: 'omniform:resize',
    height: 420.5,
  });
  ['expired', 'submitted', 'unavailable'].forEach((state) => {
    assert.deepStrictEqual(parseEmbedEvent({ type: 'omniform:state', state }), {
      type: 'omniform:state',
      state,
    });
  });
});

test('parseEmbedEvent: rejects bad heights, unknown states, other types and non-objects', () => {
  [
    { type: 'omniform:resize', height: 0 },
    { type: 'omniform:resize', height: -5 },
    { type: 'omniform:resize', height: '300' },
    { type: 'omniform:resize', height: Infinity },
    { type: 'omniform:resize', height: NaN },
    { type: 'omniform:state', state: 'open' },
    { type: 'omniform:init' },
    { type: 'other' },
    'omniform:ready',
    null,
    [],
    {},
  ].forEach((data) => {
    assert.strictEqual(parseEmbedEvent(data), null, JSON.stringify(data));
  });
});

test('parseEmbedEvent: keeps only the documented fields', () => {
  assert.deepStrictEqual(parseEmbedEvent({ type: 'omniform:submitted', answers: { x: 1 }, token: 't' }), {
    type: 'omniform:submitted',
  });
});

test('embedEventFrom: needs both the embed origin and the frame window as source', () => {
  const frame = {};
  const data = { type: 'omniform:ready' };
  assert.deepStrictEqual(embedEventFrom({ origin: FORM, source: frame, data }, FORM, frame), data);
  assert.strictEqual(embedEventFrom({ origin: FORM, source: {}, data }, FORM, frame), null);
  assert.strictEqual(embedEventFrom({ origin: 'https://evil.example.com', source: frame, data }, FORM, frame), null);
  assert.strictEqual(embedEventFrom({ origin: FORM, source: frame, data }, FORM, null), null);
  assert.strictEqual(embedEventFrom({ origin: FORM, source: null, data }, FORM, null), null);
});

function answerExtras(response, overrides) {
  return Object.assign(
    {
      sub_type: 'interactive',
      interactive: {
        type: 'nfm_reply',
        nfm_reply: {
          name: 'omniform',
          body: 'Body name',
          response_json: typeof response === 'string' ? response : JSON.stringify(response),
        },
      },
      omniform: { schema: 'qiscus.omniform.room-answer.v1', form_id: 1, form_link_id: 2 },
    },
    overrides,
  );
}

const RESPONSE = {
  schema: 'qiscus.omniform.answers.v1',
  form_name: 'Pengajuan',
  fields: [
    { label: 'Nama_1', display_value: 'Budi' },
    { label: 'Alamat', display_value: 'Jl. Satu\nNo. 2' },
  ],
  attachments: [
    { name: 'ktp.jpg', url: 'https://files.example.com/ktp.jpg' },
    { name: 'old.pdf', url: 'http://files.example.com/old.pdf' },
  ],
};

test('parseOmniFormAnswer: reads form name, fields in order and attachments, exactly as sent', () => {
  assert.deepStrictEqual(parseOmniFormAnswer(answerExtras(RESPONSE)), {
    formName: 'Pengajuan',
    fields: [
      { label: 'Nama_1', value: 'Budi' },
      { label: 'Alamat', value: 'Jl. Satu\nNo. 2' },
    ],
    attachments: [
      { name: 'ktp.jpg', url: 'https://files.example.com/ktp.jpg' },
      { name: 'old.pdf' },
    ],
  });
});

test('parseOmniFormAnswer: missing attachments, empty value, body as name fallback', () => {
  const response = { schema: RESPONSE.schema, fields: [{ label: 'Catatan', display_value: '' }] };
  assert.deepStrictEqual(parseOmniFormAnswer(answerExtras(response)), {
    formName: 'Body name',
    fields: [{ label: 'Catatan', value: '' }],
    attachments: [],
  });
});

test('parseOmniFormAnswer: null for anything that is not exactly the contract', () => {
  const bad = [
    null,
    {},
    answerExtras(RESPONSE, { sub_type: 'other' }),
    answerExtras('{not json'),
    answerExtras(Object.assign({}, RESPONSE, { schema: 'v2' })),
    answerExtras(Object.assign({}, RESPONSE, { fields: 'x' })),
    answerExtras(Object.assign({}, RESPONSE, { fields: [{ label: 'a', display_value: 1 }] })),
    answerExtras(Object.assign({}, RESPONSE, { attachments: {} })),
    answerExtras(Object.assign({}, RESPONSE, { attachments: [{ name: 'a' }] })),
    answerExtras({ schema: RESPONSE.schema, fields: [], attachments: [] }),
  ];
  const flow = answerExtras(RESPONSE);
  flow.interactive.nfm_reply.name = 'flow';
  bad.push(flow);
  bad.forEach((extras, index) => {
    assert.strictEqual(parseOmniFormAnswer(extras), null, `case ${index}`);
  });
});

test('parseOmniFormAnswer: keeps markup as plain strings', () => {
  const xss = '<img src=x onerror=alert(1)>';
  const answer = parseOmniFormAnswer(answerExtras({
    schema: RESPONSE.schema,
    form_name: xss,
    fields: [{ label: xss, display_value: xss }],
  }));
  assert.strictEqual(answer.formName, xss);
  assert.deepStrictEqual(answer.fields, [{ label: xss, value: xss }]);
});

test('omniFormAnswerIds: ids of the answer messages only', () => {
  const comments = [
    { id: 1, unique_id: 'u1', extras: {} },
    { id: 2, unique_id: 'u2', extras: answerExtras(RESPONSE) },
    { id: 3, extras: answerExtras(RESPONSE) },
    null,
  ];
  assert.deepStrictEqual(omniFormAnswerIds(comments), ['u2', '3']);
  assert.deepStrictEqual(omniFormAnswerIds(undefined), []);
});

test('omniFormLabel: English default, page override, placeholders', () => {
  assert.strictEqual(omniFormLabel({}, 'sending'), 'Sending form…');
  assert.strictEqual(omniFormLabel({ sending: 'Mengirim…' }, 'sending'), 'Mengirim…');
  assert.strictEqual(omniFormLabel({ sending: '' }, 'sending'), 'Sending form…');
  assert.match(omniFormLabel({}, 'failedTimeout', { seconds: 15 }), /within 15 seconds/);
});
