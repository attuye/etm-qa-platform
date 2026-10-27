import http from 'k6/http';
import { check, fail, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const BASE_URL = (__ENV.API_BASE_URL || 'http://localhost:3001/api').replace(/\/+$/, '');
const ADMIN_EMAIL = __ENV.ADMIN_EMAIL;
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD;
const PROFILE = __ENV.PROFILE || 'smoke';
const CUSTOMER_COUNT = 10;
const JSON_HEADERS = { 'Content-Type': 'application/json' };

const customerProfiles = {
  smoke: { executor: 'constant-vus', vus: 1, duration: '30s' },
  load: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '30s', target: 10 },
      { duration: '1m', target: 10 },
      { duration: '30s', target: 0 },
    ],
    gracefulRampDown: '10s',
  },
  stress: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '30s', target: 10 },
      { duration: '1m', target: 30 },
      { duration: '1m', target: 60 },
      { duration: '30s', target: 0 },
    ],
    gracefulRampDown: '10s',
  },
};

if (!customerProfiles[PROFILE]) {
  throw new Error(`Unknown PROFILE "${PROFILE}". Use smoke, load or stress.`);
}

const adminListSize = new Trend('admin_list_size');

export const options = {
  scenarios: {
    customers: { ...customerProfiles[PROFILE], exec: 'customerJourney' },
    admin: {
      executor: 'constant-vus',
      vus: 1,
      duration: PROFILE === 'smoke' ? '30s' : '2m',
      exec: 'adminList',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
    'http_req_duration{name:list my orders}': ['p(95)<300'],
    'http_req_duration{name:create order}': ['p(95)<500'],
    'http_req_duration{name:get order}': ['p(95)<300'],
    'http_req_duration{name:replay order}': ['p(95)<300'],
    'http_req_duration{name:list all orders}': ['p(95)<1000'],
  },
};

function login(email, password) {
  const res = http.post(`${BASE_URL}/auth/login`, JSON.stringify({ email, password }), {
    headers: JSON_HEADERS,
  });
  if (res.status !== 200) {
    fail(`Login failed for ${email}: ${res.status} ${res.body}`);
  }
  return res.json('accessToken');
}

export function setup() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    fail('Set ADMIN_EMAIL and ADMIN_PASSWORD (for example with -e ADMIN_EMAIL=...)');
  }

  const health = http.get(`${BASE_URL}/health`);
  if (health.status !== 200) {
    fail(`API is not healthy at ${BASE_URL}: ${health.status}`);
  }

  const runId = Date.now().toString(36);
  const customers = [];
  for (let i = 0; i < CUSTOMER_COUNT; i++) {
    const email = `qa-perf-${runId}-${i}@example.com`;
    const password = 'Passw0rd!Perf';
    const reg = http.post(`${BASE_URL}/auth/register`, JSON.stringify({ email, password }), {
      headers: JSON_HEADERS,
    });
    if (reg.status !== 201) {
      fail(`Register failed for ${email}: ${reg.status} ${reg.body}`);
    }
    customers.push(login(email, password));
  }

  return { customers, adminToken: login(ADMIN_EMAIL, ADMIN_PASSWORD) };
}

export function customerJourney(data) {
  const token = data.customers[(__VU - 1) % data.customers.length];
  const headers = { ...JSON_HEADERS, Authorization: `Bearer ${token}` };

  const list = http.get(`${BASE_URL}/orders`, { headers, tags: { name: 'list my orders' } });
  check(list, { 'list my orders: 200': (r) => r.status === 200 });

  const key = `perf-${__VU}-${__ITER}-${Date.now()}`;
  const body = JSON.stringify({
    product: 'Load test item',
    quantity: 1 + (__ITER % 5),
    unitPriceCents: 1999,
  });
  const created = http.post(`${BASE_URL}/orders`, body, {
    headers: { ...headers, 'Idempotency-Key': key },
    tags: { name: 'create order' },
  });
  const createdOk = check(created, { 'create order: 201': (r) => r.status === 201 });

  if (createdOk) {
    const id = created.json('id');

    const fetched = http.get(`${BASE_URL}/orders/${id}`, { headers, tags: { name: 'get order' } });
    check(fetched, {
      'get order: 200': (r) => r.status === 200,
      'get order: same id': (r) => r.json('id') === id,
    });

    if (__ITER % 10 === 0) {
      const replay = http.post(`${BASE_URL}/orders`, body, {
        headers: { ...headers, 'Idempotency-Key': key },
        tags: { name: 'replay order' },
      });
      check(replay, {
        'replay order: 200': (r) => r.status === 200,
        'replay order: same id': (r) => r.json('id') === id,
      });
    }
  }

  sleep(1);
}

export function adminList(data) {
  const res = http.get(`${BASE_URL}/orders`, {
    headers: { Authorization: `Bearer ${data.adminToken}` },
    tags: { name: 'list all orders' },
  });
  const ok = check(res, { 'list all orders: 200': (r) => r.status === 200 });
  if (ok) {
    adminListSize.add(res.json().length);
  }
  sleep(2);
}