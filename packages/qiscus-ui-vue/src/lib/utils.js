// iOS only raises the keyboard for a focus() made inside a user gesture. A
// programmatic focus (room load, reply) leaves the textarea focused with no
// keyboard, and tapping an already-focused field doesn't raise it either: the
// user had to tap away and tap again. On touch screens the tap does the focusing.
export function isTouchDevice() {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(hover: none) and (pointer: coarse)').matches;
}

// Same check the v5 blades use for body.is-ios, plus iPadOS in desktop mode
// (reports a Mac user agent but has a touch screen).
export function isIOS() {
  const ua = navigator.userAgent.toLowerCase();
  return /ipad|iphone|ipod/.test(ua)
    || (ua.includes('macintosh') && navigator.maxTouchPoints > 1);
}

export function focusMessageForm() {
  if (isTouchDevice()) return;
  const element = document.querySelector('.qcw-comment-form textarea');
  if(element) element.focus();
}

// Safety net for iOS only (callers gate it with isIOS(): the rect maths below is
// WebKit-on-iOS behaviour, other browsers measure rects against the layout
// viewport). Safari normally pans the page so the focused composer
// clears the keyboard, but on some first focuses it doesn't, and the composer
// stays under the keyboard until the user taps again. iOS reports client rects
// relative to the visible area (they shift with the pan), so the form is covered
// when its bottom is below visualViewport.height. The form sits at the bottom of
// the page, so pan until the page's bottom meets the keyboard, exactly where
// Safari pans when it does reveal it. Pan by that exact amount: with the keyboard
// up iOS lets the page scroll past its end, so scrollTo(scrollHeight) overshoots
// and leaves a blank gap above the keyboard.
export function revealMessageForm() {
  const vv = window.visualViewport;
  const form = document.querySelector('.qcw-comment-form');
  if (!vv || !form) return;
  if (form.getBoundingClientRect().bottom > vv.height + 1) {
    window.scrollBy(0, document.documentElement.getBoundingClientRect().bottom - vv.height);
  }
}

export function maintainScroll() {
  const element = document.querySelector(".qcw-comments");
  const comment = document.querySelector(".qcw-comments ul li:last-child .qcw-comment-container");
  if (Math.ceil(element.scrollTop + Number.parseInt(globalThis.getComputedStyle(element).height)) >= element.scrollHeight) {
    scrollIntoElement(comment.id)
    element.scrollTop = element.scrollHeight;
  }
}

// scrollIntoView() scrolls every scrollable ancestor, the page itself included.
// With the iOS keyboard up, Safari has scrolled the page so the composer sits
// above the keyboard; a scrollIntoView from a new message, the typing bubble or
// a sync scrolled the page back to pin the bubble to the bottom of the screen,
// leaving the composer under the keyboard until the next tap. Only the comment
// list (.qcw-comments) needs to move, so align the element's bottom with the
// list's bottom (block: 'end') by scrolling the list alone.
export function scrollListToElement(element) {
  if (!element || !element.getClientRects().length) return;
  const list = element.closest('.qcw-comments');
  if (!list) {
    element.scrollIntoView({ block: 'end' });
    return;
  }
  list.scrollTop += element.getBoundingClientRect().bottom - list.getBoundingClientRect().bottom;
}

export function scrollIntoLastElement(core) {
  if(core.selected.comments.length > 0) {
    const latestCommentId = core
      .selected.comments[core.selected.comments.length - 1].id;
    scrollListToElement(document.getElementById(latestCommentId));
  }
}
export function scrollIntoElement(elementId) {
  scrollListToElement(document.getElementById(elementId));
}
export function calculateSizeInMB(bytes) {
  if (bytes < 1000000) {
    return (bytes / 1000).toFixed(2) + ' KB';
  } else {
    return (bytes / 1000000).toFixed(2) + ' MB';
  }
}
export function debounce(fn, wait) {
  let timer;
  return function (...args) {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, wait);
  };
}

// QiscusCore's sortComments() (qiscus-sdk-core lib/index.js) sorts only by
// `unix_timestamp`, which has 1-second resolution. Messages landing in the
// same second (classic WA image+caption split: wa_hdr_ image + caption +
// immediate customer reply) get a `0` comparator and V8's stable sort keeps
// their API/insertion order — NOT the chronological one. That pushes the real
// first message (before_id === 0) off index 0, so the load-more button
// (gated on comments[0].before_id > 0) never hides and the oldest message
// fails to render at the top.
//
// Re-sort deterministically here: nanosecond timestamp first, then seconds,
// then id ascending as a last resort. `unix_nano_timestamp` can exceed 2^53
// so compare as-is (Number is fine for the diff sign); pending messages have
// a string id, so guard with Number(...) || 0 and rely on the timestamp keys.
export function sortCommentsChrono(comments) {
  return [...comments].sort((a, b) => {
    const an = Number(a.unix_nano_timestamp) || 0;
    const bn = Number(b.unix_nano_timestamp) || 0;
    if (an && bn && an !== bn) return an - bn;
    if (a.unix_timestamp !== b.unix_timestamp) {
      return (a.unix_timestamp || 0) - (b.unix_timestamp || 0);
    }
    return (Number(a.id) || 0) - (Number(b.id) || 0);
  });
}
