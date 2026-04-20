export type InternalStatus = 'to_ship' | 'shipped' | 'completed' | 'cancelled';

const SHOPEE_MAP: Record<string, InternalStatus> = {
  UNPAID: 'to_ship',
  READY_TO_SHIP: 'to_ship',
  PROCESSED: 'to_ship',
  SHIPPED: 'shipped',
  TO_CONFIRM_RECEIVE: 'shipped',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

const TIKTOK_MAP: Record<string, InternalStatus> = {
  UNPAID: 'to_ship',
  AWAITING_SHIPMENT: 'to_ship',
  AWAITING_COLLECTION: 'to_ship',
  IN_TRANSIT: 'shipped',
  DELIVERED: 'shipped',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

export function mapShopeeStatus(s: string): InternalStatus {
  return SHOPEE_MAP[s.toUpperCase()] ?? 'to_ship';
}

export function mapTiktokStatus(s: string): InternalStatus {
  return TIKTOK_MAP[s.toUpperCase()] ?? 'to_ship';
}
