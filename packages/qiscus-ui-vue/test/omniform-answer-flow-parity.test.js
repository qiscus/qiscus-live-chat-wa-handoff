// OmniForm answers must look exactly like the WA Flow reply bubble: same
// markup classes (so the same CSS applies) and the same masking switch.
const test = require('node:test');
const assert = require('node:assert/strict');
const { compileTemplate } = require('./helpers/sfc');

const flow = compileTemplate('CommentFlowResponse.vue');
const omni = compileTemplate('CommentOmniFormAnswer.vue');

test('OmniForm answer reuses the WA Flow reply structure and classes', () => {
  for (const cls of ['qcw-flow-response', 'flow-response-container', 'flow-response-detail']) {
    assert.match(flow, new RegExp(`class="${cls}"`), `WA Flow uses ${cls}`);
    assert.match(omni, new RegExp(`class="[^"]*\\b${cls}\\b`), `OmniForm must use ${cls}`);
  }
  assert.ok(!/qcw-omniform-answer__table/.test(omni), 'no separate OmniForm table styling');
});

test('OmniForm answer follows the WA Flow masking switch for values and files', () => {
  assert.match(omni, /maskValues \? '\*{8}' : field\.value/);
  assert.match(omni, /v-if="maskValues"/, 'attachments collapse to the mask when masked');
});

test('OmniForm answer stays text-only with safe links', () => {
  assert.ok(!/v-html/.test(omni));
  assert.match(omni, /rel="noopener noreferrer"/);
});
