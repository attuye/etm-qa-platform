'use client';

import Link from 'next/link';
import { useRef, useState, type FormEvent } from 'react';
import { ApiRequestError, apiFetch } from '../../../lib/api';
import { useRequireAuth } from '../../../lib/auth';
import { formatCents } from '../../../lib/format';
import type { Order } from '../../../lib/types';

// function newKey(): string {
//     return crypto.randomUUID();
// }
function newKey(): string {
    if (typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6]! & 0x0f) | 0x40;
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function toCents(dollars: string): number {
    return Math.round(Number(dollars) * 100);
}

export default function NewOrderPage() {
    const { allowed, token, logout } = useRequireAuth('customer');
    const [product, setProduct] = useState('');
    const [quantity, setQuantity] = useState('1');
    const [unitPrice, setUnitPrice] = useState('');
    const [idempotencyKey, setIdempotencyKey] = useState(newKey);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [created, setCreated] = useState<Order | null>(null);
    const inFlight = useRef(false);

    function edit(setter: (value: string) => void) {
        return (value: string) => {
            setter(value);
            setIdempotencyKey(newKey());
        };
    }

    async function onSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (inFlight.current || !token) {
            return;
        }
        inFlight.current = true;
        setError(null);
        setSubmitting(true);
        try {
            const order = await apiFetch<Order>('/orders', {
                method: 'POST',
                token,
                headers: { 'Idempotency-Key': idempotencyKey },
                body: {
                    product,
                    quantity: Number(quantity),
                    unitPriceCents: toCents(unitPrice),
                },
            });
            setCreated(order);
        } catch (e) {
            if (e instanceof ApiRequestError && e.status === 401) {
                logout();
                return;
            }
            setError(
                e instanceof ApiRequestError
                    ? e.message
                    : 'Could not reach the server. Please try again; your order will not be placed twice.',
            );
        } finally {
            inFlight.current = false;
            setSubmitting(false);
        }
    }

    function startAnother() {
        setProduct('');
        setQuantity('1');
        setUnitPrice('');
        setIdempotencyKey(newKey());
        setCreated(null);
    }

    if (!allowed) {
        return null;
    }

    if (created) {
        return (
            <section className="card">
                <h1>Order placed</h1>
                <p role="status" className="success">
                    {created.quantity} x {created.product} ordered. Total {formatCents(created.totalCents)}.
                </p>
                <p>
                    <Link href="/orders">View my orders</Link>
                </p>
                <button type="button" onClick={startAnother}>
                    Place another order
                </button>
            </section>
        );
    }

    const estimate = Number(quantity) * toCents(unitPrice);

    return (
        <section className="card">
            <h1>New order</h1>
            <form onSubmit={onSubmit} noValidate>
                <label htmlFor="product">Product</label>
                <input
                    id="product"
                    name="product"
                    type="text"
                    required
                    value={product}
                    onChange={(e) => edit(setProduct)(e.target.value)}
                />

                <label htmlFor="quantity">Quantity</label>
                <input
                    id="quantity"
                    name="quantity"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={1000}
                    step={1}
                    required
                    value={quantity}
                    onChange={(e) => edit(setQuantity)(e.target.value)}
                />

                <label htmlFor="unit-price">Unit price (USD)</label>
                <input
                    id="unit-price"
                    name="unitPrice"
                    type="number"
                    inputMode="decimal"
                    min={0.01}
                    step={0.01}
                    aria-describedby="unit-price-hint"
                    required
                    value={unitPrice}
                    onChange={(e) => edit(setUnitPrice)(e.target.value)}
                />
                <p id="unit-price-hint" className="hint">
                    For example 19.99
                </p>

                {Number.isFinite(estimate) && estimate > 0 && (
                    <p>
                        Estimated total:{' '}
                        <output htmlFor="quantity unit-price" aria-live="polite">
                            {formatCents(estimate)}
                        </output>
                    </p>
                )}

                {error && (
                    <p role="alert" className="error">
                        {error}
                    </p>
                )}

                <button type="submit" disabled={submitting}>
                    {submitting ? 'Placing order...' : 'Place order'}
                </button>
            </form>
        </section>
    );
}