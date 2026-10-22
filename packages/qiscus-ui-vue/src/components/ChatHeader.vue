<template lang="pug">
div.qcw-header(:style="headerStyle")
  span(v-if="isChannelEnable" @click.prevent="$emit('back-to-channel')" style="padding: 5px 8px;")
    icon(name="ic-chevron-left" :fill="headerIconColor" style="margin: 0;cursor: pointer;")
  div.qcw-header-avatar
    img(v-if="!wagAvatar" :src="avatar" @error="imageFallback")
    icon(v-if="wagAvatar" name="ic-wagroup" style="width: 48px; height: 48px; border-radius: 50%; margin-top: 6px;")
  div.qcw-header-info(@click="$emit('header-click')")
    div
      div.qcw-user-display-name(:style="displayNameStyle" v-html="displayName" :title="displayName")
      div.qcw-user-status.qcw-user-status--group(v-if="(isGroup || isWaGroup) && !showTypingStatus" :style="userStatusStyle") {{ participants }}
      div.qcw-user-status.status--istyping(v-if="showTypingStatus" :style="typingStatusStyle") {{ typingStatus }}
      div.qcw-user-status.participant-count(v-if="isChannel") {{ participantsCount }} participants
      div.qcw-user-status(
        v-if="!showTypingStatus && !isGroup"
        :class="{'status--online': isOnline, 'status--lastseen': !isOnline}"
        :style="onlineStatusStyle") {{ userStatus }}
  i.qcw-window-toggle-btn(@click.prevent="$emit('toggle-window')")
    icon(name="ic-minimize" :fill="headerIconColor")
  //- div(v-if="isChannelEnable" :style="closeBtnStyle" @click.prevent="$emit('toggle-window')")
  //-   img(:src="closeBtnImg")

</template>

<script>
import Icon from './Icon';

export default {
  name: 'ChatHeader',
  components: { Icon },
  props: ['core'],
  data() {
    return {
      typingStatusId: -1,
    };
  },
  mounted() {
    window.$comp = this;
  },
  computed: {
    isChannel() {
      return this.core.selected.isChannel;
    },
    avatar() {
      const isSelected = this.core.selected != null;
      const isAvatarEmpty = this.core.selected.avatar === '';
      if (isSelected && !isAvatarEmpty) {
        if (this.core.selected.avatar.includes('//image.flaticon.com/icons')) {
          return 'https://omnichannel.qiscus.com/img/default_avatar.svg';
        }
        return this.core.selected.avatar;
      }
      return 'https://qiscuss3.s3.amazonaws.com/uploads/55c0c6ee486be6b686d52e5b9bbedbbf/2.png';
    },
    displayName() {
      return this.core.selected.name
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    },
    showTypingStatus() {
      if (this.core.isTypingStatus) {
        if (this.typingStatusId !== -1) {
          window.clearTimeout(this.typingStatusId);
          this.typingStatusId = -1;
        }
        this.typingStatusId = window.setTimeout(() => {
          this.core.isTypingStatus = '';
        }, 3000);
        return true;
      }
      return false;
    },
    isGroup() {
      return this.core.selected.room_type === 'group';
    },
    isWaGroup() {
      if (!this.core.selected || !('options' in this.core.selected))        { return false; }
      const check = this.core.selected.options
        ? JSON.parse(this.core.selected.options)
        : {};
      return Object.keys(check).length > 0 && check.type
        ? check.type === 'wa_group' || check.room_type === 'wa_group'
        : false;
    },
    wagAvatar() {
      return (
        this.isWaGroup &&
        this.core.selected.avatar &&
        this.core.selected.avatar.includes('default_avatar.svg')
      );
    },
    participantsCount() {
      return this.core.selected.participantNumber;
    },
    participants() {
      const limit = 3;
      const overflowCount = this.core.selected.participants.length - limit;
      const participants = this.core.selected.participants
        .slice(0, limit)
        .map(item => item.username.split(' ')[0]);
      if (this.core.selected.participants.length <= limit)        { return participants.join(', '); }
      return participants.concat(`and ${overflowCount} others.`).join(', ');
    },
    typingStatus() {
      return this.core.isTypingStatus;
    },
    userStatus() {
      return this.core.chatmateStatus;
    },
    isOnline() {
      return this.userStatus === 'Online';
    },
    headerStyle() {
      return { background: this.core.UI.colors.headerBackgroundColor };
    },
    displayNameStyle() {
      return { color: this.core.UI.colors.headerTitleColor };
    },
    reactiveColor() {
      if (this.core.isTypingStatus) {
        return this.core.UI.colors.statusTypingColor;
      } else if (this.isOnline && !this.isGroup) {
        return this.core.UI.colors.statusOnlineColor;
      }
      return this.core.UI.colors.statusOfflineColor;
    },
    userStatusStyle() {
      return { color: this.reactiveColor };
    },
    typingStatusStyle() {
      return { color: this.reactiveColor };
    },
    onlineStatusStyle() {
      return { color: this.reactiveColor };
    },
    headerIconColor() {
      return this.core.UI.colors.headerIconColor;
    },
    closeBtnStyle() {
      return {
        position: 'absolute',
        top: '7px',
        right: '7px',
        color: this.core.UI.colors.headerIconColor,
        fontSize: '30px',
        zIndex: '9000',
        cursor: 'pointer',
      };
    },
    closeBtnImg() {
      return 'https://s3-ap-southeast-1.amazonaws.com/qiscus-sdk/public/qismo/img/close-circle.svg';
    },
    isChannelEnable() {
      return window && window.is_channel_widget_enable
        ? window.is_channel_widget_enable
        : false;
    },
  },
  methods: {
    imageFallback(e) {
      e.target.src = 'https://omnichannel.qiscus.com/img/default_avatar.svg';
    },
  },
};
</script>
