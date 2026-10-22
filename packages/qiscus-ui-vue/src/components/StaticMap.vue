<template lang="pug">
  div
    div
      a(:href="mapurl" target="_blank")
        img(:src="google_map_url" :alt="name")
      br
      strong {{ name }}
</template>

<script>
export default {
  name: 'StaticMap',
  props: ['name', 'message', 'lat', 'lng', 'mapurl', 'mapkey'],
  data() {
    return {
      google_map_url: `http://maps.google.com/maps/api/staticmap?center=${this.lat},${this.lng}&size=250x100&zoom=14&sensor=false&key=${this.mapkey}`,
    };
  },
};
</script>
