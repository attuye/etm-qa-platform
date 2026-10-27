import { orderData, userData } from '@etm/qa-data';
import { expect, test } from '@etm/qa-playwright';
import { AdminOrdersPage } from './pages/admin-orders.page';
import { LoginPage, RegisterPage } from './pages/auth.pages';
import { NewOrderPage } from './pages/new-order.page';
import { OrdersPage } from './pages/orders.page';

test.describe('Accessibility: WCAG 2.1 AA automated checks', () => {
  test('login page, empty and with an error', async ({ page, checkAccessibility }) => {
    const login = new LoginPage(page);

    await login.goto();
    await expect(login.heading).toBeVisible();
    await checkAccessibility(page);

    await login.login('nobody@example.com', 'Wrong-Passw0rd!');
    await expect(login.error).toBeVisible();
    await checkAccessibility(page);
  });

  test('register page with a validation error', async ({ page, checkAccessibility }) => {
    const register = new RegisterPage(page);

    await register.goto();
    await register.register(userData.credentials().email, userData.password.tooShort);

    await expect(register.error).toBeVisible();
    await checkAccessibility(page);
  });

  test('orders page, empty and with orders', async ({ openAs, customer, checkAccessibility }) => {
    const page = await openAs(customer);
    const orders = new OrdersPage(page);

    await orders.goto();
    await expect(orders.emptyMessage).toBeVisible();
    await checkAccessibility(page);

    await customer.orders.create(orderData.valid());
    await page.reload();
    await expect(orders.table).toBeVisible();
    await checkAccessibility(page);
  });

  test('new order form: empty, with an error, and after success', async ({
    openAs,
    customer,
    checkAccessibility,
  }) => {
    const page = await openAs(customer);
    const form = new NewOrderPage(page);

    await form.goto();
    await expect(form.submit).toBeVisible();
    await checkAccessibility(page);

    await form.fill({ product: 'Lamp', quantity: 0, unitPrice: '10' });
    await form.submit.click();
    await expect(form.error).toBeVisible();
    await checkAccessibility(page);

    await form.fill({ product: 'Lamp', quantity: 1, unitPrice: '10' });
    await form.submit.click();
    await expect(form.success).toBeVisible();
    await checkAccessibility(page);
  });

  test('admin order management', async ({ openAs, customer, admin, checkAccessibility }) => {
    test.slow();
    await customer.orders.create(orderData.valid());
    const manage = new AdminOrdersPage(await openAs(admin));

    await manage.goto();
    await expect(manage.table).toBeVisible();
    await checkAccessibility(manage.table.page());
  });
});