<template>
  <div class="qcw-custom-template" v-html="finalTemplate">
  </div>
</template>

<script>
import QiscusCore from '../lib/SDKCore';

export default {
  name: 'CommentCustom',
  props: ['data'],
  data() {
    return {
      finalTemplate: '',
    };
  },
  mounted() {
    // ambil dulu templatenya
    if (!QiscusCore.templateFunction) {
      this.finalTemplate = '<div>No template provided</div>';
      return false;
    }
    let temp = QiscusCore.templateFunction(this.data);
    if (!temp) return false;
    const rgx = /{(.*?)}/g;
    const matched = temp.match(rgx) || [];
    matched.forEach((r) => {
      // ambil array datanya
      let val = this.data;
      r.substring(1, r.length - 1)
        .split('.')
        .forEach((k) => {
          val = val[k];
        });
      temp = temp.replace(r, val);
    });
    this.finalTemplate = temp;
    return true;
  },
};
</script>
