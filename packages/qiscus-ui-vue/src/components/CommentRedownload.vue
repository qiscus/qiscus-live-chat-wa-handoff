<template lang="pug">
  div
    div(v-html="rendered_text" class="qcw-comment__content redownload")
    div(class="qcw-comment__note")
      i
        icon(name="ic-info")
      small Customer will not receive this information
</template>

<script>
import Icon from './Icon';
import QiscusTextParser from '../lib/textparser';

export default {
  name: 'CommentRedownload',
  components: { Icon },
  props: ['message', 'sender', 'timestamp'],
  data() {
    return {
      rendered_text: this.message,
    };
  },
  computed: {},
  created() {
    this.rendered_text = `${QiscusTextParser.parse(this.message)}${this.sender} on ${this.getLocaleDateTime(this.timestamp)}, at ${this.getLocaleTime(this.timestamp)}.`;
    this.rendered_text = (typeof emojione !== 'undefined') ? emojione.toImage(this.rendered_text) : this.rendered_text;
  },
  methods: {
    getLocaleDateTime(timestamp) {
      const time = timestamp * 1000;
      const date = new Date(time);
      const y = new Intl.DateTimeFormat('en-US', { year: 'numeric' }).format(date);
      const m = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(date);
      const d = new Intl.DateTimeFormat('en-US', { day: '2-digit' }).format(date);
      if (!date) return '';
      return `${d} ${m} ${y}`;
    },
    getLocaleTime(timestamp) {
      const time = timestamp * 1000;
      let date = new Date(time);
      date = date.toLocaleTimeString('en-US', { hour12: false });
      if (!date) return '';
      return date.substr(0, 5);
    },
  },
};
</script>

<style lang="stylus">
  @import '../assets/stylus/_variables.styl'
  .qcw-comment__content.redownload
    margin-bottom: 20px
  .qcw-comment__note
    display: flex
    align-items: center
    i
      display: flex
      margin-right: 6px
      svg 
        margin-top: 0
</style>