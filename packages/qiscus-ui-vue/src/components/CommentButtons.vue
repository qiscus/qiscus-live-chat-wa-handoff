<template lang="pug">
  div(class="qcw-comment__buttons")
    div(class="action_buttons" v-for="button in buttons" :key="button.label")
      button(@click="postbackHandler(button)" v-if="button.type == 'postback'")
        i(v-if="isRedownload(button)")
          icon(name="ic-reload")
        span(v-if="isRedownload(button)")
        span {{ button.label }}
      a(:href="button.payload.url" target="_blank" v-else) {{ button.label }}
</template>

<script>
import Icon from './Icon';

export default {
  name: 'QiscusCommentButtons',
  components: { Icon },
  props: ['buttons', 'postbackHandler'],
  methods: {
    handleClick(button) {
      if (button.type === 'postback') {
        this.postbackHandler(button);
      }
    },
    isRedownload(button) {
      if (button.payload &&
        button.payload.payload &&
        button.payload.payload.sub_type) {
        return button.payload.payload.sub_type === 'redownload';
      }
      return false;
    },
  },
};
</script>

<style lang="stylus">
  @import '../assets/stylus/_variables.styl'
  
  .qcw-comment__buttons
    .qcw-comment__content
      padding 0 8px
  .qcw-comment__buttons
    margin-top 8px
    .action_buttons:last-child
        margin-bottom -8px
        border-radius 0 0 7px 7px
    .action_buttons 
      background-color #fff
      border-top 1px solid $lightGrey
      width calc(100% + 16px)
      margin-left -8px
      &:hover
        a,button
          color $blue
          cursor pointer
      &:last-child
        border-radius 0 0 7px 7px
      button, a
        transition color .3s ease-out
        background-color transparent
        font-size 13px
        font-weight 600
        font-family "Open sans", sans-serif
        width 210px
        margin 0 
        height 48px
        border 0
        color $darkGrey
        text-transform capitalize
        text-decoration none
        display block 
        width 100%
      a
        line-height 48px
        text-align center
  
  .button-message__redownload
    div
      display: flex
      flex-direction: column
      justify-content: center
      .qcw-comment__buttons
        margin-top: 0
        .action_buttons
          margin-left: 0
          width: auto
          border-radius: 0
          background: transparent
          border-top: 0
          button
            padding-top: 70px;
            padding-bottom: 34px;
            display: flex
            flex-direction: column
            align-items: center
            color: #23B098
            height: auto
            line-height: 22px
            text-decoration: underline
            font-size: 14px
      .qcw-comment__content
        text-align: center
        margin-bottom: 16px
        &.qcw-comment__content__redownload
          order: 1;
          margin-left: 48px
          margin-right: 48px
      .qcw-comment__note
        order: 1
        flex-direction: row
        color: #23b098
        margin-bottom: 16px
        svg
          stroke: #23b098
</style>