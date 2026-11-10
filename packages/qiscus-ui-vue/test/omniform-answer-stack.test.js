// OmniForm answers keep the WA Flow card, but a long question must not squeeze
// the answer column: each row wraps, so the answer drops below a long label.
const test = require('node:test');
const assert = require('node:assert/strict');
const { compileStyle, declarationsFor } = require('./helpers/sfc');

const css = compileStyle('CommentOmniFormAnswer.vue');
const scope = '.qcw-omniform-answer .flow-response-detail';

test('rows wrap so the answer can move under a long question', () => {
  const tr = declarationsFor(css, `${scope} tr`);
  assert.equal(tr.display, 'flex');
  assert.equal(tr['flex-wrap'], 'wrap');
});

test('question column is capped and may wrap; answer keeps the rest', () => {
  const label = declarationsFor(css, `${scope} tr td:first-child`);
  const value = declarationsFor(css, `${scope} tr td:last-child`);
  assert.equal(label['white-space'], 'normal', 'labels must not be nowrap');
  assert.match(label['min-width'], /%$/);
  assert.match(value['flex-basis'] || value.flex, /%/);
  assert.equal(value['word-break'], 'normal', 'no per-letter breaking');
  assert.equal(value['overflow-wrap'], 'anywhere');
});
