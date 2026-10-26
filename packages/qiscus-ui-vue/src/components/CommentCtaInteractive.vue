<template lang="pug">
  div(style="width: 100%;")
    file-attachment(v-if="comment.extras.header && comment.extras.header.type !== 'text'"
      :comment="comment"
      :whitelisted-files="whitelistedFiles"
      :on-click-image="onClickImage"
      :callback="onupdate"
      :isMe="isMe"
      style="margin-bottom: 12px; padding-inline: 12px;")
    comment-render(:text="body")
    .qcw-interactive__footer(v-if="comment.extras.footer && comment.extras.footer.text" v-html="comment.extras.footer.text" style="padding-inline: 16px !important; margin: 0;")

    div(class="qcw-comment__buttons_bc" v-if="buttonText")
      div(class="action_buttons_bc")
        icon(name="ic-url" class="svg-fill")
        span {{ buttonText }}
</template>

<script>
import CommentRender from './CommentRender';
import FileAttachment from './FileAttachment';
import Icon from './Icon';

export default {
  name: 'QiscusCommentCtaInteractive',
  components: { CommentRender, Icon, FileAttachment },
  props: ['comment', 'whitelistedFiles', 'onClickImage', 'callback', 'isMe'],
  computed: {
    body() {
      const newMessage = [];
      const { header, body } = this.comment.extras;

      if (header && header.type === 'text') newMessage.push(`${header.value}`);
      newMessage.push(body);

      return newMessage.join('\n\n');
    },

    buttonText() {
      return this.comment.extras &&
        this.comment.extras.action &&
        this.comment.extras.action.parameters &&
        this.comment.extras.action.parameters.display_text;
    },
  },
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

.qcw-interactive__footer
  padding 16px !important
  margin 0

.qc-icon
  margin: 0 !important;
</style>
