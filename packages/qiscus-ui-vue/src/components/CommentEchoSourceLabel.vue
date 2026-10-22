<template lang="pug">
  div(class="echo-source-label-container")
    span(v-html="message.icon" class="echo-source-label__icon")
    span {{ message.text }}
</template>

<script>
const TIKTOK_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z" stroke="#0F172A" stroke-width="1.5" stroke-linejoin="round"/><path d="M10.5359 11.0075C9.71585 10.8916 7.84666 11.0834 6.93011 12.7782C6.01355 14.4729 6.9373 16.2368 7.51374 16.9069C8.08298 17.5338 9.89226 18.721 11.8114 17.5619C12.2871 17.2746 12.8797 17.0603 13.552 14.8153L13.4738 5.98145C13.3441 6.95419 14.4186 9.23575 17.478 9.5057" stroke="#0F172A" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const WHATSAPP_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 13.3789 2.27907 14.6926 2.78382 15.8877C3.06278 16.5481 3.20226 16.8784 3.21953 17.128C3.2368 17.3776 3.16334 17.6521 3.01642 18.2012L2 22L5.79877 20.9836C6.34788 20.8367 6.62244 20.7632 6.87202 20.7805C7.12161 20.7977 7.45185 20.9372 8.11235 21.2162C9.30745 21.7209 10.6211 22 12 22Z" stroke="#0F172A" stroke-width="1.5" stroke-linejoin="round"/><path d="M8.58815 12.3773L9.45909 11.2956C9.82616 10.8397 10.2799 10.4153 10.3155 9.80826C10.3244 9.65494 10.2166 8.96657 10.0008 7.58986C9.91601 7.04881 9.41086 7 8.97332 7C8.40314 7 8.11805 7 7.83495 7.12931C7.47714 7.29275 7.10979 7.75231 7.02917 8.13733C6.96539 8.44196 7.01279 8.65187 7.10759 9.07169C7.51023 10.8548 8.45481 12.6158 9.91948 14.0805C11.3842 15.5452 13.1452 16.4898 14.9283 16.8924C15.3481 16.9872 15.558 17.0346 15.8627 16.9708C16.2477 16.8902 16.7072 16.5229 16.8707 16.165C17 15.8819 17 15.5969 17 15.0267C17 14.5891 16.9512 14.084 16.4101 13.9992C15.0334 13.7834 14.3451 13.6756 14.1917 13.6845C13.5847 13.7201 13.1603 14.1738 12.7044 14.5409L11.6227 15.4118" stroke="#0F172A" stroke-width="1.5"/></svg>`;

export default {
  name: 'CommentEchoSourceLabel',
  props: {
    channel: {
      type: String,
      default: '',
    },
  },
  computed: {
    message() {
      if (this.channel && this.channel.toLowerCase() === 'tiktok') {
        return { text: this.$customerText('echo.tiktok'), icon: TIKTOK_ICON };
      }
      return { text: this.$customerText('echo.whatsapp'), icon: WHATSAPP_ICON };
    },
  },
};
</script>

<style lang="stylus" scoped>
.echo-source-label-container
  display flex
  align-items center
  gap 4px
  padding 4px 8px
  background #FAFAFA
  border 1px solid #BFBFBF
  border-radius 8px
  font-size 10px
  font-weight 500
  letter-spacing 0.005em
  height fit-content
  margin-bottom 4px
  text-wrap nowrap

.echo-source-label__icon
  display flex
  align-items center
  flex-shrink 0
</style>
