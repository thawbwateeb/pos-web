/** Public surface of the API — narrowed to what the FE consumes. */

export type PermissionAction =
  | 'TAKE_ORDERS' | 'EDIT_ORDERS' | 'REFUND' | 'PAYMENTS' | 'CASH_DRAWER'
  | 'VIEW_REPORTS' | 'VIEW_FINANCE' | 'MANAGE_CATALOG' | 'MANAGE_PROMOS'
  | 'WHATSAPP' | 'MANAGE_STAFF' | 'SETTINGS';

export type OrderStatus = 'RECEIVED' | 'TAGGING' | 'CLEANING' | 'READY' | 'DELIVERY' | 'COMPLETED' | 'CANCELLED';
export type OrderType = 'WALK_IN' | 'PICKUP_DELIVERY';
export type PaymentMethod = 'CASH' | 'CARD' | 'APPLE_PAY' | 'ACCOUNT' | 'ON_DELIVERY' | 'GIFT_CARD';

export interface Bootstrap {
  user: {
    id: string; email: string; fullName: string; lastLoginAt: string | null;
    role: { id: string; name: string; isSystemManager: boolean; permissions: Record<PermissionAction, boolean> };
  };
  business: {
    id: string; slug: string; name: string; status: string; timezone: string; countryCode: string;
    branding: {
      brandName: string; tagline: string | null; logoFileKey: string | null;
      posPrimary: string; posAccent: string; appPrimary: string; appAccent: string; appBg: string;
      currency: string; receiptFooter: string;
    } | null;
    tax: { enabled: boolean; rate: string; mode: 'EXCLUSIVE' | 'INCLUSIVE'; label: string; trn: string | null; onReceipt: boolean } | null;
  };
  stores: Array<{ id: string; name: string; area: string | null; address: string | null; phone: string | null; trn: string | null; hours: string | null; active: boolean }>;
  activeStoreId: string;
}

export interface CatalogueCategory {
  id: string;
  externalKey: string;
  title: string;
  items: Array<{
    id: string;
    sku: string;
    name: string;
    iconKey: string | null;
    active: boolean;
    sortOrder: number;
    prices: Record<string, number>; // keyed by tier.externalKey
  }>;
}
export interface ServiceTier { id: string; externalKey: string; name: string; short: string; sortOrder: number; active: boolean }
export interface CatalogueResponse { categories: CatalogueCategory[]; tiers: ServiceTier[] }

export interface Customer {
  id: string; externalCode: string; fullName: string; phone: string; email: string | null;
  area: string | null; address: string | null; totalOrders: number; totalSpend: string;
  isSubscriber: boolean; notes: string | null;
  tags?: Array<{ tag: { id: string; name: string; color: string | null } }>;
  loyaltyBalance?: { balance: number; lifetimeEarned: number; lifetimeSpent: number } | null;
}

export interface Driver { id: string; name: string; zone: string | null; active: boolean; userId: string | null }

export interface Order {
  id: string; number: number; type: OrderType; status: OrderStatus;
  storeId: string; customerId: string | null; driverId: string | null;
  subtotal: string; total: string; paidAmount: string; paid: boolean;
  primaryMethod: PaymentMethod | null; dueAt: string | null; rackCode: string | null;
  createdAt: string; updatedAt: string;
  expressOn: boolean; expressPct: number; expressAmount: string;
  discountCode: string | null; discountAmount: string;
  taxRate: string; taxAmount: string; deliveryFee: string;
  customer?: { id: string; fullName: string; phone: string } | null;
  driver?: { id: string; name: string } | null;
  items?: Array<{ id: string; skuSnapshot: string; nameSnapshot: string; tierSnapshot: string; qty: number; unitPrice: string; lineTotal: string }>;
  _count?: { items: number };
}

export type OrdersBoard = Record<OrderStatus, Order[]>;

export interface Payment {
  id: string; orderId: string; method: PaymentMethod; status: string;
  amount: string; refundedAmount: string; cardLast4: string | null; cardBrand: string | null;
  processedAt: string | null; createdAt: string;
  order?: { id: string; number: number; total: string; customer: { fullName: string; phone: string } | null };
}

export interface Promo {
  id: string; code: string; description: string | null;
  kind: 'PERCENT' | 'AMOUNT'; value: string; active: boolean;
  uses: number; maxUses: number; maxPerCust: number;
  channel: 'POS' | 'ONLINE' | 'ALL'; auto: boolean;
  audience: 'ALL' | 'SPECIFIC';
}

export interface PickupSlot { id: string; label: string; capacity: number; kind: 'PICKUP' | 'DELIVERY' | 'BOTH'; active: boolean; sortOrder: number }

export interface Store { id: string; name: string; area: string | null; address: string | null; phone: string | null; trn: string | null; hours: string | null; active: boolean }

export interface Role { id: string; name: string; isSystemManager: boolean; permissions: Array<{ id: string; action: PermissionAction; allowed: boolean }>; _count?: { users: number } }

export interface UserRow {
  id: string; email: string; fullName: string; active: boolean;
  lastLoginAt: string | null;
  role: { id: string; name: string; isSystemManager: boolean };
  userStores: Array<{ storeId: string }>;
}
