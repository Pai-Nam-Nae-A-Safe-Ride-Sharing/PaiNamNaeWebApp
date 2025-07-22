<template>
    <div class="container">
        <div v-for="product in data.products">
            <NuxtLink :to="`/products/${product.id}`">
                <h2>{{ product.title }}</h2>
            </NuxtLink>
            <div class="img">
                <img :src=product.thumbnail>

            </div>
        </div>
    </div>
</template>

<script setup>
const { data: data } = await useFetch('https://dummyjson.com/products?limit=10')
// console.log(data)
</script>

<style scoped>
.container {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 2em;

    div {
        width: 300px;
        height: 300px;
        background-color: aqua;
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    .img {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 200px;
        height: 200px;

        img {
            width: 100%;
            height: 100%;
        }
    }
}
</style>