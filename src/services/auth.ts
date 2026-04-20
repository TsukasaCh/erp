import axios from 'axios';
import crypto from 'crypto';
import { env } from '../config/env';
import { prisma } from '../db/client';

export const auth = {
  // ---------- Shopee ----------
  shopeeAuthUrl(redirectUri: string): string {
    const path = '/api/v2/shop/auth_partner';
    const timestamp = Math.floor(Date.now() / 1000);
    const baseString = `${env.shopee.partnerId}${path}${timestamp}`;
    const sign = crypto.createHmac('sha256', env.shopee.partnerKey).update(baseString).digest('hex');
    const params = new URLSearchParams({
      partner_id: env.shopee.partnerId,
      timestamp: String(timestamp),
      sign,
      redirect: redirectUri,
    });
    return `${env.shopee.baseUrl}${path}?${params.toString()}`;
  },

  async shopeeExchangeCode(code: string, shopId: string) {
    const path = '/api/v2/auth/token/get';
    const timestamp = Math.floor(Date.now() / 1000);
    const baseString = `${env.shopee.partnerId}${path}${timestamp}`;
    const sign = crypto.createHmac('sha256', env.shopee.partnerKey).update(baseString).digest('hex');
    const res = await axios.post(`${env.shopee.baseUrl}${path}`, {
      code,
      shop_id: Number(shopId),
      partner_id: Number(env.shopee.partnerId),
    }, { params: { partner_id: env.shopee.partnerId, timestamp, sign } });
    const { access_token, refresh_token, expire_in } = res.data;
    await persist('shopee', shopId, access_token, refresh_token, expire_in);
  },

  async shopeeRefresh(shopId: string) {
    const cred = await prisma.shopCredentials.findUnique({
      where: { platform_shopId: { platform: 'shopee', shopId } },
    });
    if (!cred?.refreshToken) throw new Error('shopee: no refresh token');
    const path = '/api/v2/auth/access_token/get';
    const timestamp = Math.floor(Date.now() / 1000);
    const baseString = `${env.shopee.partnerId}${path}${timestamp}`;
    const sign = crypto.createHmac('sha256', env.shopee.partnerKey).update(baseString).digest('hex');
    const res = await axios.post(`${env.shopee.baseUrl}${path}`, {
      refresh_token: cred.refreshToken,
      shop_id: Number(shopId),
      partner_id: Number(env.shopee.partnerId),
    }, { params: { partner_id: env.shopee.partnerId, timestamp, sign } });
    await persist('shopee', shopId, res.data.access_token, res.data.refresh_token, res.data.expire_in);
  },

  // ---------- TikTok Shop ----------
  tiktokAuthUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      app_key: env.tiktok.appKey,
      state,
      redirect_uri: redirectUri,
    });
    return `https://services.tiktokshop.com/open/authorize?${params.toString()}`;
  },

  async tiktokExchangeCode(code: string, shopId: string) {
    const res = await axios.get('https://auth.tiktok-shops.com/api/v2/token/get', {
      params: {
        app_key: env.tiktok.appKey,
        app_secret: env.tiktok.appSecret,
        auth_code: code,
        grant_type: 'authorized_code',
      },
    });
    const data = res.data?.data;
    await persist('tiktok', shopId, data.access_token, data.refresh_token, data.access_token_expire_in);
  },

  async tiktokRefresh(shopId: string) {
    const cred = await prisma.shopCredentials.findUnique({
      where: { platform_shopId: { platform: 'tiktok', shopId } },
    });
    if (!cred?.refreshToken) throw new Error('tiktok: no refresh token');
    const res = await axios.get('https://auth.tiktok-shops.com/api/v2/token/refresh', {
      params: {
        app_key: env.tiktok.appKey,
        app_secret: env.tiktok.appSecret,
        refresh_token: cred.refreshToken,
        grant_type: 'refresh_token',
      },
    });
    const data = res.data?.data;
    await persist('tiktok', shopId, data.access_token, data.refresh_token, data.access_token_expire_in);
  },

  async ensureFresh(platform: 'shopee' | 'tiktok', shopId: string) {
    const cred = await prisma.shopCredentials.findUnique({
      where: { platform_shopId: { platform, shopId } },
    });
    if (!cred) return;
    const fiveMinutes = 5 * 60 * 1000;
    if (cred.expiresAt && cred.expiresAt.getTime() - Date.now() < fiveMinutes) {
      if (platform === 'shopee') await auth.shopeeRefresh(shopId);
      else await auth.tiktokRefresh(shopId);
    }
  },
};

async function persist(
  platform: 'shopee' | 'tiktok',
  shopId: string,
  accessToken: string,
  refreshToken: string | null,
  expireInSeconds: number,
) {
  const expiresAt = new Date(Date.now() + (expireInSeconds ?? 3600) * 1000);
  await prisma.shopCredentials.upsert({
    where: { platform_shopId: { platform, shopId } },
    create: { platform, shopId, accessToken, refreshToken, expiresAt },
    update: { accessToken, refreshToken, expiresAt },
  });
}
