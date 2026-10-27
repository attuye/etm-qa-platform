import { appendFileSync, existsSync, readFileSync } from 'node:fs';

const [, , reportPath] = process.argv;

if (!reportPath || !existsSync(reportPath)) {
  console.log(`No Playwright JSON report found at ${reportPath}`);
  process.exit(0);
}

const report = JSON.parse(readFileSync(reportPath, 'utf8'));
const flaky = [];
const failed = [];

function walk(suite, titles) {
  for (const child of suite.suites ?? []) {
    walk(child, [...titles, child.title]);
  }
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      const entry = {
        name: [...titles, spec.title].filter(Boolean).join(' › '),
        location: `${spec.file}:${spec.line}`,
        attempts: test.results?.length ?? 0,
      };
      if (test.status === 'flaky') flaky.push(entry);
      if (test.status === 'unexpected') failed.push(entry);
    }
  }
}

for (const suite of report.suites ?? []) {
  walk(suite, [suite.title]);
}

const stats = report.stats ?? {};
const lines = [
  '## E2E results',
  '',
  '| Passed | Flaky | Failed | Skipped |',
  '|---|---|---|---|',
  `| ${stats.expected ?? 0} | ${stats.flaky ?? 0} | ${stats.unexpected ?? 0} | ${stats.skipped ?? 0} |`,
  '',
];

if (flaky.length > 0) {
  lines.push('### Flaky tests (passed only after a retry)', '');
  for (const t of flaky) lines.push(`- ${t.name} — \`${t.location}\` (${t.attempts} attempts)`);
  lines.push('');
}

if (failed.length > 0) {
  lines.push('### Failed tests', '');
  for (const t of failed) lines.push(`- ${t.name} — \`${t.location}\``);
  lines.push('');
}

const markdown = lines.join('\n');
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
} else {
  console.log(markdown);
}

for (const t of flaky) {
  console.log(`::warning title=Flaky test::${t.name} (${t.location}, ${t.attempts} attempts)`);
}