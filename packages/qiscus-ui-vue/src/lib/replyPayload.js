/**
 * Shared shape of a reply comment, so a reply that carries a file is wired
 * exactly like a reply that carries text.
 *
 * The rules here are not cosmetic — each one exists because a customer on some
 * channel stops seeing the quote (or sees raw markup) without it. They mirror
 * what Inbox V3 already sends (`chat.ts`, `sendFileMessage`), which is the
 * shape qismo-api and the SDK are known to round-trip.
 */

/**
 * The wire `message` of a reply carrying a file: the `[file]…[/file]` wrapper,
 * on every channel including WhatsApp.
 *
 * This used to send a BARE url on WhatsApp, on the belief that qismo-api sends
 * a reply's `message` to the customer verbatim so a wrapper would arrive as
 * literal markup. It does not. `extract_data/2` flattens `reply` → `text` and
 * then re-detects `[file]…[/file]`, promoting the message back to a
 * `file_attachment` (`qiscus_webhook.ex`), and `to_wa_message/4` sends it as
 * real media. A bare url skips that detection, so the customer received a text
 * link instead of the image — while the quote itself survived either way,
 * because `ger_reply_context/2` is applied to every WhatsApp payload, media
 * included, not only to text (`wa_client.ex`).
 *
 * Kept as a function rather than inlined so the wire shape of a file reply has
 * one definition shared by both upload paths.
 */
export const replyFileMessage = (_repliedComment, _fileUrl, fileWrapper) => fileWrapper;

/**
 * Channel-specific reply reference. qismo-api reads this out of `extras` and
 * turns it into the quote field of the outbound WhatsApp send. Without it the
 * reply still reaches the customer, but as a plain message with no quoted
 * bubble.
 *
 * WhatsApp only, deliberately: the Instagram and Facebook equivalents
 * (`business_reff_ig_id` / `business_reff_fb_id`) are introduced by the open
 * Instagram reply work and are not part of the contract on master yet. When
 * they land, this function is the one place that needs them.
 *
 * Returns a NEW object; never mutates the caller's extras.
 */
export const withChannelReplyRef = (extras, repliedComment) => {
  const uniqueId = repliedComment && repliedComment.unique_temp_id;
  if (!uniqueId || typeof uniqueId !== 'string') return extras;
  if (!uniqueId.toLowerCase().includes('wa_wamid')) return extras;

  return Object.assign({}, extras || {}, {
    business_reff_wa_id: uniqueId.replace('wa_', ''),
  });
};

/**
 * The `payload` of a reply comment.
 *
 * `text` is where the reply's OWN content lives, and for a file that means the
 * `[file]url[/file]` wrapper plus any caption. It has to be `payload.text` and
 * not `payload.caption`: the SDK persists only a whitelist of reply-payload
 * fields and silently drops `caption`, so a caption kept only there vanishes
 * from the sender's own bubble on reload. Both renderers already read
 * `payload.text` — the widget's `CommentReply.vue` decides between an image and
 * text from it, and the V3 mapper resolves the attachment url out of it.
 */
export const buildReplyPayload = (repliedComment, text, caption) => ({
  text: caption ? `${text} ${caption}` : text,
  caption: caption || '',
  replied_comment_id: repliedComment.id,
  replied_comment_message: repliedComment.message,
  replied_comment_payload: repliedComment.payload,
  replied_comment_sender_email: repliedComment.username_real,
  replied_comment_sender_username: repliedComment.username_as,
  replied_comment_type: repliedComment.type,
});
