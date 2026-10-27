<template lang="pug">
  div(class="qcw-upload-file")
    div(class="qcw-upload-progress" v-for="file in files") 
      div(class="title") {{ `${file.name}` }}
      //- div(class="meta")
          span(class="type") EXE
          span(class="separator") -
          span(class="size") 1000 KB
      div(class="progress-bar")
          div(class="progress") {{ `${file.progress}%` }}
          div(class="uploaded" :style="{width: `${file.progress}%`}")
</template>

<script>


export default {
  name: 'UploadInfo',
  props: ['files'],
};
</script>

<style lang="stylus">
  @import '../assets/stylus/_variables.styl'

  .qcw-upload-file
    position absolute
    animation fadeInUp 0.3s ease-out
    width calc(100% - 16px)
    top 81px
    z-index 4
    margin 0 8px 8px
    background-color $white
    padding 8px 12px
    box-shadow 0px 6px 16px rgba(199, 199, 199, 0.25)
    .title
      font-weight 600
      font-size 14px
    .meta
      font-size 11px
      color $mediumGrey
      .type
        margin-right 8px
      .size
        margin-left 8px
    .progress-bar
      height 8px
      background-color $lightGrey
      margin-top 4px
      border-radius 4px
      position relative
      .progress
        position absolute
        right 0
        top -24px
      .uploaded
        transition width 0.2s ease-out
        background #94ca62
        height 8px
        border-radius 8px
</style>
