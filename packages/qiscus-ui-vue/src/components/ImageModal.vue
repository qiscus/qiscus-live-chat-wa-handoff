<template lang="pug">
  div.qcw-image-modal__container
    div.qcw-image-modal__overlay(@click="closeBtnHandler")
    div.qcw-image-modal__wrapper
      div.qcw-image-modal__actions
        i.qcw-image-modal__action(@click="openImage")
          icon(name="ic-link-out")
        i.qcw-image-modal__action(@click="closeBtnHandler" style="font-size: 13px")
          icon(name="ic-close")
      image-loader(:comment="comment"
        :message="imageSource")
</template>

<script>
import Icon from './Icon';
import ImageLoader from './ImageLoader';
import { attachmentUrl } from '../lib/attachmentTag';

export default {
  name: 'ImageModal',
  components: { ImageLoader, Icon },
  props: ['uri', 'closeBtnHandler', 'comment'],
  data() {
    return {
      imageSrc: '',
    };
  },
  computed: {
    imageSource() {
      const { extras, message } = this.comment;
      const isInteractiveWA =
        extras.type === 'interactive_wa' &&
        ['reply_buttons', 'cta_url', 'flow'].includes(extras.sub_type) &&
        extras.header.type === 'image';

      return isInteractiveWA ? extras.header.value : message;
    },
  },
  mounted() {
    const message =
      typeof this.comment !== 'string' && this.comment.type !== 'reply'
        ? this.comment.message
        : this.comment.payload.replied_comment_message;
    this.imageSrc = attachmentUrl(message) || message.trim();
  },
  methods: {
    openImage() {
      // get url
      const message =
        typeof this.comment !== 'string' && this.comment.type !== 'reply'
          ? this.comment.message
          : this.comment.payload.replied_comment_message;
      let url =
        typeof this.comment !== 'string'
          ? message.substring(7, message.length - 8)
          : this.comment;

      if (typeof this.comment !== 'string' && message.includes('[file]')) {
        url = attachmentUrl(message) || message.trim();
      }
      // make ext to lowercase
      const extras = this.comment.extras;
      const testUri = extras.source === 'ig' && extras.type === 'image';
      const interactiveWA =
        extras.type === 'interactive_wa' &&
        extras.sub_type === 'reply_buttons' &&
        extras.header &&
        extras.header.type === 'image';
      let ext = url.split('.');
      if (ext.length > 0) ext = ext[ext.length - 1];
      let finalUrl = url.substr(0, url.length - ext.length) + ext;
      if (testUri) finalUrl = url;
      if (interactiveWA) finalUrl = extras.header.value;
      window.open(finalUrl, '_blank');
    },
  },
};
</script>

<style lang="stylus">
@import '../assets/stylus/_variables.styl'
.qcw-image-modal__container
  position fixed
  top 0
  left 0
  width 100%
  height 100%
  z-index 1
  display flex
  justify-content center
  align-items center
  overflow-y scroll
  padding 20px
  background rgba(255,255,255,.90)
.qcw-image-modal__overlay
  position fixed
  top 0
  left 0
  width 100%
  height 100%
.qcw-image-modal__wrapper
  min-width 240px
  position relative
  max-width 40%
  max-height 90%
  animation fadeInZoom 0.2s ease-out
  .image-loader
    box-shadow 0 3px 15px rgba(0,0,0,.7)
    display block
  .loading-image-container
    padding 48px 0
    margin 0px auto
    background-color $white
  .qcw-image-container
    margin 0;
    width 100%
    background-color: #fff;
    img
      border-radius 0
      margin-bottom 16px
.qcw-image-modal__actions
  position absolute
  display flex
  top -36px
  right 0
  align-items center
.qcw-image-modal__action
  cursor pointer
  margin-left 15px
</style>
