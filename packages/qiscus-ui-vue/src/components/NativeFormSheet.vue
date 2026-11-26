<template lang="pug">
  //- Shell (overlay, sheet, header, close) reuses the OmniForm sheet classes
  //- so both sheets look the same; the form body has its own classes.
  div.qcw-omniform.qcw-native-form-sheet(v-if="form" data-native-form-sheet @keydown.esc="emitClose")
    div.qcw-omniform__overlay(@click="emitClose")
    div.qcw-omniform__sheet(
      ref="sheet"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="uid + '-title'"
      tabindex="-1")
      div.qcw-omniform__header
        span.qcw-omniform__title(:id="uid + '-title'") {{ title }}
        button.qcw-omniform__close(
          type="button"
          ref="closeButton"
          :aria-label="label('close')"
          data-native-form-close
          @click="emitClose")
          svg(viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor"
            stroke-width="1.75" stroke-linecap="round" aria-hidden="true")
            path(d="M5 5l10 10M15 5L5 15")
      p.qcw-omniform__sr(role="status" aria-live="polite") {{ announcement }}

      form.qcw-nf(novalidate data-native-form-body @submit.prevent="submit")
        div.qcw-nf__body
          div.qcw-nf__field(
            v-for="field in form.fields"
            :key="field.name"
            :class="{ 'qcw-nf__field--error': !!shownError(field) }"
            :data-field="field.name")

            //- Opt-in: one checkbox whose label is the question.
            template(v-if="field.type === 'opt_in'")
              label.qcw-nf__choice
                input(
                  type="checkbox"
                  :id="inputId(field)"
                  :ref="'input-' + field.name"
                  :checked="values[field.name] === true"
                  :aria-invalid="shownError(field) ? 'true' : 'false'"
                  :aria-required="field.required ? 'true' : 'false'"
                  :aria-describedby="describedBy(field)"
                  :disabled="sending"
                  @change="setValue(field, $event.target.checked)")
                span.qcw-nf__choice-text
                  | {{ field.label }}
                  span.qcw-nf__required(v-if="field.required" aria-hidden="true")  *

            //- Radio / checkbox groups.
            fieldset.qcw-nf__group(
              v-else-if="field.type === 'radio' || field.type === 'checkbox'"
              :aria-describedby="describedBy(field)"
              :aria-invalid="shownError(field) ? 'true' : 'false'")
              legend.qcw-nf__label
                | {{ field.label }}
                span.qcw-nf__required(v-if="field.required || field.minSelected" aria-hidden="true")  *
              label.qcw-nf__choice(v-for="(option, index) in field.options" :key="option.id")
                input(
                  v-if="field.type === 'radio'"
                  type="radio"
                  :name="uid + '-' + field.name"
                  :ref="index === 0 ? 'input-' + field.name : null"
                  :value="option.id"
                  :checked="values[field.name] === option.id"
                  :aria-required="field.required ? 'true' : 'false'"
                  :disabled="sending"
                  @change="setValue(field, option.id)")
                input(
                  v-else
                  type="checkbox"
                  :ref="index === 0 ? 'input-' + field.name : null"
                  :value="option.id"
                  :checked="values[field.name].indexOf(option.id) !== -1"
                  :disabled="sending"
                  @change="toggleOption(field, option.id, $event.target.checked)")
                span.qcw-nf__choice-text {{ option.title }}

            //- Single inputs with a visible label.
            template(v-else)
              label.qcw-nf__label(:for="inputId(field)")
                | {{ field.label }}
                span.qcw-nf__required(v-if="field.required" aria-hidden="true")  *
              input.qcw-nf__input(
                v-if="field.type === 'text_input'"
                :id="inputId(field)"
                :ref="'input-' + field.name"
                :type="htmlInputType(field)"
                :inputmode="inputMode(field)"
                :autocomplete="autocomplete(field)"
                :placeholder="field.placeholder || null"
                :maxlength="field.maxChars"
                :value="values[field.name]"
                :aria-invalid="shownError(field) ? 'true' : 'false'"
                :aria-required="field.required ? 'true' : 'false'"
                :aria-describedby="describedBy(field)"
                :disabled="sending"
                @input="setValue(field, $event.target.value)"
                @blur="touch(field)")
              textarea.qcw-nf__input.qcw-nf__textarea(
                v-else-if="field.type === 'text_area'"
                :id="inputId(field)"
                :ref="'input-' + field.name"
                rows="3"
                :placeholder="field.placeholder || null"
                :maxlength="field.maxChars"
                :value="values[field.name]"
                :aria-invalid="shownError(field) ? 'true' : 'false'"
                :aria-required="field.required ? 'true' : 'false'"
                :aria-describedby="describedBy(field)"
                :disabled="sending"
                @input="setValue(field, $event.target.value)"
                @blur="touch(field)")
              select.qcw-nf__input.qcw-nf__select(
                v-else-if="field.type === 'dropdown'"
                :id="inputId(field)"
                :ref="'input-' + field.name"
                :aria-invalid="shownError(field) ? 'true' : 'false'"
                :aria-required="field.required ? 'true' : 'false'"
                :aria-describedby="describedBy(field)"
                :disabled="sending"
                @change="setValue(field, $event.target.value)"
                @blur="touch(field)")
                option(value="" :selected="!values[field.name]") {{ field.placeholder || label('selectPlaceholder') }}
                option(
                  v-for="option in field.options"
                  :key="option.id"
                  :value="option.id"
                  :selected="values[field.name] === option.id") {{ option.title }}
              input.qcw-nf__input(
                v-else-if="field.type === 'date'"
                type="date"
                :id="inputId(field)"
                :ref="'input-' + field.name"
                :min="field.minDate || null"
                :max="field.maxDate || null"
                :value="values[field.name]"
                :aria-invalid="shownError(field) ? 'true' : 'false'"
                :aria-required="field.required ? 'true' : 'false'"
                :aria-describedby="describedBy(field)"
                :disabled="sending"
                @input="setValue(field, $event.target.value)"
                @change="setValue(field, $event.target.value)"
                @blur="touch(field)")

            div.qcw-nf__meta(v-if="field.helperText || field.type === 'text_area'")
              p.qcw-nf__helper(v-if="field.helperText" :id="inputId(field) + '-help'") {{ field.helperText }}
              p.qcw-nf__counter(v-if="field.type === 'text_area'" aria-hidden="true")
                | {{ label('charCounter', { count: count(values[field.name]), max: field.maxChars }) }}
            p.qcw-nf__error(
              v-if="shownError(field)"
              :id="inputId(field) + '-error'"
              data-native-form-error) {{ errorText(field) }}

        div.qcw-nf__footer
          p.qcw-nf__submit-error(v-if="failed" role="alert" data-native-form-submit-error) {{ label('submitFailed') }}
          button.qcw-nf__submit(
            type="submit"
            data-native-form-submit
            :disabled="sending"
            :aria-busy="sending ? 'true' : 'false'"
            :style="submitStyle")
            span.qcw-omniform__spinner.qcw-nf__spinner(v-if="sending" aria-hidden="true")
            span {{ submitText }}
</template>

<script>
import {
  charCount,
  initialValues,
  nativeFormLabel,
  validateField,
  validateForm,
} from '../lib/nativeForm';

/**
 * Bottom sheet with a native form (see ../lib/nativeForm.js) over the chat.
 * Same shell, look and keyboard behaviour as the OmniForm sheet (overlay,
 * header with close button, Escape, focus back to the opener) but the fields
 * are rendered here, with native inputs, instead of in an iframe.
 *
 * - Errors show for a field once it was left (blur) or after a submit attempt.
 * - `send(values)` (a Promise) posts the answer; while it runs the form is
 *   locked (no double submit). On failure an error with a retry button shows;
 *   on success the sheet emits `submitted` and the parent closes it.
 * - `close` carries the current values so the parent can keep a draft.
 */
export default {
  name: 'NativeFormSheet',
  props: {
    /** Normalized form (`parseNativeForm`); null = closed. */
    form: { type: Object, default: null },
    /** Values to start from (a draft kept by the parent). */
    draft: { type: Object, default: null },
    /** `(values) => Promise`: posts the answer. */
    send: { type: Function, default: null },
    returnFocusTo: { default: null },
    labels: { type: Object, default: () => ({}) },
    brandColor: { type: String, default: '#27B199' },
  },
  data() {
    return {
      values: {},
      touched: {},
      attempted: false,
      sending: false,
      failed: false,
      announcement: '',
    };
  },
  computed: {
    uid() {
      // eslint-disable-next-line no-underscore-dangle
      return `qcw-nf-${this._uid}`;
    },
    title() {
      return (this.form && this.form.title) || this.label('title');
    },
    submitText() {
      if (this.sending) return this.label('submitting');
      if (this.failed) return this.label('retry');
      return (this.form && this.form.submitLabel) || this.label('submit');
    },
    submitStyle() {
      return this.brandColor ? { background: this.brandColor } : {};
    },
  },
  watch: {
    form: {
      immediate: true,
      handler(form, previous) {
        if (form) {
          this.reset(form);
          this.$nextTick(() => {
            const button = this.$refs.closeButton;
            if (button && button.focus) button.focus();
          });
        } else if (previous) {
          this.restoreFocus();
        }
      },
    },
  },
  methods: {
    label(key, params) {
      return nativeFormLabel(this.labels, key, params);
    },
    reset(form) {
      const values = initialValues(form);
      const draft = this.draft || {};
      form.fields.forEach((field) => {
        const saved = draft[field.name];
        if (field.type === 'checkbox' ? Array.isArray(saved) : typeof saved === typeof values[field.name]) {
          values[field.name] = field.type === 'checkbox' ? saved.slice() : saved;
        }
      });
      this.values = values;
      this.touched = {};
      this.attempted = false;
      this.sending = false;
      this.failed = false;
      this.announcement = '';
    },
    inputId(field) {
      return `${this.uid}-${field.name}`;
    },
    describedBy(field) {
      const ids = [];
      if (field.helperText) ids.push(`${this.inputId(field)}-help`);
      if (this.shownError(field)) ids.push(`${this.inputId(field)}-error`);
      return ids.length ? ids.join(' ') : null;
    },
    htmlInputType(field) {
      if (field.inputType === 'email') return 'email';
      if (field.inputType === 'phone') return 'tel';
      return 'text';
    },
    inputMode(field) {
      if (field.inputType === 'number') return 'decimal';
      if (field.inputType === 'phone') return 'tel';
      if (field.inputType === 'email') return 'email';
      return null;
    },
    autocomplete(field) {
      if (field.inputType === 'email') return 'email';
      if (field.inputType === 'phone') return 'tel';
      return 'off';
    },
    count(value) {
      return charCount(value || '');
    },
    setValue(field, value) {
      this.$set(this.values, field.name, value);
      this.failed = false;
      // Choices count as visited as soon as one is picked.
      if (field.type !== 'text_input' && field.type !== 'text_area') this.touch(field);
    },
    toggleOption(field, id, checked) {
      const current = (this.values[field.name] || []).filter(x => x !== id);
      if (checked) current.push(id);
      this.setValue(field, current);
    },
    touch(field) {
      this.$set(this.touched, field.name, true);
    },
    shownError(field) {
      if (!this.attempted && !this.touched[field.name]) return null;
      return validateField(field, this.values[field.name]);
    },
    errorText(field) {
      const error = this.shownError(field);
      return error ? this.label(error.key, error.params) : '';
    },
    emitClose() {
      this.$emit('close', Object.assign({}, this.values));
    },
    focusField(name) {
      const ref = this.$refs[`input-${name}`];
      const el = Array.isArray(ref) ? ref[0] : ref;
      if (el && el.focus) el.focus();
    },
    submit() {
      if (!this.form || this.sending) return undefined;
      this.attempted = true;
      const result = validateForm(this.form, this.values);
      if (!result.valid) {
        this.announcement = this.label('fixErrors');
        const first = this.form.fields.filter(f => result.errors[f.name])[0];
        if (first) this.$nextTick(() => this.focusField(first.name));
        return undefined;
      }
      if (!this.send) return undefined;
      this.sending = true;
      this.failed = false;
      this.announcement = this.label('submitting');
      const values = Object.assign({}, this.values);
      const form = this.form;
      return Promise.resolve()
        .then(() => this.send(values))
        .then(() => {
          // Closed (or another form opened) meanwhile: the parent already knows.
          if (this.form !== form) return;
          this.sending = false;
          this.announcement = this.label('submitted');
          this.$emit('submitted');
        }, () => {
          if (this.form !== form) return;
          this.sending = false;
          this.failed = true;
          this.announcement = this.label('submitFailed');
        });
    },
    /** Focus goes back to the button that opened the sheet, if it is still there. */
    restoreFocus() {
      const target = this.returnFocusTo;
      if (target && target.isConnected && target.focus) target.focus({ preventScroll: true });
    },
  },
};
</script>

<style lang="stylus">
// Shell styles (overlay, sheet, header, close, spinner) come from
// OmniFormSheet (.qcw-omniform*). Only the form itself is styled here.
.qcw-native-form-sheet .qcw-nf
  display flex
  flex-direction column
  min-height 0
  flex 1 1 auto
  margin 0

.qcw-nf__body
  flex 1 1 auto
  min-height 0
  overflow-y auto
  -webkit-overflow-scrolling touch
  padding 16px

.qcw-nf__field
  margin-bottom 16px
  &:last-child
    margin-bottom 0

.qcw-nf__label
  display block
  margin 0 0 6px
  padding 0
  font-size 13px
  font-weight 600
  line-height 18px
  color #0a0a0a
  overflow-wrap anywhere

.qcw-nf__required
  color #d32f2f

.qcw-nf__group
  margin 0
  padding 0
  border 0
  min-width 0

.qcw-nf__input
  display block
  box-sizing border-box
  width 100%
  min-height 40px
  padding 8px 12px
  border 1px solid #d4d4d4
  border-radius 8px
  background #fff
  color #0a0a0a
  font-family inherit
  font-size 14px
  line-height 20px
  &:focus
    outline none
    border-color #01416c
    box-shadow 0 0 0 1px #01416c
  &:disabled
    background #f3f5f7

.qcw-nf__textarea
  resize vertical
  min-height 72px

.qcw-nf__choice
  display flex
  align-items flex-start
  gap 8px
  padding 6px 0
  font-size 14px
  line-height 20px
  color #0a0a0a
  cursor pointer
  input
    flex-shrink 0
    width 16px
    height 16px
    margin 2px 0 0
  .qcw-nf__choice-text
    min-width 0
    overflow-wrap anywhere

.qcw-nf__field--error
  .qcw-nf__input
    border-color #d32f2f

.qcw-nf__meta
  display flex
  justify-content space-between
  gap 8px
  margin-top 4px

.qcw-nf__helper,
.qcw-nf__counter
  margin 0
  font-size 12px
  line-height 16px
  color #565656
  overflow-wrap anywhere

.qcw-nf__counter
  margin-left auto
  flex-shrink 0

.qcw-nf__error
  margin 4px 0 0
  font-size 12px
  line-height 16px
  color #d32f2f

.qcw-nf__footer
  flex-shrink 0
  padding 12px 16px
  padding-bottom calc(12px + env(safe-area-inset-bottom))
  border-top 1px solid #ececec
  background #fff

.qcw-nf__submit-error
  margin 0 0 8px
  font-size 13px
  line-height 18px
  color #d32f2f
  text-align center

.qcw-nf__submit
  display flex
  align-items center
  justify-content center
  gap 8px
  width 100%
  height 40px
  padding 0 20px
  border 0
  border-radius 20px
  font-family inherit
  font-size 14px
  font-weight 600
  color #fff
  cursor pointer
  &:hover:not(:disabled)
    filter brightness(.95)
  &:disabled
    opacity .7
    cursor default
  &:focus-visible
    outline 2px solid #01416c
    outline-offset 2px

.qcw-nf__spinner
  border-color rgba(255, 255, 255, .4)
  border-top-color #fff
</style>
