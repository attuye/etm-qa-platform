// Logs in through the API and checks the customer's orders.
const login = http.post(`${API_URL}/auth/login`, {
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
if (login.status !== 200) {
  throw new Error(`Login failed: ${login.status} ${login.body}`);
}

const token = json(login.body).accessToken;
const response = http.get(`${API_URL}/orders`, {
  headers: { Authorization: `Bearer ${token}` },
});
const orders = json(response.body);

if (orders.length !== Number(EXPECTED_COUNT)) {
  throw new Error(`Expected ${EXPECTED_COUNT} order(s), found ${orders.length}`);
}
if (PRODUCT && !orders.some((order) => order.product === PRODUCT)) {
  throw new Error(`No order for product "${PRODUCT}"`);
}