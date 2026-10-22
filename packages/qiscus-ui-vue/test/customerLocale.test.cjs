const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { customerText, getCustomerLocale, MESSAGES } = require('../src/lib/customerLocale');

test('auto locale selects the first supported browser language and falls back to English', () => {
  assert.equal(getCustomerLocale('auto', 'id-ID'), 'id');
  assert.equal(getCustomerLocale('auto', 'en-US'), 'en');
  assert.equal(getCustomerLocale('auto', 'fr-FR'), 'en');
  assert.equal(getCustomerLocale('auto', ['fr-FR', 'id-ID']), 'id');
});

test('locale is opt-in so existing widget embeds remain English', () => {
  assert.equal(getCustomerLocale(undefined, 'id-ID'), 'en');
  assert.equal(getCustomerLocale('id', 'en-US'), 'id');
});

test('English and Indonesian catalogs have matching keys', () => {
  assert.deepEqual(Object.keys(MESSAGES.id).sort(), Object.keys(MESSAGES.en).sort());
});

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(vue|js)$/.test(entry.name) ? [full] : [];
  });
}

test('every $customerText key used by the widget exists in both catalogs', () => {
  const used = new Set();
  for (const file of sourceFiles(path.join(__dirname, '../src'))) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/\$customerText\(\s*'([^']+)'/g)) used.add(match[1]);
    // ternary form: $customerText(cond ? 'a' : 'b')
    for (const match of source.matchAll(/\$customerText\([^)'"]*\?\s*'([^']+)'\s*:\s*'([^']+)'/g)) {
      used.add(match[1]);
      used.add(match[2]);
    }
  }
  assert.ok(used.size > 40, `expected many keys, found ${used.size}`);
  const missing = [...used].filter(key => !(key in MESSAGES.en) || !(key in MESSAGES.id));
  assert.deepEqual(missing, []);
});

test('reply and load-more copy is localized, English stays as before', () => {
  assert.equal(customerText('message.reply', 'auto', 'en-US'), 'Reply');
  assert.equal(customerText('message.reply', 'auto', 'id-ID'), 'Balas');
  assert.equal(customerText('reply.replyingTo', 'auto', 'en-US', { name: 'Rina' }), 'Replying to Rina');
  assert.equal(customerText('reply.replyingTo', 'auto', 'id-ID', { name: 'Rina' }), 'Membalas Rina');
  assert.equal(
    customerText('message.notLoaded', 'auto', 'en-US'),
    'Comment not loaded yet, load more to go to comment',
  );
  assert.match(customerText('message.notLoaded', 'auto', 'id-ID'), /Muat lebih banyak/);
});

test('customer-facing widget templates have no leftover hard-coded English for localized copy', () => {
  const read = name => fs.readFileSync(path.join(__dirname, '../src/components', name), 'utf8');
  assert.doesNotMatch(read('Comment.vue'), /li\(@click="replyHandler\(comment\)"\) Reply/);
  assert.doesNotMatch(read('Comment.vue'), /\$toasted\.error\('Error download file'\)/);
  assert.doesNotMatch(read('CommentReplyPreview.vue'), /\) Replying to/);
  assert.doesNotMatch(read('CommentList.vue'), /'Comment not loaded yet/);
});

test('live-handover-room opts into auto locale and localizes its static error page', () => {
  // handoff-widget-standalone: the room is the static page served by the Worker.
  const room = fs.readFileSync(path.join(__dirname, '../../../public/live-handover-room.html'), 'utf8');
  assert.match(room, /customerLocale: 'auto'/);
  assert.match(room, /Terjadi kesalahan\. Silakan muat ulang browser Anda\./);
  assert.match(room, /Something went wrong\. Please try again by refreshing your browser\./);
  assert.match(room, /navigator\.languages/);
  // Static error text is set as text, not concatenated into innerHTML.
  assert.doesNotMatch(room, /innerHTML\s*=/);
  // The hosted page itself must not opt in (only the room iframe does).
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname, '../../../public/widget.html'), 'utf8'), /customerLocale/);
});

test('customer text uses selected locale and interpolates values', () => {
  assert.equal(customerText('chat.end', 'auto', 'id-ID'), 'Akhiri chat');
  assert.equal(customerText('common.sendTo', 'auto', 'id-ID', { name: 'Rina' }), 'Kirim ke Rina');
  assert.equal(customerText('chat.end', 'auto', 'fr-FR'), 'End chat');
  assert.equal(customerText('unknown.key', 'auto', 'id-ID'), 'unknown.key');
});

test('dropzone, upload failure and echo-source copy are localized and English is unchanged', () => {
  assert.equal(customerText('upload.dropzone', 'auto', 'en-US'), 'Drag file here for upload...');
  assert.equal(customerText('upload.fileFailed', 'auto', 'en-US'), 'File uploading failed');
  assert.equal(customerText('echo.whatsapp', 'auto', 'en-US'), 'This message was sent from the WhatsApp app.');
  assert.equal(customerText('echo.tiktok', 'auto', 'en-US'), 'This message was sent from the Tiktok app.');
  for (const key of ['upload.dropzone', 'upload.fileFailed', 'echo.whatsapp', 'echo.tiktok']) {
    assert.notEqual(customerText(key, 'auto', 'id-ID'), customerText(key, 'auto', 'en-US'), key);
  }
});

test('upload dropzone, upload failures and echo label no longer hard-code English', () => {
  const read = rel => fs.readFileSync(path.join(__dirname, '../src', rel), 'utf8');
  assert.doesNotMatch(read('components/FileDragDrop.vue'), /'Drag file here for upload\.\.\.'/);
  assert.match(read('components/FileDragDrop.vue'), /\$customerText\('upload\.dropzone'\)/);
  const uploader = read('lib/fileUploader.js');
  const uploadFileBody = uploader.slice(uploader.indexOf('export const uploadFile'), uploader.indexOf('export const uploadEmailAttachment'));
  assert.doesNotMatch(uploadFileBody, /toasted\.error\('File uploading failed'\)/);
  assert.match(uploadFileBody, /failedText/);
  assert.match(read('components/ChatWindow.vue'), /\$customerText\('upload\.fileFailed'\)/);
  const echo = read('components/CommentEchoSourceLabel.vue');
  assert.doesNotMatch(echo, /text: 'This message was sent from/);
  assert.match(echo, /\$customerText\('echo\.whatsapp'\)/);
  assert.match(echo, /\$customerText\('echo\.tiktok'\)/);
});
