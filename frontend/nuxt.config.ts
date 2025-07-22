// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  // compatibilityDate: '2025-05-15',
  // devtools: { enabled: true }
  app: {
    head: {
      // update Nuxt defaults
      title:"ร้านค้าโจอี้",
      meta:[
        {name:"description",content:"รายละเอียด"}
      ],
      charset: 'utf-16',
      viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
    }
  }
})
