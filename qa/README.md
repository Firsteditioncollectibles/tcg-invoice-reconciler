# Automated QA

This directory is the source of truth for release-critical behaviour.

## Roles

### Developer
Builds or fixes the feature.

### QA gate
Proves the current branch still satisfies the critical flows.

A feature is not considered complete just because the developer says it is complete.

## Local run

```bash
npm install
npx playwright install chromium
npm run qa
```

## CI run

GitHub Actions runs:
1. dependency install
2. TypeScript checking
3. production build
4. Chromium Playwright tests
5. upload of Playwright report/test artifacts when a failure occurs

## Failure evidence

Playwright is configured to retain on failure:
- screenshot
- browser trace
- video
- HTML report

## Safety

Automated tests must use local/preview environments and synthetic fixtures.
They must not mutate production data or external seller/order systems.
