// An agent attachment reaches the SDK as a PLAIN TEXT comment that wraps the
// file url in a `[file]…[/file]` tag. When the agent adds a caption it trails
// the closing tag — `[file]https://…/photo.png[/file] my caption` — the wire
// format every Qiscus front end sends (legacy inbox, MCF inbox-v2 and the v3
// monorepo alike), because `post_comment` refuses a `file_attachment` type for
// a url it does not host itself.
//
// `qiscus-sdk-core`'s `Comment#getAttachmentURI` predates that caption: it
// assumes the message ENDS with the closing tag and slices `substring(6, len - 7)`.
// A captioned message therefore yields the url plus `[/file]` plus all but the
// last seven characters of the caption — an unloadable src that falls back to
// the broken-image placeholder, with the caption itself never rendered.
//
// Parse the tag by its actual delimiters instead, and hand the trailing text
// back as the caption so a captioned attachment renders like any other.
const FILE_TAG_PATTERN = /\[file\]([\s\S]*?)\[\/file\]([\s\S]*)/i;

export function parseAttachmentTag(message) {
  if (typeof message !== 'string') return null;
  const matched = message.match(FILE_TAG_PATTERN);
  if (!matched) return null;
  return { url: matched[1].trim(), caption: matched[2].trim() };
}

// Empty string (not undefined) when there is no tag, so callers can keep their
// own fallback with a plain `||`.
export function attachmentUrl(message) {
  const parsed = parseAttachmentTag(message);
  return parsed ? parsed.url : '';
}

export function attachmentCaption(message) {
  const parsed = parseAttachmentTag(message);
  return parsed ? parsed.caption : '';
}
