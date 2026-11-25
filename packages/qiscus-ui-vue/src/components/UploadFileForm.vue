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
          .file-container(v-if="selected")
            span(v-text="selected.name")
            .boxed-file
              icon(name="ic-pdf-file" v-if="selected.name.includes('pdf')" style="width: 100px; height: 100px;")
              icon(name="ic-word-file" v-else-if="selected.name.includes('doc')" style="width: 100px; height: 100px;")
              icon(name="ic-excel-file" v-else-if="selected.name.includes('xls')" style="width: 100px; height: 100px;")
              icon(name="ic-ppt-file" v-else-if="selected.name.includes('ppt')" style="width: 100px; height: 100px;")
              icon(name="ic-doc-file" v-else style="width: 100px; height: 100px;")
              .info-file {{ $customerText('common.noPreview') }}
              span(v-text="`${selected.size} - ${selected.ext}`")
          //- .comment-form
          //-   input(type="text" placeholder="Add caption.." v-model="caption" ref="inputUploadCaption")
      footer
        //- .file-list
        //-   .file-container(v-for="file in files" :key="file.id")
        //-     span(@click="removeImage(file)")
        //-       icon(name="ic-close" :fill="iconStyle")
        //-     img(
        //-       :src="file.file"
        //-       :class="{selected: selected.id == file.id}"
        //-       @click="selectFile(file)"
        //-     )
        //- label(title="Add more file")
        //-   input(type="file" accept="file/*" multiple ref="addFile" @change="addFile")
        //-   icon(name="ic-file-attachment" :fill="iconStyle" ref="addImageInput")
        textarea(
          id="input-upload-caption"
          row="1"
          resize="none"
          :placeholder="$customerText('common.captionShort')"
          v-model="caption"
          @keydown.enter="onSubmit($event)"
          ref="inputUploadCaption"
          style="padding: 8px 16px")
        label(:title="displayName" @click="handleClose(true)")
          icon(name="ic-send-message" :fill="iconStyle")
</template>

<script>
/* eslint no-plusplus: ["error", { "allowForLoopAfterthoughts": true }] */
import { calculateSizeInMB } from './../lib/utils';
import Icon from './Icon';

export default {
  name: 'UploadFileForm',
  props: ['core', 'data'],
  data() {
    return {
      showModal: true,
      files: [],
      selected: null,
      caption: '',
      fileId: 0,

      channel: null,
    };
  },
  components: {
    Icon,
  },
  mounted() {
    const files = this.files;
    for (let i = 0; i < this.data.length; i++) {
      this.fileId += 1;
      const data = {
        id: this.fileId,
        file: this.data[i],
        caption: '',
        doc: '',
        name: this.data[i].name,
        size: calculateSizeInMB(this.data[i].size),
        ext: this.data[i].name
          .split('.')
          .pop()
          .toUpperCase(),
      };
      files.push(data);
    }
    this.selected = files[0];
    this.generateFiles();
    if (this.$refs.inputUploadCaption) {
      this.$refs.inputUploadCaption.focus();
    }

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
        const i = this.files.findIndex(data => data.id === this.selected.id);
        this.files[i].caption = this.caption;

        const data = {
          id: null,
          file: this.files,
        };

        this.$emit('handle-upload', data);
      } else {
        this.$emit('handle-close', null);
      }
    },
    generateFiles() {
      const self = this;
      for (let i = 0; i < self.files.length; i++) {
        self.files[i].doc = URL.createObjectURL(self.data[i]);
        // const fileReader = new FileReader();
        // fileReader.onload = function reader() {
        //   self.files[i].file = fileReader.result;
        // };
        // fileReader.readAsDataURL(self.files[i].file);
      }
    },
    selectFile(file) {
      const i = this.files.findIndex(data => data.id === this.selected.id);
      this.files[i].caption = this.caption;
      this.selected = file;
      this.caption = file.caption;
      if (this.$refs.inputUploadCaption) {
        this.$refs.inputUploadCaption.focus();
      }
    },
    addFile(event) {
      const files = event.target.files;
      const datas = this.files;
      for (let i = 0; i < files.length; i++) {
        this.fileId += 1;
        const data = {
          id: this.fileId,
          file: files[i],
          caption: '',
        };
        datas.push(data);
      }
      this.generateFiles();
      this.$refs.addFile.value = null;
    },
    removeImage(file) {
      const files = this.files;
      const i = files.findIndex(f => f.id === file.id);
      if (i > -1) {
        if (files.length === 1) {
          this.handleClose(false);
        } else {
          if (file.id === this.selected.id) {
            this.selected = i !== 0 ? files[0] : files[1];
            this.caption = this.selected.caption;
          }
          files.splice(i, 1);
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

        .file-container
          width 100%
          height calc(100% - 50px)
          display flex
          flex-direction column
          justify-content center
          align-items center
          gap 1rem

          .boxed-file
            display flex
            flex-direction column
            align-items center
            justify-content center
            border 1px solid #e8e8e8
            border-radius 12px
            padding 2rem 6rem
            background-color #f9f9f9
            font-size 14px
            .info-file
              font-size 24px
              margin-top 1.5rem
              margin-bottom 0.5rem

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
      justify-content flex-end

      .file-list
        max-width calc(100% - 100px)
        overflow auto
        display flex
        padding 8px

        .file-container
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
        display flex
        align-items center

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
