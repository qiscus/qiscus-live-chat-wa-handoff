<template lang="pug">
  div
    .qcw-file-container
      a(href='javascript:void(0)')
        i
          icon(name='ic-user')
        .file-meta
          .file-name {{ name }}
          .file-description {{ phone }}
    //- comment-render(:text="comment.payload.caption" v-if="comment.payload.caption != ''")
</template>

<script>
import Icon from './Icon';
import CommentRender from './CommentRender';

export default {
  name: 'CommentContact',
  computed: {
    name() {
      if (!this.messages) return '';
      return this.messages[0];
    },
    phone() {
      if (!this.messages || this.messages.length < 1) return '';
      return this.messages[1];
    },
  },
  data() {
    return {
      messages: this.comment.message.split(' - '),
    };
  },
  components: { Icon, CommentRender },
  props: ['comment'],
};
</script>
