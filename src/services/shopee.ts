import axios from 'axios';
import crypto from 'crypto';
import { env } from '../config/env';

function sign(path: string, timestamp: number, extra = ''): string {
  const baseString = `${env.shopee.partnerId}${path}${timestamp}${env.shopee.accessToken}${env.shopee.shopId}${extra}`;
  return crypto.createHmac('sha256', env.shopee.partnerKey).update(baseString).digest('hex');
}

function buildUrl(path: string): { url: string; params: Record<string, string | number> } {
  const timestamp = Math.floor(Date.now() / 1000);
  const sign_ = sign(path, timestamp);
  return {
    url: `${env.shopee.baseUrl}${path}`,
    params: {
      partner_id: env.shopee.partnerId,
      timestamp,
      access_token: env.shopee.accessToken,
      shop_id: env.shopee.shopId,
      sign: sign_,
    },
  };
}

export interface ShopeeOrder {
  order_sn: string;
  order_status: string;
  buyer_username?: string;
  total_amount: number;
  create_time: number;
  item_list?: Array<{ item_sku: string; model_quantity_purchased: number; model_discounted_price: number }>;
}

export const shopee = {
  async listOrdersSince(unixSeconds: number): Promise<ShopeeOrder[]> {
    const path = '/api/v2/order/get_order_list';
    const { url, params } = buildUrl(path);
    const res = await axios.get(url, {
      params: {
        ...params,
        time_range_field: 'create_time',
        time_from: unixSeconds,
        time_to: Math.floor(Date.now() / 1000),
        page_size: 50,
        response_optional_fields: 'order_status',
      },
    });
    const list: Array<{ order_sn: string }> = res.data?.response?.order_list ?? [];
    if (list.length === 0) return [];

    const detailPath = '/api/v2/order/get_order_detail';
    const detail = buildUrl(detailPath);
    const detailRes = await axios.get(detail.url, {
      params: {
        ...detail.params,
        order_sn_list: list.map((o) => o.order_sn).join(','),
        response_optional_fields:
          'buyer_username,item_list,total_amount,order_status,create_time',
      },
    });
    return detailRes.data?.response?.order_list ?? [];
  },

  async updateStock(itemId: string, stock: number): Promise<void> {
    const path = '/api/v2/product/update_stock';
    const { url, params } = buildUrl(path);
    await axios.post(url, {
      item_id: Number(itemId),
      stock_list: [{ model_id: 0, normal_stock: stock }],
    }, { params });
  },
};
