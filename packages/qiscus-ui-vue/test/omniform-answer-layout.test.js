// OmniForm fallback text may contain upload URLs. It must keep the text
// bubble's configured colors/padding instead of being classified as an image.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');
const { loadSrc } = require('./helpers/esm');
const { attachmentCaption } = loadSrc('lib/attachmentTag.js');

const source = fs.readFileSync(path.join(__dirname, '../src/components/Comment.vue'), 'utf8');
const match = source.match(/isMeFileImageAttachment\(\) \{([\s\S]*?)\n    \},/);
assert.ok(match, 'the real Comment image classifier must exist');
const classify = vm.runInNewContext(`(function () {${match[1]}\n})`, { attachmentCaption });

const answerMatch = source.match(/omniFormAnswer\(\) \{([\s\S]*?)\n    \},/);
const { parseOmniFormAnswer } = loadSrc('lib/omniForm.js');
const readAnswer = vm.runInNewContext(`(function () {${answerMatch[1]}\n})`, { parseOmniFormAnswer });
test('malformed masked answers never fall through to raw text or upload URLs', () => {
  const context = {
    core: { UI: { maskFlowResponse: true } },
    comment: { message: 'private https://files.example/private.pdf', extras: {
      interactive: { type: 'nfm_reply', nfm_reply: { name: 'omniform', response_json: 'invalid' } },
    } },
  };
  const masked = readAnswer.call(context);
  assert.ok(masked, 'structured placeholder suppresses raw text fallback');
  assert.equal(masked.fields[0].value, '********');
  assert.equal(masked.attachments.length, 0);
  context.core.UI.maskFlowResponse = false;
  assert.equal(readAnswer.call(context), null, 'unmasked malformed replies keep their text fallback');
});

const comment = {
  payload: {},
  message: 'Form #1\n\nNama: Pelanggan Uji\nphoto.jpg: https://files.example/photo.jpg',
};

test('OmniForm answer with an upload retains the configured text bubble', () => {
  assert.equal(classify.call({ isMe: true, omniFormAnswer: { fields: [], attachments: [] }, comment }), false);
});

test('ordinary own image attachments keep their existing classification', () => {
  assert.equal(classify.call({ isMe: true, omniFormAnswer: null, comment: {
    payload: {}, message: '[file]https://files.example/photo.jpg[/file]',
  } }), true);
});
