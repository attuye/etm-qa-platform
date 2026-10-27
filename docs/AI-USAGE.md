# AI usage log

## Session: New order page exploration (Day 6c)
- Tool: <AI client> with Playwright MCP (@playwright/mcp, --isolated)
- Environment: local, test account qa-mcp-1@example.com (no admin access given)

### Exploration
- Prompt: explore /orders/new as a tester; report observations, issues and ranked ideas; no code.
- Output: <N> ideas. Kept 2, <N> already covered, <N> low priority, 1 known finding.
- New gaps chosen: "Place another order" reset; 3-decimal price rounding.

### Draftings
- Prompt: one test for "Place another order", with our framework rules; no file edits.
- Accepted: flow, fixtures, page object use, unique products, non-default first quantity (2)
  so the reset check is meaningful, success checks naming each product.
- Changed:
  - Used a locator that did not exist (form.anotherOrder); added placeAnother to NewOrderPage.
  - arrayContaining allowed extra or duplicate orders; replaced with an exact sorted list.
  - Added a total check for the second order.
- Verification: typecheck, --repeat-each=3, mutation (removed setProduct('') reset): failed as expected.