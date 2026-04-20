import 'dotenv/config';

export const env = {
  port: Number(process.env.PORT ?? 3000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  syncCron: process.env.SYNC_INTERVAL_CRON ?? '*/5 * * * *',

  shopee: {
    partnerId: process.env.SHOPEE_PARTNER_ID ?? '',
    partnerKey: process.env.SHOPEE_PARTNER_KEY ?? '',
    shopId: process.env.SHOPEE_SHOP_ID ?? '',
    accessToken: process.env.SHOPEE_ACCESS_TOKEN ?? '',
    baseUrl: process.env.SHOPEE_BASE_URL ?? 'https://partner.shopeemobile.com',
  },

  tiktok: {
    appKey: process.env.TIKTOK_APP_KEY ?? '',
    appSecret: process.env.TIKTOK_APP_SECRET ?? '',
    shopId: process.env.TIKTOK_SHOP_ID ?? '',
    accessToken: process.env.TIKTOK_ACCESS_TOKEN ?? '',
    baseUrl: process.env.TIKTOK_BASE_URL ?? 'https://open-api.tiktokglobalshop.com',
  },
};
