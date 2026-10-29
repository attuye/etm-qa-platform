// Registers a fresh customer through the API and shares the credentials with the flow.
const email = `qa-mobile-${Date.now()}-${Math.floor(Math.random() * 1000000)}@example.com`;
const password = 'Passw0rd!Mobile';

const response = http.post(`${API_URL}/auth/register`, {
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: email, password: password }),
});

if (response.status !== 201) {
  throw new Error(`Register failed: ${response.status} ${response.body}`);
}

output.customer = { email: email, password: password };