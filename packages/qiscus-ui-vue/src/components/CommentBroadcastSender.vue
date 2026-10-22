<template lang="pug">
   div(class="broadcast-sender-container")
     div(class="broadcast-sender-container__by") Broadcast sent by {{ senderLabel }}
     div(v-if="broadcastedAt" class="broadcast-sender-container__at") Sent at {{ broadcastedAt }}
 </template>

<script>
export default {
  name: 'CommentBroadcastSender',
  props: {
    broadcasterName: {
      type: String,
      required: true,
    },
    broadcasterRole: {
      type: String,
      default: '',
    },
    broadcastedAt: {
      type: String,
      default: '',
    },
  },
  computed: {
    // "Broadcast sent by {Name} - {Role}"; falls back to name only when role is unknown
    senderLabel() {
      return this.broadcasterRole
        ? `${this.broadcasterName} - ${this.broadcasterRole}`
        : this.broadcasterName;
    },
  },
};
</script>

<style lang="stylus" scoped>
.broadcast-sender-container
 display flex
 flex-direction column
 padding 4px 12px
 background #FAFAFA
 border 1px solid #BFBFBF
 border-radius 8px
 font-size 10px
 font-weight 500
 line-height 16px
 letter-spacing 0.005em
 height fit-content
 margin-bottom: 4px
 text-wrap nowrap

.broadcast-sender-container__at
 margin-top 2px
 padding-top 3px
 border-top 1px solid #ECECEC
 font-weight 400
 text-align right
</style>
