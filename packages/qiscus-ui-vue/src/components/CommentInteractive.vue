<template lang="pug">
  div(class="interactive")
    div(class='product-sections')
      table
        tbody
          tr
            td Catalog ID
            td
              strong {{ interactive.catalog_id }}
          tr
            td(style='width: 100px;') Product Retailer ID
            td
              div(style='max-width: 200px;')
                strong {{ interactive.product_retailer_id }}
    p Customer interest in your product:
</template>

<script>

export default {
  name: 'QiscusInteractiveComment',
  props: ['interactive'],
};
</script>


<style lang="stylus">
  @import '../assets/stylus/_variables.styl'
  .interactive
    .product-sections
      padding: 0 12px
      border-radius: 8px
      background: rgba(0, 0, 0, 0.05)
    table
      border-collapse:separate
      vertical-align: baseline
      border-spacing: 0
      overflow: hidden
      tr
        th
          border-bottom: thin solid rgba(255, 255, 255, 0.50)
          padding: 12px 0
        td
          vertical-align: baseline
          border-top: thin solid rgba(255, 255, 255, 0.50)
          padding: 12px 0
          color: #565656
          strong
            color: #0A0A0A
        &:first-child
          td
            border: none
    p
      margin-top: 8px
      margin-bottom: 8px
</style>