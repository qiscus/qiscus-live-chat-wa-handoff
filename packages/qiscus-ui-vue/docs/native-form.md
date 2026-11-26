# Live Chat native form (phase 1)

A bot or API can send a **native form** into a Live Chat room (pure Live Chat
and the WA → Live Chat handoff room). The widget shows it as a bubble with a
button; the button opens a bottom sheet with the fields (no iframe, unlike
OmniForm). The visitor's answers come back into the room as a normal customer
message, so bots, allocation and the inbox receive them through the usual
pipeline. No backend change is needed: qismo-api and the SDK pass `extras`
through.

Code: `src/lib/nativeForm.js` (parse, validate, build/read answers, labels),
`src/components/CommentNativeForm.vue` (bubble),
`src/components/NativeFormSheet.vue` (sheet), wired in `Comment.vue`,
`CommentList.vue` and `ChatWindow.vue`. Answers render with
`CommentOmniFormAnswer.vue` (same card as OmniForm / WA Flow replies).

## Form message (bot → room)

Send a `text` comment whose `extras` carry the form:

```json
{
  "type": "text",
  "message": "Mohon isi data berikut untuk booking.",
  "extras": {
    "type": "interactive_wa",
    "sub_type": "form",
    "header": { "type": "text", "value": "Booking" },
    "body": "Mohon isi data berikut untuk booking.",
    "footer": { "text": "Data Anda aman" },
    "action": { "button": "Isi form" },
    "form": {
      "schema": "qiscus.form.v1",
      "id": "booking-v1",
      "title": "Booking",
      "submit_label": "Kirim",
      "fields": [
        { "name": "full_name", "type": "text_input", "label": "Nama", "required": true, "max_chars": 80 },
        { "name": "email", "type": "text_input", "label": "Email", "input_type": "email" },
        { "name": "branch", "type": "dropdown", "label": "Cabang", "required": true,
          "options": [{ "id": "jkt", "title": "Jakarta" }, { "id": "sby", "title": "Surabaya" }] },
        { "name": "services", "type": "checkbox", "label": "Layanan", "min_selected": 1, "max_selected": 2,
          "options": [{ "id": "a", "title": "Pijat" }, { "id": "b", "title": "Refleksi" }] },
        { "name": "date", "type": "date", "label": "Tanggal", "required": true,
          "min_date": "2026-11-27", "max_date": "2026-12-31" },
        { "name": "consent", "type": "opt_in", "label": "Saya setuju dihubungi", "required": true }
      ]
    }
  }
}
```

- `message` is the fallback text for clients without support, and what the
  widget shows when the form is invalid.
- Field `type`: `text_input` (`input_type` `text|number|email|phone`),
  `text_area`, `dropdown`, `radio`, `checkbox` (`min_selected`,
  `max_selected`), `date` (`min_date`, `max_date` as `YYYY-MM-DD`), `opt_in`.
- Common props: `name` (unique, `^[A-Za-z0-9_]{1,64}$`), `label` (≤ 100
  chars), `required` (default `false`), `helper_text`, `placeholder`.
  `max_chars` defaults to 80 (`text_input`) / 600 (`text_area`).
- Limits: 1–50 fields; 1–100 options per choice field, unique ids.

The form is **invalid** (the bubble shows only `message`) when the schema is
not `qiscus.form.v1`, `id` is missing, there are no fields or more than 50, a
field type or `input_type` is unknown, names are duplicated or malformed, a
label is missing, a choice field has no/duplicate/too many options, or
`min_date` is after `max_date`. Unknown properties are ignored. Over-long
display strings are cut (label 100, header/footer/title 100, button and
`submit_label` 40, body 4096 chars). Every string is rendered as plain text
(never HTML) and no URL in it is followed.

Validation rules in the sheet: required; email / phone (6–15 digits) /
number format; `min_chars` / `max_chars`; `min_selected` / `max_selected`
(`min_selected` applies even when `required` is not set); date format and
range; a required `opt_in` must be ticked.

### Example: post a form with the SDK REST API

Placeholders only: use the app's own values and keep the secret key out of
logs and tickets.

```bash
curl -X POST "https://api.qiscus.com/api/v2.1/rest/post_comment" \
  -H "Content-Type: application/json" \
  -H "QISCUS-SDK-APP-ID: <APP_ID>" \
  -H "QISCUS-SDK-SECRET: <SECRET_KEY>" \
  -d '{
    "user_id": "<BOT_OR_AGENT_USER_ID>",
    "room_id": "<ROOM_ID>",
    "type": "text",
    "message": "Mohon isi data berikut untuk booking.",
    "extras": {
      "type": "interactive_wa",
      "sub_type": "form",
      "header": { "type": "text", "value": "Booking" },
      "body": "Mohon isi data berikut untuk booking.",
      "action": { "button": "Isi form" },
      "form": {
        "schema": "qiscus.form.v1",
        "id": "booking-v1",
        "title": "Booking",
        "fields": [
          { "name": "full_name", "type": "text_input", "label": "Nama", "required": true },
          { "name": "consent", "type": "opt_in", "label": "Saya setuju dihubungi", "required": true }
        ]
      }
    }
  }'
```

(Use the SDK base URL of the environment the app lives on.)

## Answer (visitor → room)

On submit the widget sends, as the visitor:

- `type: "text"`, `message` = the form title only (answers never go into
  `message`, so agent masking and copy/quote guards keep working);
- `unique_id` = `<room_id>_form_<form comment id>_<timestamp>`; a retry after a
  failed send reuses it;
- `extras`:

```json
{
  "sub_type": "interactive",
  "interactive": {
    "type": "nfm_reply",
    "nfm_reply": {
      "name": "form",
      "body": "Booking",
      "response_json": "{\"schema\":\"qiscus.form.answers.v1\",\"form_id\":\"booking-v1\",\"form_name\":\"Booking\",\"form_message_id\":123456789,\"fields\":[{\"name\":\"full_name\",\"label\":\"Nama\",\"type\":\"text_input\",\"value\":\"Ani\",\"display_value\":\"Ani\"},{\"name\":\"consent\",\"label\":\"Saya setuju dihubungi\",\"type\":\"opt_in\",\"value\":true,\"display_value\":\"Yes\"}],\"values\":{\"full_name\":\"Ani\",\"consent\":true}}"
    }
  }
}
```

- `values` is a flat map for bots (WA Flow style). Optional fields left empty
  are omitted from `fields` and `values`. Value types: text / email / phone /
  text_area / date → string, number → number, dropdown / radio → option id,
  checkbox → array of ids (in form order), opt_in → boolean (always sent;
  "Yes"/"No").
- One-shot: the bubble's button turns into a disabled "Submitted" once the room
  holds an answer whose `form_message_id` is the form comment's id (an answer
  still being sent shows "Sending…"; a failed one re-enables the form), or
  after a successful submit in this session.

In the room the answer shows as the OmniForm / WA Flow answer card
(`label | value` rows). With `QiscusUI.maskFlowResponse` on, every value is
masked.

## Labels

English defaults; the page can override any of them:

```js
QiscusUI.nativeForm = {
  labels: {
    open: 'Isi form',
    submit: 'Kirim',
    submitted: 'Terkirim',
    required: 'Wajib diisi',
    invalidEmail: 'Email tidak valid',
  },
};
```

Keys: `title`, `open`, `close`, `submit`, `submitting`, `submitted`,
`submitFailed`, `retry`, `fixErrors`, `required`, `optional`, `invalidEmail`,
`invalidPhone`, `invalidNumber`, `minChars`, `maxChars`, `minSelected`,
`maxSelected`, `invalidOption`, `invalidDate`, `dateMin`, `dateMax`,
`selectPlaceholder`, `charCounter` (see `NATIVE_FORM_LABELS` in
`src/lib/nativeForm.js`; `{min}`, `{max}`, `{count}` are filled in). The form's
own `action.button` and `submit_label` win over `open` and `submit`.

## Not in phase 1

File upload, multiple screens, dynamic data, a form builder, storage, and
sending a form from the agent composer.
