<template lang="pug">
  div(class="comment_email_attachment")
    template(v-if="comment.message")
      .comment_email_attachment--body(v-html="textMessage")
      hr(v-if="listFile.length > 0" class="comment_email_attachment--line" :style="borderColor")
    .comment_email_attachment--footer(v-if="listFile.length > 0")
      .file-item(v-for="(file, i) in listFile" :key="i" :style="borderColor")
        .icon-file(:style="{background: isMe ? 'white' : `var(--me-bubble-color, #27b69d)` }")
          icon(name="ic-docs-attachment-render-buble" :style="{fill: isMe ? `var(--me-bubble-color, #27b69d)` : 'white'}")
        .file-name
          .file-name--desc(:style="{ color: isMe ? messageStyle.textRight : messageStyle.textLeft }")
            div {{ file.file_name }}
            div {{ file.sizeInMb }}
          a(:href="file.url" target="_blank" rel="noopener noreferrer")
            icon(name="ic-download" class="file-name--download" :style="{color: isMe ? 'white' : `var(--me-bubble-color, ${messageStyle.bgRight})`}")
      button(
        v-if="listFile.length > 1"
        class="download-file"
        :style="{color: isMe ? 'white' : `var(--me-bubble-color, ${messageStyle.textRight})` }"
        @click="downloadAll()"
        ) Download All Attachment

</template>

<script>
import QiscusTextParser from '../lib/textparser';
import { calculateSizeInMB } from '../lib/utils';
import Icon from './Icon';

export default {
  name: 'CommentEmailAttachment',
  components: {
    Icon,
  },
  props: ['comment', 'isMe'],
  computed: {
    listFile() {
      if (this.comment &&
        this.comment.payload &&
        this.comment.payload.content &&
        this.comment.payload.content.email_attachment
      ) {
        return this.comment.payload.content.email_attachment.map(file => ({
          ...file,
          sizeInMb: calculateSizeInMB(file.size),
        }));
      }
      return [];
    },
    borderColor() {
      return {
        borderColor: this.isMe ? 'white' : '#B6B6B6',
      };
    },
    textMessage() {
      const parseHtml = QiscusTextParser.parse(this.comment.message);
      return (typeof emojione !== 'undefined') ? emojione.toImage(parseHtml) : parseHtml;
    },
  },
  data() {
    return {
      messageStyle: {},
    };
  },
  mounted() {
    this.messageStyle = {
      bgRight: this.$core.UI.colors.bubleRightColor,
      bgLeft: this.$core.UI.colors.bubleLeftColor,
      textRight: this.$core.UI.colors.bubleRightTextColor,
      textLeft: this.$core.UI.colors.bubleLeftTextColor,
    };
  },
  methods: {
    downloadAll() {
      this.listFile.forEach((f) => {
        window.open(f.url, '_blank');
      });
    },
  },
};
</script>
<style lang="stylus" scoped>
  .comment_email_attachment
    &--body
      padding: 10px
      margin: 0;
      word-break: break-word;
      word-wrap: break-word;
      white-space: pre-line;
    &--line
      margin 10px -8px
      border none;
      border-top 1px solid
      border-color: white
    &--footer
      display: flex
      align-items: center
      justify-content: center
      flex-direction: column
      color: white
      padding-top: 10px
      padding-bottom: 20px
      padding: 10px 10px 20px 10px
      gap 20px
      .download-file
        padding 10px 16px
        width 100%
        border-radius 50px
        border 1px solid
        background none
        cursor pointer
        &.is-me
          color white
      >.file-item
        display: flex
        border: 1px solid
        border-color: white
        padding: 10px 16px
        border-radius: 6px
        gap: 24px
        .icon-file
          border-radius: 100%
          background-color: white
          width: 50px
          height: 50px
          display: flex
          align-items: center
          justify-content: center
          >svg
            margin: 0px
            width: 25px
            height: 25px
        .file-name
          gap: 20px
          flex-grow: 1
          display: flex
          align-items: center
          justify-content: space-between
          &--desc
            display: flex
            flex-direction: column
            justify-content: center
            width: 200px
            text-overflow: ellipsis
            overflow: hidden
            white-space: nowrap
            >div
              text-overflow: ellipsis
              overflow: hidden
              white-space: nowrap
          &--download
            width: 24px
            height: 24px
            cursor: pointer
            color: white
</style>
