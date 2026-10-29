import * as Crypto from 'expo-crypto';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:3001/api').replace(/\/+$/, '');

interface Order {
  id: string;
  product: string;
  quantity: number;
  totalCents: number;
  status: string;
}

type Screen = 'orders' | 'new-order';

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

async function api<T>(
  path: string,
  options: { method?: string; token?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...options.headers,
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  const data: unknown = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    const message = (data as { message?: unknown } | undefined)?.message;
    throw new Error(
      Array.isArray(message)
        ? message.join(', ')
        : typeof message === 'string'
          ? message
          : `Request failed (${res.status})`,
    );
  }
  return data as T;
}

function Button(props: { label: string; testID: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      testID={props.testID}
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityState={{ disabled: Boolean(props.disabled) }}
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }) => [styles.button, (pressed || props.disabled) && styles.buttonDim]}
    >
      <Text style={styles.buttonText}>{props.label}</Text>
    </Pressable>
  );
}

function Field(props: {
  label: string;
  testID: string;
  value: string;
  onChangeText: (value: string) => void;
  secure?: boolean;
  keyboardType?: 'default' | 'email-address' | 'number-pad' | 'decimal-pad';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        testID={props.testID}
        accessibilityLabel={props.label}
        value={props.value}
        onChangeText={props.onChangeText}
        secureTextEntry={props.secure}
        keyboardType={props.keyboardType ?? 'default'}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
      />
    </View>
  );
}

function ErrorText({ message, testID }: { message: string | null; testID: string }) {
  if (!message) {
    return null;
  }
  return (
    <Text testID={testID} accessibilityRole="alert" style={styles.error}>
      {message}
    </Text>
  );
}

function LoginScreen({ onLoggedIn }: { onLoggedIn: (token: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const { accessToken } = await api<{ accessToken: string }>('/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      onLoggedIn(accessToken);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View>
      <Text accessibilityRole="header" style={styles.title}>
        Log in
      </Text>
      <Field label="Email" testID="email-input" value={email} onChangeText={setEmail} keyboardType="email-address" />
      <Field label="Password" testID="password-input" value={password} onChangeText={setPassword} secure />
      <ErrorText testID="login-error" message={error} />
      <Button label={busy ? 'Logging in...' : 'Log in'} testID="login-button" onPress={submit} disabled={busy} />
    </View>
  );
}

function OrdersScreen(props: { token: string; onNewOrder: () => void; onLogout: () => void }) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setOrders(await api<Order[]>('/orders', { token: props.token }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load orders.');
    }
  }, [props.token]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.flex}>
      <Text accessibilityRole="header" style={styles.title}>
        My orders
      </Text>
      <ErrorText testID="orders-error" message={error} />
      {orders === null && !error && <ActivityIndicator testID="orders-loading" />}
      {orders?.length === 0 && <Text testID="orders-empty">You have no orders yet.</Text>}
      {orders && orders.length > 0 && (
        <FlatList
          testID="orders-list"
          data={orders}
          keyExtractor={(order) => order.id}
          renderItem={({ item }) => (
            <View testID={`order-${item.id}`} style={styles.row} accessible>
              <Text style={styles.rowTitle}>{item.product}</Text>
              <Text>
                {item.quantity} x · {formatCents(item.totalCents)} · {item.status}
              </Text>
            </View>
          )}
        />
      )}
      <Button label="New order" testID="new-order-button" onPress={props.onNewOrder} />
      <Button label="Log out" testID="logout-button" onPress={props.onLogout} />
    </View>
  );
}

function NewOrderScreen(props: { token: string; onDone: () => void }) {
  const [product, setProduct] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [key, setKey] = useState(() => Crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Order | null>(null);
  const inFlight = useRef(false);

  function edit(setter: (value: string) => void) {
    return (value: string) => {
      setter(value);
      setKey(Crypto.randomUUID());
    };
  }

  async function submit() {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    setError(null);
    setBusy(true);
    try {
      const order = await api<Order>('/orders', {
        method: 'POST',
        token: props.token,
        headers: { 'Idempotency-Key': key },
        body: {
          product,
          quantity: Number(quantity),
          unitPriceCents: Math.round(Number(unitPrice) * 100),
        },
      });
      setCreated(order);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not place the order.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  if (created) {
    return (
      <View>
        <Text accessibilityRole="header" style={styles.title}>
          Order placed
        </Text>
        <Text testID="order-success" accessibilityLiveRegion="polite">
          {created.quantity} x {created.product} ordered. Total {formatCents(created.totalCents)}.
        </Text>
        <Button label="View my orders" testID="view-orders-button" onPress={props.onDone} />
      </View>
    );
  }

  return (
    <View>
      <Text accessibilityRole="header" style={styles.title}>
        New order
      </Text>
      <Field label="Product" testID="product-input" value={product} onChangeText={edit(setProduct)} />
      <Field
        label="Quantity"
        testID="quantity-input"
        value={quantity}
        onChangeText={edit(setQuantity)}
        keyboardType="number-pad"
      />
      <Field
        label="Unit price (USD)"
        testID="unit-price-input"
        value={unitPrice}
        onChangeText={edit(setUnitPrice)}
        keyboardType="decimal-pad"
      />
      <ErrorText testID="order-error" message={error} />
      <Button label={busy ? 'Placing order...' : 'Place order'} testID="place-order-button" onPress={submit} disabled={busy} />
      <Button label="Cancel" testID="cancel-order-button" onPress={props.onDone} />
    </View>
  );
}

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>('orders');

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      {!token ? (
        <LoginScreen
          onLoggedIn={(newToken) => {
            setToken(newToken);
            setScreen('orders');
          }}
        />
      ) : screen === 'orders' ? (
        <OrdersScreen token={token} onNewOrder={() => setScreen('new-order')} onLogout={() => setToken(null)} />
      ) : (
        <NewOrderScreen token={token} onDone={() => setScreen('orders')} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 56, paddingHorizontal: 20, backgroundColor: '#f7f9fb' },
  flex: { flex: 1 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 16, color: '#1f2933' },
  field: { marginBottom: 12 },
  label: { fontWeight: '600', marginBottom: 4, color: '#1f2933' },
  input: {
    borderWidth: 1,
    borderColor: '#d9e2ec',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  button: { backgroundColor: '#1f4e79', borderRadius: 6, padding: 12, marginTop: 10, alignItems: 'center' },
  buttonDim: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '600' },
  error: { color: '#b42318', backgroundColor: '#fef3f2', padding: 8, borderRadius: 6, marginBottom: 8 },
  row: { backgroundColor: '#fff', padding: 12, borderRadius: 6, marginBottom: 8, borderWidth: 1, borderColor: '#d9e2ec' },
  rowTitle: { fontWeight: '600' },
});