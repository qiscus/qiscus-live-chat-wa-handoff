<template>
  <span class="loader" :style="{ width: width, height: height, borderWidth: borderWidth}"></span>
</template>

<script>
  export default {
    props: ['width', 'height', 'borderWidth'],
  };
</script>

<style>
  .loader {
    border-radius: 50%;
    width: 70px;
    height: 70px;
    border-width: 5px;
    margin-top: 120px;
    position: fixed;
    border: 5px solid rgba(148, 202, 98,.4);
    border-top-color: #94ca62;
    display: inline-block;
    animation: rotate .9s ease-out infinite;
  }
  @keyframes rotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>