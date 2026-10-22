<template>
  <div class="image-loader">
    <div v-if="isBlacklistedFiles" class="image-loader--text">
      {{ $customerText('file.blocked', { filename: filename, ext: ext }) }}
    </div>
    <div v-else>
      <div class="loading-image-container" v-show="isLoading">
        <i>
          <icon name="ic-load"></icon>
        </i>
        <span class="label">{{ $customerText('common.imageLoading') }}</span>
      </div>
      <div v-show="isImage && !isLoading && error == ''" class="qcw-image-container" @click="clickImageHandler">
        <img ref="imageContainer" :src="imageSrc" :alt="uri" @error="imageFallback" @load="imageLoaded" />
      </div>
      <div v-show="error">
        <p>
          <i style="font-size: 2em; display: inline-block">
            <icon name="close"></icon>
          </i>
          {{ error }}
        </p>
        <button @click="loadImage" class="reload-image-btn">
          {{ $customerText('common.imageReload') }}
        </button>
      </div>
      <div v-show="!isImage && !isLoading" class="qcw-file-container">
        <a v-if="!isCommentReply" href="javascript:void(0)" @click.prevent="isValidUri">
          <i>
            <icon :name="fileClassName" style="width: 24px;height: 24px;"></icon>
          </i>
          <div class="file-meta">
            <div class="file-name file-name-color" :style="fileMetaClassName">
              {{ filename }}
            </div>
          </div>
        </a>
        <div v-if="isCommentReply" class="file-container-reply">
          <i>
            <icon :name="fileClassName" style="width: 24px;height: 24px;"></icon>
          </i>
          <div class="file-meta">
            <div class="file-name file-name-color" :style="fileMetaClassName">
              {{ filename }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import Icon from './Icon';
import { attachmentUrl } from '../lib/attachmentTag';

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'gif', 'webp', 'png']);

const INSTAGRAM_FILENAME_MAP = {
  audio: 'Instagram Voice Note',
  video: 'Instagram Video',
  story_reply: 'Instagram',
  video_story_reply: 'Instagram',
  image_story_reply: 'Instagram',
  story_mention: 'Instagram',
  ig_post: 'Instagram',
  share: 'Instagram Post',
  video_ig_comment: 'Instagram Video Post',
  image_ig_comment: 'Instagram Image Post',
  carousel_album_ig_comment: 'Instagram Carousel Album Post',
};

export default {
  name: 'ImageLoader',
  components: { Icon },
  props: [
    'comment',
    'message',
    'whitelistedFiles',
    'callback',
    'onClickImage',
    'thumbnailMode',
    'isCommentReply',
    'isMe',
  ],
  data() {
    return {
      isLoading: true,
      isImage: false,
      imageSrc: '',
      uri: attachmentUrl(this.message) || this.comment.getAttachmentURI(this.message),
      filename: '',
      ext: '',
      error: '',
    };
  },
  computed: {
    isReply() {
      return this.comment.type === 'reply';
    },
    fileClassName() {
      const ext = this.ext.toLowerCase();
      const extras = this.comment.extras;
      if (extras.source === 'ig') {
        return (this.isCommentReply && this.isFileAttachment)
          ? 'ic-file-attachment'
          : 'ic-ig-attachment';
      }
      return IMAGE_EXTS.has(ext) ? 'ic-image' : 'ic-file-attachment';
    },
    isBlacklistedFiles() {
      return (
        this.whitelistedFiles &&
        this.whitelistedFiles.length > 0 &&
        !this.whitelistedFiles.includes(this.ext)
      );
    },
    isFileAttachment() {
      return (
        this.comment.payload &&
        this.comment.payload.replied_comment_type === 'file_attachment'
      );
    },
    fileMetaClassName() {
      if (this.isCommentReply) return 'color: #565656';
      return this.isMe ? 'color: #ffffff' : 'color: #007BFF';
    },
  },
  created() {
    this.loadImage();
  },
  destroyed() {
    URL.revokeObjectURL(this.imageSrc);
  },
  methods: {
    isValidUri() {
      if (!this.uri || this.isCommentReply || this.isBlacklistedFiles)        { return false; }
      if (this.uri.hostname === globalThis.location.hostname) return false;

      const extras = this.comment.extras;
      const isSourceInstagram = extras.source === 'ig';

      if (isSourceInstagram && extras.type === 'audio' && !this.isCommentReply) {
        this.uri = attachmentUrl(this.comment.payload.text) || this.uri;
      }

      window.open(this.uri, '_blank');

      const splittedUri = this.uri.split('/');
      const hasExtension = splittedUri[splittedUri.length - 1].includes('.');
      if (isSourceInstagram || hasExtension) return true;

      const actions = [
        {
          text: this.$customerText('file.open'),
          onClick: (e, toastObject) => {
            window.open(this.uri);
            toastObject.goAway(0);
          },
        },
        {
          text: this.$customerText('common.cancel'),
          onClick: (e, toastObject) => {
            toastObject.goAway(0);
            return false;
          },
        },
      ];

      return this.$toasted.show(
        this.$customerText('file.confirmOpen'),
        { duration: 5000, action: actions },
      );
    },

    imageFallback() {
      if (
        this.comment.extras.type === 'text' &&
        ('replied_comment_type' in this.comment.payload) &&
        this.comment.payload.replied_comment_type === 'file_attachment'
      ) {
        this.isImage = false;
      }
      this.imageSrc = 'https://omnichannel.qiscus.com/img/broken-image.jpg';
      this.imageLoaded();
    },

    getImageThumbnail(url, width, height) {
      if (!url || url.includes('.webp')) return url;
      if (width === undefined && height === undefined) return url;

      const baseUrlSegment = url.split('//');
      const urlSegment = baseUrlSegment[1].split('/');
      if (urlSegment.length !== 6) return url;

      // take two last segment
      const imageRelativePath = `${urlSegment[4]}/${urlSegment[5]}`;
      const baseImagePath = url.substr(0, url.length - imageRelativePath.length);

      if (width !== undefined && height !== undefined) {
        return baseImagePath + imageRelativePath;
      }
      return `${baseImagePath}w_320,h_320,c_limit/${imageRelativePath}`;
    },

    clickImageHandler() {
      if ('replied_msg' in this.comment.extras) {
        window.open(this.uri, '_blank');
        return;
      }
      if (this.onClickImage && !this.isCommentReply) {
        this.onClickImage(this.comment);
      }
    },

    isImageAttachment(message) {
      return message.match(/\.(jpg|jpeg|gif|png|webp)/i) != null;
    },

    /**
     * Resolve the text message used for image loading based on reply context.
     */
    resolveTextMessage() {
      if (!this.isReply) return this.message;
      return this.isCommentReply
        ? this.comment.payload.replied_comment_message
        : this.comment.payload.text;
    },

    /**
     * Determine the URI to use based on interactive message type.
     */
    resolveUri(textMessage, extras) {
      const isInteractive =
        extras.type === 'interactive_wa' &&
        ['reply_buttons', 'cta_url', 'flow'].includes(extras.sub_type);

      const rawUri = isInteractive
        ? textMessage
        : attachmentUrl(textMessage) || this.comment.getAttachmentURI(textMessage);

      return (this.isImage && this.thumbnailMode)
        ? this.getImageThumbnail(rawUri, 100, 100)
        : rawUri;
    },

    /**
     * Extract filename and extension from the current URI.
     */
    parseFilenameFromUri() {
      if (!this.uri) return;
      this.filename = this.uri
        .split('/')
        .pop()
        .split('#')[0]
        .split('?')[0];
      this.ext = this.filename.split('.').pop();
    },

    /**
     * Override filename for Instagram-sourced attachments.
     */
    applyInstagramOverrides(extras) {
      if (extras.source !== 'ig') return;

      const igFilename = INSTAGRAM_FILENAME_MAP[extras.type];
      if (igFilename) {
        this.isImage = false;
        this.filename = igFilename;
      }

      if (this.isCommentReply && this.isFileAttachment) {
        this.filename = this.comment.payload.replied_comment_payload.file_name;
      }
    },

    loadImage() {
      const comment = this.comment;
      const textMessage = this.resolveTextMessage();

      this.isLoading = true;
      this.$nextTick(() => {
        const extras = comment.extras;

        // Test the url alone, never the whole message: a caption is free text
        // and may well carry a ".png" of its own.
        this.isImage = this.isImageAttachment(attachmentUrl(textMessage) || textMessage);

        if (
          extras.type === 'text' &&
          ('replied_comment_type' in comment.payload) &&
          comment.payload.replied_comment_type === 'file_attachment'
        ) {
          this.isImage = true;
        }

        if (!this.isCommentReply && extras.source === 'ig' && extras.type === 'image') {
          this.isImage = true;
        }

        this.uri = this.resolveUri(textMessage, extras);
        this.parseFilenameFromUri();

        this.error = '';
        if (this.isImage) {
          this.imageSrc = this.uri.substr(0, this.uri.length - this.ext.length) + this.ext;
        } else {
          this.imageLoaded();
        }

        this.applyInstagramOverrides(extras);
      });
    },

    imageLoaded() {
      this.isLoading = false;
    },
  },
};
</script>

<style lang="stylus">
@import '../assets/stylus/_variables.styl'
.file-container-reply
  display flex
  align-items center
  justify-content center
  padding 0px
.image-loader
  margin -4px
  overflow hidden
  border-radius 16px
.reply-wrapper .image-loader
  margin-top 4px
  padding-bottom 4px
.reply-wrapper .qcw-image-container
  margin 0
  width 100%
.image-loader--text
  white-space normal

.image-loader + .qcw-comment__content
  width 100%
  overflow hidden
  text-overflow ellipsis
  margin-top 12px
  word-break break-word
  a
    word-break break-all

.loading-image-container
  min-width 194px
  height 194px !important
  display flex
  justify-content center
  flex-direction column

.reply-wrapper--preview .qcw-image-container,
.qcw-comment__message .qcw-image-container
  display flex
  align-items center
  justify-content center
  overflow hidden
  max-height 220px
  cursor pointer

@media only screen and (min-width: 678px)
  .reply-wrapper--preview .qcw-image-container,
  .qcw-comment__message .qcw-image-container
    img
      // aspect-ratio 4/3
      width: 100%

.qcw-image-container
  img
    height 100%
    width 100%
    display block
    object-fit contain

.reply-wrapper--preview .qcw-file-container
  margin 4px 0 0 0
  a
    justify-content flex-start

.qcw-file-container
  //background-color $darkWhite
  padding 4px 8px
  border-radius 4px
  word-break break-word
  a
    //color $darkGrey
    text-decoration none
    display flex
    align-items top
    justify-content left
  i
    display flex
    align-items: center
    justify-content: center
    margin-right 8px
    svg
      margin 0
      fill $mediumGrey
      width 16px
      height 16px
  .file-meta
    font-size 13px
    overflow ellipsis
    display flex
    align-items center
    .file-name
      font-weight 400
      font-size 14px
      line-height 1.2
      background: transparent !important

    .file-description
      font-size 11px
      font-weight 200
      line-height 14px

.reload-image-btn {
  display: block;
  width: 100%;
  margin: 10px 0;
  padding: 7px 15px;
  text-align: center;
  cursor: pointer;
  background: #eee;
  color: #FFF;
  border: 2px solid #FFF;
  font-weight: bold;
  border-radius: 5px;
  color: #444;
}
</style>
