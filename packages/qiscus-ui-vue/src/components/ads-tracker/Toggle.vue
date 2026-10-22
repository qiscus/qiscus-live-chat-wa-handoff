<template lang="pug">
  span(v-if="isEligible" class="qcw-icon" title="Ads Tracker" @click="showAdsTrackerPopup")
    label
      icon(name="ic-ads-tracker" :fill="core.UI.colors.formMessageIconColor")
</template>
<script>
import Icon from '../Icon';

export default {
  name: 'AdsTrackerToggle',
  components: {
    Icon,
  },
  props: ['core'],
  computed: {
    isEligible() {
      if (!this.core.selected || !('options' in this.core.selected)) return false;
      const parseOptions = this.core.selected.options ? JSON.parse(this.core.selected.options) : {};
      const isWaChannel = Object.keys(parseOptions).length > 0 ? parseOptions.channel.toLowerCase().includes('wa') : false;
      return this.isAddonEnabled && isWaChannel;
    },
    isAgentMode() {
      return this.core.mode === 'wide';
    },
  },
  data() {
    return {
      isAddonEnabled: null,
    };
  },
  mounted() {
    if (this.isAddonEnabled === null
      && this.isAgentMode
      && window.adsTracker
      // eslint-disable-next-line no-underscore-dangle
      && window.adsTracker._baseUrl) {
      window.adsTracker.isRegistered()
        .then((res) => {
          this.isAddonEnabled = res.registered || false;
        });
    }
  },
  methods: {
    showAdsTrackerPopup() {
      this.$emit('show', true);
    },
  },
};
</script>
