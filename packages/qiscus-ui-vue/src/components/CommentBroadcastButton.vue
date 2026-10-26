<template lang="pug">
  div(style="width: 100%;")
   comment-render(:text="comment.extras.body")
   div(class="qcw-comment__buttons_bc" v-if="comment.extras.buttons && typeof comment.extras.buttons === 'object'")
    div(class="action_buttons_bc" v-for="button in comment.extras.buttons" :key="button.text")
      icon(v-if="button.type.toLowerCase() === 'url'" name="ic-url"  class="svg-fill")

      icon(v-if="button.type.toLowerCase() === 'quick_reply'" name="ic-quick-reply"  class="svg-fill")

      icon(v-if="button.type.toLowerCase() === 'phone_number'" name="ic-phone-outgoing-call" class="svg-fill")

      icon(v-if="button.type.toLowerCase() === 'flow'" name="ic-note" class="svg-fill")

      span {{ button.text }}
</template>

<script>
import CommentRender from './CommentRender';
import Icon from './Icon';

export default {
  name: 'QiscusCommentBroadcastButton',
  components: { CommentRender, Icon },
  props: ['comment', 'messageStyle'],
};
</script>

<style lang="stylus" scoped>
@import '../assets/stylus/_variables.styl'

.qcw-comment__buttons_bc
  max-width calc(100% + 2px); // 2px to cover border
  margin: 0px -1px -1px -1px; // -1px to cover border
  display flex
  flex-direction column
  overflow hidden
  & .action_buttons_bc
    background white
    display flex
    align-items center
    justify-content center
    padding 12px
    cursor cursor
    gap 8px
    font-size 14px
    font-weight 600
    border-top 1px solid #ECECEC
    color #565656
    width 100%
    margin-left 0px
    &:last-child
      margin-bottom 0px
      border-radius 0px
    & span
      white-space nowrap
      overflow hidden
      text-overflow ellipsis
      min-width 0px
      line-height 20px

.qc-icon
  min-width 20px
  width 20px
  height 20px
  margin-top 0px
</style>
