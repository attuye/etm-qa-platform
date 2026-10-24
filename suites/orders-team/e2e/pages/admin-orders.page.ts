import type { Locator, Page } from '@playwright/test';
import type { OrderStatus } from '@etm/qa-api-client';

export type AdminAction = 'Confirm' | 'Ship' | 'Cancel';

export class AdminOrdersPage {
  readonly filter: Locator;
  readonly table: Locator;
  readonly error: Locator;
  readonly success: Locator;

  constructor(private readonly page: Page) {
    const main = page.getByRole('main');
    this.filter = main.getByLabel('Filter by status');
    this.table = main.getByRole('table', { name: 'Orders to manage' });
    this.error = main.getByRole('alert');
    this.success = main.getByRole('status');
  }

  async goto(): Promise<void> {
    await this.page.goto('/admin/orders');
  }

  rowFor(product: string): Locator {
    return this.table.getByRole('row').filter({ hasText: product });
  }

  async act(product: string, action: AdminAction): Promise<void> {
    await this.rowFor(product).getByRole('button', { name: action }).click();
  }

  async filterBy(status: OrderStatus | 'all'): Promise<void> {
    await this.filter.selectOption(status);
  }
}