import type { Locator, Page } from '@playwright/test';

export interface OrderFormInput {
  product: string;
  quantity: number;
  unitPrice: string;
}

export class NewOrderPage {
  readonly product: Locator;
  readonly quantity: Locator;
  readonly unitPrice: Locator;
  readonly estimate: Locator;
  readonly submit: Locator;
  readonly error: Locator;
  readonly success: Locator;
  readonly placeAnother: Locator;

  constructor(private readonly page: Page) {
    const main = page.getByRole('main');
    this.product = main.getByLabel('Product', { exact: true });
    this.quantity = main.getByLabel('Quantity', { exact: true });
    this.unitPrice = main.getByLabel('Unit price (USD)', { exact: true });
    this.estimate = main.locator('output');
    this.submit = main.getByRole('button', { name: 'Place order' });
    this.error = main.getByRole('alert');
    // this.success = main.getByRole('status');
    this.success = main.getByRole('status').filter({ hasText: 'ordered.' });
    this.placeAnother = main.getByRole('button', { name: 'Place another order' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/orders/new');
  }

  async fill(input: OrderFormInput): Promise<void> {
    await this.product.fill(input.product);
    await this.quantity.fill(String(input.quantity));
    await this.unitPrice.fill(input.unitPrice);
  }
}