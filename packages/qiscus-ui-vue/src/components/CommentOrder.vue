<template lang="pug">
  div(class="order")
    div Catalog ID : 
      strong {{ order.catalog_id }}
    div(v-for='(item, index) in order.product_items' :key='index' class='product-sections')
      table
        tbody
          tr
            td(style='width: 100px;') Product Retailer ID
            td
              div(style='max-width: 200px;')
                strong {{ item.product_retailer_id }}
          tr
            td Quantity
            td
              strong {{ item.quantity }}
          tr
            td Price
            td
              strong {{ item.currency +' '+ item.item_price }}
</template>

<script>

export default {
  name: 'QiscusOrderComment',
  props: ['order'],
};
</script>


<style lang="stylus">
  @import '../assets/stylus/_variables.styl'
  .order
    display: flex
    flex-direction: column
    margin-bottom: 10px
    gap: 10px
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
</style>