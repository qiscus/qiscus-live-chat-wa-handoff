<template lang="pug">
  div(style="width: 100%;")
    div(style="padding: 0 16px 16px 16px;")
      comment-render(:text="comment.extras.body")
    div(class="qcw-comment__buttons_bc" v-if="comment.extras.action")
      div(class="action_buttons_bc")
        span Request Contact Info
</template>

<script>
import CommentRender from "./CommentRender";

export default {
  name: "QiscusCommentRequestContact",
  components: { CommentRender },
  props: ["comment"]
};
</script>

<style lang="stylus" scoped>
@import '../assets/stylus/_variables.styl'

.qcw-comment__buttons_bc
  max-width calc(100% + 2px)
  margin 0px -1px -1px -1px
  display flex
  flex-direction column
  overflow hidden

  & .action_buttons_bc
    background white
    display flex
    align-items center
    justify-content center
    padding 12px
    cursor pointer
    gap 8px
    font-size 14px
    font-weight 600
    border-top 1px solid #ECECEC
    color #565656
    width 100%
    margin-left 0px

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
