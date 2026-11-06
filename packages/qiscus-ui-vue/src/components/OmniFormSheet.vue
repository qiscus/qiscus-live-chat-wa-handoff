<template lang="pug">
  div.qcw-omniform(v-if="url" data-omniform-sheet @keydown.esc="emitClose")
    div.qcw-omniform__overlay(@click="emitClose")
    div.qcw-omniform__sheet(
      ref="sheet"
      role="dialog"
      aria-modal="true"
      :aria-label="label('title')"
      tabindex="-1")
      div.qcw-omniform__header
        span.qcw-omniform__title {{ label('title') }}
        button.qcw-omniform__close(
          type="button"
          ref="closeButton"
          :aria-label="label('close')"
          data-omniform-close
          @click="emitClose")
          svg(viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor"
            stroke-width="1.75" stroke-linecap="round" aria-hidden="true")
            path(d="M5 5l10 10M15 5L5 15")
      p.qcw-omniform__sr(role="status" aria-live="polite") {{ announcement }}

      div.qcw-omniform__failed(v-if="phase === 'failed'" role="alert")
        p.qcw-omniform__failed-title {{ label('failed') }}
        p.qcw-omniform__failed-text(data-omniform-failure) {{ failureText }}
        details.qcw-omniform__details(data-omniform-failure-detail)
          summary {{ label('details') }}
          code(v-text="failureDetail")
        //- A link that is not a URL is not offered in a new tab either.
        button.qcw-omniform__new-tab(
          v-if="failure && failure.reason !== 'invalid_url'"
          type="button"
          :style="{ background: brandColor }"
          data-omniform-new-tab
          @click="openInNewTab") {{ label('openInNewTab') }}

      div.qcw-omniform__body(v-else)
        div.qcw-omniform__loading(v-if="phase === 'loading'" data-omniform-loading)
          span.qcw-omniform__spinner(aria-hidden="true")
          span {{ label('loading') }}
        iframe.qcw-omniform__frame(
          ref="frame"
          :src="frameSrc || false"
          :title="label('title')"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          referrerpolicy="no-referrer"
          :style="{ height: frameHeight + 'px' }"
          @load="onFrameLoad"
          @error="onFrameError")
</template>

<script>
import { embedEventFrom, omniFormLabel } from '../lib/omniForm';

/**
 * Bottom sheet framing an OmniForm `embed_url` (`<form origin>/e/<token>`)
 * over the chat, per the OmniForm team's embed contract (addon-omniform-fe
 * `docs/embed-customer-view.md`). Ported from the v5 widget in
 * omnichannel-fe-monorepo (`apps/widget/src/components/OmniFormSheet.vue`).
 *
 * - The form has no close button: the sheet's own button, the overlay, Escape
 *   (outside the frame) and `omniform:close` close it.
 * - Events are believed only from the embed origin AND this iframe's window;
 *   the listener is in place before the frame gets its `src`.
 * - `omniform:resize` sizes the frame, capped to what the sheet can show.
 * - `omniform:submitted` does NOT close: the form's thank-you screen is
 *   showing; its auto close (if on) arrives later as `omniform:close`.
 * - Nothing is ever posted into the frame, and no answer passes through here:
 *   qismo-api posts them into the room.
 * - No `ready` in time (blocked frame, CSP, network): the frame is dropped and
 *   the visitor can open the same link in a new tab instead, with a copyable
 *   line for support (reason, form origin, time waited), also written once to
 *   the console. Never the URL: it holds the link token (a bearer secret).
 *
 * Failure reasons, as far as a cross-origin frame lets the widget know:
 * `ready_timeout` (frame never even finished loading), `loaded_without_ready`
 * (it loaded but never said ready: the usual sign of a form site that does not
 * allow this widget's origin), `frame_error`, `invalid_url`.
 */

/** Without `ready` by then, the frame is treated as not loading. */
const READY_TIMEOUT_MS = 15000;
/** The contract's suggested height until the page reports its own. */
const DEFAULT_FRAME_HEIGHT = 560;
/** Room the sheet keeps above the frame: its header and the gap to the panel's top. */
const SHEET_CHROME_PX = 64;
const MIN_FRAME_HEIGHT = 160;

const REASON_LABEL = {
  ready_timeout: 'failedTimeout',
  loaded_without_ready: 'failedNoReady',
  frame_error: 'failedFrameError',
  invalid_url: 'failedInvalidUrl',
};

export default {
  name: 'OmniFormSheet',
  props: {
    /** An allowed embed URL (see `omniFormEmbedUrl`); null = closed. */
    url: { type: String, default: null },
    /** Where focus goes back when the sheet closes (the link that opened it). */
    returnFocusTo: { default: null },
    labels: { type: Object, default: () => ({}) },
    brandColor: { type: String, default: '#27B199' },
  },
  data() {
    return {
      frameSrc: '',
      phase: 'loading',
      frameHeight: DEFAULT_FRAME_HEIGHT,
      linkState: null,
      submitted: false,
      failure: null,
    };
  },
  computed: {
    failureText() {
      if (!this.failure) return '';
      return this.label(REASON_LABEL[this.failure.reason], {
        seconds: Math.round(READY_TIMEOUT_MS / 1000),
      });
    },
    /** One copyable line for support; the same fields as the console line. */
    failureDetail() {
      const f = this.failure;
      return f ? `reason=${f.reason} origin=${f.origin || '-'} waited_ms=${f.waitedMs}` : '';
    },
    announcement() {
      if (this.linkState === 'expired') return this.label('expired');
      if (this.linkState === 'submitted') return this.label('alreadySubmitted');
      if (this.linkState === 'unavailable') return this.label('unavailable');
      return this.submitted ? this.label('submitted') : '';
    },
  },
  watch: {
    url: {
      immediate: true,
      handler(url, previous) {
        this.stop();
        if (url) {
          this.open(url);
        } else if (previous) {
          this.restoreFocus();
        }
      },
    },
  },
  // beforeCreate, not created: the immediate `url` watcher runs before
  // `created` and its open() sets these; `created` would overwrite them.
  beforeCreate() {
    this.stopFn = () => {};
    this.onFrameLoadFn = () => {};
    this.onFrameErrorFn = () => {};
  },
  beforeDestroy() {
    this.stop();
  },
  methods: {
    label(key, params) {
      return omniFormLabel(this.labels, key, params);
    },
    stop() {
      if (this.stopFn) this.stopFn();
      this.stopFn = () => {};
    },
    emitClose() {
      this.$emit('close');
    },
    onFrameLoad() {
      this.onFrameLoadFn();
    },
    onFrameError() {
      this.onFrameErrorFn();
    },
    /** The tallest frame the sheet can show in the chat panel. */
    maxFrameHeight() {
      const host = this.$el && this.$el.clientHeight ? this.$el.clientHeight : window.innerHeight;
      return Math.max(MIN_FRAME_HEIGHT, Math.floor(host - SHEET_CHROME_PX));
    },
    capHeight(height) {
      return Math.min(Math.ceil(height), this.maxFrameHeight());
    },
    /** Shows the fallback once, and leaves one token-free line for whoever investigates. */
    fail(reason, origin, openedAt) {
      if (this.phase === 'failed') return;
      const waitedMs = Math.max(0, Date.now() - openedAt);
      this.failure = { reason, origin, waitedMs };
      this.phase = 'failed';
      // eslint-disable-next-line no-console
      console.warn('[live chat] OmniForm did not load', { reason, origin, waitedMs });
    },
    open(url) {
      const openedAt = Date.now();
      this.failure = null;
      this.phase = 'loading';
      this.submitted = false;
      this.linkState = null;
      let origin;
      try {
        origin = new URL(url).origin;
      } catch (e) {
        this.fail('invalid_url', null, openedAt);
        return;
      }
      this.frameHeight = DEFAULT_FRAME_HEIGHT;
      let frameLoaded = false;
      let timer = 0;

      const onMessage = (event) => {
        const frame = this.$refs.frame;
        const message = embedEventFrom(event, origin, frame ? frame.contentWindow : null);
        if (!message) return;
        switch (message.type) {
          case 'omniform:ready':
            window.clearTimeout(timer);
            if (this.phase === 'loading') this.phase = 'ready';
            break;
          case 'omniform:resize':
            this.frameHeight = this.capHeight(message.height);
            break;
          case 'omniform:submitted':
            this.submitted = true;
            this.$emit('submitted');
            break;
          case 'omniform:state':
            this.linkState = message.state;
            break;
          case 'omniform:close':
            this.emitClose();
            break;
          default:
            break;
        }
      };
      // Listener first: `ready` must not arrive before anyone is listening.
      window.addEventListener('message', onMessage);
      timer = window.setTimeout(() => {
        if (this.phase !== 'loading') return;
        this.frameSrc = '';
        this.fail(frameLoaded ? 'loaded_without_ready' : 'ready_timeout', origin, openedAt);
      }, READY_TIMEOUT_MS);
      this.onFrameLoadFn = () => {
        // Only the form page's own load counts, not a frame without its src yet.
        if (this.frameSrc) frameLoaded = true;
      };
      this.onFrameErrorFn = () => {
        if (this.phase !== 'loading' || !this.frameSrc) return;
        window.clearTimeout(timer);
        this.frameSrc = '';
        this.fail('frame_error', origin, openedAt);
      };
      this.frameSrc = url;
      this.stopFn = () => {
        window.removeEventListener('message', onMessage);
        window.clearTimeout(timer);
        this.onFrameLoadFn = () => {};
        this.onFrameErrorFn = () => {};
        this.frameSrc = '';
      };
      this.$nextTick(() => {
        this.frameHeight = this.capHeight(this.frameHeight);
        const button = this.$refs.closeButton;
        if (button && button.focus) button.focus();
      });
    },
    /** The same link, outside the frame: its own tab, no opener, no referrer. */
    openInNewTab() {
      if (this.url) window.open(this.url, '_blank', 'noopener,noreferrer');
      this.emitClose();
    },
    /** Focus goes back to the link that opened the sheet, if it is still there. */
    restoreFocus() {
      const target = this.returnFocusTo;
      if (target && target.isConnected && target.focus) target.focus({ preventScroll: true });
    },
  },
};
</script>

<style lang="stylus">
.qcw-omniform
  position absolute
  top 0
  left 0
  right 0
  bottom 0
  z-index 20
  display flex
  flex-direction column
  justify-content flex-end

.qcw-omniform__overlay
  position absolute
  top 0
  left 0
  right 0
  bottom 0
  background rgba(10, 10, 10, .4)

.qcw-omniform__sheet
  position relative
  width 100%
  max-height calc(100% - 8px)
  display flex
  flex-direction column
  overflow hidden
  background #fff
  border-radius 12px 12px 0 0
  box-shadow 0 -4px 16px rgba(0, 0, 0, .12)
  outline none
  animation qcwOmniformUp .2s ease-out

.qcw-omniform__header
  flex-shrink 0
  display flex
  align-items center
  justify-content space-between
  padding 8px 8px 8px 16px
  border-bottom 1px solid #ececec

.qcw-omniform__title
  font-size 14px
  font-weight 600
  line-height 20px
  color #0a0a0a
  overflow hidden
  text-overflow ellipsis
  white-space nowrap

.qcw-omniform__close
  flex-shrink 0
  display flex
  align-items center
  justify-content center
  width 36px
  height 36px
  padding 0
  border 0
  border-radius 50%
  background transparent
  color #565656
  cursor pointer
  &:hover
    background #f3f5f7
  &:focus-visible
    outline 2px solid #01416c

.qcw-omniform__sr
  position absolute
  width 1px
  height 1px
  margin -1px
  padding 0
  overflow hidden
  clip rect(0, 0, 0, 0)
  white-space nowrap
  border 0

.qcw-omniform__body
  position relative
  min-height 0
  overflow-x auto
  overflow-y hidden
  padding-bottom env(safe-area-inset-bottom)

.qcw-omniform__frame
  display block
  width 100%
  border 0

.qcw-omniform__loading
  position absolute
  top 0
  left 0
  right 0
  bottom 0
  display flex
  align-items center
  justify-content center
  gap 8px
  font-size 13px
  color #565656
  background #fff

.qcw-omniform__spinner
  width 16px
  height 16px
  border 2px solid #ececec
  border-top-color #565656
  border-radius 50%
  animation qcwOmniformSpin .8s linear infinite

.qcw-omniform__failed
  display flex
  flex-direction column
  align-items center
  padding 24px 16px
  text-align center
  p
    margin 0 0 8px
    font-size 13px
    line-height 18px
    color #565656
  .qcw-omniform__failed-title
    font-weight 600
    color #0a0a0a

.qcw-omniform__details
  width 100%
  margin-bottom 12px
  font-size 12px
  color #565656
  summary
    cursor pointer
  code
    display block
    margin-top 8px
    padding 4px 8px
    border-radius 4px
    background #f3f5f7
    text-align left
    word-break break-all
    user-select all

.qcw-omniform__new-tab
  height 40px
  padding 0 20px
  border 0
  border-radius 20px
  font-size 13px
  font-weight 600
  color #fff
  cursor pointer
  &:hover
    filter brightness(.95)

@keyframes qcwOmniformUp
  from
    transform translateY(24px)
    opacity 0
  to
    transform translateY(0)
    opacity 1

@keyframes qcwOmniformSpin
  to
    transform rotate(360deg)
</style>
