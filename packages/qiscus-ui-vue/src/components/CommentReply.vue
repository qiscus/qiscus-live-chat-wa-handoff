<template lang="pug">
  div
    div(v-if="comment.payload.replied_comment_id === 0"
      class="reply-wrapper"
      :class="{'reply-wrapper--me': isMe}")
      comment-render(text="Message has been deleted")

    div(v-if="comment.payload.replied_comment_id !== 0"
      class="reply-wrapper"
      :class="{'reply-wrapper--me': isMe }"
      @click="clickHandler")
      div(class="reply-sender") {{ comment.payload.replied_comment_sender_username }}
      div(class="reply-caption-container" v-if="isAttachment")
        comment-render(v-if="isAttachment && attachmentHasCaption"
          :text="comment.payload.replied_comment_payload.caption")
        image-loader(v-if="isAttachment"
          :comment="comment"
          :message="comment.payload.replied_comment_message"
          :thumbnailMode="true"
          :whitelisted-files="whitelistedFiles"
          :on-click-image="onClickImage"
          :callback="callback"
          :is-comment-reply="true"
          :isMe="isMe")
      comment-render(v-if="!isAttachment && !isTypeCarousel"
        :text="repliedText" :is-comment-reply="true")
      div(v-if="!isAttachment && isTypeCarousel"
        class="qcw-file-container")
        i
          icon(name="ic-file-attachment")
        div(class="file-meta")
          div(class="file-name file-name-color") {{ repliedText }}

    image-loader(v-if="comment.isAttachment(comment.payload.text) && !isSubmittedFlowMessage"
      :comment="comment"
      :message="comment.payload.text"
      :thumbnailMode="true"
      :on-click-image="onClickImage"
      :callback="callback"
      :isMe="isMe")

    comment-render(v-if="ownAttachmentCaption && !isSubmittedFlowMessage"
      :text="ownAttachmentCaption")

    comment-render(v-if="!comment.isAttachment(comment.payload.text) && !isInteractiveMessage && !isSubmittedFlowMessage"
      :text="comment.payload.text")
    div(v-if="!isAttachment && isInteractiveMessage")
      div(v-if="isInteractiveMessageHeader"
        v-html="isInteractiveMessageHeader"
        :class="comment.extras.interactive.type === 'list_reply' ? 'qcw-interactive__header' : 'qcw-interactive__body'")
      div(v-if="isInteractiveMessageDesc" v-html="isInteractiveMessageDesc" class="qcw-interactive__body")
</template>

<script>
import ImageLoader from './ImageLoader';
import CommentRender from './CommentRender';
import Icon from './Icon';
import { attachmentCaption } from '../lib/attachmentTag';

export default {
  name: 'CommentReply',
  components: { ImageLoader, CommentRender, Icon },
  props: ['comment', 'isMe', 'whitelistedFiles', 'clickHandler', 'onClickImage', 'callback'],
  computed: {
    isTypeFileAttachment() {
      return this.comment.payload.replied_comment_type === 'file_attachment';
    },
    isTypeCarousel() {
      return this.comment.payload.replied_comment_type === 'carousel';
    },
    isAttachment() {
      return this.comment.isAttachment(
        this.comment.payload.replied_comment_message,
      );
    },
    // A reply that carries its OWN attachment keeps the caption after the
    // closing tag in `payload.text` — the SDK's reply-payload whitelist drops a
    // `payload.caption` key — so read it back off the tag.
    ownAttachmentCaption() {
      const payload = this.comment.payload;
      if (!payload || typeof payload.text !== 'string') return '';
      if (!this.comment.isAttachment(payload.text)) return '';
      return attachmentCaption(payload.text);
    },
    attachmentHasCaption() {
      return (
        this.comment.payload.replied_comment_payload.caption !== '' &&
        this.comment.payload.replied_comment_payload.caption != null &&
        !this.comment.payload.replied_comment_payload.caption.includes(
          'This message was sent on previous session by',
        )
      );
    },
    repliedText() {
      const isTrue = this.comment.payload.replied_comment_message.includes(
        'This message was sent on previous session by',
      );
      let text = '';
      if (isTrue) {
        const lines = this.comment.payload.replied_comment_message
          .split('\n')
          .filter(l => l.trim() !== '');
        lines.forEach((line, index) => {
          if (index < lines.length - 2) {
            text = `${line.trim()}\n`;
          }
        });
      } else {
        text = this.comment.payload.replied_comment_message;
      }

      if (this.comment.payload.replied_comment_type === 'buttons') {
        text = this.comment.payload.replied_comment_payload.text;
      }

      if (this.isTypeCarousel) {
        text = 'Carousel Message';
      }

      return text;
    },
    isInteractiveMessage() {
      const extras = this.comment.extras;
      if (!extras) return false;
      return (
        extras.interactive &&
        (extras.interactive.type === 'list_reply' ||
          extras.interactive.type === 'button_reply')
      );
    },
    isSubmittedFlowMessage() {
      const extras = this.comment.extras;
      if (!extras) return false;
      return (
        extras.interactive &&
        extras.interactive.type === 'nfm_reply' &&
        extras.interactive.nfm_reply.name === 'flow'
      );
    },
    isInteractiveMessageHeader() {
      if (!this.isInteractiveMessage) return '';
      const extras = this.comment.extras;
      if (
        extras.interactive.list_reply &&
        extras.interactive.list_reply.title
      ) {
        return extras.interactive.list_reply.title;
      } else if (
        extras.interactive.button_reply &&
        extras.interactive.button_reply.title
      ) {
        return extras.interactive.button_reply.title;
      }
      return '';
    },
    isInteractiveMessageDesc() {
      if (!this.isInteractiveMessage) return '';
      const extras = this.comment.extras;
      if (
        extras.interactive.list_reply &&
        extras.interactive.list_reply.description
      ) {
        return extras.interactive.list_reply.description;
      } else if (
        extras.interactive.button_reply &&
        extras.interactive.button_reply.description
      ) {
        return extras.interactive.button_reply.description;
      }
      return '';
    },
  },
};
</script>

<style lang="stylus" scoped>
.reply-wrapper .reply-caption-container {
  align-items: center;
}

.qcw-file-container
  display flex
  background-color #fafafa
  padding 4px 8px
  margin 4px 0
  border-radius 4px
  word-break break-word
  i
    margin-top 4px
    display inline-block
    margin-right 8px
    svg
      margin 0
      fill #979797
      width 36px
      height 36px
  .file-meta
    font-size 13px
    overflow ellipsis
    display flex
    align-items center
    .file-name
      font-weight 600
      font-size 12px
      line-height 1.2
    .file-description
      font-size 11px
      font-weight 200
      line-height 14px
</style>
