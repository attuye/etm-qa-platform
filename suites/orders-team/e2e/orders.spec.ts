import { orderData, uniqueId } from '@etm/qa-data';
import { expect, test } from '@etm/qa-playwright';
import { AdminOrdersPage } from './pages/admin-orders.page';
import { NewOrderPage } from './pages/new-order.page';
import { OrdersPage } from './pages/orders.page';

function uniqueProduct(name: string): string {
  return `${name} ${uniqueId('e2e')}`;
}

test.describe('Placing an order', () => {
  test('places an order and shows it with the server-calculated total', async ({ openAs, customer }) => {
    const page = await openAs(customer);
    const form = new NewOrderPage(page);
    const product = uniqueProduct('Desk lamp');

    await form.goto();
    await form.fill({ product, quantity: 2, unitPrice: '19.99' });
    await expect(form.estimate).toHaveText('$39.98');
    await form.submit.click();

    await expect(form.success).toContainText('Total $39.98');
    const orders = new OrdersPage(page);
    await orders.goto();
    await expect(orders.rowFor(product)).toContainText('$39.98');
    await expect(orders.rowFor(product)).toContainText('pending');
  });

  test('shows the API validation message and creates nothing', async ({ openAs, customer }) => {
    const page = await openAs(customer);
    const form = new NewOrderPage(page);

    await form.goto();
    await form.fill({ product: uniqueProduct('Lamp'), quantity: 0, unitPrice: '10' });
    await form.submit.click();

    await expect(form.error).toContainText(/quantity/i);
    expect(await customer.orders.list()).toHaveLength(0);
  });

  test('a double click sends one request and places one order', async ({ openAs, customer }) => {
    const page = await openAs(customer);
    const form = new NewOrderPage(page);
    let postRequests = 0;
    page.on('request', (request) => {
      if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/orders') {
        postRequests += 1;
      }
    });

    await form.goto();
    await form.fill({ product: uniqueProduct('Keyboard'), quantity: 1, unitPrice: '49.50' });
    await form.submit.dblclick();

    await expect(form.success).toBeVisible();
    expect(postRequests).toBe(1);
    expect(await customer.orders.list()).toHaveLength(1);
  });

  test('a retry after a lost response does not place a second order', async ({ openAs, customer }) => {
    const page = await openAs(customer);
    const form = new NewOrderPage(page);
    const keys: string[] = [];
    let loseNextResponse = true;

    await page.route('**/api/orders', async (route) => {
      const request = route.request();
      if (request.method() !== 'POST') {
        await route.continue();
        return;
      }
      keys.push(request.headers()['idempotency-key'] ?? '');
      if (loseNextResponse) {
        loseNextResponse = false;
        await route.fetch();
        await route.abort('failed');
        return;
      }
      await route.continue();
    });

    await form.goto();
    await form.fill({ product: uniqueProduct('Monitor'), quantity: 1, unitPrice: '150' });
    await form.submit.click();
    await expect(form.error).toContainText('Could not reach the server');

    await form.submit.click();

    await expect(form.success).toBeVisible();
    expect(keys).toHaveLength(2);
    expect(keys[1]).toBe(keys[0]);
    expect(await customer.orders.list()).toHaveLength(1);
  });

  test('works when crypto.randomUUID is unavailable', async ({ openAs, customer }) => {
    const page = await openAs(customer);
    await page.addInitScript(() => {
      Object.defineProperty(crypto, 'randomUUID', { value: undefined });
    });
    const form = new NewOrderPage(page);

    await form.goto();
    await form.fill({ product: uniqueProduct('Cable'), quantity: 3, unitPrice: '2.99' });
    await form.submit.click();

    await expect(form.success).toContainText('Total $8.97');
  });
});

test.describe('Managing orders as admin', () => {
  test('confirms and ships an order, and the customer sees the new status', async ({
    openAs,
    customer,
    admin,
  }) => {
    const product = uniqueProduct('Chair');
    await customer.orders.create(orderData.valid({ product }));
    const manage = new AdminOrdersPage(await openAs(admin));

    await manage.goto();
    await manage.act(product, 'Confirm');
    await expect(manage.success).toHaveText(`${product} is now confirmed.`);
    await manage.act(product, 'Ship');
    await expect(manage.rowFor(product)).toContainText('No actions');

    const orders = new OrdersPage(await openAs(customer));
    await orders.goto();
    await expect(orders.rowFor(product)).toContainText('shipped');
  });

  test('filters orders by status', async ({ openAs, customer, admin }) => {
    const product = uniqueProduct('Desk');
    await customer.orders.create(orderData.valid({ product }));
    const manage = new AdminOrdersPage(await openAs(admin));

    await manage.goto();
    await manage.filterBy('shipped');
    await expect(manage.rowFor(product)).toHaveCount(0);
    await manage.filterBy('pending');
    await expect(manage.rowFor(product)).toHaveCount(1);
  });

  test('rejects a stale action from a second admin window', async ({ openAs, customer, admin }) => {
    const product = uniqueProduct('Shelf');
    await customer.orders.create(orderData.valid({ product }));
    const first = new AdminOrdersPage(await openAs(admin));
    const second = new AdminOrdersPage(await openAs(admin));
    await first.goto();
    await second.goto();
    await expect(second.rowFor(product)).toBeVisible();

    await first.act(product, 'Cancel');
    await expect(first.rowFor(product)).toContainText('cancelled');
    await second.act(product, 'Confirm');

    await expect(second.error).toHaveText('Cannot change status from cancelled to confirmed');
  });

    test('resets the form when placing another order', async ({ openAs, customer }) => {
    const page = await openAs(customer);
    console.log('Customer email:', customer.email);
    console.log('Customer password:', customer.credentials.password);
    const form = new NewOrderPage(page);
    const firstProduct = uniqueProduct('Desk lamp');
    const secondProduct = uniqueProduct('Office chair');

    await form.goto();
    await form.fill({ product: firstProduct, quantity: 2, unitPrice: '19.99' });
    await form.submit.click();
    await expect(form.success).toContainText(firstProduct);

    await form.placeAnother.click();
    await expect(form.product).toHaveValue('');
    await expect(form.quantity).toHaveValue('1');
    await expect(form.unitPrice).toHaveValue('');

    await form.fill({ product: secondProduct, quantity: 3, unitPrice: '12.50' });
    await form.submit.click();
    await expect(form.success).toContainText(secondProduct);
    await expect(form.success).toContainText('Total $37.50');

    const products = (await customer.orders.list()).map((order) => order.product).sort();
    expect(products).toEqual([firstProduct, secondProduct].sort());
  });
});