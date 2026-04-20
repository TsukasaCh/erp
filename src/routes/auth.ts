import { Router } from 'express';
import { auth } from '../services/auth';

export const authRouter = Router();

const REDIRECT_BASE = process.env.OAUTH_REDIRECT_BASE ?? 'http://localhost:3000';

// ---- Shopee ----
authRouter.get('/shopee/install', (_req, res) => {
  const url = auth.shopeeAuthUrl(`${REDIRECT_BASE}/api/auth/shopee/callback`);
  res.redirect(url);
});

authRouter.get('/shopee/callback', async (req, res) => {
  const { code, shop_id } = req.query;
  if (!code || !shop_id) return res.status(400).json({ error: 'missing code/shop_id' });
  try {
    await auth.shopeeExchangeCode(String(code), String(shop_id));
    res.json({ ok: true, platform: 'shopee', shop_id });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ---- TikTok ----
authRouter.get('/tiktok/install', (req, res) => {
  const state = String(req.query.state ?? 'erp');
  const url = auth.tiktokAuthUrl(`${REDIRECT_BASE}/api/auth/tiktok/callback`, state);
  res.redirect(url);
});

authRouter.get('/tiktok/callback', async (req, res) => {
  const { code, shop_id } = req.query;
  if (!code || !shop_id) return res.status(400).json({ error: 'missing code/shop_id' });
  try {
    await auth.tiktokExchangeCode(String(code), String(shop_id));
    res.json({ ok: true, platform: 'tiktok', shop_id });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Manual refresh trigger (debug)
authRouter.post('/refresh/:platform/:shopId', async (req, res) => {
  const { platform, shopId } = req.params;
  try {
    if (platform === 'shopee') await auth.shopeeRefresh(shopId);
    else if (platform === 'tiktok') await auth.tiktokRefresh(shopId);
    else return res.status(400).json({ error: 'invalid platform' });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
