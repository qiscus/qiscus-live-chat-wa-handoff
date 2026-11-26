<template lang="pug">
  //- Native form message (extras.sub_type "form"): header / body / footer, then
  //- one call-to-action that opens the form sheet. Text interpolation only.
  div.qcw-native-form(data-native-form :data-native-form-status="status || 'open'")
    div.qcw-comment__content
      div.qcw-native-form__header(v-if="form.header") {{ form.header }}
      div.qcw-native-form__body(v-if="bodyText") {{ bodyText }}
      div.qcw-native-form__footer(v-if="form.footer") {{ form.footer }}
    button.qcw-native-form__cta(
      type="button"
      data-native-form-open
      :disabled="!canOpen"
      :aria-disabled="canOpen ? 'false' : 'true'"
      :aria-haspopup="canOpen ? 'dialog' : null"
      :style="ctaStyle"
      @click="open")
      icon(name="ic-note" class="svg-fill")
      span {{ ctaText }}
</template>

<script>
import Icon from './Icon';
import { nativeFormLabel } from '../lib/nativeForm';

/**
 * The bubble of a native form message (see ../lib/nativeForm.js). The form is
 * one-shot: once answered (an answer for this message is in the room, or the
 * visitor just sent one) the button is disabled and reads "Submitted".
 */
export default {
  name: 'CommentNativeForm',
  components: { Icon },
  props: {
    /** Normalized form (`parseNativeForm`). */
    form: { type: Object, required: true },
    /** The comment `message`, shown when the form has no `body`. */
    fallbackText: { type: String, default: '' },
    /** null (open), 'sending' or 'answered'. */
    status: { type: String, default: null },
    /** The visitor's own message (never expected for a bot form): read-only. */
    readOnly: { type: Boolean, default: false },
    labels: { type: Object, default: () => ({}) },
    brandColor: { type: String, default: '' },
  },
  computed: {
    bodyText() {
      return this.form.body || this.fallbackText;
    },
    canOpen() {
      return !this.status && !this.readOnly;
    },
    ctaText() {
      if (this.status === 'answered') return this.label('submitted');
      if (this.status === 'sending') return this.label('submitting');
      return this.form.button || this.label('open');
    },
    ctaStyle() {
      return this.canOpen && this.brandColor ? { color: this.brandColor } : {};
    },
  },
  methods: {
    label(key, params) {
      return nativeFormLabel(this.labels, key, params);
    },
    open(event) {
      if (!this.canOpen) return;
      this.$emit('open', event && event.currentTarget ? event.currentTarget : null);
    },
  },
};
</script>

<style lang="stylus">
.qcw-native-form
  width 100%
  .qcw-native-form__header
    font-weight 600
    margin-bottom 4px
    white-space pre-wrap
    overflow-wrap anywhere
  .qcw-native-form__body
    white-space pre-wrap
    overflow-wrap anywhere
  .qcw-native-form__footer
    margin-top 8px
    font-size 12px
    opacity .7
    white-space pre-wrap
    overflow-wrap anywhere

// Same CTA bar as the WA Flow request bubble (CommentFlowInteractive).
.qcw-native-form__cta
  display flex
  align-items center
  justify-content center
  gap 8px
  width calc(100% + 2px)
  margin 0 -1px -1px
  padding 12px
  border 0
  border-top 1px solid #ECECEC
  border-radius 0
  background white
  color #565656
  font-family inherit
  font-size 14px
  font-weight 600
  line-height 20px
  cursor pointer
  &:hover:not(:disabled)
    background #f3f5f7
  &:focus-visible
    outline 2px solid #01416c
    outline-offset -2px
  &:disabled
    color #a0a0a0
    cursor default
  .qc-icon
    margin 0 !important
    flex-shrink 0
  span
    min-width 0
    overflow hidden
    white-space nowrap
    text-overflow ellipsis
</style>
