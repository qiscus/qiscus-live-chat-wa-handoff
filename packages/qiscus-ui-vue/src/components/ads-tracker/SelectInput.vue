<template lang="pug">
  div(class="wrapper-dropdown" ref="dropdownContainer")
    input(type="text" :placeholder="showDropdown ? 'Search' : placeholder" @focus="toggleShowDropdown" v-model="seacrhKeyword" @input="$emit('search', seacrhKeyword)")
    div(v-if="showDropdown" class="dropdown-menu")
      ul
        li(v-for="(opt, i) in options" :key="i" @click="selectData(opt)") {{ opt.label }}
    Icon(name="ic-chevron-down" class="dropicon")
</template>
<script>
import Icon from '../Icon';

export default {
  name: 'SelectInput',
  components: {
    Icon,
  },
  props: {
    options: {
      type: Array,
      default: () => [],
    },
    placeholder: {
      type: String,
      default: 'Select',
    },
  },
  data() {
    return {
      showDropdown: false,
      selected: null,
      seacrhKeyword: '',
    };
  },
  methods: {
    toggleShowDropdown() {
      this.seacrhKeyword = '';
      this.showDropdown = true;
    },
    closeDropdown() {
      this.showDropdown = false;
      this.seacrhKeyword = '';
      if (this.selected) {
        this.seacrhKeyword = this.selected.label;
      }
    },
    clickedOutsideDropdown(e) {
      const clickedEl = e.target;
      if (this.$refs.dropdownContainer) {
        if (!this.$refs.dropdownContainer.contains(clickedEl)) {
          this.closeDropdown();
        }
      }
    },
    selectData(data) {
      this.selected = data;
      this.seacrhKeyword = data.label;
      this.$emit('change', data);
      this.closeDropdown();
    },
  },
  mounted() {
    window.addEventListener('click', this.clickedOutsideDropdown);
  },
  beforeDestroy() {
    window.removeEventListener('click', this.clickedOutsideDropdown);
  },
};
</script>
<style lang="stylus" scoped>
.wrapper-dropdown
  position: relative;
  width: 100%;
  .dropicon
    position: absolute;
    right: 0;
    top: 0;
    margin: 16px;
    width: 15px;
    height: 15px;
  input[type=text]
    font-size: 14px;
    font-style: normal;
    font-weight: 400;
    padding: 14px 16px;
    border: 1px solid #A0A0A0;
    border-radius: 6px;
    width: 100%;
    padding-right: 35px;
    &:focus
      outline-color: #2563EB;
  .dropdown-menu
    position: absolute;
    width: 100%;
    margin-top: 5px;
    border-radius: 6px;
    background: #FFF;
    left: 0;
    box-shadow: 0px 7px 17px 0px rgba(51, 51, 51, 0.07);
    margin-bottom: 20px;
    max-height: 160px;
    overflow-y: auto;
    &::-webkit-scrollbar-track
      border-radius: 10px;
      background-color: #fafafa;

    &::-webkit-scrollbar
      width: 8px;
      background-color: #fafafa;

    &::-webkit-scrollbar-thumb
      border-radius: 4px;
      background-color: #e0e0e0;
    ul
      list-style-type: none;
      margin: 0px;
      padding: 15px;
      li
        padding: 8px
        font-size: 14px;
        font-weight: 500;
        border-bottom: 1px solid #ECECEC;
        color: #0A0A0A;
        cursor: pointer;
        &:last-child
          border-bottom: none;
        &:hover
          background: #ECECEC;
</style>
