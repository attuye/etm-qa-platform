export type Role = 'admin' | 'customer';

export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'cancelled';

export interface Order {
  id: string;
  customerId: string;
  product: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  status: OrderStatus;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
}