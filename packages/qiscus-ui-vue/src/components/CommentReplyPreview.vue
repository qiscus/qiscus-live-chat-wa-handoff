<template lang="pug">
  div(class="reply-wrapper reply-wrapper--preview")
    div
      div(class="reply-sender") Replying to {{ comment.username_as }}
      image-loader(v-if="comment.isAttachment(comment.message)"
        :comment="comment"
        :message="comment.message"
        :whitelisted-files="whitelistedFiles"
        :on-click-image="void(0)"
        :callback="void(0)")
      
      //- comment-render(v-if="!comment.isAttachment(comment.message)" 
      //-   :text="textToRender")

      div(class="qcw-comment__content" 
        v-if="!comment.isAttachment(comment.message)") {{ textToRender }}

    i(@click="closeReplyHandler" class="reply-close-btn")
      icon(name="ic-close")
</template>

<script>
import ImageLoader from './ImageLoader';
import Icon from './Icon';
import CommentRender from './CommentRender';

export default {
  name: 'CommentReplyPreview',
  components: { ImageLoader, CommentRender, Icon },
  props: ['core', 'comment', 'closeReplyHandler'],
  computed: {
    textToRender() {
      if (this.comment.type === 'carousel') return 'Carousel Message';
      if (this.comment.type === 'buttons') return this.comment.payload.text;
      return this.comment.type !== 'reply'
        ? this.comment.message
        : this.comment.payload.text;
    },
    whitelistedFiles() {
      if (
        this.core.UI.whitelistedFiles &&
        this.core.UI.whitelistedFiles !== ''
      ) {
        return this.core.UI.whitelistedFiles.split(',');
      }
      return [];
    },
  },
};
</script>
