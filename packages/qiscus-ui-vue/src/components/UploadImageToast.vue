<template lang="pug">
  .qcw-upload-toast__content
    header
      label
        | Sending to
        b &nbsp;{{ textEllipsis(upload.room.name, 20)}}
      .info
        label(v-if="!onUploadComplete") {{`${upload.success + upload.error}/${upload.total}`}}
        .form-icon(v-else @click="handleClose()")
          icon(name="ic-close" :fill="iconStyle")
    section
      a(v-if="onUploadComplete" href="" @click.prevent="toggleDetails") {{ showDetails ? 'Hide' : 'Show' }} details
      ul(:class="{hide: !showDetails, done: onUploadComplete && showDetails}")
        li(v-for="(data, i) in upload.data" :key="i")
          label(:title="data.file.name") {{ textEllipsis(data.file.name, 25) }}
          span(:class="{err: data.status === 3}") {{ getStatus(data) }}
      label(v-if="onUploadComplete && upload.error") {{ `${upload.error} media(s) failed to send.` }} Click &nbsp; #[a(href="" @click.prevent="handleSendImages(true)" v-text="' here '")] &nbsp; to try again.
</template>

<script>
/* eslint no-plusplus: ["error", { "allowForLoopAfterthoughts": true }] */
import Icon from './Icon';
import textEllipsis from '../helpers/stringManipulator';
import {
  buildReplyPayload,
  replyFileMessage,
  withChannelReplyRef,
} from '../lib/replyPayload';

export default {
  name: 'UploadImageToast',
  props: ['core', 'data'],
  data() {
    return {
      upload: {
        room: [],
        total: 0,
        success: 0,
        error: 0,
        data: [],
      },
      errUpload: [],
      showDetails: true,
      pendingReply: null,
    };
  },
  components: {
    Icon,
  },
  watch: {
    core: {
      handler(val) {
        if (this.onUpload || this.onUploadComplete) {
          const comments = val.selected.comments;
          const i = comments.findIndex(data => !data.room_id);
          if (i > 0) {
            if (this.upload.room.id !== val.selected.id) comments.splice(i, 1);
          }
        }
      },
      deep: true,
    },
    onUploadComplete(val) {
      if (val) {
        if (this.upload.error) {
          this.showDetails = false;
        } else {
          this.handleClose();
        }
      }
    },
  },
  mounted() {
    this.handleSendImages(false);
  },
  computed: {
    iconStyle() {
      return {
        fill: this.$core.UI.colors.headerIconColor,
      };
    },
    onUpload() {
      return this.upload.data.length > 0;
    },
    onUploadComplete() {
      const upload = this.upload;
      if (upload.total) {
        if (upload.success + upload.error === upload.total) return true;
      }
      return false;
    },
  },
  methods: {
    handleClose() {
      this.$emit('handle-close', this.data);
    },
    toggleDetails() {
      this.showDetails = !this.showDetails;
    },
    getStatus(data) {
      const status = data.status;
      let text = '';
      if (!status) text = 'On queue';
      if (status === 1) {
        if (data.progress === 100) {
          text = 'Sending';
        } else {
          text = `Uploading ${Math.floor(data.progress)}%`;
        }
      }
      if (status === 2) text = 'Success';
      if (status === 3) text = 'Failed';

      return text;
    },
    handleSendImages(reupload) {
      const data = this.data.data;
      const upload = this.upload;
      const errUpload = this.errUpload;

      if (reupload) {
        upload.total = 0;
        upload.success = 0;
        upload.error = 0;
        upload.data = [];
        data.splice(0);
        for (let i = 0; i < errUpload.length; i++) {
          data.push(errUpload[i]);
        }
      } else {
        upload.room = this.core.selected;
        // The batch carries a SNAPSHOT of the reply taken when it was queued
        // (`data.repliedComment`), not a live prop: the composer releases its
        // reply the moment the batch is handed over, so reading it later would
        // always find null. Captured once per batch, not per file — and a retry
        // of failed uploads must not re-quote what the first attempt quoted.
        this.pendingReply = this.data.repliedComment || null;
      }

      upload.total = data.length;

      for (let i = 0; i < data.length; i++) {
        const d = {
          id: data[i].id,
          file: data[i].file,
          progress: 0,
          status: 0,
        };
        upload.data.push(d);
      }

      errUpload.splice(0);
      this.showDetails = true;
      this.sendImages();
    },
    sendImages() {
      const upload = this.upload;
      const errUpload = this.errUpload;
      const images = this.data.data;
      const i = upload.data.findIndex(data => !data.status);

      if (i >= 0) {
        upload.data[i].status = 1;
        this.core.upload(images[i].file, (error, progress, url) => {
          if (error) {
            console.log(error);
            upload.error += 1;
            upload.data[i].status = 3;
            errUpload.push(images[i]);
            this.sendImages();
          }
          if (progress) upload.data[i].progress = progress.percent;
          if (url) {
            const payload = {
              url,
              caption: images[i].caption,
              file_name: images[i].file.name,
            };
            let extras = null;
            if (this.core.UI.alternateUser) {
              extras = {
                alternate_user: this.core.UI.alternateUser,
              };
            }
            const commentText = `[file] ${url} [/file]`;
            const nanotimestamp =
              window.performance.now() + window.performance.timeOrigin;
            const uniqueId = `${upload.room.id}_${nanotimestamp}`;

            // Claim the reply before the send, so a second file in the same
            // batch cannot quote it again — only the FIRST file quotes, which
            // is what Inbox V3 does (it clears `replyTo` after one send).
            const replied = this.pendingReply;
            this.pendingReply = null;
            const isReply = Boolean(replied);

            this.core
              .sendComment(
                upload.room.id,
                isReply
                  ? replyFileMessage(replied, url, commentText)
                  : commentText,
                uniqueId,
                isReply ? 'reply' : 'file_attachment',
                JSON.stringify(
                  isReply
                    ? buildReplyPayload(replied, commentText, images[i].caption)
                    : payload,
                ),
                isReply ? withChannelReplyRef(extras, replied) : extras,
              )
              .then((res) => {
                upload.success += 1;
                upload.data[i].status = 2;
                this.core.options.sentMessageCallback(res);
                this.sendImages();
              })
              .catch((err) => {
                console.log(err);
                upload.error += 1;
                upload.data[i].status = 3;
                errUpload.push(images[i]);
                this.sendImages();
              });
          }
        });
      }
    },
    textEllipsis(text, length) {
      return textEllipsis(text, length);
    },
  },
};
</script>
<style lang="stylus">
@import '../assets/stylus/_variables.styl';
.qcw-upload-toast__content
  width 310px
  margin-bottom 10px
  background-color #fff
  border 1px solid #e8e8e8
  border-radius 8px
  box-shadow 4px 4px 8px rgba(0,0,0,0.075)
  transition all .5s ease

  header
    display flex
    align-items center
    padding 2px 10px 4px
    border-bottom 1px solid #e8e8e8

    label
      font-size 12px

    .info
      margin-left auto

      .form-icon
        cursor pointer

        svg
          margin 0
          width 10px
          height 10px

  section
    padding 10px
    font-size 12px

    a
      color $blue
      text-decoration none

    ul
      list-style none
      margin 0
      padding 0
      max-height 100px
      overflow auto
      transition max-height .3s ease
      &.hide
        max-height 0
      &.done
        border-top 1px solid #e8e8e8
        border-bottom 1px solid #e8e8e8

      li
        display flex
        justify-content space-between

        label
          width calc(100% - 100px)
          overflow hidden
          white-space nowrap
          text-overflow ellipsis

        span
          width 100px
          text-align center
          &.err
            color $red
    label
      font-size 12px
</style>
