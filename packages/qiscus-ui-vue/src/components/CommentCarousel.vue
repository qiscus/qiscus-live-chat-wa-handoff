<template lang="pug">
  div(class="comment__carousel")
    //- <!-- cards -->
    i(@click='prev')
      icon(name="ic-chevron-left")
    div.carousel-container(ref="carouselContainer")
      div(ref="carousel")
        div(class="qcw-carousel__item" ref="carouselItem" v-for="(card, index) in cards")
            comment-card(:data="card"
              :key="index")
    i(@click='next')
      icon(name="ic-chevron-right")


    //- <!-- bullets -->
    //- ul(class="carousel__bullets")
      li(v-for="(card, index) in cards"
          @click="gotoCard(index)"
          :class="{'active': index == currentNumber}")
            div(class="ic-bullet")
</template>

<script>
import CommentCard from './CommentCard';
import Icon from './Icon';

export default {
  name: 'QiscusCommentCarousel',
  props: ['cards', 'mode'],
  components: { CommentCard, Icon },
  data() {
    return {
      cardLength: this.cards.length,
      currentIndex: 0,
      timer: null,
    };
  },
  methods: {
    getViewport() {
      const containerWidth = this.$refs.carouselContainer.offsetWidth;
      const paddingLeftContainer = parseInt(
        window.getComputedStyle(this.$refs.carouselContainer).paddingLeft,
        10,
      );
      const paddingRightContainer = parseInt(
        window.getComputedStyle(this.$refs.carouselContainer).paddingRight,
        10,
      );
      const paddingContainer = paddingLeftContainer + paddingRightContainer;
      const innerContainer = containerWidth - paddingContainer;
      return {
        containerWidth,
        paddingLeftContainer,
        paddingRightContainer,
        paddingContainer,
        innerContainer,
      };
    },
    getCurrentPosition(el) {
      const transformStyle = el.style.transform;
      let currentPosition = parseInt(
        transformStyle.replace(/[^-\d.]/g, ''),
        10,
      );
      if (!currentPosition) {
        currentPosition = 0;
      }
      return currentPosition;
    },
    cardWidth() {
      return (
        this.$refs.carouselItem[0].offsetWidth +
        parseInt(
          window.getComputedStyle(this.$refs.carouselItem[0]).marginLeft,
          10,
        ) +
        parseInt(
          window.getComputedStyle(this.$refs.carouselItem[0]).marginRight,
          10,
        )
      );
    },
    next() {
      const slideTranslate = this.cardWidth();

      // count carousel viewport size
      const viewport = this.getViewport();

      // card that can viewed on the view port at the same time
      const cardsOnViewPort = Math.floor(
        viewport.innerContainer / slideTranslate,
      );

      // count carousel width
      const carouselWidth = this.$refs.carousel.offsetWidth;
      const cardLastIndex = Math.ceil(this.cardLength / cardsOnViewPort) - 1;

      if (cardsOnViewPort === this.cardLength) {
        console.log('Doing Nothing');
      } else if (this.currentIndex !== cardLastIndex) {
        // get current position
        const currentPosition = this.getCurrentPosition(this.$refs.carousel);

        if (this.currentIndex + 1 === cardLastIndex) {
          const leftOver =
            (carouselWidth - viewport.innerContainer) + currentPosition;
          this.$refs.carousel.style.transform = `translateX(${currentPosition -
            leftOver}px)`;
        } else {
          this.$refs.carousel.style.transform = `translateX(${currentPosition -
            (cardsOnViewPort * slideTranslate)}px)`;
        }
        this.currentIndex = this.currentIndex + 1;
      }
    },
    prev() {
      const slideTranslate = this.cardWidth();

      // count carousel viewport size
      const viewport = this.getViewport();

      // card that can viewed on the view port at the same time
      const cardsOnViewPort = Math.floor(
        viewport.innerContainer / slideTranslate,
      );

      // count carousel width
      // const carouselWidth = this.$refs.carousel.offsetWidth;
      // this.cardLastIndex = Math.floor(this.cardLength / cardsOnViewPort) - 1;

      if (cardsOnViewPort === this.cardLength) {
        console.log('Doing Nothing');
      } else if (this.currentIndex !== 0) {
        // get current position
        const currentPosition = this.getCurrentPosition(this.$refs.carousel);

        // width of the overflowed element
        // const carouselMod = carouselWidth % viewport.innerContainer;

        if (this.currentIndex === 1) {
          this.$refs.carousel.style.transform = 'translateX(0px)';
        } else {
          this.$refs.carousel.style.transform = `translateX(${currentPosition +
            (cardsOnViewPort * slideTranslate)}px)`;
        }
        this.currentIndex = this.currentIndex - 1;
      }
    },
  },
};
</script>

<style lang="stylus">
@import '../assets/stylus/_variables.styl'
.qcw-comment-container.qcw-comment--carousel
  padding 0
  flex-direction column
  .qcw-comment__time
    position absolute
    top 28px
    right 32px
  .qcw-comment__message
    margin 0
    padding 0
    max-width none;
    &.carousel
      background-color transparent
      box-shadow none
    & > .tip
      display none
  .qcw-comment
    flex 1
    overflow: visible
    width 100%
    position: relative;
    &.comment--me
      justify-content flex-end
      .qcw-comment__time
        position absolute
        top 28px
      .qcw-comment__state
        left 32px
        margin-top 28px
      .qcw-comment__message.message__bot.carousel
        right 20px
    .qcw-comment__username
      top 28px
      left 64px
    .qcw-comment__message
      &.carousel
        .reply-btn-wrapper
          position absolute
          top 28px
          right 32px
.comment__carousel
  overflow hidden
  display flex
  max-width 352px
  &:hover
    & > i
      opacity 1
      &:hover
        .qc-icon
          fill $green
  & > i
    align-self center
    cursor pointer
    position absolute
    z-index 1
    opacity 0
    transition opacity 0.3s ease-out
    background white
    border-radius 50%
    width 40px
    height 40px
    display flex
    align-items center
    justify-content center
    box-shadow 0px 0px 12px 4px rgba(10, 10, 10, 0.10)
    svg
      margin-top unset
      paddding-bottom 4px
    &:first-child
      padding-right 6px
    &:last-child
      padding 4px 8px
      right 0
@media only screen and (min-width: 768px)
  .qcw-container--wide
    .comment__carousel
      max-width 400px
.carousel-container
  display flex
  padding 16px
  overflow-x hidden
  & > div
    display flex
    position relative
    transition all 0.75s ease-out
    gap 12px
  .qcw-carousel__item
    .comment__card--container
      margin-right 0px
      margin-left 0px
      width 256px
      background-color white
      border-radius 8px
      box-shadow 0 7px 16px rgba(199,199,199,0.25)
      .comment__card--image
        margin unset
        width 256px
        .qcw-image-container
          width 256px;
.extra-margin
  margin-bottom 36px
ul.carousel__bullets
  position: absolute;
  width: 100%;
  bottom -36px
ul.carousel__bullets,
ul.qcw-carousel__nav
  list-style: none;
  overflow: hidden;
  text-align: center;
ul.carousel__bullets li
  display: inline-block;
  cursor: pointer;
  margin: 4px 8px;
  color: #999;
  vertical-align: middle;
ul.carousel__bullets li.active
  font-size: 24px;
  font-weight: bold;
  color: #3498db;
.ic-bullet
  border: 2px solid $green;
  height: 8px;
  width: 8px;
  border-radius: 50%;
.active
  & > .ic-bullet
    background-color $green
    border: 2px solid $green;
</style>
