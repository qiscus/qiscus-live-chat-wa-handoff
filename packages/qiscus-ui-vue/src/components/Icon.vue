<template lang="pug">
  svg(class="qc-icon" :style="{ fill: fillOverride }")
    use(:xlink:href="xlink")
</template>

<script>
export default {
  name: 'Icon',
  props: ['name', 'fill'],
  computed: {
    xlink() { return `#${this.name}`; },
    fillOverride() { return this.fill; },
  },
};
</script>

<style lang="stylus">
@import '../assets/stylus/_variables.styl'
.qc-icon 
  display inline-block
  margin-top 6px
  width 20px
  height 20px
  fill $darkGrey
  transition fill 0.3s ease-out

.qc-icon--light 
  fill #FFF

</style>

