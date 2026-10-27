<template lang="pug">
div
  .qcw-comment-fb-ads
    .thumbnail
      svg(
        xmlns="http://www.w3.org/2000/svg" 
        fill="none" 
        viewBox="0 0 32 32" 
        height="32" 
        width="32"
        )
        path(
          stroke-linejoin="round" 
          stroke-linecap="round" 
          stroke-width="2" 
          stroke="#979797" 
          d="M24 2.6665H20C18.2319 2.6665 16.5362 3.36888 15.286 4.61913C14.0358 5.86937 13.3334 7.56506 13.3334 9.33317V13.3332H9.33337V18.6665H13.3334V29.3332H18.6667V18.6665H22.6667L24 13.3332H18.6667V9.33317C18.6667 8.97955 18.8072 8.64041 19.0572 8.39036C19.3073 8.14031 19.6464 7.99984 20 7.99984H24V2.6665Z"
          )
    a.thumbnail-text(
      rel="noopener noreferrer" 
      target="_blank" 
      :href="comment.extras.referral.source_url"
      ) 
      | {{ comment.extras.referral.headline }}
  div Customer interest in your {{ type }}:
  div(class="qcw-comment-fb-ads__content")
    slot
</template>

<script>
export default {
  name: 'CommentFbAds',
  props: ['comment'],
  computed: {
    type() {
      return this.comment.extras.referral.source_type
        ? this.comment.extras.referral.source_type
        : 'post';
    },
  },
};
</script>
