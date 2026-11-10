<template lang="pug">
  //- Same markup/classes as CommentFlowResponse (WA Flow reply), so the bubble
  //- looks identical: header text, then the gray label | value card.
  div.qcw-flow-response.qcw-omniform-answer(data-omniform-answer)
    span(v-if="answer.formName") {{ answer.formName }}
    div.flow-response-container
      table.flow-response-detail
        tr(v-for="(field, index) in answer.fields" :key="'f' + index")
          td {{ field.label }}
          td {{ maskValues ? '********' : field.value }}
        tr(v-if="answer.attachments.length")
          td {{ attachmentsLabel }}
          td
            span(v-if="maskValues") ********
            template(v-else)
              div(v-for="(file, index) in answer.attachments" :key="'a' + index")
                a(v-if="file.url" :href="file.url" target="_blank" rel="noopener noreferrer") {{ file.name }}
                span(v-else) {{ file.name }}
</template>

<script>
/**
 * OmniForm answers posted into the room by qismo-api (see `parseOmniFormAnswer`
 * in ../lib/omniForm.js), rendered exactly like the WA Flow reply bubble: the
 * form name, then one `label | value` row per field in the order sent, then the
 * uploads as links. Values follow the same `maskFlowResponse` switch as WA Flow.
 * Every string is customer input and goes through text interpolation only
 * (never v-html); attachment links are https only.
 */
export default {
  name: 'CommentOmniFormAnswer',
  props: {
    answer: { type: Object, required: true },
    attachmentsLabel: { type: String, default: 'Attachments' },
    maskValues: { type: Boolean, default: false },
  },
};
</script>

<style lang="stylus">
// Card styling comes from CommentFlowResponse (.flow-response-*). Only the
// attachment link needs a rule: outrank the generic own-message link color
// (white) so it keeps the card's dark value color.
.qcw-comment .qcw-omniform-answer .flow-response-detail
  a
    color inherit
    text-decoration underline

// WA Flow keeps the question column on one line (nowrap), so a long question
// (e.g. a consent sentence) squeezes the answer to a few letters per line.
// Here each row is a wrapping flex line: a question that fits in 45% keeps the
// two-column look; a longer one takes the full width and the answer drops
// below it. Only OmniForm is affected; WA Flow keeps its own table.
.qcw-omniform-answer .flow-response-detail
  display block
  tbody
    display block
  tr
    display flex
    flex-wrap wrap
    align-items baseline
    row-gap 2px
    padding 12px 0
  td
    display block
    box-sizing border-box
    padding 0
  tr td:first-child
    flex 0 1 auto
    min-width 45%
    max-width 100%
    padding-right 12px
    white-space normal
    overflow-wrap anywhere
  tr td:last-child
    flex 1 1 55%
    width auto
    min-width 0
    word-break normal
    overflow-wrap anywhere
</style>
