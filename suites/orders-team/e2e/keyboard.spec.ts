import { orderData, uniqueId } from '@etm/qa-data';
import { expect, test } from '@etm/qa-playwright';
import { AdminOrdersPage } from './pages/admin-orders.page';
import { LoginPage } from './pages/auth.pages';
import { NewOrderPage } from './pages/new-order.page';

test.describe('Keyboard-only use', () => {
  test('logs in using only the keyboard', async ({ page, customer }) => {
    const login = new LoginPage(page);
    await login.goto();

    await login.email.focus();
    await page.keyboard.type(customer.email);
    await page.keyboard.press('Tab');
    await expect(login.password).toBeFocused();
    await page.keyboard.type(customer.credentials.password);
    await page.keyboard.press('Tab');
    await expect(login.submit).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/\/orders$/);
  });

  test('places an order using only the keyboard', async ({ openAs, customer }) => {
    const page = await openAs(customer);
    const form = new NewOrderPage(page);
    const product = `Keyboard lamp ${uniqueId('e2e')}`;
    await form.goto();

    await form.product.focus();
    await page.keyboard.type(product);
    await page.keyboard.press('Tab');
    await expect(form.quantity).toBeFocused();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type('2');
    await page.keyboard.press('Tab');
    await expect(form.unitPrice).toBeFocused();
    await page.keyboard.type('19.99');
    await page.keyboard.press('Tab');
    await expect(form.submit).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(form.success).toContainText('Total $39.98');
  });

  test('an admin can confirm an order with the keyboard', async ({ openAs, customer, admin }) => {
    test.slow();
    const product = `Keyboard chair ${uniqueId('e2e')}`;
    await customer.orders.create(orderData.valid({ product }));
    const manage = new AdminOrdersPage(await openAs(admin));
    await manage.goto();

    const confirm = manage.rowFor(product).getByRole('button', { name: 'Confirm' });
    await confirm.focus();
    await expect(confirm).toBeFocused();
    await manage.table.page().keyboard.press('Enter');

    await expect(manage.rowFor(product)).toContainText('confirmed');
  });
});