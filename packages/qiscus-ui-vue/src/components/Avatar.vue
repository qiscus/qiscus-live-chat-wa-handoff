<template lang="pug">
  div(class="qcw-avatar")
    img(:src="src" @error="imageFallback")
</template>

<script>
export default {
  name: 'Avatar',
  props: ['src'],
  methods: {
    imageFallback(e) {
      e.target.src = 'https://omnichannel.qiscus.com/img/default_avatar.svg';
    },
  },
};
</script>