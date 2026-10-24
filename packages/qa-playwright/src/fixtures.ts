import { expect, test as base, type BrowserContext, type Page } from '@playwright/test';
import { createApiClient, type ApiClient, type Session } from '@etm/qa-api-client';
import { loadConfig } from '@etm/qa-config';
import { createCustomer, seedData } from '@etm/qa-data';

export interface QaTestFixtures {
    customer: Session;
    admin: Session;
    openAs: (session: Session) => Promise<Page>;
    pageErrorLog: string[];
    failOnPageErrors: void;
}

export interface QaWorkerFixtures {
    api: ApiClient;
    authStorageKey: string;
    dataSeed: void;
}

function trackPageErrors(page: Page, log: string[]): void {
    page.on('pageerror', (error) => {
        log.push(`${page.url()}: ${error.name}: ${error.message}`);
    });
}

export const test = base.extend<QaTestFixtures, QaWorkerFixtures>({
    authStorageKey: ['etm.auth', { option: true, scope: 'worker' }],

    dataSeed: [
        async ({ }, use) => {
            const seed = Number(process.env.DATA_SEED);
            if (Number.isInteger(seed)) {
                seedData(seed);
            }
            await use();
        },
        { scope: 'worker', auto: true },
    ],

    api: [
        async ({ }, use) => {
            await use(createApiClient(loadConfig()));
        },
        { scope: 'worker' },
    ],

    customer: async ({ api }, use) => {
        await use(await createCustomer(api));
    },

    admin: async ({ api }, use) => {
        await use(api.asAdmin());
    },

    pageErrorLog: async ({ }, use) => {
        await use([]);
    },

    page: async ({ page, pageErrorLog }, use) => {
        trackPageErrors(page, pageErrorLog);
        await use(page);
    },

    openAs: async ({ browser, baseURL, authStorageKey, pageErrorLog }, use) => {
        const contexts: BrowserContext[] = [];

        await use(async (session) => {
            if (!baseURL) {
                throw new Error('baseURL is not set in playwright.config.ts');
            }
            const token = await session.getToken();
            const context = await browser.newContext({
                baseURL,
                storageState: {
                    cookies: [],
                    origins: [
                        {
                            origin: new URL(baseURL).origin,
                            localStorage: [
                                { name: authStorageKey, value: JSON.stringify({ token, email: session.email }) },
                            ],
                        },
                    ],
                },
            });
            contexts.push(context);
            const page = await context.newPage();
            trackPageErrors(page, pageErrorLog);
            return page;
        });

        await Promise.all(contexts.map((context) => context.close()));
    },

    failOnPageErrors: [
        async ({ pageErrorLog }, use) => {
            await use();
            if (pageErrorLog.length > 0) {
                throw new Error(`Uncaught errors in the page:\n${pageErrorLog.join('\n')}`);
            }
        },
        { auto: true },
    ],
});

export { expect };