<template lang="pug">
  div.qcw-trigger-btn(@click="clickHandler" :style="buttonStyle")
    img(v-if="icon" :src="icon")
    div(v-if="label") {{ (label) }}
</template>

<script>
export default {
  name: 'QiscusTriggerButton',
  props: ['label', 'icon', 'clickHandler', 'core'],
  computed: {
    buttonStyle: function buttonStyle() {
      const style = {
        background: this.core.UI.colors.widgetButtonBackgroundColor,
        color: this.core.UI.colors.widgetButtonTextColor,
      };
      return style;
    },
  },
};
</script>

<style lang="stylus">
@import '../assets/stylus/_variables.styl'

.qcw-trigger-btn
  background: $primary
  color: $white
  padding: 10px
  border-radius: $big-border-radius
  vertical-align middle
  text-align center
  cursor pointer
  transition all .3s ease
  box-shadow 0 7px 16px rgba(46,46,46,.15)
  margin-top: 15px
  display: flex;
  align-items: center;
  justify-content: center;

  & > div {
    margin-left 8px
  }
  img
    margin-right 8px
    display block
    width 32px
    height 32px
  & > *:first-child{
    margin 0;
  }

  @media screen and (max-width: 600px)
    position relative
    z-index 0

  &:hover
    transform translateY(-3px)
    box-shadow 0 7px 16px rgba(46,46,46,.25)

  .qcw-container.qcw-container--wide &
    display none
</style>
