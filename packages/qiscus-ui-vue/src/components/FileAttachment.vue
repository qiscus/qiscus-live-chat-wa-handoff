<template lang="pug">
  div(class="qcw-comment__attachment")
    audio(
      v-if="fileType == 'audio' && !isBlacklistedFiles"
      :src="audioSource"
      width="100%"
      controls) {{ $customerText('file.audioUnsupported') }}
    video(
      v-else-if="fileType == 'video' && !isBlacklistedFiles"
      :controlsList="controlsListValue"
      controls
      muted
      :src="videoSource"
      width="100%") {{ $customerText('file.videoUnsupported') }}
    image-loader(
      v-else
      :comment="comment"
      :message="fileSource"
      :whitelisted-files="whitelistedFiles"
      :on-click-image="onClickImage"
      :thumbnailMode="true"
      :callback="callback"
      :isMe="isMe")

    comment-render(:text="caption" v-if="caption && !isInteractiveMessage")

    //- USER COMMENT INSTAGRAM POST
    div(v-if="comment.extras && ( isInstagramSource || isRedownloadAttachment)"
      class="reply-wrapper" :class="{'reply-wrapper--redownload': isRedownloadAttachment}")
      comment-render(:text="comment.extras.reply" v-if="comment.extras.type !== 'redownload_attachment' && comment.extras.reply && comment.extras.reply !== ''")
      comment-redownload(message="This attachment file was sent in the previous message by " :sender="comment.extras.sender" :timestamp="comment.extras.timestamp" v-if="isRedownloadAttachment")
</template>

<script>
import ImageLoader from './ImageLoader';
import CommentRender from './CommentRender';
import CommentRedownload from './CommentRedownload';
import { attachmentUrl, attachmentCaption } from '../lib/attachmentTag';

const INSTAGRAM_COMMENT_TYPES = new Set([
  'video_ig_comment',
  'image_ig_comment',
  'carousel_album_ig_comment',
]);

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'gif', 'webp', 'png']);
const VIDEO_EXTS = new Set(['mov', 'mp4', 'webm']);
const AUDIO_EXTS = new Set(['mp3', 'oga', 'ogg', 'm4a']);

export default {
  name: 'FileAttachment',
  components: { ImageLoader, CommentRender, CommentRedownload },
  props: ['comment', 'whitelistedFiles', 'onClickImage', 'callback', 'isMe'],
  data() {
    return {
      ext: '',
      fileType: null,
      controlsListValue: '',
    };
  },
  computed: {
    isInteractiveMessage() {
      const { extras } = this.comment;
      return (
        extras &&
        extras.type === 'interactive_wa' &&
        ['reply_buttons', 'cta_url', 'flow'].includes(extras.sub_type) // 'flow' for flow interactive
      );
    },
    // A real `file_attachment` carries its caption in the payload; a plain-text
    // `[file]url[/file] caption` comment — what every agent-side composer sends —
    // carries it after the closing tag.
    caption() {
      const payloadCaption = this.comment.payload && this.comment.payload.caption;
      return payloadCaption || attachmentCaption(this.comment.message);
    },
    fileSource() {
      if (this.isInteractiveMessage) return this.comment.extras.header.value;
      return this.comment.message;
    },
    audioSource() {
      if (this.comment.payload && this.comment.payload.url) {
        return this.sanitizeUrl(this.comment.payload.url);
      }
      if (this.comment.message && this.fileType === 'audio') {
        return this.sanitizeUrl(this.removeFileTags(this.comment.message));
      }
      return '';
    },
    videoSource() {
      if (this.isInteractiveMessage) {
        return this.sanitizeUrl(this.comment.extras.header.value);
      }
      if (this.comment.payload && this.comment.payload.url) {
        return this.sanitizeUrl(this.comment.payload.url);
      }
      if (this.comment.message && this.fileType === 'video') {
        return this.sanitizeUrl(this.removeFileTags(this.comment.message));
      }
      return '';
    },
    isRedownloadAttachment() {
      return this.comment.extras.type === 'redownload_attachment';
    },
    isInstagramSource() {
      return INSTAGRAM_COMMENT_TYPES.has(this.comment.extras.type);
    },
    isBlacklistedFiles() {
      return (
        this.whitelistedFiles &&
        this.whitelistedFiles.length > 0 &&
        !this.whitelistedFiles.includes(this.ext)
      );
    },
  },
  mounted() {
    const payload = this.resolvePayload();

    if (payload) {
      this.fileType = this.detectFileType(payload);
    } else if (this.comment.message) {
      this.ext = this.getExtensionFromUrl(this.comment.message);
      this.fileType = this.getTypeByExtension(this.ext);
    }
  },
  methods: {
    removeFileTags(raw) {
      if (typeof raw !== 'string') return '';
      return attachmentUrl(raw) || raw.replaceAll(/\[\/?file\]/gi, '').trim();
    },

    sanitizeUrl(url) {
      if (typeof url !== 'string') return '';
      try {
        const { protocol } = new URL(url);
        return ['https:', 'http:'].includes(protocol) ? url : '';
      } catch (e) {
        console.error('sanitizeUrl: invalid URL', e);
        return '';
      }
    },

    /**
     * Determine which payload object to use for file type detection.
     */
    resolvePayload() {
      if (this.isInteractiveMessage && this.comment.extras.header) {
        return this.comment.extras.header;
      }
      if (this.comment.payload && this.comment.payload.url) {
        return this.comment.payload;
      }
      return null;
    },

    /**
     * Extract the file extension from a URL or message string.
     */
    getExtensionFromUrl(url) {
      const clean = (attachmentUrl(url) || url.replaceAll(/\[\/?file\]/gi, ''))
        .split('?')[0]
        .trim();
      const parts = clean.split('.');
      return parts[parts.length - 1].toLowerCase();
    },

    /**
     * Return a file type string based on extension alone ("video" | "audio" | null).
     */
    getTypeByExtension(ext) {
      if (VIDEO_EXTS.has(ext)) return 'video';
      if (AUDIO_EXTS.has(ext)) return 'audio';
      return null;
    },

    /**
     * Configure video download controls based on agent permissions.
     */
    applyVideoDownloadRestrictions() {
      const qismoRawData = localStorage['qismo-data'];
      if (!qismoRawData) return;

      let qismoData;
      try {
        qismoData = JSON.parse(qismoRawData);
      } catch (e) {
        console.error('applyVideoDownloadRestrictions: failed to parse qismo-data', e);
        return;
      }
      const isAgent = qismoData && qismoData.user && qismoData.user.type === 2;
      const appConfig = globalThis.appAdditionalConfig;
      const agentCanDownload = appConfig && appConfig.agentCanDownloadVideo;

      if (isAgent && !agentCanDownload) {
        this.controlsListValue = 'nodownload';
      }
    },

    /**
     * Detect the file type from a payload and apply any side-effects
     * (e.g. video download restrictions).
     */
    detectFileType(payload) {
      const extras = this.comment.extras || {};
      const isIgSource = extras.source === 'ig';
      const isIgAudio = isIgSource && extras.type === 'audio';
      const isIgVideo = isIgSource && extras.type === 'video';

      const url = this.isInteractiveMessage ? payload.value : payload.url;
      this.ext = this.getExtensionFromUrl(url);

      if (IMAGE_EXTS.has(this.ext)) return 'image';

      if (VIDEO_EXTS.has(this.ext) || isIgVideo) {
        this.applyVideoDownloadRestrictions();
        return 'video';
      }

      if (AUDIO_EXTS.has(this.ext) || isIgAudio) return 'audio';
      if (isIgSource) return 'ic-ig-attachment';
      return 'ic-file-attachment';
    },
  },
};
</script>

<style lang="stylus">
.qcw-comment__attachment
  video
    max-height 220px
    border-radius 16px

.qcw-comment__attachment > div > .qcw-comment__content
    margin-block 8px
</style>
