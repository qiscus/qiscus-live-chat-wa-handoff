<template lang="pug">
  div(class="qcw-attachment-form" :style="style")
    div(class="qcw-attachment-form__header" :style="headerStyle")
      div(class="qcw-attachment-form__title")
        h4 Preview
        span(:style="subtitleStyle") Send to {{ displayName }}
      div(class="qcw-attachment-form__close-btn" @click="closeFormHandler")
        icon(name="ic-close" :style="iconStyle")
    label()
      div(class="qcw-attachment-form__picker-btn" :class="{'populated': populated}") {{ label }}
      input(class="qcw-attachment-form__input" name="file_image" type="file" accept="image/*" @change="changeFile")
    div(class="qcw-attachment-form__action")
      input(class="qcw-attachment-form__caption-txt"
        ref="caption"
        placeholder="Add your caption ..."
        @keydown.enter="tryUploadFile($event)"
        v-model="caption")
      i(class="send-button" @click="uploadFile")
        icon(name="ic-send-message")
</template>

<script>
  import Icon from './Icon';

  export default {
    name: 'AttachmentForm',
    props: ['uploadHandler', 'closeFormHandler', 'displaying', 'attachmentData', 'setAttachmentData'],
    components: { Icon },
    data() {
      return {
        thumbnail: '',
        label: 'Browse',
        file: null,
        caption: '',
        populated: false,
      };
    },
    computed: {
      displayName() {
        return this.$core.selected.name;
      },
      headerStyle() {
        return {
          background: this.$core.UI.colors.headerBackgroundColor,
          color: this.$core.UI.colors.headerTitleColor,
        };
      },
      iconStyle() {
        return {
          fill: this.$core.UI.colors.headerIconColor,
        };
      },
      subtitleStyle() {
        return {
          color: this.reactiveColor,
        };
      },
      style() {
        const backgrounds = [
          'background: #FFF',
          `background: #FFF url(${this.attachmentData.thumbnail}) no-repeat center; background-size: cover`,
        ];
        return backgrounds[(this.attachmentData.thumbnail) ? 1 : 0];
      },
    },
    created() {
      this.focusInCaption();
    },
    methods: {
      changeFile(event) {
        const self = this;
        const file = event.target.files[0];
        const fileReader = new FileReader();
        fileReader.onload = () => {
          self.setAttachmentData({
            file: event,
            thumbnail: fileReader.result,
          });
          self.label = 'Change';
          self.populated = true;
        };
        fileReader.readAsDataURL(file);
        self.focusInCaption();
      },
      uploadFile() {
        this.uploadHandler(this.attachmentData.file, this.caption);
      },
      tryUploadFile(e) {
        if (!e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          this.uploadFile();
        }
      },
      focusInCaption() {
        const self = this;
        if (!self.displaying) return;
        self.$nextTick(() => {
          self.$refs.caption.focus();
        });
      },
    },
    mounted() {
      this.focusInCaption();
    },
  };
</script>

<style lang="stylus">
  @import '../assets/stylus/_variables.styl'
  .qcw-attachment-form
    position absolute
    top 0
    left 0
    width 100%
    height 100%
    background #FFF
    display flex
    flex-direction column
    justify-content space-between
    align-content center
    z-index 999
    label + div
      cursor pointer
  .qcw-attachment-form__header
    display flex
    justify-content space-between
    background $darkWhite
    border-bottom 1px solid $lightGrey
    padding 12px 16px
    color $darkGrey
    align-items center
  .qcw-attachment-form__title
    align-self flex-start
    flex 1
    height 48px
    overflow hidden
    text-overflow ellipsis
    white-space nowrap
    h4
      margin 0
      font-size 15px
    span
      font-size 13px
  .qcw-attachment-form__action
    display flex
    justify-content space-between
    margin-top 10px
    padding 20px
    background #FFF
    border-top 1px solid $lightGrey
    color #666
  .qcw-attachment-form__caption-txt
    flex 1
    margin-right 10px
    border 0
    outline none
    font-size 15px
  .qcw-attachment-form__picker-btn
    border 1px solid $mediumGrey
    color gray
    background-color white
    padding 8px
    border-radius 8px
    font-size 16px
    font-weight bold
    flex 0 0 auto
    max-width 100px
    text-align center
    margin 0 auto
    cursor pointer
    transition all 0.3s ease-out
    &.populated
      background-color rgba(148,202,98,0.5)
      color $white
      border 1px solid $green
    &:hover
      opacity 1
      background-color $green
      border 1px solid $green
      color $white
  .qcw-attachment-form__input
    display none
  .qcw-attachment-form__preview-img
    width 150px
    height 150px
    margin 10px auto
  .qcw-attachment-form__close-btn
    margin-left auto
    cursor pointer
    display flex
    flex 0 28px
    justify-content flex-end
    .qc-icon
      width 14px
  .send-button
    .qc-icon
      &:hover
        fill $green
</style>
