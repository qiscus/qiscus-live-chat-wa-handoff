/**
 * Live Chat native form (phase 1): a bot/API posts a `text` comment whose
 * `extras` describe a single-screen form (WhatsApp Flow style, no iframe);
 * the widget renders it as a bubble + bottom sheet and posts the answers back
 * as an `nfm_reply` named `form`.
 *
 * Contract v1 (Live Chat native form, "message contract v1"):
 *
 * Form message (bot -> room):
 *   { type: 'text', message: <fallback text>, extras: {
 *       type: 'interactive_wa', sub_type: 'form',
 *       header?: { type: 'text', value }, body?, footer?: { text },
 *       action?: { button },
 *       form: { schema: 'qiscus.form.v1', id, title, submit_label?, fields: [...] } } }
 *
 * Answer (customer -> room, sent by this widget):
 *   core.sendComment(roomId, <form title>, uniqueId, 'text', null, {
 *     sub_type: 'interactive',
 *     interactive: { type: 'nfm_reply', nfm_reply: { name: 'form', body: <form title>,
 *       response_json: JSON.stringify({ schema: 'qiscus.form.answers.v1', form_id,
 *         form_name, form_message_id, fields: [{ name, label, type, value, display_value }],
 *         values: { <name>: <value> } }) } } })
 *
 * Anything in the form that does not match the contract makes `parseNativeForm`
 * return null, and the message shows as its plain `message` text: never a broken
 * sheet. Every string is bot or customer input: it is rendered through text
 * interpolation only (never v-html), and URLs in it are never followed.
 */

export const NATIVE_FORM_SCHEMA = 'qiscus.form.v1';
export const NATIVE_FORM_ANSWERS_SCHEMA = 'qiscus.form.answers.v1';

export const FIELD_TYPES = ['text_input', 'text_area', 'dropdown', 'radio', 'checkbox', 'date', 'opt_in'];
export const INPUT_TYPES = ['text', 'number', 'email', 'phone'];

const NAME_PATTERN = /^[A-Za-z0-9_]{1,64}$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Contract limits. */
export const MAX_FIELDS = 50;
export const MAX_OPTIONS = 100;
export const MAX_LABEL_CHARS = 100;
export const DEFAULT_MAX_CHARS = { text_input: 80, text_area: 600 };

/**
 * Display caps for strings the contract leaves open (client-side only: longer
 * text is cut, the form stays valid).
 */
const CAP = {
  title: 100,
  header: 100,
  body: 4096,
  footer: 100,
  button: 40,
  submitLabel: 40,
  helperText: 300,
  placeholder: 100,
  optionTitle: 100,
  optionId: 200,
  formId: 200,
};
/** Hard ceiling for a typed value, whatever `max_chars` says. */
const MAX_VALUE_CHARS = 4096;

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** Length in code points, so an emoji counts as one character. */
export function charCount(text) {
  return Array.from(String(text)).length;
}

function cap(value, max) {
  if (typeof value !== 'string') return '';
  const chars = Array.from(value);
  return chars.length > max ? chars.slice(0, max).join('') : value;
}

function positiveInt(value) {
  return typeof value === 'number' && isFinite(value) && Math.floor(value) === value && value >= 0
    ? value
    : undefined;
}

/** A real calendar day as `YYYY-MM-DD`, else false. */
export function isIsoDate(value) {
  if (typeof value !== 'string') return false;
  const m = DATE_PATTERN.exec(value);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

function parseOptions(raw) {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > MAX_OPTIONS) return null;
  const options = [];
  const seen = {};
  for (let i = 0; i < raw.length; i += 1) {
    const option = raw[i];
    if (!isRecord(option) || typeof option.id !== 'string' || !option.id) return null;
    if (typeof option.title !== 'string' || !option.title) return null;
    if (charCount(option.id) > CAP.optionId) return null;
    if (Object.prototype.hasOwnProperty.call(seen, option.id)) return null;
    seen[option.id] = true;
    options.push({ id: option.id, title: cap(option.title, CAP.optionTitle) });
  }
  return options;
}

/** One field of the form, normalized; null when it breaks the contract. Unknown props are dropped. */
function parseField(raw) {
  if (!isRecord(raw)) return null;
  if (typeof raw.name !== 'string' || !NAME_PATTERN.test(raw.name)) return null;
  if (FIELD_TYPES.indexOf(raw.type) === -1) return null;
  if (typeof raw.label !== 'string' || !raw.label.trim()) return null;

  const field = {
    name: raw.name,
    type: raw.type,
    label: cap(raw.label, MAX_LABEL_CHARS),
    required: raw.required === true,
    helperText: cap(raw.helper_text, CAP.helperText),
    placeholder: cap(raw.placeholder, CAP.placeholder),
  };

  switch (raw.type) {
    case 'text_input':
    case 'text_area': {
      if (raw.type === 'text_input') {
        const inputType = raw.input_type === undefined || raw.input_type === null ? 'text' : raw.input_type;
        if (INPUT_TYPES.indexOf(inputType) === -1) return null;
        field.inputType = inputType;
      } else {
        field.inputType = 'text';
      }
      const minChars = positiveInt(raw.min_chars);
      const maxChars = positiveInt(raw.max_chars);
      field.maxChars = Math.min(maxChars && maxChars > 0 ? maxChars : DEFAULT_MAX_CHARS[raw.type], MAX_VALUE_CHARS);
      field.minChars = minChars && minChars <= field.maxChars ? minChars : 0;
      break;
    }
    case 'dropdown':
    case 'radio':
    case 'checkbox': {
      const options = parseOptions(raw.options);
      if (!options) return null;
      field.options = options;
      if (raw.type === 'checkbox') {
        const min = positiveInt(raw.min_selected);
        const max = positiveInt(raw.max_selected);
        field.maxSelected = max && max > 0 ? Math.min(max, options.length) : options.length;
        field.minSelected = min && min <= field.maxSelected ? min : 0;
      }
      break;
    }
    case 'date':
      field.minDate = isIsoDate(raw.min_date) ? raw.min_date : '';
      field.maxDate = isIsoDate(raw.max_date) ? raw.max_date : '';
      if (field.minDate && field.maxDate && field.minDate > field.maxDate) return null;
      break;
    default:
      break;
  }
  return field;
}

/**
 * The form carried by a message's `extras`, normalized, or null when it is not
 * a native form or breaks the contract (bad schema, unknown field type,
 * duplicate names, 0 or more than 50 fields, ...).
 */
export function parseNativeForm(extras) {
  if (!isRecord(extras) || extras.type !== 'interactive_wa' || extras.sub_type !== 'form') return null;
  const form = extras.form;
  if (!isRecord(form) || form.schema !== NATIVE_FORM_SCHEMA) return null;
  if (typeof form.id !== 'string' || !form.id || charCount(form.id) > CAP.formId) return null;
  if (!Array.isArray(form.fields) || form.fields.length < 1 || form.fields.length > MAX_FIELDS) return null;

  const fields = [];
  const names = {};
  for (let i = 0; i < form.fields.length; i += 1) {
    const field = parseField(form.fields[i]);
    if (!field) return null;
    if (Object.prototype.hasOwnProperty.call(names, field.name)) return null;
    names[field.name] = true;
    fields.push(field);
  }

  const header = isRecord(extras.header) && extras.header.type === 'text' && typeof extras.header.value === 'string'
    ? cap(extras.header.value, CAP.header)
    : '';
  // The answer's `message` is the title, and a comment needs some text.
  const title = cap(form.title, CAP.title) || header || 'Form';
  return {
    id: form.id,
    title,
    submitLabel: cap(form.submit_label, CAP.submitLabel),
    header,
    body: cap(extras.body, CAP.body),
    footer: isRecord(extras.footer) ? cap(extras.footer.text, CAP.footer) : '',
    button: isRecord(extras.action) ? cap(extras.action.button, CAP.button) : '',
    fields,
  };
}

/** True for a `text` comment flagged as a native form (valid or not). */
export function isNativeFormComment(comment) {
  return Boolean(comment) && comment.type === 'text' && isRecord(comment.extras) &&
    comment.extras.type === 'interactive_wa' && comment.extras.sub_type === 'form';
}

/** The empty value a field starts with in the sheet. */
export function emptyValue(field) {
  if (field.type === 'checkbox') return [];
  if (field.type === 'opt_in') return false;
  return '';
}

export function initialValues(form) {
  const values = {};
  form.fields.forEach((field) => {
    values[field.name] = emptyValue(field);
  });
  return values;
}

function isEmpty(field, value) {
  if (field.type === 'checkbox') return !Array.isArray(value) || value.length === 0;
  if (field.type === 'opt_in') return value !== true;
  return typeof value !== 'string' || !value.trim();
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9\s\-().]+$/;
const NUMBER_PATTERN = /^[-+]?(\d+([.,]\d+)?|[.,]\d+)$/;

function hasOption(field, id) {
  return field.options.some(option => option.id === id);
}

/**
 * The first problem with `value` for `field`, as `{ key, params? }` (a label
 * key, see NATIVE_FORM_LABELS), or null when it is fine. An empty optional
 * field is fine, except a checkbox group with `min_selected`.
 */
export function validateField(field, value) {
  if (isEmpty(field, value)) {
    if (field.required) return { key: 'required' };
    // `min_selected` asks for that many ticks even when `required` is not set
    // (the contract's own example: `min_selected: 1` without `required`).
    if (field.type === 'checkbox' && field.minSelected) {
      return { key: 'minSelected', params: { min: field.minSelected } };
    }
    return null;
  }
  switch (field.type) {
    case 'text_input':
    case 'text_area': {
      const text = value.trim();
      const length = charCount(text);
      if (field.minChars && length < field.minChars) return { key: 'minChars', params: { min: field.minChars } };
      if (length > field.maxChars) return { key: 'maxChars', params: { max: field.maxChars } };
      if (field.inputType === 'email' && !EMAIL_PATTERN.test(text)) return { key: 'invalidEmail' };
      if (field.inputType === 'phone') {
        const digits = text.replace(/\D/g, '').length;
        if (!PHONE_PATTERN.test(text) || digits < 6 || digits > 15) return { key: 'invalidPhone' };
      }
      if (field.inputType === 'number' && (!NUMBER_PATTERN.test(text) || !isFinite(Number(text.replace(',', '.'))))) {
        return { key: 'invalidNumber' };
      }
      return null;
    }
    case 'dropdown':
    case 'radio':
      return hasOption(field, value) ? null : { key: 'invalidOption' };
    case 'checkbox': {
      const unique = value.filter((id, index) => value.indexOf(id) === index);
      if (unique.length !== value.length || !unique.every(id => hasOption(field, id))) {
        return { key: 'invalidOption' };
      }
      if (field.minSelected && unique.length < field.minSelected) {
        return { key: 'minSelected', params: { min: field.minSelected } };
      }
      if (unique.length > field.maxSelected) return { key: 'maxSelected', params: { max: field.maxSelected } };
      return null;
    }
    case 'date':
      if (!isIsoDate(value)) return { key: 'invalidDate' };
      if (field.minDate && value < field.minDate) return { key: 'dateMin', params: { min: field.minDate } };
      if (field.maxDate && value > field.maxDate) return { key: 'dateMax', params: { max: field.maxDate } };
      return null;
    case 'opt_in':
      return null;
    default:
      return { key: 'invalidOption' };
  }
}

/** `{ valid, errors: { <name>: { key, params? } } }` for the whole form. */
export function validateForm(form, values) {
  const errors = {};
  form.fields.forEach((field) => {
    const error = validateField(field, values ? values[field.name] : undefined);
    if (error) errors[field.name] = error;
  });
  return { valid: Object.keys(errors).length === 0, errors };
}

function optionTitle(field, id) {
  const option = field.options.filter(o => o.id === id)[0];
  return option ? option.title : id;
}

/**
 * One answered field as `{ name, label, type, value, display_value }`, or null
 * when the field is optional and was left empty (omitted from the answer).
 */
function answerField(field, raw) {
  if (field.type !== 'opt_in' && isEmpty(field, raw)) return null;
  let value;
  let display;
  switch (field.type) {
    case 'text_input':
    case 'text_area': {
      const text = raw.trim();
      if (field.inputType === 'number') {
        value = Number(text.replace(',', '.'));
        display = text;
      } else {
        value = text;
        display = text;
      }
      break;
    }
    case 'dropdown':
    case 'radio':
      value = raw;
      display = optionTitle(field, raw);
      break;
    case 'checkbox':
      // In the form's option order, whatever order they were ticked in.
      value = field.options.filter(o => raw.indexOf(o.id) !== -1).map(o => o.id);
      display = value.map(id => optionTitle(field, id)).join(', ');
      break;
    case 'date':
      value = raw;
      display = raw;
      break;
    case 'opt_in':
      value = raw === true;
      display = value ? 'Yes' : 'No';
      break;
    default:
      return null;
  }
  return { name: field.name, label: field.label, type: field.type, value, display_value: display };
}

/** `form_message_id` as sent: the comment id, numeric when it is a number. */
function messageId(id) {
  if (typeof id === 'number') return id;
  const text = String(id);
  return /^\d+$/.test(text) && Number(text) <= Number.MAX_SAFE_INTEGER ? Number(text) : text;
}

/**
 * The answer's `response_json` object (schema `qiscus.form.answers.v1`):
 * fields in form order with `display_value`, plus the flat `values` map for
 * bots. Optional fields left empty are omitted from both; an opt-in is always
 * answered (`true`/`false`, "Yes"/"No").
 */
export function buildAnswerResponse(form, values, formMessageId) {
  const fields = [];
  const flat = {};
  form.fields.forEach((field) => {
    const answered = answerField(field, values ? values[field.name] : undefined);
    if (!answered) return;
    fields.push(answered);
    flat[field.name] = answered.value;
  });
  return {
    schema: NATIVE_FORM_ANSWERS_SCHEMA,
    form_id: form.id,
    form_name: form.title,
    form_message_id: messageId(formMessageId),
    fields,
    values: flat,
  };
}

/** The answer comment's `extras` (WhatsApp Flow `nfm_reply` shape, name `form`). */
export function buildAnswerExtras(form, values, formMessageId) {
  return {
    sub_type: 'interactive',
    interactive: {
      type: 'nfm_reply',
      nfm_reply: {
        name: 'form',
        body: form.title,
        response_json: JSON.stringify(buildAnswerResponse(form, values, formMessageId)),
      },
    },
  };
}

/** `${roomId}_form_${formMessageId}_${timestamp}`, like the list_reply unique id. */
export function answerUniqueId(roomId, formMessageId, now) {
  return `${roomId}_form_${formMessageId}_${now}`;
}

/**
 * The native-form answer carried by a message's `extras`, in the shape the
 * answer card (CommentOmniFormAnswer) renders: `{ formName, formMessageId,
 * fields: [{ label, value }], attachments: [] }`, or null when it is not
 * (exactly) there.
 */
export function parseNativeFormAnswer(extras) {
  if (!isRecord(extras) || extras.sub_type !== 'interactive') return null;
  const interactive = extras.interactive;
  if (!isRecord(interactive) || interactive.type !== 'nfm_reply') return null;
  const reply = interactive.nfm_reply;
  if (!isRecord(reply) || reply.name !== 'form' || typeof reply.response_json !== 'string') return null;

  let response;
  try {
    response = JSON.parse(reply.response_json);
  } catch (e) {
    return null;
  }
  if (!isRecord(response) || response.schema !== NATIVE_FORM_ANSWERS_SCHEMA) return null;
  if (!Array.isArray(response.fields)) return null;

  let formName = '';
  if (typeof response.form_name === 'string') formName = response.form_name;
  else if (typeof reply.body === 'string') formName = reply.body;

  const fields = [];
  for (let i = 0; i < response.fields.length; i += 1) {
    const raw = response.fields[i];
    if (!isRecord(raw) || typeof raw.label !== 'string' || typeof raw.display_value !== 'string') return null;
    fields.push({ label: raw.label, value: raw.display_value });
  }
  const id = response.form_message_id;
  const formMessageId = typeof id === 'number' || (typeof id === 'string' && id) ? String(id) : null;
  return { formName, formMessageId, fields, attachments: [] };
}

/** True when the extras are a native-form answer by name (valid or not). */
export function isNativeFormAnswerExtras(extras) {
  const interactive = isRecord(extras) && isRecord(extras.interactive) ? extras.interactive : null;
  return Boolean(interactive) && interactive.type === 'nfm_reply' &&
    isRecord(interactive.nfm_reply) && interactive.nfm_reply.name === 'form';
}

/**
 * `{ <form comment id>: 'answered' | 'sending' }` from the answers in
 * `comments`. An answer the SDK is still posting (`isPending`) counts as
 * 'sending'; one that failed (`isFailed`) does not count, so the form opens
 * again and the visitor can retry.
 */
export function nativeFormAnswerStatus(comments) {
  const status = {};
  (comments || []).forEach((comment) => {
    if (!comment || comment.isFailed) return;
    const answer = parseNativeFormAnswer(comment.extras);
    if (!answer || !answer.formMessageId) return;
    if (comment.isPending) {
      if (!status[answer.formMessageId]) status[answer.formMessageId] = 'sending';
    } else {
      status[answer.formMessageId] = 'answered';
    }
  });
  return status;
}

/** Comment ids (as strings) of the form messages answered by any of `comments`. */
export function nativeFormAnsweredIds(comments) {
  const status = nativeFormAnswerStatus(comments);
  return Object.keys(status).filter(id => status[id] === 'answered');
}

/**
 * One-shot rule: answered when the room holds an answer (sent or being sent)
 * whose `form_message_id` is this comment's id.
 */
export function isNativeFormAnswered(comment, comments) {
  if (!comment || comment.id === undefined || comment.id === null) return false;
  return Boolean(nativeFormAnswerStatus(comments)[String(comment.id)]);
}

/** English defaults; the page may override any of them through `QiscusUI.nativeForm.labels`. */
export const NATIVE_FORM_LABELS = {
  title: 'Form',
  open: 'Open form',
  close: 'Close form',
  submit: 'Submit',
  submitting: 'Sending…',
  submitted: 'Submitted',
  submitFailed: "Your answers couldn't be sent. Please try again.",
  retry: 'Try again',
  fixErrors: 'Please check the highlighted fields.',
  required: 'This field is required',
  optional: 'Optional',
  invalidEmail: 'Please enter a valid email',
  invalidPhone: 'Please enter a valid phone number',
  invalidNumber: 'Please enter a number',
  minChars: 'Please enter at least {min} characters',
  maxChars: 'Please enter at most {max} characters',
  minSelected: 'Please select at least {min}',
  maxSelected: 'Please select at most {max}',
  invalidOption: 'Please choose one of the options',
  invalidDate: 'Please enter a valid date',
  dateMin: 'Please choose {min} or later',
  dateMax: 'Please choose {max} or earlier',
  selectPlaceholder: 'Select an option',
  charCounter: '{count}/{max}',
};

/** The native-form settings the page gave the widget (`QiscusUI.nativeForm`). */
export function nativeFormConfig(ui) {
  const raw = ui && isRecord(ui.nativeForm) ? ui.nativeForm : {};
  return { labels: isRecord(raw.labels) ? raw.labels : {} };
}

/**
 * A label with `{name}` placeholders filled; page overrides win when they are
 * non-empty strings.
 */
export function nativeFormLabel(labels, key, params) {
  const override = labels && typeof labels[key] === 'string' && labels[key] ? labels[key] : null;
  let text = override || NATIVE_FORM_LABELS[key] || key;
  if (params) {
    Object.keys(params).forEach((name) => {
      text = text.split(`{${name}}`).join(String(params[name]));
    });
  }
  return text;
}
