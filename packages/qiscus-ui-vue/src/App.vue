<template lang="pug">
  .qcw-container(:class="{'qcw-container--open': chatWindowStatus, 'qcw-container--wide': core.mode=='wide'}")
    chat-window(v-if="core.isInit" :core="core" :toggleWindowStatus="toggleWindowStatus" :onBackToChannelIframe="onBackToChannelIframe")
    //- div(v-if="!core.isInit" class="qcw-connecting-indicator") Connecting to chat server ...
    qcw-trigger(:clickHandler="toggleWindowStatus" :core="core" :label="widgetButtonText" :icon="widgetButtonIcon")
</template>

<script>
import QiscusCore from './lib/SDKCore';
import QcwTrigger from './components/QcwTrigger';
import ChatWindow from './components/ChatWindow';
import {
  focusMessageForm,
  scrollIntoElement,
  scrollIntoLastElement,
} from './lib/utils';

export default {
  name: 'app',
  components: {
    QcwTrigger,
    ChatWindow,
  },
  computed: {
    widgetButtonText: () => QiscusCore.UI.widgetButtonText,
    widgetButtonIcon: () => QiscusCore.UI.widgetButtonIcon,
  },
  data() {
    return {
      core: QiscusCore,
      chatWindowStatus: false,
      roomId: null,
    };
  },
  created() {
    const self = this;
    const colors = {
      primary: '#01416C',
      white: '#FFFFFF',
      darkWhite: '#fafafa',
      lightGrey: '#F3F5F7',
      mediumGrey: '#979797',
      dark: '#0A0A0A',
      darkGrey: '#565656',
      green: '#94ca62',
      blue: '#34b6ff',
      red: '#ff2424',
      link: '#007BFF',
    };

    const colorConfig = {
      widgetButtonBackgroundColor: colors.green,
      widgetButtonTextColor: colors.white,

      headerBackgroundColor: colors.white,
      headerTitleColor: colors.dark,
      headerIconColor: colors.darkGrey,

      formMessageIconColor: colors.darkGrey,
      formMessageIconHoverColor: colors.primary,
      formMessagePlaceholderColor: colors.mediumGrey,
      formMessageTextColor: colors.dark,

      statusOnlineColor: colors.green,
      statusOfflineColor: colors.mediumGrey,
      statusTypingColor: colors.blue,

      bubleLeftColor: colors.lightGrey,
      bubleLeftTextColor: colors.dark,
      bubleRightColor: colors.primary,
      bubleRightTextColor: colors.white,

      messageTimeColor: colors.mediumGrey,
      messageStatusIconColor: colors.primary,
      messageFailedIconColor: colors.red,
    };
    const uiConfig = {
      showAvatar: true,
      showHeader: true,
      showCommentForm: true,
      showRepliedForm: false,
    };
    self.core.UI = {
      useCustomColors: false,
      colors: colorConfig,
      config: uiConfig,
      widgetButtonText: 'Talk to Us',
      widgetButtonIcon: null,
      isReading: false,
      isMessageInfoActive: false,
      messageInfoData: null,
      autoExpandWidget: false,
      emptyStateUrl: '',
      isPublishTyping: false,
      isBubbleRoomTyping: false,
      bubbleData: null,
      alternateUser: null,
      whitelistedFiles: '',
      isWaca: false,
      showChannelFormCount: false,
      maxChannelFormCount: null,
      maskFlowResponse: false,
      // Host (legacy inbox / widget config) sets this true to mask agent
      // names in agent-join/handover system events. See
      // helpers/systemEventMask.js. Seeded from window.hideSystemEventAgentName
      // because the host config request commonly resolves BEFORE this widget
      // renders (legacy inbox renders inside an async chain), so the host can't
      // rely on QiscusUI existing yet — it stashes the value on window instead.
      hideSystemEventAgentName:
        typeof window !== 'undefined' && window.hideSystemEventAgentName === true,
      displayMode: 'widget',
      chatTarget(target) {
        return self.core.chatTarget(target).then(
          (res) => {
            if (!self.chatWindowStatus && self.core.UI.autoExpandWidget) {
              self.toggleWindowStatus();
            }
            window.setTimeout(() => scrollIntoLastElement(self.core), 0);
            focusMessageForm();
            self.core.UI.isReading = false;
            QiscusUI.isMessageInfoActive = false;
            return Promise.resolve(res);
          },
          (err) => {
            self.$toasted.error(`Error opening chatroom: ${err}`);
            return Promise.reject(err);
          },
        );
      },
      chatGroup(id) {
        return self.core.chatGroup(id).then(
          (res) => {
            if (!self.chatWindowStatus && self.core.UI.autoExpandWidget) {
              self.toggleWindowStatus();
            }
            window.setTimeout(() => scrollIntoLastElement(self.core), 0);
            self.core.UI.isReading = false;
            focusMessageForm();
            QiscusUI.isMessageInfoActive = false;
            return Promise.resolve(res);
          },
          err => Promise.reject(err),
        );
      },
      gotoComment(comment) {
        if (!self.core.isInit) return Promise.reject('widget is not initiated');
        return self.core.chatGroup(comment.room_id).then(
          (res) => {
            self.core.UI.isReading = false;
            window.setTimeout(() => scrollIntoElement(comment.id), 0);
            focusMessageForm();
            return Promise.resolve(res);
          },
          err => Promise.reject(err),
        );
      },
      setCustomColors(customColors) {
        self.core.UI.useCustomColors = true;
        self.core.UI.colors = Object.assign(self.core.UI.colors, customColors);
      },
    };
    window.QiscusUI = self.core.UI;
  },
  methods: {
    toggleWindowStatus() {
      // cache room id if not null
      // if (this.core.selected) this.roomId = this.core.selected.id;
      // if (this.chatWindowStatus) {
      //   this.core.exitChatRoom();
      // }
      // if (!this.chatWindowStatus && this.roomId) QiscusUI.chatGroup(this.roomId);
      this.chatWindowStatus = !this.chatWindowStatus;
      // send a toggle window status event to parent
      window.parent.postMessage({ event_name: 'toggle-widget' }, '*');
    },
    onBackToChannelIframe() {
      this.chatWindowStatus = false;
      window.parent.postMessage({ event_name: 'open-previous-form' }, '*');
    },
  },
};
</script>

<style lang="stylus">
@import './assets/stylus/_variables.styl'

.qcw-container
  font-family "Inter", sans-serif
  -webkit-font-smoothing antialiased
  -moz-osx-font-smoothing grayscale
  line-height 150%

.toasted-container
  font-family "Inter", sans-serif
  &.bottom-right
    position: fixed
    bottom: 20px
    right: 42px
    border-radius 30px
    .toasted
      margin-top 8px
      padding: 10px 15px
      background-color $yellow
      color $darkGrey
      .action
        margin 0 8px
        padding 0
        color $darkGrey
        &:first-child
          margin-left 16px;
        &:last-child
          color $blue
        &:hover
          color $red
          text-decoration none;
      &.bubble
        line-height 150%
        font-size 16px
        &.error
          background-color $red
          color $white
          .action:hover
            color $white
        &.success
          background-color $green
        &.info
          background-color $blue

.qcw-container
  color #444
  position: fixed
  bottom: 20px
  right: 42px
  display flex
  flex-direction column
  align-items flex-end

  &.qcw-container--open
    @media screen and (max-width: 600px)
      bottom 0
      right 0

  &.qcw-container--wide
    position relative
    top 0
    right 0
    bottom auto
    width 100%
    height 100%
    & .qcw-chat-wrapper
      bottom 0
      border-radius 0
      width 100%
      height 100% !important
.qcw-connecting-indicator
  background #FFF
  padding 20px
  border-radius 20px
.qcw-container *, .qcw-container *:after, .qcw-container *:before
  box-sizing border-box
@-moz-keyframes spin { 100% { -moz-transform: rotate(360deg); } }
@-webkit-keyframes spin { 100% { -webkit-transform: rotate(360deg); } }
@keyframes spin { 100% { -webkit-transform: rotate(360deg); transform:rotate(360deg); } }
@keyframes fadeInDown {
  from {
    opacity: 0;
    transform: translate3d(0, -20%, 0);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translate3d(0, 20%, 0);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes fadeInZoom {
  from {
    opacity: 0;
    transform: scale3d(.4, .4, .4) translate3d(85%, 0, 0);
  }
  to {
    opacity: 1;
    transform: scale3d(1, 1, 1)
  }
}

@keyframes fadeInLeftBig {
  from {
    opacity: 0;
    transform: translate3d(-100%, 0, 0);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
</style>
