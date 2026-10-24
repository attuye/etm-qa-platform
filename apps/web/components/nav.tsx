'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth';

export function Nav() {
  const { ready, token, email, role, logout } = useAuth();
  const router = useRouter();

  if (!ready) {
    return <nav aria-label="Main" className="nav" />;
  }

  return (
    <nav aria-label="Main" className="nav">
      <Link href="/orders" className="brand">
        ETM Partner Shop
      </Link>
      {token ? (
        <>
          <Link href="/orders">Orders</Link>
          {role === 'customer' && <Link href="/orders/new">New order</Link>}
          {role === 'admin' && <Link href="/admin/orders">Admin</Link>}
          <span className="nav-user">{email}</span>
          <button
            type="button"
            onClick={() => {
              logout();
              router.push('/login');
            }}
          >
            Log out
          </button>
        </>
      ) : (
        <>
          <Link href="/login">Log in</Link>
          <Link href="/register">Register</Link>
        </>
      )}
    </nav>
  );
}