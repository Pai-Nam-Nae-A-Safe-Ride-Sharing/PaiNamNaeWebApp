<template>
    <div>
        <h1>สินค้าทั้งหมดใน product</h1>
        <ul v-for="product in data.products">
            <li>{{  product.title}}</li>
        </ul>
    </div>
</template>

<script setup>
    const { data:data} = await useFetch('https://dummyjson.com/products?limit=10')
    console.log(data)
</script>

<style scoped></style>