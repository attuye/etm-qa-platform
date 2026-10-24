import type { Locator, Page } from '@playwright/test';

export class OrdersPage {
  readonly nav: Locator;
  readonly main: Locator;
  readonly emptyMessage: Locator;
  readonly table: Locator;

  constructor(private readonly page: Page) {
    this.nav = page.getByRole('navigation', { name: 'Main' });
    this.main = page.getByRole('main');
    this.emptyMessage = this.main.getByText('You have no orders yet.');
    this.table = this.main.getByRole('table', { name: 'Orders' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/orders');
  }

  heading(name: 'My orders' | 'All orders'): Locator {
    return this.main.getByRole('heading', { name });
  }

  rowFor(product: string): Locator {
    return this.table.getByRole('row').filter({ hasText: product });
  }

  async logOut(): Promise<void> {
    await this.nav.getByRole('button', { name: 'Log out' }).click();
  }
}