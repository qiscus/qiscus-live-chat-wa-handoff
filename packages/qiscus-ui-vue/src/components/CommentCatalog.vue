<template lang='pug'>
  div(class='catalog')
    div Send {{ catalog.product_retailer_id ? 'single' : 'multiple' }} product from WhatsApp Catalog
    div Catalog ID : 
      strong {{ catalog.catalog_id }}
    div(v-if='catalog.product_retailer_id' class='product-sections')
      table
        tbody
          tr
            td(style='width: 100px;') Product Retailer ID
            td
              div(style='max-width: 200px;')
                strong {{ catalog.product_retailer_id }}
    div(v-if='!catalog.product_retailer_id' v-for='(obj, index) in catalog.sections' :key='index' class='product-sections')
      table
        thead
          tr
            th(colspan='2')
              strong {{ obj.title }}
        tbody
          tr(v-for='(item, idx) in obj.product_items' :key='idx')
            td(class='border-top' style='width: 100px;') Product Retailer ID
            td(class='border-top' )
              div( style='max-width: 200px;')
                strong {{ item.product_retailer_id }}
</template>

<script>

export default {
  name: 'QiscusCatalogComment',
  props: ['catalog'],
};
</script>


<style lang='stylus'>
  @import '../assets/stylus/_variables.styl'
  .catalog
    display: flex
    flex-direction: column
    margin-bottom: 10px
    gap: 10px
    .border-top
      border-top: thin solid rgba(255, 255, 255, 0.50)
    .product-sections
      padding: 0 12px
      border-radius: 8px
      background: rgba(0, 0, 0, 0.15)
      strong
        margin-bottom: 4px
      table
        border-collapse:separate
        vertical-align: baseline
        border-spacing: 0
        overflow: hidden;
        th
          border-bottom: thin solid rgba(255, 255, 255, 0.50)
          padding: 12px 0
          &:first-child
            border-left: none
        td
          vertical-align: baseline
          padding: 12px 0
          &:first-child
            border-left: none
</style>