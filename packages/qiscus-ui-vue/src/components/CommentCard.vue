<template lang="pug">
  div(class="comment__card--container")
    <div class="comment__card--image image-loader">
      <div class="loading-image-container"  v-if="isLoading"> 
        <i class="">
          <icon name="ic-load"></icon>
        </i> {{ $customerText('common.imageLoading') }}
      </div>
      <div class="qcw-image-container" v-if="!isLoading" :style="{'background-image':'url('+imageSource+')'}">
      </div>
    </div>
    strong(class="comment__card--title") {{ data.title }}
    div(class="comment__card--description") {{ data.description }}
    comment-buttons(:buttons="data.buttons" :postbackHandler="postbackSubmit")
</template>

<script>
import Icon from './Icon';
import QiscusCore from '../lib/SDKCore';
import CommentButtons from './CommentButtons';

export default {
  name: 'QiscusCardComment',
  components: { Icon, CommentButtons },
  props: ['data'],
  data() {
    return {
      isLoading: true,
      isImage: false,
      isError: false,
    };
  },
  created() {
    this.loadImage();
  },
  computed: {
    imageSource() {
      if (this.isError || this.data.image === '') {
        // return 'https://s3-ap-southeast-1.amazonaws.com/qiscus-sdk/public/image_placeholder.png';
      }
      return this.data.image;
    },
  },
  methods: {
    loadImage() {
      const self    = this;
      const payload = this.data;
      const xhr = new XMLHttpRequest();

      xhr.onreadystatechange = function attachImage() {
        if (this.readyState === 4 && this.status === 200) {
          self.isError  = false;
          self.isLoading = false;
          // setTimeout( () => self.callback(), 0 );
        }
      };

      xhr.open('GET', payload.image, true);
      xhr.onerror = function throwLoadingError() {
        self.isLoading = false;
        self.isError = true;
      };
      // xhr.setRequestHeader('Authorization', 'Token token='+window.doctortoken);
      xhr.send();
      return true;
    },
    postbackSubmit(button) {
      const topicId = QiscusCore.selected.id;
      const labelToSend = button.postback_text ? button.postback_text : button.label;
      const nanotimestamp = (window.performance.now() + window.performance.timeOrigin);
      const uniqueId = `${topicId}_${nanotimestamp}`;
      QiscusCore.sendComment(
        topicId,
        labelToSend,
        uniqueId,
        'button_postback_response',
        JSON.stringify(button.payload),
      )
        .then((res) => {
          this.core.options.sentMessageCallback(res);
        });
    },
  },
};
</script>


<style lang="stylus">
  @import '../assets/stylus/_variables.styl'
  .qcw-comment__message.card > .tip
    display none
  // .comment--me
  //   .comment__card--container
  //     .comment__card--image .loading-image-container
  //       background-color $white
  .comment__card--container
    margin-left -8px
    margin-right -8px
    border-radius 8px
    background-color $white
    border-radius 8px
    .comment__card--description
      padding 0 8px
      font-size 11px
    .comment__card--image
      border-bottom 1px solid $lightGrey
      height 160px
      margin-top -8px
      .loading-image-container.loading-image-container
        height 100%
        background-color $lightGrey
        border-radius 8px 8px 0 0
        i
          margin-top 40px
      .qcw-image-container
        max-height 160px
        height 160px
        margin 0
        width 210px
        background-size cover
        background-position center
        background-color transparent
        background-position center center
        border-radius 8px 8px 0 0
    .comment__card--title
      text-transform capitalize
      font-size 12px
      font-weight 600
      margin 0px
      padding 8px
      display block
    .qcw-comment__buttons
      margin-left 8px
      margin-right 8px
</style>
