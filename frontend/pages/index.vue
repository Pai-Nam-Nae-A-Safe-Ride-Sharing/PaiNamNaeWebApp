<template>
    <div class="ctn">
        
        <div><h1>หน้าแรกของเว็บไซต์</h1></div>
        <img src="/image/2.jpg" alt="">
    </div>
</template>

<script setup>
    useHead({
        title:"หน้าแรกของเว็บไซต์"
    })
</script>

<style scoped>
    .ctn{
        display: flex;
        justify-content: center;
        align-items: center;
        flex-direction: column;
        gap: 20px;

        img{
            width: 500px;
            height: 500px;
        }
    }
</style>