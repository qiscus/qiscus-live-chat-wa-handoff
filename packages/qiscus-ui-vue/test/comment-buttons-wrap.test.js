// Regression: interactive "buttons" messages (CommentButtons / quick reply /
// account linking share `.qcw-comment__buttons .action_buttons button|a`) forced
// every row to `height: 48px` (and `line-height: 48px` on links). Long labels
// that wrap (e.g. full addresses) then spilled out of their row and overlapped
// the neighbouring rows. Rows must grow with their text instead, keep the
// original whitespace/newlines, and never truncate.

const test = require('node:test');
const assert = require('node:assert');
const {
  compileTemplate,
  compileStyle,
  declarationsFor,
} = require('./helpers/sfc');

const css = compileStyle('CommentButtons.vue');
const PREFIX = '.qcw-comment__buttons .action_buttons';
const targets = { button: `${PREFIX} button`, link: `${PREFIX} a` };

const px = v => (/^-?\d+(\.\d+)?px$/.test(v || '') ? parseFloat(v) : null);

Object.entries(targets).forEach(([kind, selector]) => {
  test(`${kind}: row height is not fixed, it grows with wrapped text`, () => {
    const d = declarationsFor(css, selector);
    assert.ok(
      d.height === undefined || d.height === 'auto',
      `fixed height "${d.height}" makes long labels overflow into the next row`,
    );
    assert.ok(px(d['min-height']) >= 48, 'keeps the 48px single-line row as a minimum');
  });

  test(`${kind}: line-height is not the fixed row height`, () => {
    const d = declarationsFor(css, selector);
    const lh = d['line-height'];
    assert.ok(
      lh === undefined || lh === 'normal' || px(lh) === null || px(lh) < 48,
      `line-height ${lh} stacks wrapped lines 48px apart`,
    );
  });

  test(`${kind}: keeps original whitespace and wraps long words`, () => {
    const d = declarationsFor(css, selector);
    assert.strictEqual(d['white-space'], 'pre-wrap');
    const wrap = d['overflow-wrap'] || d['word-wrap'];
    assert.ok(['anywhere', 'break-word'].includes(wrap), `unbroken tokens need overflow-wrap, got ${wrap}`);
  });

  test(`${kind}: never truncates or hides text`, () => {
    const d = declarationsFor(css, selector);
    assert.strictEqual(d['text-overflow'], undefined);
    assert.notStrictEqual(d['white-space'], 'nowrap');
    assert.ok(!['hidden', 'clip'].includes(d.overflow), 'overflow must not clip text');
    assert.notStrictEqual(d['word-break'], 'break-all');
  });

  test(`${kind}: is box-sized so width:100% plus padding stays inside the bubble`, () => {
    const d = declarationsFor(css, selector);
    assert.strictEqual(d['box-sizing'], 'border-box');
    assert.strictEqual(d.width, '100%');
  });
});

test('redownload variant keeps its own auto-height layout', () => {
  const d = declarationsFor(
    css,
    '.button-message__redownload div .qcw-comment__buttons .action_buttons button',
  );
  assert.strictEqual(d.height, 'auto');
  assert.strictEqual(d['padding-top'], '70px');
  assert.strictEqual(d['padding-bottom'], '34px');
  assert.strictEqual(d['flex-direction'], 'column');
});

test('labels render as plain text with original behaviour (no transformation, handlers/links intact)', () => {
  const html = compileTemplate('CommentButtons.vue');
  assert.match(html, /\{\{ button\.label \}\}/);
  assert.doesNotMatch(html, /button\.label\s*\|/, 'no filter on the label');
  assert.doesNotMatch(html, /button\.label\.(trim|replace|toUpperCase|toLowerCase)/);
  assert.match(html, /@click="postbackHandler\(button\)"/);
  assert.match(html, /:href="button\.payload\.url"/);
  assert.match(html, /target="_blank"/);
});

test('custom quick reply keeps disabled postback buttons under the shared selector', () => {
  const html = compileTemplate('CommentButtonQuickReply.vue');
  assert.match(html, /class="qcw-comment__buttons"/);
  assert.match(html, /class="action_buttons"/);
  assert.match(html, /<button[^>]*disabled/);
  assert.match(html, /\{\{ ct\.action\.label \}\}/);
});
