<template lang="pug">
  div(class="qcw-comment__buttons")
    div(class="action_buttons" v-for="ct in content" :key="ct.action.label")
      button(v-if="ct.action.type == 'postback'" disabled)
        span {{ ct.action.label }}
</template>

<script>
export default {
  name: 'QiscusCommentButtonQuickReply',
  props: ['content'],
};
</script>
