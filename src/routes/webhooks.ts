import { Router } from 'express';
import crypto from 'crypto';
import { prisma } from '../db/client';
import { env } from '../config/env';
import { syncShopeeOrders, syncTiktokOrders } from '../services/sync';

export const webhooksRouter = Router();

// Shopee verifies push by HMAC SHA256(partner_key, url|body)
webhooksRouter.post('/shopee', async (req, res) => {
  const signature = req.header('Authorization');
  const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  const expected = crypto
    .createHmac('sha256', env.shopee.partnerKey)
    .update(`${url}|${JSON.stringify(req.body)}`)
    .digest('hex');
  if (signature && signature !== expected) {
    return res.status(401).json({ error: 'invalid signature' });
  }
  await prisma.webhookEvent.create({
    data: {
      platform: 'shopee',
      eventType: String(req.body?.code ?? 'unknown'),
      externalId: req.body?.data?.ordersn ?? null,
      payload: JSON.stringify(req.body),
    },
  });
  // Trigger immediate pull (idempotent upsert)
  syncShopeeOrders().catch((e) => console.error('shopee webhook sync failed', e));
  res.json({ ok: true });
});

// TikTok signs with X-Tts-Signature: HMAC-SHA256 of body using app_secret
webhooksRouter.post('/tiktok', async (req, res) => {
  const signature = req.header('X-Tts-Signature');
  const expected = crypto
    .createHmac('sha256', env.tiktok.appSecret)
    .update(JSON.stringify(req.body))
    .digest('hex');
  if (signature && signature !== expected) {
    return res.status(401).json({ error: 'invalid signature' });
  }
  await prisma.webhookEvent.create({
    data: {
      platform: 'tiktok',
      eventType: String(req.body?.type ?? 'unknown'),
      externalId: req.body?.data?.order_id ?? null,
      payload: JSON.stringify(req.body),
    },
  });
  syncTiktokOrders().catch((e) => console.error('tiktok webhook sync failed', e));
  res.json({ ok: true });
});
