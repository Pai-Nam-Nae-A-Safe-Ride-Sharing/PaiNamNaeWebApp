<template>
    <div>
        <header>
            
            <nav>
                <h1 class="logo">Joey Shop</h1>
                <NuxtLink to="/">หน้าแรก</NuxtLink>
                <NuxtLink to="/about">เกี่ยวกับ</NuxtLink>
                <NuxtLink to="/products">สินค้าทั้งหมด</NuxtLink>
            </nav>
        </header>
        <div><slot/></div>
    </div>
</template>

<script setup>

</script>

<style scoped>
    nav{
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 10px;
        background-color: blue;
        padding: 1em;
        

        a{
            text-decoration: none;
            color:white
        }
        .logo{
            margin-right: auto;
            color:white


        }
    }
</style>