<template lang="pug">
   div(:id="`slider-container-${id}`" class="slider-container" )
    div(style="position: relative;")
      div(class="qcw-wa-carousel-container" :id="`slider-${id}`")
          div(class="float-btn left" @click="scrollTo('prev')" v-show="cards.length > 1 && !isMaxLeft") 
            svg(width='24' height='24' viewbox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg')
              path(fill-rule='evenodd' clip-rule='evenodd' d='M12 3.81818C16.5187 3.81818 20.1818 7.48131 20.1818 12C20.1818 16.5187 16.5187 20.1818 12 20.1818C7.48131 20.1818 3.81818 16.5187 3.81818 12C3.81818 7.48131 7.48131 3.81818 12 3.81818ZM22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12ZM11.3572 7.72081C10.1432 8.93474 8.91774 10.1382 7.7149 11.3631C7.36959 11.7148 7.37299 12.2958 7.72146 12.6435L11.3572 16.2792C11.7122 16.6342 12.2878 16.6342 12.6428 16.2792C12.9978 15.9242 12.9978 15.3486 12.6428 14.9935L10.5584 12.9091H15.6364C16.1384 12.9091 16.5455 12.5021 16.5455 12C16.5455 11.4979 16.1384 11.0909 15.6364 11.0909H10.5584L12.6428 9.00646C12.9978 8.65144 12.9978 8.07583 12.6428 7.72081C12.2878 7.36579 11.7122 7.36579 11.3572 7.72081Z' fill='#0A0A0A')

          div(class="float-btn right" @click="scrollTo('next')" v-show="cards.length > 1 && !isMaxRight") 
            svg(width='24' height='24' viewbox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg')
              path(fill-rule='evenodd' clip-rule='evenodd' d='M12 3.81818C7.48131 3.81818 3.81818 7.48131 3.81818 12C3.81818 16.5187 7.48131 20.1818 12 20.1818C16.5187 20.1818 20.1818 16.5187 20.1818 12C20.1818 7.48131 16.5187 3.81818 12 3.81818ZM2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12ZM12.6428 7.72081C13.8568 8.93474 15.0823 10.1382 16.2851 11.3631C16.6304 11.7148 16.627 12.2958 16.2785 12.6435L12.6428 16.2792C12.2878 16.6342 11.7122 16.6342 11.3572 16.2792C11.0022 15.9242 11.0022 15.3486 11.3572 14.9935L13.4416 12.9091H8.36364C7.86156 12.9091 7.45455 12.5021 7.45455 12C7.45455 11.4979 7.86156 11.0909 8.36364 11.0909H13.4416L11.3572 9.00646C11.0022 8.65144 11.0022 8.07583 11.3572 7.72081C11.7122 7.36579 12.2878 7.36579 12.6428 7.72081Z' fill='#0A0A0A')

          div(v-for="card, cardIdx in cards" :key="`card-wa-carousel-${cardIdx}`" class="qcw-wa-carousel-card" :id="`slider-item-${cardIdx}-${id}`" :style="messageStyle")
            img(v-if="card.header && card.header.type.toLowerCase() === 'image' && !card.header.is_blacklist" :src="card.header.value")
            div(v-if="card.header && card.header.type.toLowerCase() === 'image' && card.header.is_blacklist" class="cover-block") 
              div
                svg(width='24' height='24' class="svg-stroke" viewbox='0 0 24 24' fill='none' :stroke='messageStyle.color' xmlns='http://www.w3.org/2000/svg')
                  path(d='M19 3H5C3.89543 3 3 3.89543 3 5V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V5C21 3.89543 20.1046 3 19 3Z' stroke='inherit' fill='none' stroke-width='2' stroke-linecap='round' stroke-linejoin='round')
                  path(d='M8.5 10C9.32843 10 10 9.32843 10 8.5C10 7.67157 9.32843 7 8.5 7C7.67157 7 7 7.67157 7 8.5C7 9.32843 7.67157 10 8.5 10Z' stroke='inherit' fill='none' stroke-width='2' stroke-linecap='round' stroke-linejoin='round')
                  path(d='M21 15L16 10L5 21' stroke='inherit' fill='none' stroke-width='2' stroke-linecap='round' stroke-linejoin='round')

                span The .{{ card.header.ext }} not permitted. Contact your Administrator to more information!
            
            video(v-if="card.header && card.header.type.toLowerCase() === 'video' && !card.header.is_blacklist" controls='')
              source(:src='card.header.value' type='video/mp4')
              | Your browser does not support the video tag.

            div(v-if="card.header && card.header.type.toLowerCase() === 'video' && card.header.is_blacklist" class="cover-block") 
              div
                svg(width='24' height='24' class="svg-stroke" viewbox='0 0 24 24' fill='none' :stroke='messageStyle.color' xmlns='http://www.w3.org/2000/svg')
                  path(d='M23 7L16 12L23 17V7Z' stroke='inherit' fill='none' stroke-width='2' stroke-linecap='round' stroke-linejoin='round')
                  path(d='M14 5H3C1.89543 5 1 5.89543 1 7V17C1 18.1046 1.89543 19 3 19H14C15.1046 19 16 18.1046 16 17V7C16 5.89543 15.1046 5 14 5Z' stroke='inherit' fill='none' stroke-width='2' stroke-linecap='round' stroke-linejoin='round')
                span The .{{ card.header.ext }} not permitted. Contact your Administrator to more information!

            div(class="card-body") {{ card.body }}

            div(v-for="btn, btnIdx in card.buttons" :key="btnIdx" class="card-btn") 
              svg(v-if="btn.type === 'url'" class="svg-fill" width='18' height='18' viewbox='0 0 18 18' :fill='messageStyle.color' xmlns='http://www.w3.org/2000/svg')
                path(fill-rule='evenodd' clip-rule='evenodd' d='M3.75 5.25C3.55109 5.25 3.36032 5.32902 3.21967 5.46967C3.07902 5.61032 3 5.80109 3 6V14.25C3 14.4489 3.07902 14.6397 3.21967 14.7803C3.36032 14.921 3.55109 15 3.75 15H12C12.1989 15 12.3897 14.921 12.5303 14.7803C12.671 14.6397 12.75 14.4489 12.75 14.25V9.75C12.75 9.33579 13.0858 9 13.5 9C13.9142 9 14.25 9.33579 14.25 9.75V14.25C14.25 14.8467 14.0129 15.419 13.591 15.841C13.169 16.2629 12.5967 16.5 12 16.5H3.75C3.15326 16.5 2.58097 16.2629 2.15901 15.841C1.73705 15.419 1.5 14.8467 1.5 14.25V6C1.5 5.40326 1.73705 4.83097 2.15901 4.40901C2.58097 3.98705 3.15326 3.75 3.75 3.75H8.25C8.66421 3.75 9 4.08579 9 4.5C9 4.91421 8.66421 5.25 8.25 5.25H3.75Z' fill='inherit')
                path(fill-rule='evenodd' clip-rule='evenodd' d='M10.5 2.25C10.5 1.83579 10.8358 1.5 11.25 1.5H15.75C16.1642 1.5 16.5 1.83579 16.5 2.25V6.75C16.5 7.16421 16.1642 7.5 15.75 7.5C15.3358 7.5 15 7.16421 15 6.75V3H11.25C10.8358 3 10.5 2.66421 10.5 2.25Z' fill='inherit')
                path(fill-rule='evenodd' clip-rule='evenodd' d='M16.2803 1.71967C16.5732 2.01256 16.5732 2.48744 16.2803 2.78033L8.03033 11.0303C7.73744 11.3232 7.26256 11.3232 6.96967 11.0303C6.67678 10.7374 6.67678 10.2626 6.96967 9.96967L15.2197 1.71967C15.5126 1.42678 15.9874 1.42678 16.2803 1.71967Z' fill='inherit')

              svg(v-if="btn.type === 'quick_reply'" class="svg-fill" width='18' height='18' viewbox='0 0 18 18' :fill='messageStyle.color' xmlns='http://www.w3.org/2000/svg')
                g(clip-path='url(#clip0_8538_6000)')
                  path(fill-rule='evenodd' clip-rule='evenodd' d='M7.38922 1.55955C7.66638 1.67709 7.8464 1.94897 7.8464 2.25002V5.18184H8.36563C11.8479 5.18184 13.9685 6.89551 15.3445 9.05756C16.4149 10.7394 17.062 12.7464 17.5895 14.3826C17.7184 14.7825 17.8402 15.1602 17.9593 15.5056C18.0689 15.8234 17.9536 16.1753 17.6772 16.3666C17.4008 16.558 17.0309 16.5421 16.772 16.3277C16.2666 15.9094 15.8197 15.5314 15.4157 15.1897C14.2953 14.2421 13.5044 13.5731 12.7096 13.0941C11.7037 12.4879 10.7081 12.2046 9.00025 12.2046H7.8464V15.1364C7.8464 15.4439 7.65863 15.7203 7.3727 15.8336C7.08677 15.9469 6.76065 15.8742 6.54998 15.6501L0.203821 8.90012C-0.077096 8.60132 -0.0659235 8.1323 0.228902 7.84722L6.57506 1.71085C6.79148 1.50158 7.11206 1.442 7.38922 1.55955ZM1.80325 8.41147L6.3464 13.2437V11.4546C6.3464 11.0404 6.68219 10.7046 7.0964 10.7046H9.00025C10.9224 10.7046 12.1987 11.0349 13.4838 11.8094C14.1824 12.2304 14.8897 12.79 15.7094 13.4747C15.2855 12.2359 14.7883 10.9774 14.0791 9.86293C12.9166 8.03635 11.2296 6.68184 8.36563 6.68184H7.0964C6.68219 6.68184 6.3464 6.34605 6.3464 5.93184V4.0185L1.80325 8.41147Z' fill='inherit')
                defs
                  clippath#clip0_8538_6000
                    rect(width='18' height='18' fill='inherit')

              svg(v-if="btn.type === 'phone_number'" class="svg-fill" width='18' height='18' viewbox='0 0 18 18' :fill='messageStyle.color' xmlns='http://www.w3.org/2000/svg')
                path(fill-rule='evenodd' clip-rule='evenodd' d='M5.79765 2.60888C5.29792 2.12716 3.79034 2.45943 3.16932 2.45942C2.76263 2.45999 2.41595 2.84485 2.44932 3.25004C2.88391 7.35821 5.21747 11.1901 8.67944 13.4087L8.68508 13.4123C10.467 14.5777 12.4947 15.3058 14.6058 15.5384C14.9049 15.5632 15.2077 15.382 15.3285 15.1035C15.4584 14.8038 15.5679 14.1825 15.5513 13.5106C15.5406 13.0743 15.5149 12.4618 15.218 12.1084C14.682 11.4704 13.9216 11.2518 13.0988 11.3461C12.2587 11.4423 11.4293 11.8627 10.9012 12.3953C10.6709 12.6276 10.3151 12.676 10.032 12.5136C8.10741 11.41 6.5139 9.80297 5.41957 7.86205C5.25858 7.57652 5.30661 7.2177 5.53692 6.98543C5.93336 6.58562 6.24601 6.33231 6.47702 6.00161C6.93984 5.33906 6.33026 3.86874 6.10587 3.18466C6.00957 2.89111 5.90442 2.71179 5.79765 2.60888ZM6.79748 1.55394C6.4229 1.19286 5.93143 0.995055 5.3362 1.00009L3.16894 1.00009C1.90407 1.00129 0.896174 2.13176 1.00857 3.38609L1.00968 3.39747C1.25905 5.76575 2.05784 8.04153 3.34137 10.0406C4.50838 11.8919 6.06487 13.4616 7.90052 14.6386C9.87376 15.9285 12.1194 16.7338 14.4572 16.99L14.4702 16.9913C15.3896 17.0751 16.2828 16.5452 16.6543 15.6882C16.9001 15.1213 17.0173 14.2646 16.9979 13.4744C16.988 13.0685 16.9415 12.6483 16.8431 12.2603C16.7467 11.8804 16.5883 11.482 16.322 11.1651C15.4025 10.0706 14.1169 9.76076 12.9355 9.89608C11.9752 10.0061 11.036 10.4113 10.3098 10.9803C8.96468 10.1222 7.82329 8.97621 6.96652 7.62397C7.20178 7.39422 7.46396 7.12266 7.65996 6.84207C8.55542 5.5602 7.85277 2.57117 6.79748 1.55394Z' fill='inherit')

              span {{ btn.button_text }}
</template>

<script>
import Icon from './Icon';

export default {
  name: 'CommentWaCarousel',
  props: ['comment', 'messageStyle', 'id', 'whitelistedFiles'],
  components: {
    Icon,
  },
  data() {
    return {
      activeCard: 0,
    };
  },
  computed: {
    cards() {
      return this.comment.extras.cards.map(card => ({
        ...card,
        header: {
          ...card.header,
          is_blacklist: this.getBLStatus(card.header.value),
          ext: this.getExt(card.header.value),
        },
      }));
    },
    isMaxLeft() {
      const targetId = `slider-item-${this.activeCard}-${this.id}`;
      const targetElement = document.getElementById(targetId);
      if (!targetElement) return true;

      return targetElement.offsetLeft === 0;
    },
    isMaxRight() {
      const targetId = `slider-item-${this.activeCard}-${this.id}`;
      const targetElement = document.getElementById(targetId);
      if (!targetElement) return false;

      const totalWidthEl = targetElement.offsetLeft + targetElement.clientWidth;
      const sliderContainer = document.getElementById(`slider-${this.id}`);
      const sliderWidth = sliderContainer.scrollWidth;

      return totalWidthEl >= sliderWidth;
    },
    isBlacklistedFiles() {
      if (this.whitelistedFiles && this.whitelistedFiles.length > 0) {
        return !this.whitelistedFiles.includes(this.ext);
      }
      return false;
    },
  },
  methods: {
    scrollTo(goto = 'next') {
      const containerWidth = 258; // should be card width

      const slider = document.getElementById(`slider-${this.id}`);
      const totalCards = this.cards.length;

      if (goto === 'next') {
        if (this.activeCard + 1 < totalCards) {
          this.activeCard += 1;
        }

        slider.scrollBy(258, 0);
      } else {
        if (this.activeCard > 0) {
          this.activeCard -= 1;
        }

        slider.scrollBy(-containerWidth, 0);
      }
    },
    getBLStatus(fileName) {
      const ext = this.getExt(fileName);

      if (!this.whitelistedFiles || this.whitelistedFiles.length === 0)        { return false; }

      return !this.whitelistedFiles.includes(ext);
    },
    getExt(fileName) {
      return fileName.split('.').pop();
    },
  },
};
</script>

<style lang="stylus" scoped>
@import '../assets/stylus/_variables.styl'

.slider-container
  user-select none
  display flex
  justify-content flex-end
  font-size 14px

  .float-btn
    background white
    position absolute
    top 30%
    width 40px
    height 40px
    border-radius 100%
    display grid
    place-items: center
    box-shadow 1px 7px 12px 0px #0000001A
    cursor pointer
    z-index 1
    &.left
      left 0
      transform translateX(-20px)
    &.right
      right 0px
      transform translateX(20px)

.qcw-wa-carousel-container
  border-radius 8px
  display flex
  max-width 380px
  gap 8px
  align-item stretch !important
  overflow-x auto
  -ms-scroll-snap-type x mandatory
  scroll-snap-type x mandatory
  scroll-behavior smooth
  overflow -moz-scrollbars-none
  /* Firefox */
  -ms-overflow-style none
  /* IE and Edge */
  scrollbar-width none
  /* Firefox */

  .qcw-wa-carousel-card
    background: $darkWhite
    border-radius 24px
    min-width 240px !important
    scroll-snap-align start
    overflow hidden
    display flex
    flex-direction column
    max-width 240px
    border 1px solid $lightGrey
    img, video
      width 100%
      height 180px
      background black
    img
      object-fit cover
    video
      aspect-ratio 4/3

    .cover-block
      width 100%
      height 180px
      display: grid
      place-items: center
      padding 12px
      text-align: center

      div
        display: flex
        flex-direction: column
        gap: 8px
        align-items: center

    .card-body
      padding 12px 16px
      flex 1
      word-break break-word
      word-wrap break-word
      white-space pre-line
    .card-btn
      display flex
      border-top 1px solid $lightGrey
      padding 12px 16px
      gap 10px
      justify-content center
      align-items center
</style>
