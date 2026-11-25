<template lang="pug">
  .qcw-upload-form
    .backdrop(@click="handleClose(false)")
    .content
      header
        h3 {{ $customerText('common.preview') }}
        .form-icon(@click="handleClose(false)")
          icon(name="ic-close" :fill="iconStyle")
      section
        .preview-container
          .image-container
            img(:src="selected.image")
          .comment-form
            textarea(
              id="input-upload-caption"
              rows="1"
              :placeholder="$customerText('common.captionShort')"
              v-model="caption"
              @keydown.enter="onSubmit($event)"
              ref="inputUploadCaption"
              style="padding: 8px 16px")
      footer
        .image-list
          .image-container(v-for="img in images" :key="img.id")
            span(@click="removeImage(img)")
              icon(name="ic-close" :fill="iconStyle")
            img(
              :src="img.image"
              :class="{selected: selected.id == img.id}"
              @click="selectImg(img)"
            )
        label(:title="$customerText('common.addImage')")
          input(type="file" accept="image/*" multiple ref="addImage" @change="addImage")
          icon(name="ic-image-attachment" :fill="iconStyle" ref="addImageInput")
        label(:title="displayName" @click="handleClose(true)")
          icon(name="ic-send-message" :fill="iconStyle")
</template>

<script>
/* eslint no-plusplus: ["error", { "allowForLoopAfterthoughts": true }] */
import Icon from './Icon';

export default {
  name: 'UploadImageForm',
  props: ['core', 'data'],
  data() {
    return {
      showModal: true,
      images: [],
      selected: [],
      caption: '',
      imageId: 0,

      channel: null,
    };
  },
  components: {
    Icon,
  },
  mounted() {
    const images = this.images;
    for (let i = 0; i < this.data.length; i++) {
      this.imageId += 1;
      const data = {
        id: this.imageId,
        file: this.data[i],
        caption: '',
        image: '',
      };
      images.push(data);
    }
    this.generateImages();
    this.selected = images[0];
    this.$refs.inputUploadCaption.focus();

    this.handleHideCaption();
  },
  computed: {
    displayName() {
      return this.$customerText('common.sendTo', { name: this.$core.selected.name });
    },
    iconStyle() {
      return {
        fill: this.$core.UI.colors.headerIconColor,
      };
    },
  },
  methods: {
    onSubmit(e) {
      if (!e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        this.handleClose(true);
      }
    },
    handleClose(upload) {
      if (upload) {
        const i = this.images.findIndex(data => data.id === this.selected.id);
        this.images[i].caption = this.caption;

        const data = {
          id: null,
          image: this.images,
        };

        this.$emit('handle-upload', data);
      } else {
        this.$emit('handle-close', null);
      }
    },
    generateImages() {
      const self = this;
      for (let i = 0; i < self.images.length; i++) {
        const fileReader = new FileReader();
        fileReader.onload = function reader() {
          self.images[i].image = fileReader.result;
        };
        fileReader.readAsDataURL(self.images[i].file);
      }
    },
    selectImg(img) {
      const i = this.images.findIndex(data => data.id === this.selected.id);
      this.images[i].caption = this.caption;
      this.selected = img;
      this.caption = img.caption;
      this.$refs.inputUploadCaption.focus();
    },
    addImage(event) {
      const files = event.target.files;
      const images = this.images;
      for (let i = 0; i < files.length; i++) {
        this.imageId += 1;
        const data = {
          id: this.imageId,
          file: files[i],
          caption: '',
          image: '',
        };
        images.push(data);
      }
      this.generateImages();
      this.$refs.addImage.value = null;
    },
    removeImage(image) {
      const images = this.images;
      const i = images.findIndex(img => img.id === image.id);
      if (i > -1) {
        if (images.length === 1) {
          this.handleClose(false);
        } else {
          if (image.id === this.selected.id) {
            this.selected = i !== 0 ? images[0] : images[1];
            this.caption = this.selected.caption;
          }
          images.splice(i, 1);
        }
      }
    },

    handleHideCaption() {
      const options = this.core.selected.options
        ? JSON.parse(this.core.selected.options)
        : null;

      if (!options) return;

      const channels = ['tiktok'];
      if (!channels.includes(options.channel)) return;

      const captionEl = document.querySelector('.comment-form');

      captionEl.style.display = 'none';
    },
  },
};
</script>
<style lang="stylus" scoped>
@import '../assets/stylus/_variables.styl';
input, textarea
  font-family 'Inter', sans-serif
  font-weight normal
  width 100%
  color #8c8c8c
  padding 10px 14px
  background-color #fff
  -webkit-box-shadow 0px 7px 17px rgba(51, 51, 51, 0.07)
  box-shadow 0px 7px 17px rgba(51, 51, 51, 0.07)
  border-radius 6px
  border 1px solid transparent
  outline none
  font-size 14px
  line-height 16px

.qcw-upload-form
  position fixed
  top 0
  left 0
  right 0
  bottom 0
  display flex
  align-items center
  justify-content center
  z-index 3

  .backdrop
    position absolute
    top 0
    left 0
    right 0
    bottom 0
    background-color #404040
    opacity 0.5

  .content
    z-index 3
    width 100%
    max-width 900px
    height 95%
    background-color #fff
    border-radius 8px
    margin 0 16px

    header
      height 50px
      display flex
      align-items center
      padding 0 16px
      border-bottom 0.5px solid #e8e8e8

      h3
        margin-right auto
        font-weight 600

      .form-icon
        cursor pointer

        svg
          width 14px
          height 14px

    section
      height calc(100% - 150px)
      border-bottom 0.5px solid #e8e8e8
      padding 16px

      .preview-container
        width 100%
        height 100%

        .image-container
          width 100%
          height calc(100% - 50px)
          display flex
          justify-content center
          align-items center

          img
            display block
            width auto
            height auto
            max-height 90%
            max-width 90%

        .comment-form
          display flex
          align-items center
          height 50px

    footer
      height 100px
      padding 0 16px
      display flex
      align-items center
      justify-content center

      .image-list
        max-width calc(100% - 100px)
        overflow auto
        display flex
        padding 8px

        .image-container
          position relative
          margin-right 5px
          display flex

          &:last-child
            margin 0

          svg
            position absolute
            top -5px
            right -5px
            width 20px
            height 20px
            background-color #fff
            padding 5px
            margin 0
            border-radius 50%
            z-index 2
            border 1px solid #b7b7b7
            cursor pointer

          img
            width 70px
            height 70px
            border 0.5px solid #979797
            transition all 0.1s ease-in-out
            cursor pointer

            &.selected
              border-width 3px

            &.onupload
              cursor default

      label
        margin-left 16px

        &.onupload
          svg
            cursor default

        input
          display none

        svg
          width 25px
          height 25px
          cursor pointer
          margin 0
</style>
