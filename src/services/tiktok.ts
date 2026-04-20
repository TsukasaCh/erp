import axios from 'axios';
import crypto from 'crypto';
import { env } from '../config/env';

function sign(path: string, query: Record<string, string | number>): string {
  const sortedKeys = Object.keys(query).filter((k) => k !== 'sign' && k !== 'access_token').sort();
  const concatenated =
    env.tiktok.appSecret +
    path +
    sortedKeys.map((k) => `${k}${query[k]}`).join('') +
    env.tiktok.appSecret;
  return crypto.createHmac('sha256', env.tiktok.appSecret).update(concatenated).digest('hex');
}

function baseQuery(): Record<string, string | number> {
  return {
    app_key: env.tiktok.appKey,
    timestamp: Math.floor(Date.now() / 1000),
    shop_id: env.tiktok.shopId,
    version: '202309',
  };
}

export interface TiktokOrder {
  order_id: string;
  order_status: string;
  buyer_email?: string;
  payment_info?: { total_amount: string };
  create_time: number;
  line_items?: Array<{ seller_sku: string; quantity: number; sale_price: string }>;
}

export const tiktok = {
  async listOrdersSince(unixSeconds: number): Promise<TiktokOrder[]> {
    const path = '/api/orders/search';
    const query = baseQuery();
    const signature = sign(path, query);
    const res = await axios.post(
      `${env.tiktok.baseUrl}${path}`,
      {
        create_time_from: unixSeconds,
        create_time_to: Math.floor(Date.now() / 1000),
        page_size: 50,
      },
      {
        params: { ...query, sign: signature, access_token: env.tiktok.accessToken },
      },
    );
    return res.data?.data?.order_list ?? [];
  },

  async updateStock(productId: string, sku: string, stock: number): Promise<void> {
    const path = '/api/products/inventory/update';
    const query = baseQuery();
    const signature = sign(path, query);
    await axios.put(
      `${env.tiktok.baseUrl}${path}`,
      {
        product_id: productId,
        skus: [{ id: sku, stock_infos: [{ available_stock: stock }] }],
      },
      { params: { ...query, sign: signature, access_token: env.tiktok.accessToken } },
    );
  },
};
