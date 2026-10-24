import type { Locator, Page } from '@playwright/test';

export class LoginPage {
  readonly heading: Locator;
  readonly email: Locator;
  readonly password: Locator;
  readonly submit: Locator;
  readonly error: Locator;

  constructor(private readonly page: Page) {
    const main = page.getByRole('main');
    this.heading = main.getByRole('heading', { name: 'Log in' });
    this.email = main.getByLabel('Email', { exact: true });
    this.password = main.getByLabel('Password', { exact: true });
    this.submit = main.getByRole('button', { name: 'Log in' });
    this.error = main.getByRole('alert');
  }

  async goto(): Promise<void> {
    await this.page.goto('/login');
  }

  async login(email: string, password: string): Promise<void> {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
  }
}

export class RegisterPage {
  readonly email: Locator;
  readonly password: Locator;
  readonly submit: Locator;
  readonly error: Locator;

  constructor(private readonly page: Page) {
    const main = page.getByRole('main');
    this.email = main.getByLabel('Email', { exact: true });
    this.password = main.getByLabel('Password', { exact: true });
    this.submit = main.getByRole('button', { name: 'Create account' });
    this.error = main.getByRole('alert');
  }

  async goto(): Promise<void> {
    await this.page.goto('/register');
  }

  async register(email: string, password: string): Promise<void> {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
  }
}