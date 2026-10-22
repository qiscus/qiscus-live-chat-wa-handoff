<template lang="pug">
  div(class="qcw-message-info")
    div(class="qcw-message-info__header")
      span Message Info
      span(@click="closeMessageInfo")
        icon(name="ic-close")

    div(class="qcw-message-info__comment")
      div(class="qcw-message-info__comment-text"
        v-if="data.comment.type=='file_attachment'")
        image-loader(
          :comment="data.comment"
          :message="data.comment.message")
      div(class="qcw-message-info__comment-text"
        v-html="data.comment.message"
        v-if="data.comment.type != 'file_attachment'")
      small(class="qcw-message-info__comment-time") {{ data.comment.time }}

    div(class="qcw-message-info__info")
      strong.qcw-message-info__info-header.read
        span Read By
        icon(name="ic-double-check")

      ul
        li(v-for="r in read")
          img(class="qcw-message-info__user-avatar")
          div(class="qcw-message-info__user-info")
            strong {{ r.user.username }}
            small {{ new Date(r.time).toLocaleString() }}
      strong.qcw-message-info__info-header.delivered
        span Delivered To
        icon(name="ic-double-check")
      ul
        li(v-for="d in delivered")
          img(class="qcw-message-info__user-avatar")
          div(class="qcw-message-info__user-info")
            strong {{ d.user.username }}
            small {{ new Date(d.time).toLocaleString() }}
</template>

<script>
import Icon from './Icon';
import ImageLoader from './ImageLoader';

export default {
  name: 'MessageInfo',
  props: ['core'],
  components: { Icon, ImageLoader },
  data() {
    return {
      delivered: [],
      read: [],
    };
  },
  computed: {
    data: () => QiscusUI.messageInfoData,
  },
  methods: {
    closeMessageInfo() {
      QiscusUI.isMessageInfoActive = false;
    },
  },
  mounted() {
    this.core.userAdapter.getCommentReceiptStatus(this.data.comment.id)
      .then((res) => {
        res.results.delivered_to.forEach(d => this.delivered.push(d));
        res.results.read_by.forEach(r => this.read.push(r));
      });
  },
};
</script>

<style lang="stylus">
@import '../assets/stylus/_variables.styl'
.qcw-message-info
  background #FFF
  position absolute
  top 0
  left 0
  width 100%
  height 100%
  z-index 999
  display flex
  flex-direction column
  flex 1 0 320px
  border-left 1px solid $lightGrey
  .qcw-container--wide &
    position relative

.qcw-message-info__header
  display flex
  justify-content space-between
  align-items center
  height 73px
  padding 0 16px
  border-bottom 1px solid #e8e8e8
  color #777
  flex 0 auto
  .qc-icon
    width 14px
    height 14px

  & span:nth-child(2)
    cursor pointer

.qcw-message-info__comment
  background #FAFAFA
  padding 25px
  display flex
  align-items center
  justify-content center
  flex 0 auto

.qcw-message-info__comment-text
  background: #FFFFFF;
  box-shadow: 0px 7px 16px rgba(199, 199, 199, 0.25);
  border-radius: 4px;
  padding 10px 8px 10px 8px
  margin-right 15px
  position relative
  word-break break-all
  word-wrap break-word

  &:before
    position: absolute;
    top: 15px;
    right: -8px;
    pointer-events: none;
    content: " ";
    height: 0;
    width: 0;
    border: 4px solid transparent;
    border-left-color: #FFF;

.qcw-message-info__comment-time
  font-size 10px
  letter-spacing 0.5px
  color #9d9d9d

.qcw-message-info__info
  flex 1 auto
  overflow hidden
  overflow-y auto
  padding 25px
  border-top 1px solid $lightGrey

  strong.qcw-message-info__info-header
    color #777
    font-size 14px
    line-height 25px
    letter-spacing 0.5px
    margin-bottom 20px
    display flex
    justify-content space-between

    &.read
      .qc-icon
        width 22px
        fill #94ca62
    &.delivered
      .qc-icon
        width 22px
  ul
    list-style none
    margin 0
    padding 0
    margin-bottom 20px

  li
    display flex

    img
      width 40px
      height 40px
      background #c4c4c4
      border-radius 50%
      margin-right 15px

.qcw-message-info__user-info
  display flex
  flex-direction column

  strong
    color #333
    font-size 14px
    line-height 25px
  small
    font-size 10px
    color #777
</style>
