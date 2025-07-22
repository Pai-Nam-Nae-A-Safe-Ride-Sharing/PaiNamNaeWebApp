<template>
    <div>
        <Head>
            <Title>{{ product.title }}</Title>
        </Head>
        <h1>รายละเอียดสินค้าแต่ละชิ้น{{ id }}</h1>
        <img :src=product.thumbnail>
        <h2>{{ product.title }}</h2>
        <p>Price:{{ product.price }}</p>
    </div>
</template>

<script setup>
const { id } = useRoute().params
const { data: product } = await useFetch('https://dummyjson.com/products/' + id)
// console.log(product)

</script>

<style scoped></style>