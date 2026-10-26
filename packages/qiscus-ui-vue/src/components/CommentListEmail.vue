<template>
  <div
    class="qcw-comments"
    @scroll="onScroll($event)"
    ref="scrollTarget" @dragenter="onDragging(true)"
    :class="{'isReading': isReading}">
    <div class="inner">
      <div class="qcw-load-comment-indicator" v-if="core.isLoading">
        <loader></loader>
      </div>
      <ul v-if="core.selected">
        <li
          v-if="comments.length > 0 && comments[0].before_id > 0"
          class="qcw-load-more qcw-load-more-btn"
          @click="loadMore">
          <icon name="ic-load" class="ic-load-more__state" v-if="isLoadingMore"></icon>
          <span>Load More</span>
        </li>
        <li class="qcw-load-more qcw-top-page" v-else>
          <span>You've reached first page</span>
        </li>
        <li v-for="(comment) in comments" :key="comment.id">
          <comment-email
            ref="comment"
            :core="core"
            :comment="comment"
            :userData="core.userData"
            :customerEmail="customerEmail"/>
        </li>
      </ul>
      <!-- component for uploader progress -->
    </div>
</div>
</template>

<script>
import Loader from './Loader';
import Comment from './Comment';
import Icon from './Icon';
import CommentEmail from './CommentEmail';
import { scrollIntoLastElement, scrollListToElement, sortCommentsChrono } from '../lib/utils';

export default {
  name: 'CommentList',
  components: { Loader, Comment, CommentEmail, Icon },
  props: ['core', 'onClickImage', 'onupdate', 'replyHandler'],
  data() {
    return {
      isLoadingMore: false,
      isReading: false,
      commentLength: 0,
      currentMenuId: null,
      timeoutId: -1,
      timesLoadingMore: 1,
      maxTimesLoadingMore: 3,
      lastCommentId: null,
    };
  },
  computed: {
    comments() {
      // Deterministic tie-break; SDK sorts by second-resolution timestamp only
      // and leaves same-second messages out of order (breaks load-more). utils.js
      return sortCommentsChrono(this.core.selected.comments);
    },
    roomName() {
      return this.core.selected.name.toLowerCase();
    },
    customerEmail() {
      const participants = this.core.selected.participants;
      let email = '-';
      const user = participants.filter(u => u.extras === null || u.extras.type === undefined || u.extras.type !== 'agent');
      if (user.length) {
        email = user[0].email;
      }
      return email;
    },
    stickerIgRegex() {
      return /^\[file\][\s]*\b(?:https):\/\/[a-z0-9-+&@#/%?=~_|!:,.;()]*[a-z0-9-+&@#/%=~_|].gif[\s]*\[\/file\]/i;
    },
    stickerRegex() {
      return /^\[sticker\][\s]*\b(?:https):\/\/[a-z0-9-+&@#/%?=~_|!:,.;()]*[a-z0-9-+&@#/%=~_|][\s]*\[\/sticker\]/i;
    },
    stickerUrlRegex() {
      return /\b(?:https):\/\/[a-z0-9-+&@#/%?=~_|!:,.;]*[a-z0-9-+&@#/%=~_|]/i;
    },
  },
  updated() {
    if (this.core.selected) {
      if (this.comments.length > this.commentLength) {
        const lastCommentIndex = this.comments.length - 1;
        const lastComment = this.comments[lastCommentIndex];
        this.core.readComment(this.core.selected.id, lastComment.id);
        this.commentLength = this.comments.length;
        if (!this.isReading) {
          scrollIntoLastElement(this.core);
        }
      }
    }
  },
  methods: {
    onScroll(event) {
      if (this.timeoutId !== -1) {
        this.isReading = false;
        window.clearTimeout(this.timeoutId);
      }
      this.timeoutId = window.setTimeout(() => {
        const $element = event.target;
        const scrollHeight = $element.scrollHeight;
        const clientHeight = $element.clientHeight;
        const scrollTop = $element.scrollTop;
        const scrollTreshold = 1.2 * clientHeight;
        const calculation = scrollHeight - scrollTop;
        this.isReading = calculation > scrollTreshold;
        this.timeoutId = -1;
      }, 0);
    },
    setReply(comment) {
      this.replyHandler(comment);
      this.onChangeMenu(null);
    },
    loadMore() {
      this.isLoadingMore = true;
      this.core.loadMore(this.comments[0].id).then(() => {
        this.isLoadingMore = false;
      });
    },
    onChangeMenu(id) {
      this.currentMenuId = id;
    },
    onDragging(status) {
      this.$emit('onDragging', status);
    },
    loadMoreComment(id) {
      const self = this;
      const currentCommentId = (self.lastCommentId) ? self.lastCommentId : self.comments[0].id;
      if (self.timesLoadingMore >= self.maxTimesLoadingMore) return;
      self.isLoadingMore = true;
      self.core.loadMore(currentCommentId).then(async (response) => {
        self.lastCommentId = response[0].id;
        if (!response || response.length < 20) self.timesLoadingMore = self.maxTimesLoadingMore;
        const element = document.getElementById(id);
        if (!element) {
          self.timesLoadingMore += 1;
          const elementTop = document.getElementById(self.lastCommentId);
          scrollListToElement(elementTop);
          await self.loadMoreComment(id);
          return;
        }
        self.isLoadingMore = false;
        self.timesLoadingMore = 1;
        scrollListToElement(element);
      });
    },
  },
};
</script>

<style lang="stylus" scoped>
  @import '../assets/stylus/_variables.styl'
  .hidden {
    display: none !important;
  }
  .loading-image-container
    width 100%
    height auto
    background-color $darkWhite
    padding 8px
    border-radius 2px
    text-align center
    i
      display block
      margin 0px auto 8px auto
      .qc-icon
        fill $green
      svg
        animation spin 1s ease-in-out infinite
  .qcw-load-more
    font-size 9px
    text-align center
    margin 12px auto 12px auto
    font-weight bold
    &.qcw-top-page
      width 100%
      color $mediumGrey
    &.qcw-load-more-btn
      width 82px
      border-radius 10px
      flex: 1 100%;
      color $white
      background-color $green
      text-transform uppercase
      cursor pointer
      transition transform .32s ease
      display flex
      align-items center
      justify-content center
      &:hover
        transform translatey(-2px)

  .qcw-comment__state--read
    .qc-icon
      &.ic-double-check__state
        fill $green
      &.ic-option-menu__state
        fill $darkGrey
  .qc-icon
    &.ic-load__state,
    &.ic-check__state,
    &.ic-double-check__state,
    &.ic-option-menu__state
      margin-right 8px
    &.ic-load__state
      animation spin 1s ease-in-out infinite
    &.ic-load-more__state
      fill: #fff;
      margin: 0 4px 0 0;
      height: 12px;
      width: 12px;
      animation spin 1s ease-in-out infinite

  .inner
    position relative
    padding-top 1px
    min-height 100%

  .qcw-load-comment-indicator
    position absolute
    width 100%
    height 100%
    top 0
    display flex
    justify-content center
    background rgba(255,255,255,0.95)
    z-index : 10
    > .loader
      position relative

  .qcw-comments
    background $darkWhite
    &::-webkit-scrollbar-track
      border-radius: 10px;
      background-color: #fafafa;

    &::-webkit-scrollbar
      width: 8px;
      background-color: #fafafa;

    &::-webkit-scrollbar-thumb
      border-radius: 4px;
      background-color: #e0e0e0;

  .qcw-comments ul
    position relative
    list-style none
    margin 0
    padding 0

  .qcw-comment-date
    margin-bottom 24px

  .qcw-group.parent--container
    margin-top 20px
    &.contain-date
      margin-top 0
      .qcw-comment
        margin-top 20px
    &.my--container
      margin-top 0
      .qcw-comment
        margin-top 0

  i.delete-btn,
  i.reply-btn
    position absolute
    overflow hidden
    height 24px
    cursor pointer
    top 6px
    width 24px
    border-radius 50%
    background $lightGrey
    display none
    z-index 1
    animation fadeInLeftBig 0.3s ease-out
    transition background 0.3s ease-out

  i.delete-btn
    left -64px
    & svg.qc-icon
      display block
      width 12px
      height 12px
      margin 6px auto
    &:hover
      background-color $red
      .qc-icon
        fill $white

  i.reply-btn
    right -32px
    & svg.qc-icon
      display block
      width 13px
      height 13px
      margin 5px auto
    &.reply-btn--me
      left -32px
      & svg.qc-icon
        width 16px
        height 14px
    &:hover
      background-color $green
      .qc-icon
        fill $white

  .qcw-comments li:hover
    .hover-effect
      i.reply-btn
        display inline-block
      .qcw-comment__state
        display none
      .qcw-comment__time
        display none
      .delete-btn
        display inline-block
      .qcw-comment__more
        display block

  .qcw-comment__state
    animation:fadeInDown 0.3s ease-out;

  .qcw-comment-container
    padding 0 16px
    display: flex;
    flex-wrap: wrap;
    &.comment--me
      justify-content flex-end
      .qcw-avatar
        display none
    &.qcw-comment--file_attachment
      .qcw-comment__note
        color: #23B098
        svg
          stroke: #23B098

  .qcw-comment-date
    text-align center
    font-weight bold
    font-size 9px
    margin-top 4px
    flex: 1 100%;
    color $darkGrey
    text-transform uppercase
    &.extra-margin
      margin-top 24px
    div
      width: 190px;
      margin: auto;
      padding: 2px 8px;
      background-color: $lightGrey;
      border-radius: 12px;
  .qcw-comment
    display flex
    flex 0 auto

  .qcw-avatar
    flex 0 0 36px
    img
      width 36px
      height 36px
      border-radius 50%
    .comment--me &
      order 2
      text-align right

  .qcw-comment__more--menu
    position absolute
    padding 16px
    margin auto
    top 0
    left auto
    z-index 2
    height 100%
    width 100%
    transition opacity .4s
    display block
    ul
      display block
      width 100px
      padding 5px 0
      background $white
      font-size 14px
      list-style none
      top 25px
      left -61px
      right auto
      border-radius 8px
      box-shadow 0 7px 16px rgba(199,199,199,.25)
      margin-bottom 10px
      border-radius 7px
      li
        line-height 35px
        height 35px
        color $darkGrey
        cursor pointer
        display inline-block
        width 100%
        padding 0 10px
        &:hover
          color $green

  .qcw-comment__info
    padding-bottom 7px
    margin-bottom 7px
    flex 1 100%
    display flex
    justify-content: space-between;
    align-items: center;

  .qcw-comment__username
    font-weight bold

  .qcw-comment__state
    font-size 11px;
    text-transform lowercase
    color $darkGrey;
    position absolute
    top 16px

    svg.qc-icon
        margin-top 3px

  .qcw-comment
    .qcw-comment__time
        font-size 11px;
        text-transform lowercase
        color $darkGrey;
        position absolute
        min-width 50px
        top 8px
        right -58px
    .qcw-comment__username
      position absolute
      font-size 11px
      width 128px
      top -20px
      left 0
      text-align left
      white-space nowrap
      &.qcw-comment__username--hide{
        display : none;
      }
    .qcw-comment__more
      position absolute
      overflow hidden
      padding 5px 0
      height 24px
      width 24px
      cursor pointer
      top 6px
      left -35px
      border-radius 50%
      background $lightGrey
      display none
      z-index 1
      animation fadeInLeftBig 0.3s ease-out
      transition background 0.3s ease-out
      & svg.qc-icon
        display block
        width 12px
        height 12px
        margin 6px auto
      &:hover
        background-color $green
        .qc-icon
          fill $white

    &.comment--me
      .qcw-comment__username
        text-align right
        right 0
        left auto
      .qcw-comment__time
        top 2px
        left -35px
      .qcw-comment__state
        left -20px
        svg.qc-icon
            width 12px
            height 9px
      .qcw-comment__state--read,
      .qcw-comment__state--delivered
        left -24px
        svg.qc-icon
            width 16px
            height 9px
            margin 0 auto
      .qcw-comment__state--delivered svg.qc-icon
        fill grey
      .qcw-comment__state--failed
        color $red
        text-transform capitalize
        left -28px
        display flex
        align-items center
        top 0
        cursor pointer

  .qcw-container.qcw-container--wide
    .qcw-comment__more--menu
      ul
        top 25px

  .failed-info
    text-align right
    margin-top 0px
    font-size 14px
    margin-bottom 4px
    width: calc(100% - 27px);
    color $red
    span
      color $green
      padding 4px 0px 4px 4px
      margin-left 4px
      font-weight 600
      &:hover
        text-decoration underline
        cursor pointer
      &.resend--inbox
        color $green !important
    &.failed--last
      margin-bottom 24px
      margin-top -8px

  .qcw-comment--system-event
    text-align: center;
    padding: 5px 20px;
    border-radius:8px;
    flex: 0 auto;
    margin: 0 auto 24px;
    font-size: 13px;
    background-color: $white;
    border: 0.5px solid $lightGrey;
    color: $darkGrey;

  .qcw-comment__message
    flex 0 auto
    padding 8px
    font-size 14px
    background $lightGrey
    box-shadow 0 7px 16px rgba(199,199,199,.25)
    margin-bottom 4px
    position relative
    display flex
    min-width 80px
    max-width 210px
    align-items flex-end
    border-radius 8px

    &.qcw-comment-prevsession .qcw-file-container a { align-items: center; }

    &.qcw-comment-prevsession, .comment--me &.qcw-comment-prevsession
      background: #9d9d9d !important;
      color: #FFF !important;
      font-size: 9px;

    &.qcw-comment-prevsession blockquote {
      font-size: 14px;
      line-height: 16px;
      position: relative;
      margin-bottom: 14px;
      padding-bottom: 14px;
    }
    &.qcw-comment-prevsession blockquote:before {
      content: ' ';
      background: #FFF;
      height: 1px;
      width: 25px;
      position: absolute;
      left: 0;
      bottom: 0;
    }

    audio
      min-width 250px
      width 100%
    .comment--parent &
      margin-left 60px
      flex-wrap wrap
    .comment--me &
      margin-left 0px
      margin-right 12px
      background $white
    .comment--parent &, .comment--mid &
      margin-left 12px
    .comment--mid &
      margin-left 12px
    .comment--last &
      margin-left 12px
      margin-right 60px
    .comment--parent.comment--me &
      margin-left 60px
    .comment--last.comment--me &
      margin-left 60px
      margin-right 12px
    .comment--parent.comment--last &
      margin-left 12px
    .comment--parent & > .tip
      position absolute
      top 15px
      left -8px
      pointer-events none
      content " "
      height 0
      width 0
      border 4px solid transparent
      border-right-color $lightGrey
    .comment--parent.comment--me & > .tip
      border-left-color $white
      border-right-color transparent
      box-shadow 0 7px 16px rgba(199,199,199,.25)
      left auto
      right -8px
    &.card
      max-width 210px !important

  @media only screen and (min-width: 640px)
    .qcw-container--wide
      .qcw-comment__message
        max-width 400px
  @media only screen and (min-width: 1024px)
    .qcw-container--wide
      .qcw-comment__message
        max-width 800px

  .comment--last
    margin-bottom 24px

  .deleted
    .qcw-comment__content
      font-size 13px
      color $red
  .comment-text
    width 100%
    .qcw-comment__content
      margin 0
      word-break break-word
      word-wrap break-word
      white-space pre-line
  .qcw-comment__content
    iframe
      width 100%
      height auto
      display block
    img.emojione
      display inline-block
      vertical-align middle
</style>
