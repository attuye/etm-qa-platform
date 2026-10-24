'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ApiRequestError, apiFetch } from '../../lib/api';
import { useAuth } from '../../lib/auth';

export default function RegisterPage() {
    const { login } = useAuth();
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    async function onSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        setSubmitting(true);
        try {
            await apiFetch('/auth/register', { method: 'POST', body: { email, password } });
            await login(email, password);
            router.push('/orders');
        } catch (e) {
            setError(e instanceof ApiRequestError ? e.message : 'Something went wrong. Please try again.');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <section className="card">
            <h1>Create an account</h1>
            <form onSubmit={onSubmit} noValidate>
                <label htmlFor="email">Email</label>
                <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />

                <label htmlFor="password">Password</label>
                <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    aria-describedby="password-hint"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
                <p id="password-hint" className="hint">
                    8 to 72 characters.
                </p>

                {error && (
                    <p role="alert" className="error">
                        {error}
                    </p>
                )}

                <button type="submit" disabled={submitting}>
                    {submitting ? 'Creating account...' : 'Create account'}
                </button>
            </form>
            <p>
                Already registered? <Link href="/login">Log in</Link>
            </p>
        </section>
    );
}