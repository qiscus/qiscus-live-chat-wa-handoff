<template lang="pug">
  div.qcw-comments(@scroll="onScroll($event)"
    ref="scrollTarget"
    @dragenter="onDragging(true)"
    :class="{'isReading': isReading}")
    div.inner
      div.qcw-load-comment-indicator(v-if="core.isLoading")
        loader()

      ul(v-if="core.selected")
        li(class="qcw-load-more qcw-load-more-btn" :style="{background: this.core.UI.colors.bubleRightColor}" @click="loadMore" v-if="comments.length > 0 && comments[0].before_id > 0")
          icon(name="ic-load" class="ic-load-more__state" v-if="isLoadingMore")
          span {{ $customerText('common.loadMore') }}
        li(class="qcw-load-more qcw-top-page" v-else)
          span {{ $customerText('common.firstPage') }}
        li(v-for="(comment, index) in comments" :key="comment.id")
          comment(
            :comment="comment"
            :comment-before="(index-1 < 0) ? null : comments[index-1]"
            :comment-after="(index+1 <= comments.length-1) ? comments[index+1] : null"
            :on-click-image="onClickImage"
            :replyHandler="setReply"
            :onupdate="onupdate"
            :userData="core.userData"
            :showAvatar="core.options.avatar"
            :currentMenuId="currentMenuId"
            :roomName="roomName"
            :customerEmail = "customerEmail"
            :isSticker = "((comment.type == 'text' && comment.message.match(stickerRegex)) || (comment.extras.source == 'ig' && comment.extras.type == 'image' && comment.message.match(stickerIgRegex))) ? true : false"
            :isInteractiveListMessage = "comment.type === 'text' && comment.extras.type === 'interactive_wa' && comment.extras.sub_type === 'list_message' ? true : false"
            :isInteractiveQuickReply = "comment.type === 'text' && comment.extras.type === 'interactive_wa' && comment.extras.sub_type === 'reply_buttons' ? true : false"
            :isInteractiveVoiceCall = "comment.type === 'text' && comment.extras.type === 'interactive_wa' && comment.extras.sub_type === 'voice_call' ? true : false"
            :isInteractiveCallPermissionRequest = "comment.type === 'text' && comment.extras.type === 'interactive_wa' && comment.extras.sub_type === 'call_permission_request' ? true : false"
            :isInteractiveCtaUrl = "comment.type === 'text' && comment.extras.type === 'interactive_wa' && comment.extras.sub_type === 'cta_url' ? true : false"
            :isOutgoingCall = "comment.type === 'text' && comment.extras && comment.extras.referral && comment.extras.referral.call && comment.extras.referral.call.mark === 'call' ? true : false"
            :isContactCard = "comment.type === 'text' && comment.extras && (((comment.extras.referral && comment.extras.referral.origin === 'contact_request')) || ((comment.extras.wa_contact && comment.extras.wa_contact.origin === 'contact_request'))) ? true : false"
            :stickerUrl = "(comment.type == 'text' && comment.message.match(stickerRegex)) ? comment.message.match(stickerUrlRegex)[0] : null"
            @onChangeMenu="onChangeMenu"
            @commentNotFound="loadMoreComment"
            ref="comment"
          )
        li(v-if="isBubbleRoomTyping" id="bubble-room-typing")
          .parent--container
            .qcw-comment-container.qcw-comment--text.qcw-comment--cust
              .qcw-comment.comment--parent.comment--last
                .qcw-comment__message(style="color: rgb(10, 10, 10); background: rgb(243, 245, 247); border-color: rgb(236, 236, 236);") {{ bubbleTypingText }}

</template>

<script>
import Icon from './Icon';
import Loader from './Loader';
import Comment from './Comment';
import { scrollIntoElement, scrollIntoLastElement, scrollListToElement, sortCommentsChrono } from '../lib/utils';

export default {
  name: 'CommentList',
  components: { Icon, Loader, Comment },
  props: ['core', 'onClickImage', 'onupdate', 'replyHandler'],
  data() {
    return {
      isLoadingMore: false,
      isReading: false,
      commentLength: 0,
      prevRoomId: 0,
      currentMenuId: null,
      timeoutId: -1,
      timesLoadingMore: 1,
      maxTimesLoadingMore: 11,
      lastCommentId: null,
      messageStyle: {},
    };
  },
  mounted() {
    window.$comp = this;
  },
  computed: {
    isBubbleRoomTyping() {
      setTimeout(() => {
        scrollIntoElement('bubble-room-typing');
      }, 100);
      return this.core.UI.isBubbleRoomTyping;
    },
    bubbleTypingText() {
      if (this.core.UI.bubbleData) {
        return this.core.UI.bubbleData.text || this.$customerText('ai.thinking');
      }
      return this.$customerText('ai.thinking');
    },
    comments() {
      const { comments, participants, options } = this.core.selected;
      const opt = options ? JSON.parse(options) : options;

      // Re-sort with a deterministic tie-break; the SDK's second-resolution
      // sort leaves same-second messages (WA image+caption) out of order,
      // which breaks load-more and hides the oldest message. See utils.js.
      const newComments = sortCommentsChrono(comments);

      // only for wa group
      if (opt && opt.type === 'wa_group') {
        const participantMap = this.createParticipantMap(participants);

        return newComments.map(comment =>
          this.replaceMentionsInComment(comment, participantMap),
        );
      }

      return newComments;
    },
    roomName() {
      return this.core.selected.name.toLowerCase();
    },
    customerEmail() {
      const participants = this.core.selected.participants;
      const roomname = this.core.selected.name.toLowerCase();
      let email = '';

      let user = participants.find(
        participant =>
          (participant.extras && participant.extras.is_customer === true) ||
          (participant.extras && participant.extras.is_customer === 'true'),
      );
      if (!user) {
        user = participants.find(
          participant => participant.username.toLowerCase() === roomname,
        );
      }
      if (user) {
        email = user.email;
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
      if (this.prevRoomId !== this.core.selected.id) {
        this.commentLength = 0;
        this.lastCommentId = null;
      }
      if (this.comments.length > this.commentLength) {
        const lastCommentIndex = this.comments.length - 1;
        const lastComment = this.comments[lastCommentIndex];
        this.core.readComment(this.core.selected.id, lastComment.id);
        this.prevRoomId = this.core.selected.id;
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
      const currentCommentId = self.lastCommentId
        ? self.lastCommentId
        : self.comments[0].id;
      if (self.timesLoadingMore >= self.maxTimesLoadingMore) {
        self.isLoadingMore = false;
        self.timesLoadingMore = 1;
        self.$toasted.error(self.$customerText('message.notLoaded'));
        return;
      }
      self.isLoadingMore = true;
      self.core
        .loadMore(currentCommentId, { limit: 50 })
        .then(async (response) => {
          self.lastCommentId = response[0].id;
          if (!response || response.length < 20) {
            self.timesLoadingMore = self.maxTimesLoadingMore;
          }
          const element = document.getElementById(id);
          let ofs = 0;
          let timer = 1;
          if (!element) {
            self.timesLoadingMore += 1;
            const elementTop = document.getElementById(self.lastCommentId);
            scrollListToElement(elementTop);
            await self.loadMoreComment(id);
            return;
          }
          self.isLoadingMore = false;
          self.timesLoadingMore = 1;

          const blink = window.setInterval(() => {
            element.style.background = `rgba(255, 252, 218, ${Math.abs(
              Math.sin(ofs),
            )})`;
            ofs += 0.05;
            timer += 1;
            if (timer === 300) {
              window.clearInterval(blink);
              element.style.background = 'transparent';
            }
          }, 10);

          scrollListToElement(element);
        });
    },
    replaceMentionsInComment(comment, participantMap) {
      const allowedTypes = ['text', 'file_attachment', 'reply'];
      if (!allowedTypes.includes(comment.type)) {
        return comment;
      }

      let message = '';
      let params = null;

      switch (comment.type) {
        case 'file_attachment': {
          const caption = comment.payload.caption || '';
          params = {
            payload: {
              ...comment.payload,
              caption: this.resolveMentions(caption, participantMap),
            },
          };
          break;
        }

        case 'reply': {
          message = this.resolveMentions(
            comment.payload.text || '',
            participantMap,
          );
          const replyMessage = this.resolveMentions(
            comment.payload.replied_comment_message || '',
            participantMap,
          );

          let payload = {
            ...comment.payload,
            replied_comment_message: replyMessage,
            text: message,
          };

          if (
            comment.payload.replied_comment_type === 'file_attachment' &&
            comment.payload.replied_comment_payload
          ) {
            const messageCaption = this.resolveMentions(
              comment.payload.replied_comment_payload.caption || '',
              participantMap,
            );

            payload = {
              ...payload,
              replied_comment_payload: {
                ...comment.payload.replied_comment_payload,
                caption: messageCaption,
              },
            };
          }

          params = { payload };

          break;
        }

        default:
          // BROADCAST MESSAGE HANDLING
          if (
            comment.extras &&
            comment.extras.broadcast_message &&
            comment.extras.broadcast_message.is_broadcast
          ) {
            params = {
              extras: {
                ...comment.extras,
                body: this.resolveMentions(
                  comment.extras.body || '',
                  participantMap,
                ),
              },
            };
          } else {
            message = this.resolveMentions(
              comment.message || '',
              participantMap,
            );
            params = {
              message,
            };
          }
          break;
      }

      return Object.assign(
        Object.create(Object.getPrototypeOf(comment)),
        comment,
        params,
      );
    },

    resolveMentions(message, participantMap) {
      const regex = /@(\d+)/g;
      let tempMessage = message;
      let messageChanged = false;

      let match = regex.exec(tempMessage);
      while (match !== null) {
        const userId = match[1];
        const mention = match[0];
        const username = participantMap.get(userId);

        if (username) {
          tempMessage = tempMessage.replace(mention, username);
          messageChanged = true;
          regex.lastIndex = 0;
        }
        match = regex.exec(tempMessage);
      }

      return messageChanged ? tempMessage : message;
    },
    createParticipantMap(participants) {
      const participantMap = new Map();
      participants.forEach((p) => {
        const idMatch = p.email.match(/(\d+)/);
        if (idMatch) {
          participantMap.set(idMatch[1], p.username);
        }
      });
      return participantMap;
    },
  },
};
</script>

<style lang="stylus">
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
      fill $primary
    svg
      animation spin 1s ease-in-out infinite
.qcw-load-more
  font-size 9px
  text-align center
  margin 16px auto
  font-weight 600
  &.qcw-top-page
    width 100%
    color $mediumGrey
  &.qcw-load-more-btn
    width 110px
    border-radius 6px
    padding 4px 16px
    flex 1 100%
    color $white
    background-color $primary
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
    fill #fff
    margin 0 4px 0 0
    height 12px
    width 12px
    animation spin 1s ease-in-out infinite
  &.ic-failed__state
    width 20px !important
    height 20px !important
    margin-top 0px !important

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
  z-index  10
  > .loader
    position relative

.qcw-comments
  &::-webkit-scrollbar-track
    border-radius 10px
    background-color #fafafa

  &::-webkit-scrollbar
    width 8px
    background-color #fafafa

  &::-webkit-scrollbar-thumb
    border-radius 4px
    background-color #e0e0e0

.qcw-comments ul
  position relative
  list-style none
  margin 0
  padding 0

// .qcw-group, .parent--container
//   margin-top 16px
//   &.contain-date
//     margin-top 0
//     .qcw-comment
//       margin-top 20px
//   &.my--container
//     margin-top 0
//     .qcw-comment
//       margin-top 0

.reply-btn-wrapper
  position absolute
  overflow hidden
  top 0
  display none
  z-index 1
  animation fadeInLeftBig 0.3s ease-out
  transition background 0.3s ease-out

i.reply-btn
  overflow hidden
  height 24px
  cursor pointer
  width 24px
  border-radius 50%
  background $lightGrey
  display flex
  align-items center
  justify-content center
  .qc-icon
    margin-top 0
    width 16px
    height 10px

i.delete-btn,
  overflow hidden
  height 24px
  cursor pointer
  width 24px
  border-radius 50%
  background $lightGrey
  z-index 1
  animation fadeInLeftBig 0.3s ease-out
  transition background 0.3s ease-out

i.delete-btn
  display none
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

.reply-btn-wrapper
  right -54px

i.reply-btn
  &.reply-btn--me
    left -32px
    & svg.qc-icon
      width 16px
      height 14px

.qcw-comments li:hover
  .hover-effect
    .reply-btn-wrapper
      display flex
      flex-direction column
      align-items flex-start
      @media only screen and (max-width: 767px)
        gap 4px
    .qcw-comment__state
      display none
    .qcw-comment__time
      display none
    .delete-btn
      display inline-block
    .qcw-comment__more-wrapper
      display flex
      flex-direction column
      align-items flex-end
      @media only screen and (max-width: 767px)
        gap 4px

.qcw-comment__state
  animation:fadeInDown 0.3s ease-out

.qcw-comment-container
  padding 0 20px
  display flex
  flex-wrap wrap
  &.comment--me
    justify-content flex-end
    .qcw-avatar
      display none
  &.qcw-comment--file_attachment
    .qcw-comment__note
      color #23B098
      svg
        stroke #23B098

  &_carousel
    display flex
    // background red
    &.comment--me
     display flex-reverse
    //  background green

  &_echo
    display flex
    & .qcw-avatar
      height 33px
      width 33px

.qcw-comment-date
  text-align center
  flex 1 100%
  color $darkGrey
  text-transform capitalize
  font-size 12px
  font-style normal
  font-weight 400
  line-height 32px
  margin-block 16px
  &.extra-margin
    margin-top 24px
  div
    width 190px
    margin 0 auto
.qcw-comment
  display flex
  flex 0 auto


.qcw-avatar
  flex 0 0 24px
  display flex
  overflow hidden
  img
    width 24px
    height 24px
    border-radius 50%
  .comment--me &
    order 2
    text-align right

.qcw-comment__more--menu
  position absolute
  padding 16px
  margin auto
  top -12px
  left 0px
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
    left auto
    right 128px
    border-radius 8px
    box-shadow 0 4px 8px rgba( 0,0,0,.15)
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
        color $primary

.qcw-comment__info
  padding-bottom 7px
  margin-bottom 7px
  flex 1 100%
  display flex
  justify-content space-between
  align-items center

.qcw-comment__state
  font-size 11px
  text-transform lowercase
  color $darkGrey
  position absolute
  top 16px

  svg.qc-icon
      margin-top 3px
.qcw-comment--system_event
  margin-bottom 16px
  @media only screen and (min-width: 768px)
    margin-bottom 12px
    .qcw-comment-date
      margin-top unset
.qcw-comment
  .qcw-comment__time
      font-size 11px
      text-transform lowercase
      color $darkGrey
      position absolute
      min-width 50px
      top 8px
      right -58px
  .qcw-comment__time--second
      font-size 11px
      text-transform lowercase
      color $darkGrey
      font-weight 300

  .qcw-comment__username
    // Long sender names (e.g. a 43-char bot name) are cut to one line with an
    // ellipsis; the full name is in the title tooltip. A nowrap name would set the
    // bubble's min-content width and push it, with its time, out of the frame, so
    // the text stays wrappable and line-clamp does the one-line cut instead.
    min-width 0
    display -webkit-box
    -webkit-line-clamp 1
    /* autoprefixer: ignore next */
    -webkit-box-orient vertical
    overflow hidden
    word-break break-word
    font-size 12px
    font-style normal
    font-weight 600
    line-height 16px
    color $dark
    &.qcw-comment__username--hide{
      display  none
    }

  .qcw-comment__more-wrapper
    position absolute
    top 0
    left -55px
    display none
    z-index 1
    animation fadeInLeftBig 0.3s ease-out
    transition background 0.3s ease-out

  .qcw-comment__more
    overflow hidden
    padding 5px 0
    height 24px
    width 24px
    cursor pointer
    border-radius 50%
    background $lightGrey
    & svg.qc-icon
      display block
      width 12px
      height 12px
      margin 6px auto
      fill inherit
  &:not(.comment--last)
    .qcw-comment__message
      margin-bottom 4px
  &.comment--parent
    &.comment--last
      .qcw-comment__message
        border-radius 24px 24px 24px 4px
        @media only screen and (min-width: 768px)
          border-radius 16px 16px 16px 4px
    .qcw-comment__message
      border-bottom-left-radius 4px
      .qcw-comment__buttons_bc
        border-bottom-left-radius 4px
        border-bottom-right-radius 16px

  &.comment--mid
    .qcw-comment__message
      border-top-left-radius 4px
      border-bottom-left-radius 4px
      .qcw-comment__buttons_bc
        border-bottom-left-radius 4px
        border-bottom-right-radius 16px
  &.comment--last
    margin-bottom 16px
    @media only screen and (min-width: 768px)
      margin-bottom 12px
    .qcw-comment__message
      border-top-left-radius 4px
      .qcw-comment__buttons_bc
        border-bottom-left-radius 16px
        border-bottom-right-radius 16px
  a
    text-decoration none
    color $link
    &:hover
      text-decoration underline
      cursor pointer
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
      margin-left 8px
    &.comment--parent
      &.comment--last
        .qcw-comment__message
          border-radius 24px 24px 4px 24px
          @media only screen and (min-width: 768px)
            border-radius 16px 16px 4px 16px
      .qcw-comment__message
        margin-left 60px
        border-radius: 24px 24px 4px 24px;
        @media only screen and (min-width: 768px)
          border-radius 16px 16px 4px 16px
        .qcw-comment__buttons_bc
          border-bottom-right-radius 4px
          border-bottom-left-radius 16px
    &.comment--mid
      .qcw-comment__message
        margin-left 60px
        .qcw-comment__buttons_bc
          border-bottom-left-radius 16px
          border-bottom-right-radius 4px
    &:not(.comment--parent).comment--mid
      .qcw-comment__message
        border-radius: 24px 4px 4px 24px;
        @media only screen and (min-width: 768px)
          border-radius: 16px 4px 4px 16px;
    &:not(.comment--parent).comment--last
      .qcw-comment__message
        border-radius: 24px 4px 24px 24px;
        @media only screen and (min-width: 768px)
          border-radius: 16px 4px 16px 16px;
    a
      color $white
    .qcw-file-container
      a
        color $darkGrey
        &:hover
          color $link
    .message__image
      padding 4px

.qcw-container.qcw-container--wide
  .qcw-comment__more--menu
    ul
      top 25px

.failed-info
  text-align right
  margin-top 0px
  font-size 14px
  margin-bottom 4px
  width calc(100% - 27px)
  color $red
  span
    color $primary
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
  text-align center
  padding 8px 16px
  border-radius 6px
  flex 0 auto
  margin 0 auto
  font-size 12px
  font-style normal
  font-weight 400
  line-height 16px
  background-color $white
  border 1px solid $lightGrey
  color $darkGrey

.qcw-comment__message
  flex 0 auto
  padding 16px
  font-size 14px
  background $lightGrey
  position relative
  display flex
  flex-direction column
  align-items flex-start
  flex-wrap wrap
  max-width 352px
  border-radius 16px
  border 1px solid transparent
  gap 12px
  white-space: pre-line;
  @media only screen and (min-width: 768px)
    padding 12px
    gap 8px
  &.message__bot.carousel
    gap unset
    .qcw-comment__header
      padding 16px 16px 0
  .qcw-comment__header
    display flex
    align-items center
    gap 12px
    @media only screen and (min-width: 768px)
      gap 8px
      margin 4px
  .qcw-comment__content
    word-break break-word
    word-wrap break-word
    white-space pre-line

  &.qcw-comment-prevsession .qcw-file-container a { align-items center }

  &.qcw-comment-prevsession, .comment--me &.qcw-comment-prevsession
    background #9d9d9d !important
    border-color #9d9d9d !important
    color #FFF !important
    font-size 9px

  &.qcw-comment-prevsession blockquote {
    font-size 14px
    line-height 16px
    position relative
    margin-bottom 14px
    padding-bottom 14px
  }
  &.qcw-comment-prevsession blockquote:before {
    content ' '
    background #FFF
    height 1px
    width 25px
    position absolute
    left 0
    bottom 0
  }

  audio
    min-width 250px
    width 100%
  .comment--me &
    margin-left 0
    margin-right 0
    background $white
  .comment--last &
    margin-right 60px
  .comment--last-carousel &
    margin-left 0
    margin-right 60px
  .comment--parent.comment--me &
    margin-left 60px
  .comment--last.comment--me &
    margin-left 60px
    margin-right 0
  .comment--last-carousel.comment--me &
    margin-left 60px
    margin-right 0
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

@media only screen and (min-width: 768px)
  .qcw-container--wide
    .qcw-comment__message
      max-width 400px
@media only screen and (min-width: 1024px)
  .qcw-container--wide
    .qcw-comment__message
      max-width 800px

.deleted
  .qcw-comment__content
    font-size 13px
    color $red
.comment-text
  width 100%
  line-height 20px
  .comment-text__interactive
    border-left 4px solid #BFBFBF
    padding-left 10px
    line-height 19.6px
  .qcw-comment__content
    margin 0
    word-break break-word
    word-wrap break-word
    white-space pre-line
  .qcw-interactive__footer
    font-size 12px
    margin-top 16px
  .qcw-interactive__header
    font-weight 600
  .qcw-interactive__list
    display flex
    flex-direction column
    margin-top 8px
    overflow hidden
    border 1px solid #D9DEE7
    border-radius 8px
    background #FFFFFF
    color #172033
    white-space normal
  .qcw-interactive__section + .qcw-interactive__section
    border-top 1px solid #D9DEE7
  .qcw-interactive__section-title
    padding 8px 16px
    border-bottom 1px solid #D9DEE7
    background #F8FAFC
    color #64748B
    font-size 12px
    line-height 16px
    font-weight 600
  .qcw-interactive__item
    display flex
    flex-direction column
    gap 2px
    padding 12px 16px
    width 100%
    margin 0
    border 0
    background transparent
    color inherit
    font inherit
    text-align left
    cursor pointer
    &:hover:not(:disabled), &:focus-visible
      background #F1F5F9
      outline none
    &:disabled
      cursor default
  .qcw-interactive__item + .qcw-interactive__item
    border-top 1px solid #D9DEE7
  .qcw-interactive__item-title
    font-size 14px
    line-height 20px
    font-weight 500
  .qcw-interactive__description
    color #64748B
    font-size 12px
    line-height 18px
  .qcw-interactive__btn-call
    display flex
    align-items center
    justify-content center
    gap 8px
    .qc-icon
      margin-top: 0;
  .qcw-interactive__btn-cta_url
    display flex
    align-items center
    justify-content center
    gap 8px
    text-transform capitalize
  .qcw-interactive__btn-cta_url
    margin-top 16px
    padding-top 16px
    border-top 1px solid #FFFFFF
    .qc-icon
      margin-top 0
.qcw-comment__content
  iframe
    width 100%
    height auto
    display block
  img.emojione
    display inline-block
    vertical-align middle

.qcw-comment-fb-ads
  background-color $darkWhite
  border-radius $small-border-radius
  padding 12px
  display flex
  flex-direction row
  gap 12px
  align-items center
  margin-bottom 12px
  .thumbnail
      display grid
      place-items center
  .thumbnail-text
    color $darkGrey
    font-weight 700
    font-size 14px
    line-height 150%
    -webkit-text-decoration-line underline
    text-decoration-line underline
    text-decoration-thickness 1px
    text-underline-offset 4px
    -webkit-line-clamp 2
    -webkit-box-orient vertical
    overflow hidden
    display -webkit-box
    cursor pointer
  &__content
      margin-top 8px
      border-left solid 4px #BFBFBF
      padding-left 8px

.qcw-download-file-button
  display flex
  align-items center
  text-align center
  background $white
  border 1px solid $green
  color $green
  padding 8px 30px
  border-radius 24px
  cursor pointer
  outline none
  text-decoration none
  font-size 12px
  font-weight 600
  line-height 18px
  letter-spacing 0.005em
  .qc-icon
    margin-top 0
    width 18px
    height 18px
    margin-right 6px
  &:hover
    transform translatey(-2px)
.qcw-call
  &__outgoing
    display flex
    align-items center
    padding 12px
    border-radius 12px
    gap 12px
    background white
    .qc-icon
      margin-top 0px
      width 20px
      height 20px
      min-width 20px
      min-height 20px
    div
      display flex
      flex-direction column
      gap 4px

.qcw-contact-card
  display flex
  flex-direction column
  gap 8px
  .qcw-contact-card__text
    font-size 14px
    line-height 20px
  .qcw-contact-card__item
    display flex
    align-items center
    gap 12px
    padding 12px
    border-radius 12px
    background white
    border 1px solid #ECECEC
    color #0A0A0A
    .qc-icon
      margin-top 0px
      width 20px
      height 20px
      min-width 20px
      min-height 20px
      fill none
    span
      font-weight 600
      font-size 14px

.qcw-group
  .qcw-comment--cust
    .qcw-call__outgoing
      svg
        fill #565656
    .qcw-contact-card
      .qcw-contact-card__item
        color #0A0A0A

  &:not(:has(.qcw-comment--cust))
    .qcw-
      svg
        fill white
    .qcw-call__outgoing
      svg
        fill white
      background #249a86
    :has(.message__bot)
      .qcw-call__outgoing
        background #565656


.qcw-comment__message
 &.message__broadcast_button,
.qcw-comment__message
 &.message__flow_interactive
  border: 1px solid #ECECEC
  padding 0 !important;
  padding-top: 16px !important;
  & .qcw-comment__header
    padding-inline 16px !important;
  & .qcw-comment__content
    padding-inline 16px !important;
    padding-bottom 16px !important;

.qcw-comment__message
 &.message__request_contact_button
  border: 1px solid #ECECEC
  padding: 16px 0 0 !important;


@media screen and (max-width: 600px)
  .hidden-sm
    display none !important
</style>
