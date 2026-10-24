'use client';

import { useEffect, useState } from 'react';
import { ApiRequestError, apiFetch } from '../../../lib/api';
import { useRequireAuth } from '../../../lib/auth';
import { formatCents } from '../../../lib/format';
import { NEXT_ACTIONS, STATUSES } from '../../../lib/order-status';
import type { Order, OrderStatus } from '../../../lib/types';

type Filter = OrderStatus | 'all';

interface Message {
    kind: 'error' | 'success';
    text: string;
}

export default function AdminOrdersPage() {
    const { allowed, token, logout } = useRequireAuth('admin');
    const [orders, setOrders] = useState<Order[] | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [filter, setFilter] = useState<Filter>('all');
    const [busyId, setBusyId] = useState<string | null>(null);
    const [message, setMessage] = useState<Message | null>(null);

    useEffect(() => {
        if (!allowed || !token) {
            return;
        }
        let cancelled = false;

        apiFetch<Order[]>('/orders', { token })
            .then((data) => {
                if (!cancelled) {
                    setOrders([...data].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
                }
            })
            .catch((e: unknown) => {
                if (cancelled) {
                    return;
                }
                if (e instanceof ApiRequestError && e.status === 401) {
                    logout();
                    return;
                }
                setLoadError(e instanceof Error ? e.message : 'Could not load orders.');
            });

        return () => {
            cancelled = true;
        };
    }, [allowed, token, logout]);

    async function changeStatus(order: Order, status: OrderStatus) {
        if (!token) {
            return;
        }
        setBusyId(order.id);
        setMessage(null);
        try {
            const updated = await apiFetch<Order>(`/orders/${order.id}/status`, {
                method: 'PATCH',
                token,
                body: { status },
            });
            setOrders((current) => current?.map((o) => (o.id === updated.id ? updated : o)) ?? null);
            setMessage({ kind: 'success', text: `${updated.product} is now ${updated.status}.` });
        } catch (e) {
            if (e instanceof ApiRequestError && e.status === 401) {
                logout();
                return;
            }
            setMessage({ kind: 'error', text: e instanceof Error ? e.message : 'Could not update the order.' });
        } finally {
            setBusyId(null);
        }
    }

    if (!allowed) {
        return null;
    }

    const visible = orders?.filter((o) => filter === 'all' || o.status === filter) ?? [];

    return (
        <section>
            <h1>Manage orders</h1>

            <label htmlFor="status-filter">Filter by status</label>{' '}
            <select
                id="status-filter"
                value={filter}
                onChange={(e) => setFilter(e.target.value as Filter)}
            >
                <option value="all">All</option>
                {STATUSES.map((status) => (
                    <option key={status} value={status}>
                        {status}
                    </option>
                ))}
            </select>

            {message && (
                <p role={message.kind === 'error' ? 'alert' : 'status'} className={message.kind}>
                    {message.text}
                </p>
            )}
            {loadError && (
                <p role="alert" className="error">
                    {loadError}
                </p>
            )}
            {orders === null && !loadError && <p aria-busy="true">Loading orders...</p>}

            {orders && (
                <p>
                    Showing {visible.length} of {orders.length} orders
                </p>
            )}

            {visible.length > 0 && (
                <table>
                    <caption className="visually-hidden">Orders to manage</caption>
                    <thead>
                        <tr>
                            <th scope="col">Customer</th>
                            <th scope="col">Product</th>
                            <th scope="col">Total</th>
                            <th scope="col">Status</th>
                            <th scope="col">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visible.map((order) => (
                            <tr key={order.id} data-order-id={order.id}>
                                <td title={order.customerId}>{order.customerId.slice(0, 8)}</td>
                                <td>{order.product}</td>
                                <td>{formatCents(order.totalCents)}</td>
                                <td>
                                    <span className="status">{order.status}</span>
                                </td>
                                <td>
                                    {NEXT_ACTIONS[order.status].length === 0 ? (
                                        <span className="hint">No actions</span>
                                    ) : (
                                        NEXT_ACTIONS[order.status].map((action) => (
                                            <button
                                                key={action.status}
                                                type="button"
                                                disabled={busyId === order.id}
                                                onClick={() => changeStatus(order, action.status)}
                                                style={{ marginRight: 8 }}
                                            >
                                                {action.label}
                                            </button>
                                        ))
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </section>
    );
}