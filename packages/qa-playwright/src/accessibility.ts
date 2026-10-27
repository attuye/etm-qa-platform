import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, type TestInfo } from '@playwright/test';

export const WCAG_21_AA_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

export interface A11yOptions {
  include?: string;
  exclude?: string[];
  disableRules?: string[];
}

type AxeResults = Awaited<ReturnType<AxeBuilder['analyze']>>;
export type A11yViolation = AxeResults['violations'][number];

export function formatViolations(violations: A11yViolation[]): string {
  return violations
    .map((violation) => {
      const nodes = violation.nodes
        .slice(0, 5)
        .map((node) => `    - ${node.target.join(' ')}: ${(node.failureSummary ?? '').replace(/\n/g, ' ')}`)
        .join('\n');
      const more = violation.nodes.length > 5 ? `\n    ... and ${violation.nodes.length - 5} more` : '';
      return `[${violation.impact ?? 'unknown'}] ${violation.id}: ${violation.help}\n  ${violation.helpUrl}\n${nodes}${more}`;
    })
    .join('\n\n');
}

export async function scanAccessibility(
  page: Page,
  testInfo: TestInfo,
  options: A11yOptions = {},
): Promise<A11yViolation[]> {
  let builder = new AxeBuilder({ page }).withTags(WCAG_21_AA_TAGS);
  if (options.include) {
    builder = builder.include(options.include);
  }
  for (const selector of options.exclude ?? []) {
    builder = builder.exclude(selector);
  }
  if (options.disableRules && options.disableRules.length > 0) {
    builder = builder.disableRules(options.disableRules);
  }

  const results = await builder.analyze();
  await testInfo.attach(`accessibility-scan-${testInfo.attachments.length + 1}`, {
    body: JSON.stringify(results, null, 2),
    contentType: 'application/json',
  });
  return results.violations;
}

export async function expectAccessible(
  page: Page,
  testInfo: TestInfo,
  options: A11yOptions = {},
): Promise<void> {
  const violations = await scanAccessibility(page, testInfo, options);
  expect(
    violations,
    `Accessibility violations on ${page.url()}:\n\n${formatViolations(violations)}`,
  ).toHaveLength(0);
}