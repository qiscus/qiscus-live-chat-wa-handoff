<template lang="pug">
  div
    div(v-if="isInteractiveTypeCallPermissionReply || isInteractiveTypeNfmReply")
      strong(v-text="labelInteractiveTypeCallPermissionReply")
    div(v-if="!isPreviousMessageNotifier" v-html="rendered_text" class="qcw-comment__content")
    div(v-if="isPreviousMessageNotifier")
      blockquote
        p(v-html="prev_session_message")
      p
        small(v-html="prev_session_notice")
</template>

<script>
import QiscusTextParser from '../lib/textparser';

export default {
  name: 'CommentRender',
  props: ['comment', 'text', 'isCommentReply'],
  data() {
    return {
      rendered_text: this.text,
      prev_session_message: '',
      prev_session_notice: '',
      labelInteractiveTypeCallPermissionReply: null,
    };
  },
  computed: {
    isPreviousMessageNotifier() {
      const isTrue = this.text
        ? this.text.includes('This message was sent on previous session by')
        : false;
      if (isTrue) {
        const lines = this.text.split('\n').filter(l => l.trim() !== '');
        // Lines carry the previous session's message text and end up in v-html.
        lines.forEach((line, index) => {
          if (index < lines.length - 2) {
            this.prev_session_message += `${QiscusTextParser.escapeText(line.trim())}<br>`;
          } else {
            this.prev_session_notice += `${QiscusTextParser.escapeText(line)}<br>`;
          }
        });
      }
      return isTrue;
    },
    isInteractiveTypeCallPermissionReply() {
      if (this.comment) {
        if (this.comment.extras.interactive) {
          return (
            this.comment.extras.interactive.type === 'call_permission_reply'
          );
        }
      }
      return false;
    },
    isInteractiveTypeNfmReply() {
      if (this.comment) {
        if (this.comment.extras.interactive) {
          return (
            this.comment.extras.interactive.type === 'nfm_reply' &&
            this.comment.extras.interactive.nfm_reply.name ===
              'call_permission_request'
          );
        }
      }
      return false;
    },
  },
  methods: {
    useParser() {
      if (!this.rendered_text) {
        this.rendered_text = '';
        return;
      }
      if (this.isCommentReply) {
        const linkPattern = /((?:(?:https?|ftp|file):\/\/|www\.|ftp\.)[-A-Z0-9+&@#/%=~_|$?!:;,.|([{}\])`^]*[A-Z0-9+&@#/%=~_|$])(?!([^<]+)?>)/gi;

        // A quote with a URL keeps it as plain text, but it is still raw message
        // content going into v-html, so it must be escaped like parse() does.
        this.rendered_text = this.rendered_text.match(linkPattern)
          ? QiscusTextParser.parsePlainText(this.rendered_text)
          : QiscusTextParser.parse(this.rendered_text);
      } else {
        this.rendered_text = QiscusTextParser.parse(this.text);
      }
      if (!this.rendered_text) this.rendered_text = '';
    },
  },
  created() {
    this.useParser();
    if (typeof emojione !== 'undefined' && this.rendered_text) {
      this.rendered_text = emojione.toImage(this.rendered_text);
    }
    if (
      this.isInteractiveTypeCallPermissionReply ||
      this.isInteractiveTypeNfmReply
    ) {
      switch (this.comment.extras.interactive.call_permission_reply.response) {
        case 'accept':
          this.labelInteractiveTypeCallPermissionReply =
            'Call Permission Reply';
          this.rendered_text =
            'The customer accepted the Business Initiated Call';

          if (
            this.comment.extras.interactive.call_permission_reply.is_permanent
          ) {
            this.rendered_text =
              'The customer permanently accepted the Business Initiated Call';
          }
          break;

        case 'reject':
          this.labelInteractiveTypeCallPermissionReply =
            'Call Permission Reply';
          this.rendered_text =
            'The customer declined the Business Initiated Call';
          break;

        default:
          this.labelInteractiveTypeCallPermissionReply = 'Missed Call';
          this.rendered_text =
            'You have a missed call from a customer who tried to reach you.';
          break;
      }
    }
  },
};
</script>
