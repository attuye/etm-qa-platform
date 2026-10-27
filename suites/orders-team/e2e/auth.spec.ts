import { userData } from '@etm/qa-data';
import { expect, test } from '@etm/qa-playwright';
import { LoginPage, RegisterPage } from './pages/auth.pages';
import { OrdersPage } from './pages/orders.page';

test.describe('Authentication', () => {
  test('sends a logged-out visitor to the login page', async ({ page }) => {
    await page.goto('/orders');

    await expect(page).toHaveURL(/\/login$/);
    await expect(new LoginPage(page).heading).toBeVisible();
  });

  test('logs in through the form and shows the customer\'s orders', async ({ page, customer }) => {
    const login = new LoginPage(page);
    const orders = new OrdersPage(page);

    await login.goto();
    await login.login(customer.email, customer.credentials.password);

    await expect(page).toHaveURL(/\/orders$/);
    await expect(orders.heading('My orders')).toBeVisible();
    await expect(orders.nav).toContainText(customer.email);
  });

  test('shows an error for a wrong password and stays on the login page', async ({ page, customer }) => {
    const login = new LoginPage(page);

    await login.goto();
    await login.login(customer.email, 'Wrong-Passw0rd!');

    await expect(login.error).toHaveText('Invalid email or password');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('registers a new customer and logs them in', async ({ page }) => {
    const register = new RegisterPage(page);
    const orders = new OrdersPage(page);
    const credentials = userData.credentials();

    await register.goto();
    await register.register(credentials.email, credentials.password);

    await expect(page).toHaveURL(/\/orders$/);
    await expect(orders.emptyMessage).toBeVisible();
  });

  test('rejects a registration with an email that is already used', async ({ page, customer }) => {
    const register = new RegisterPage(page);

    await register.goto();
    await register.register(customer.email, userData.credentials().password);

    await expect(register.error).toHaveText('Email is already registered');
  });

  test('shows the API validation message for a short password', async ({ page }) => {
    const register = new RegisterPage(page);

    await register.goto();
    await register.register(userData.credentials().email, userData.password.tooShort);

    await expect(register.error).toContainText(/password/i);
    await expect(page).toHaveURL(/\/register$/);
  });

  test('logs out, clears the stored login and cannot go back', async ({ openAs, customer, authStorageKey }) => {
    const page = await openAs(customer);
    const orders = new OrdersPage(page);
    await orders.goto();
    await expect(orders.heading('My orders')).toBeVisible();

    await orders.logOut();

    await expect(page).toHaveURL(/\/login$/);
    expect(await page.evaluate((key) => localStorage.getItem(key), authStorageKey)).toBeNull();

    await page.goBack();
    await expect(page).not.toHaveURL(/\/orders$/);
    await expect(orders.heading('My orders')).toHaveCount(0);
  });

  test('keeps the customer logged in after a page reload', async ({ openAs, customer }) => {
    const page = await openAs(customer);
    const orders = new OrdersPage(page);
    await orders.goto();

    await page.reload();

    await expect(orders.heading('My orders')).toBeVisible();
  });
});

test.describe('Role-based navigation', () => {
  test('a customer is redirected away from the admin page', async ({ openAs, customer }) => {
    const page = await openAs(customer);

    await page.goto('/admin/orders');

    await expect(page).toHaveURL(/\/orders$/);
  });

  test('an admin sees the Admin link and no New order link', async ({ openAs, admin }) => {
    const page = await openAs(admin);
    const orders = new OrdersPage(page);

    await orders.goto();

    await expect(orders.heading('All orders')).toBeVisible();
    await expect(orders.nav.getByRole('link', { name: 'Admin' })).toBeVisible();
    await expect(orders.nav.getByRole('link', { name: 'New order' })).toHaveCount(0);
  });

  test('TEMPORARY: fails on the first attempt only', async ({}, testInfo) => {
  expect(testInfo.retry).toBeGreaterThan(0);
});
});