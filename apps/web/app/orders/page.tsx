'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ApiRequestError, apiFetch } from '../../lib/api';
import { useRequireAuth } from '../../lib/auth';
import { formatCents } from '../../lib/format';
import type { Order } from '../../lib/types';

export default function OrdersPage() {
    const { allowed, token, role, logout } = useRequireAuth();
    const [orders, setOrders] = useState<Order[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!allowed || !token) {
            return;
        }
        let cancelled = false;

        apiFetch<Order[]>('/orders', { token })
            .then((data) => {
                if (!cancelled) {
                    setOrders(data);
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
                setError(e instanceof Error ? e.message : 'Could not load orders.');
            });

        return () => {
            cancelled = true;
        };
    }, [allowed, token, logout]);

    if (!allowed) {
        return null;
    }

    return (
        <section>
            <div className="page-header">
                <h1>{role === 'admin' ? 'All orders' : 'My orders'}</h1>
                {role === 'customer' && (
                    <Link href="/orders/new" className="button">
                        New order
                    </Link>
                )}
            </div>

            {error && (
                <p role="alert" className="error">
                    {error}
                </p>
            )}
            {orders === null && !error && <p aria-busy="true">Loading orders...</p>}
            {orders?.length === 0 && <p>You have no orders yet.</p>}

            {orders && orders.length > 0 && (
                <table>
                    <caption className="visually-hidden">Orders</caption>
                    <thead>
                        <tr>
                            <th scope="col">Product</th>
                            <th scope="col">Quantity</th>
                            <th scope="col">Unit price</th>
                            <th scope="col">Total</th>
                            <th scope="col">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {orders.map((order) => (
                            <tr key={order.id} data-order-id={order.id}>
                                <td>{order.product}</td>
                                <td>{order.quantity}</td>
                                <td>{formatCents(order.unitPriceCents)}</td>
                                <td>{formatCents(order.totalCents)}</td>
                                <td>
                                    <span className="status">{order.status}</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </section>
    );
}