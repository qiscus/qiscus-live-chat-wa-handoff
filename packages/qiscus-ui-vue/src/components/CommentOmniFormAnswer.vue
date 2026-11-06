<template lang="pug">
  div.qcw-omniform-answer(data-omniform-answer)
    div.qcw-omniform-answer__title(v-if="answer.formName") {{ answer.formName }}
    table.qcw-omniform-answer__table
      tr(v-for="(field, index) in answer.fields" :key="'f' + index")
        td.qcw-omniform-answer__label {{ field.label }}
        td.qcw-omniform-answer__value {{ field.value }}
      tr(v-if="answer.attachments.length")
        td.qcw-omniform-answer__label {{ attachmentsLabel }}
        td.qcw-omniform-answer__value
          div(v-for="(file, index) in answer.attachments" :key="'a' + index")
            a(v-if="file.url" :href="file.url" target="_blank" rel="noopener noreferrer") {{ file.name }}
            span(v-else) {{ file.name }}
</template>

<script>
/**
 * OmniForm answers posted into the room by qismo-api (see `parseOmniFormAnswer`
 * in ../lib/omniForm.js): the form name, then one `label | value` row per field
 * in the order sent, then the uploads as links. Every string is customer input
 * and goes through text interpolation only (never v-html); attachment links are
 * https only.
 */
export default {
  name: 'CommentOmniFormAnswer',
  props: {
    answer: { type: Object, required: true },
    attachmentsLabel: { type: String, default: 'Attachments' },
  },
};
</script>

<style lang="stylus">
.qcw-omniform-answer
  min-width 180px
  max-width 100%

.qcw-omniform-answer__title
  font-weight 600
  margin-bottom 6px
  word-break break-word

.qcw-omniform-answer__table
  width 100%
  border-collapse collapse
  td
    padding 4px 0
    vertical-align top
    font-size 13px
    line-height 18px
    border-top 1px solid rgba(0, 0, 0, .08)
    word-break break-word
    white-space pre-wrap
  tr:first-child td
    border-top 0

.qcw-omniform-answer__label
  width 40%
  padding-right 8px !important
  opacity .75

.qcw-omniform-answer__value
  a
    color inherit
    text-decoration underline
</style>
