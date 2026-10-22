<template lang="pug">
  .qcw-dropzone-area(
      :class="{ 'qcw-dropzone-over': dragging }",
      drag-over="handleDragOver",
      @dragenter="onDragging(true)",
      @dragleave="onDragging(false)"
    )
    .qcw-dropzone-text
      span.qcw-dropzone-title {{ title || 'Drag file here for upload...' }}
    |
    input(ref="inputDragDrop" type="file", @change="changeFile")
</template>

<script>
import Icon from './Icon';
// import { uploadFile } from "../lib/fileUploader";

export default {
  name: 'FileDragDrop',
  components: { Icon },
  props: ['title', 'core', 'dragging'],
  methods: {
    changeFile(e) {
      // uploadFile(e, null, this.core, this.$toasted);
      const files = e.target.files;
      this.$emit('onFileChange', files);
      this.onDragging(false);
    },
    onDragging(status) {
      this.$emit('onDragging', status);
    },
  },
  mounted() {
    if (this.dragging && this.$refs.inputDragDrop) {
      this.$refs.inputDragDrop.value = null;
    }
  },
};
</script>

<style lang="stylus">
@import '../assets/stylus/_variables.styl'
$width = 350px;
$height = $width;
$fontSizeTitle = 16px;
$fontColorTitle = $darkGrey;
$bgContent = $darkerWhite;

.qcw-dropzone-area
  display flex
  align-items center
  justify-content center
  position absolute
  bottom 0
  left auto
  border 3px dashed $mediumGrey
  height calc(100% - 73px)
  width 100%
  background $darkWhite
  z-index 3
  border-bottom-left-radius 20px
  border-bottom-right-radius 20px
  opacity 0
  visibility hidden
  transition all 0.3s ease-out
  &.qcw-dropzone-over
    opacity 1
    visibility visible
    animation fadeInUp 0.3s ease-out

  .qcw-dropzone-text
    top 50%
    text-align center
    transform translate(0, -50%)
    font-size 20px
    font-weight 600
    color $mediumGrey
  input
    position absolute
    cursor pointer
    top 0px
    right 0
    bottom 0
    left 0
    width 100%
    height 100%
    opacity 0

.qcw-container.qcw-container--wide
  .qcw-dropzone-area
    border-radius 0
</style>
