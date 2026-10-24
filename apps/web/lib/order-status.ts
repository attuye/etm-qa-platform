import type { OrderStatus } from './types';

export interface StatusAction {
    label: string;
    status: OrderStatus;
}

export const NEXT_ACTIONS: Record<OrderStatus, StatusAction[]> = {
    pending: [
        { label: 'Confirm', status: 'confirmed' },
        { label: 'Cancel', status: 'cancelled' },
    ],
    confirmed: [
        { label: 'Ship', status: 'shipped' },
        { label: 'Cancel', status: 'cancelled' },
    ],
    shipped: [],
    cancelled: [],
};

export const STATUSES: OrderStatus[] = ['pending', 'confirmed', 'shipped', 'cancelled'];