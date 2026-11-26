// Live Chat native form (lib/nativeForm.js): parsing the form message,
// validating answers, building the answer extras, reading answers back and the
// one-shot "answered" rule. Payloads follow the native form contract v1.

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSrc } = require('./helpers/esm');

const nf = loadSrc('lib/nativeForm.js');

// The form message from the contract, section 1.
function contractExtras() {
  return {
    type: 'interactive_wa',
    sub_type: 'form',
    header: { type: 'text', value: 'Booking' },
    body: 'Mohon isi data berikut untuk booking.',
    footer: { text: 'Data Anda aman' },
    action: { button: 'Isi form' },
    form: {
      schema: 'qiscus.form.v1',
      id: 'booking-v1',
      title: 'Booking',
      submit_label: 'Kirim',
      fields: [
        { name: 'full_name', type: 'text_input', label: 'Nama', required: true, input_type: 'text', max_chars: 80 },
        { name: 'email', type: 'text_input', label: 'Email', input_type: 'email' },
        { name: 'phone', type: 'text_input', label: 'No. HP', input_type: 'phone' },
        { name: 'guests', type: 'text_input', label: 'Jumlah tamu', input_type: 'number' },
        { name: 'notes', type: 'text_area', label: 'Catatan', helper_text: 'Opsional', max_chars: 500 },
        { name: 'branch', type: 'dropdown', label: 'Cabang', required: true, options: [{ id: 'jkt', title: 'Jakarta' }, { id: 'sby', title: 'Surabaya' }] },
        { name: 'slot', type: 'radio', label: 'Sesi', options: [{ id: 'am', title: 'Pagi' }, { id: 'pm', title: 'Sore' }] },
        { name: 'services', type: 'checkbox', label: 'Layanan', min_selected: 1, max_selected: 2, options: [{ id: 'a', title: 'Pijat' }, { id: 'b', title: 'Refleksi' }] },
        { name: 'date', type: 'date', label: 'Tanggal', required: true, min_date: '2026-11-27', max_date: '2026-12-31' },
        { name: 'consent', type: 'opt_in', label: 'Saya setuju dihubungi', required: true },
      ],
    },
  };
}

function field(form, name) {
  return form.fields.filter(f => f.name === name)[0];
}

// ---------------------------------------------------------------- parsing

test('parses the contract example into a normalized form', () => {
  const form = nf.parseNativeForm(contractExtras());
  assert.ok(form);
  assert.equal(form.id, 'booking-v1');
  assert.equal(form.title, 'Booking');
  assert.equal(form.submitLabel, 'Kirim');
  assert.equal(form.header, 'Booking');
  assert.equal(form.body, 'Mohon isi data berikut untuk booking.');
  assert.equal(form.footer, 'Data Anda aman');
  assert.equal(form.button, 'Isi form');
  assert.deepEqual(form.fields.map(f => f.type),
    ['text_input', 'text_input', 'text_input', 'text_input', 'text_area', 'dropdown', 'radio', 'checkbox', 'date', 'opt_in']);
  assert.equal(field(form, 'full_name').required, true);
  assert.equal(field(form, 'full_name').maxChars, 80);
  assert.equal(field(form, 'email').inputType, 'email');
  assert.equal(field(form, 'email').maxChars, 80, 'text_input default max_chars');
  assert.equal(field(form, 'notes').maxChars, 500);
  assert.equal(field(form, 'notes').helperText, 'Opsional');
  assert.equal(field(form, 'services').minSelected, 1);
  assert.equal(field(form, 'services').maxSelected, 2);
  assert.equal(field(form, 'date').minDate, '2026-11-27');
  assert.equal(field(form, 'date').maxDate, '2026-12-31');
  assert.equal(field(form, 'slot').required, false, 'required defaults to false');
});

test('text_area defaults to 600 chars; input_type defaults to text', () => {
  const extras = contractExtras();
  extras.form.fields = [
    { name: 'a', type: 'text_area', label: 'A' },
    { name: 'b', type: 'text_input', label: 'B' },
  ];
  const form = nf.parseNativeForm(extras);
  assert.equal(form.fields[0].maxChars, 600);
  assert.equal(form.fields[1].inputType, 'text');
});

test('unknown props are dropped, not passed through', () => {
  const extras = contractExtras();
  extras.form.fields[0].onclick = 'alert(1)';
  extras.form.fields[0].html = '<img src=x onerror=alert(1)>';
  extras.form.extra = { x: 1 };
  const form = nf.parseNativeForm(extras);
  assert.ok(form);
  assert.equal('onclick' in form.fields[0], false);
  assert.equal('html' in form.fields[0], false);
  assert.equal('extra' in form, false);
});

test('long strings are capped (label 100 chars), the form stays valid', () => {
  const extras = contractExtras();
  extras.form.fields[0].label = 'x'.repeat(500);
  extras.body = 'y'.repeat(10000);
  const form = nf.parseNativeForm(extras);
  assert.ok(form);
  assert.equal(form.fields[0].label.length, nf.MAX_LABEL_CHARS);
  assert.equal(form.body.length, 4096);
});

test('invalid forms return null (the bubble falls back to the message text)', () => {
  const cases = {
    'not a form sub_type': (e) => { e.sub_type = 'list_message'; },
    'missing form': (e) => { delete e.form; },
    'bad schema': (e) => { e.form.schema = 'qiscus.form.v2'; },
    'missing id': (e) => { delete e.form.id; },
    'no fields': (e) => { e.form.fields = []; },
    'fields not an array': (e) => { e.form.fields = {}; },
    'unknown field type': (e) => { e.form.fields[0].type = 'file_upload'; },
    'duplicate names': (e) => { e.form.fields[1].name = 'full_name'; },
    'bad name': (e) => { e.form.fields[0].name = 'full name'; },
    'name too long': (e) => { e.form.fields[0].name = 'a'.repeat(65); },
    'missing label': (e) => { delete e.form.fields[0].label; },
    'unknown input_type': (e) => { e.form.fields[0].input_type = 'password'; },
    'dropdown without options': (e) => { e.form.fields[5].options = []; },
    'duplicate option ids': (e) => { e.form.fields[5].options[1].id = 'jkt'; },
    'option without title': (e) => { delete e.form.fields[5].options[0].title; },
    'more than 100 options': (e) => {
      e.form.fields[5].options = Array.from({ length: 101 }, (_, i) => ({ id: `o${i}`, title: `O${i}` }));
    },
    'min_date after max_date': (e) => { e.form.fields[8].min_date = '2027-01-01'; },
    'more than 50 fields': (e) => {
      e.form.fields = Array.from({ length: 51 }, (_, i) => ({ name: `f${i}`, type: 'text_input', label: `F${i}` }));
    },
  };
  Object.keys(cases).forEach((name) => {
    const extras = contractExtras();
    cases[name](extras);
    assert.equal(nf.parseNativeForm(extras), null, name);
  });
  assert.equal(nf.parseNativeForm(null), null);
  assert.equal(nf.parseNativeForm('form'), null);
});

test('exactly 50 fields is still valid', () => {
  const extras = contractExtras();
  extras.form.fields = Array.from({ length: 50 }, (_, i) => ({ name: `f${i}`, type: 'text_input', label: `F${i}` }));
  assert.equal(nf.parseNativeForm(extras).fields.length, 50);
});

test('isNativeFormComment only flags text comments with sub_type form', () => {
  assert.equal(nf.isNativeFormComment({ type: 'text', extras: contractExtras() }), true);
  assert.equal(nf.isNativeFormComment({ type: 'custom', extras: contractExtras() }), false);
  assert.equal(nf.isNativeFormComment({ type: 'text', extras: { type: 'interactive_wa', sub_type: 'flow' } }), false);
});

// ---------------------------------------------------------------- validation

test('validation: required, email, phone, number, chars', () => {
  const form = nf.parseNativeForm(contractExtras());
  const v = (name, value) => nf.validateField(field(form, name), value);
  assert.deepEqual(v('full_name', ''), { key: 'required' });
  assert.deepEqual(v('full_name', '   '), { key: 'required' });
  assert.equal(v('full_name', 'Ani'), null);
  assert.deepEqual(v('full_name', 'x'.repeat(81)), { key: 'maxChars', params: { max: 80 } });
  assert.equal(v('email', ''), null, 'optional and empty is fine');
  assert.deepEqual(v('email', 'not-an-email'), { key: 'invalidEmail' });
  assert.equal(v('email', 'ani@example.com'), null);
  assert.deepEqual(v('phone', '12ab'), { key: 'invalidPhone' });
  assert.deepEqual(v('phone', '123'), { key: 'invalidPhone' });
  assert.equal(v('phone', '+62 812-3456-7890'), null);
  assert.deepEqual(v('guests', 'two'), { key: 'invalidNumber' });
  assert.equal(v('guests', '2'), null);
  assert.equal(v('guests', '2.5'), null);
  const min = nf.parseNativeForm(Object.assign(contractExtras(), {
    form: { schema: 'qiscus.form.v1', id: 'x', title: 'X', fields: [{ name: 'a', type: 'text_input', label: 'A', min_chars: 3 }] },
  })).fields[0];
  assert.deepEqual(nf.validateField(min, 'ab'), { key: 'minChars', params: { min: 3 } });
  assert.equal(nf.validateField(min, 'abc'), null);
});

test('validation: choices, min/max selected, dates, opt-in', () => {
  const form = nf.parseNativeForm(contractExtras());
  const v = (name, value) => nf.validateField(field(form, name), value);
  assert.deepEqual(v('branch', ''), { key: 'required' });
  assert.deepEqual(v('branch', 'bdg'), { key: 'invalidOption' });
  assert.equal(v('branch', 'jkt'), null);
  assert.equal(v('slot', ''), null);
  assert.deepEqual(v('services', []), { key: 'minSelected', params: { min: 1 } }, 'min_selected applies without required');
  assert.equal(v('services', ['a']), null);
  assert.deepEqual(v('services', ['a', 'b', 'c']), { key: 'invalidOption' });
  assert.deepEqual(v('services', ['a', 'a']), { key: 'invalidOption' });
  const three = nf.parseNativeForm(Object.assign(contractExtras(), {
    form: { schema: 'qiscus.form.v1', id: 'x', title: 'X', fields: [{ name: 'c', type: 'checkbox', label: 'C', min_selected: 2, max_selected: 2,
      options: [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }, { id: 'c', title: 'C' }] }] },
  })).fields[0];
  assert.deepEqual(nf.validateField(three, ['a']), { key: 'minSelected', params: { min: 2 } });
  assert.deepEqual(nf.validateField(three, ['a', 'b', 'c']), { key: 'maxSelected', params: { max: 2 } });
  assert.equal(nf.validateField(three, ['a', 'c']), null);
  const free = Object.assign({}, three, { minSelected: 0 });
  assert.equal(nf.validateField(free, []), null, 'optional group without min_selected may stay empty');
  assert.deepEqual(v('date', ''), { key: 'required' });
  assert.deepEqual(v('date', '2026-02-30'), { key: 'invalidDate' });
  assert.deepEqual(v('date', '2026-11-26'), { key: 'dateMin', params: { min: '2026-11-27' } });
  assert.deepEqual(v('date', '2027-01-01'), { key: 'dateMax', params: { max: '2026-12-31' } });
  assert.equal(v('date', '2026-12-01'), null);
  assert.deepEqual(v('consent', false), { key: 'required' });
  assert.equal(v('consent', true), null);
});

test('validateForm reports every invalid field', () => {
  const form = nf.parseNativeForm(contractExtras());
  const result = nf.validateForm(form, nf.initialValues(form));
  assert.equal(result.valid, false);
  assert.deepEqual(Object.keys(result.errors).sort(), ['branch', 'consent', 'date', 'full_name', 'services']);
});

// ---------------------------------------------------------------- answer

function filled(form) {
  return Object.assign(nf.initialValues(form), {
    full_name: '  Ani  ',
    guests: '3',
    branch: 'sby',
    services: ['b', 'a'],
    date: '2026-12-01',
    consent: true,
  });
}

test('answer extras follow the contract (nfm_reply "form", schema, values, display_value)', () => {
  const form = nf.parseNativeForm(contractExtras());
  const values = filled(form);
  assert.equal(nf.validateForm(form, values).valid, true);
  const extras = nf.buildAnswerExtras(form, values, 123456789);
  assert.equal(extras.sub_type, 'interactive');
  assert.equal(extras.interactive.type, 'nfm_reply');
  assert.equal(extras.interactive.nfm_reply.name, 'form');
  assert.equal(extras.interactive.nfm_reply.body, 'Booking');
  const response = JSON.parse(extras.interactive.nfm_reply.response_json);
  assert.equal(response.schema, 'qiscus.form.answers.v1');
  assert.equal(response.form_id, 'booking-v1');
  assert.equal(response.form_name, 'Booking');
  assert.equal(response.form_message_id, 123456789);
  assert.deepEqual(response.values, {
    full_name: 'Ani',
    guests: 3,
    branch: 'sby',
    services: ['a', 'b'],
    date: '2026-12-01',
    consent: true,
  });
  assert.deepEqual(response.fields, [
    { name: 'full_name', label: 'Nama', type: 'text_input', value: 'Ani', display_value: 'Ani' },
    { name: 'guests', label: 'Jumlah tamu', type: 'text_input', value: 3, display_value: '3' },
    { name: 'branch', label: 'Cabang', type: 'dropdown', value: 'sby', display_value: 'Surabaya' },
    { name: 'services', label: 'Layanan', type: 'checkbox', value: ['a', 'b'], display_value: 'Pijat, Refleksi' },
    { name: 'date', label: 'Tanggal', type: 'date', value: '2026-12-01', display_value: '2026-12-01' },
    { name: 'consent', label: 'Saya setuju dihubungi', type: 'opt_in', value: true, display_value: 'Yes' },
  ]);
});

test('empty optional fields are omitted; an unticked optional opt-in is "No"', () => {
  const extras = contractExtras();
  extras.form.fields.push({ name: 'promo', type: 'opt_in', label: 'Promo' });
  const form = nf.parseNativeForm(extras);
  const response = nf.buildAnswerResponse(form, filled(form), '42');
  ['email', 'phone', 'notes', 'slot'].forEach((name) => {
    assert.equal(name in response.values, false, `${name} omitted from values`);
    assert.equal(response.fields.some(f => f.name === name), false, `${name} omitted from fields`);
  });
  assert.equal(response.values.promo, false);
  assert.equal(response.fields.filter(f => f.name === 'promo')[0].display_value, 'No');
  assert.equal(response.form_message_id, 42, 'numeric string id becomes a number');
});

test('answer unique id carries room and form message ids', () => {
  assert.equal(nf.answerUniqueId(77, 123, 1700000000000.5), '77_form_123_1700000000000.5');
});

test('an answer built here parses back into the answer card shape', () => {
  const form = nf.parseNativeForm(contractExtras());
  const extras = nf.buildAnswerExtras(form, filled(form), 123456789);
  const answer = nf.parseNativeFormAnswer(extras);
  assert.equal(answer.formName, 'Booking');
  assert.equal(answer.formMessageId, '123456789');
  assert.deepEqual(answer.attachments, []);
  assert.deepEqual(answer.fields[0], { label: 'Nama', value: 'Ani' });
  assert.deepEqual(answer.fields[3], { label: 'Layanan', value: 'Pijat, Refleksi' });
});

test('parseNativeFormAnswer rejects other replies and bad payloads', () => {
  const reply = (nfm) => ({ sub_type: 'interactive', interactive: { type: 'nfm_reply', nfm_reply: nfm } });
  assert.equal(nf.parseNativeFormAnswer(reply({ name: 'omniform', response_json: '{}' })), null);
  assert.equal(nf.parseNativeFormAnswer(reply({ name: 'flow', response_json: '{}' })), null);
  assert.equal(nf.parseNativeFormAnswer(reply({ name: 'form', response_json: 'not json' })), null);
  assert.equal(nf.parseNativeFormAnswer(reply({ name: 'form', response_json: JSON.stringify({ schema: 'qiscus.omniform.answers.v1', fields: [] }) })), null);
  assert.equal(nf.parseNativeFormAnswer(reply({ name: 'form', response_json: JSON.stringify({
    schema: 'qiscus.form.answers.v1', fields: [{ label: 'A', display_value: 1 }] }) })), null);
  assert.equal(nf.isNativeFormAnswerExtras(reply({ name: 'form', response_json: 'x' })), true);
  assert.equal(nf.isNativeFormAnswerExtras(reply({ name: 'flow' })), false);
});

// ---------------------------------------------------------------- answered

function answerComment(formMessageId, flags) {
  const form = nf.parseNativeForm(contractExtras());
  return Object.assign({ type: 'text', message: 'Booking', extras: nf.buildAnswerExtras(form, filled(form), formMessageId) }, flags || {});
}

test('a form counts as answered once the room holds its answer', () => {
  const formComment = { id: 123456789, type: 'text', extras: contractExtras() };
  const other = { id: 5, type: 'text', extras: contractExtras() };
  const comments = [formComment, other, answerComment(123456789)];
  assert.equal(nf.isNativeFormAnswered(formComment, comments), true);
  assert.equal(nf.isNativeFormAnswered(other, comments), false);
  assert.deepEqual(nf.nativeFormAnsweredIds(comments), ['123456789']);
  assert.equal(nf.isNativeFormAnswered(formComment, [formComment]), false);
});

test('a pending answer is "sending", a failed one does not count', () => {
  const formComment = { id: 9, type: 'text', extras: contractExtras() };
  assert.deepEqual(nf.nativeFormAnswerStatus([formComment, answerComment(9, { isPending: true })]), { 9: 'sending' });
  assert.equal(nf.isNativeFormAnswered(formComment, [formComment, answerComment(9, { isPending: true })]), true);
  assert.deepEqual(nf.nativeFormAnswerStatus([formComment, answerComment(9, { isFailed: true })]), {});
  assert.deepEqual(nf.nativeFormAnswerStatus([
    answerComment(9, { isFailed: true }), answerComment(9, { isPending: true }), answerComment(9),
  ]), { 9: 'answered' });
});

// ---------------------------------------------------------------- labels

test('labels have English defaults and page overrides (QiscusUI.nativeForm.labels)', () => {
  assert.equal(nf.nativeFormLabel({}, 'submit'), 'Submit');
  assert.equal(nf.nativeFormLabel({}, 'submitted'), 'Submitted');
  assert.equal(nf.nativeFormLabel({}, 'required'), 'This field is required');
  assert.equal(nf.nativeFormLabel({}, 'invalidEmail'), 'Please enter a valid email');
  assert.equal(nf.nativeFormLabel({}, 'maxChars', { max: 80 }), 'Please enter at most 80 characters');
  const { labels } = nf.nativeFormConfig({ nativeForm: { labels: { submit: 'Kirim', required: '' } } });
  assert.equal(nf.nativeFormLabel(labels, 'submit'), 'Kirim');
  assert.equal(nf.nativeFormLabel(labels, 'required'), 'This field is required', 'empty override is ignored');
  assert.deepEqual(nf.nativeFormConfig(undefined).labels, {});
  assert.deepEqual(nf.nativeFormConfig({ nativeForm: { labels: 'x' } }).labels, {});
});
